import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getClient } from '../database/db';
import { config } from '../config';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import {
  registerUserSchema,
  loginSchema,
  registerManufacturerSchema,
} from '../validators';
import { JwtPayload } from '../types';

export class AuthController {
  /**
   * Register a standard consumer/citizen user
   */
  public static async registerUser(req: Request, res: Response): Promise<void> {
    try {
      const validated = registerUserSchema.parse(req.body);

      // Check if email already registered
      const existing = await query('SELECT id FROM users WHERE email = $1', [validated.email]);
      if (existing.rows.length > 0) {
        res.status(409).json({ success: false, error: 'Email address is already registered.' });
        return;
      }

      const passwordHash = await bcrypt.hash(validated.password, config.bcrypt.saltRounds);

      const insertRes = await query(
        `INSERT INTO users (email, password_hash, role, full_name)
         VALUES ($1, $2, 'user', $3)
         RETURNING id, email, role, full_name, created_at`,
        [validated.email, passwordHash, validated.full_name]
      );

      const user = insertRes.rows[0];
      const tokenPayload: JwtPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const token = jwt.sign(tokenPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn as any,
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully.',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            full_name: user.full_name,
          },
        },
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      res.status(500).json({ success: false, error: err.message || 'Registration failed.' });
    }
  }

  /**
   * Universal Login (User, Admin, Manufacturer)
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const validated = loginSchema.parse(req.body);

      const result = await query(
        `SELECT u.id, u.email, u.password_hash, u.role, u.full_name, u.is_active,
                m.id as manufacturer_id, m.company_name, m.license_number, m.approval_status
         FROM users u
         LEFT JOIN manufacturers m ON u.id = m.user_id
         WHERE u.email = $1`,
        [validated.email]
      );

      if (result.rows.length === 0) {
        res.status(401).json({ success: false, error: 'Invalid email or password.' });
        return;
      }

      const user = result.rows[0];

      if (!user.is_active) {
        res.status(403).json({ success: false, error: 'Your account has been deactivated. Please contact support.' });
        return;
      }

      const match = await bcrypt.compare(validated.password, user.password_hash);
      if (!match) {
        res.status(401).json({ success: false, error: 'Invalid email or password.' });
        return;
      }

      const tokenPayload: JwtPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        manufacturerId: user.manufacturer_id || undefined,
      };

      const token = jwt.sign(tokenPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn as any,
      });

      res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            full_name: user.full_name,
          },
          manufacturer: user.manufacturer_id ? {
            id: user.manufacturer_id,
            company_name: user.company_name,
            license_number: user.license_number,
            approval_status: user.approval_status,
          } : undefined,
        },
      });
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      res.status(500).json({ success: false, error: err.message || 'Login failed.' });
    }
  }

  /**
   * Register a new Pharmaceutical Manufacturer (starts with 'pending' status)
   */
  public static async registerManufacturer(req: Request, res: Response): Promise<void> {
    const client = await getClient();
    try {
      const validated = registerManufacturerSchema.parse(req.body);

      await client.query('BEGIN');

      // Check if user email or company license already exists
      const emailCheck = await client.query('SELECT id FROM users WHERE email = $1', [validated.email]);
      if (emailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(409).json({ success: false, error: 'Account email is already registered.' });
        return;
      }

      const licenseCheck = await client.query('SELECT id FROM manufacturers WHERE license_number = $1', [validated.license_number]);
      if (licenseCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(409).json({ success: false, error: 'A manufacturer with this drug license number is already registered.' });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(validated.password, config.bcrypt.saltRounds);

      // Create user entry with role = 'manufacturer'
      const userRes = await client.query(
        `INSERT INTO users (email, password_hash, role, full_name)
         VALUES ($1, $2, 'manufacturer', $3)
         RETURNING id, email, role, full_name, created_at`,
        [validated.email, passwordHash, validated.full_name]
      );
      const user = userRes.rows[0];

      // Create manufacturer profile with pending status
      const mfgRes = await client.query(
        `INSERT INTO manufacturers (
          user_id, company_name, license_number, contact_email, contact_phone, address, approval_status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING id, company_name, license_number, approval_status, created_at`,
        [
          user.id,
          validated.company_name,
          validated.license_number,
          validated.contact_email,
          validated.contact_phone || null,
          validated.address || null,
        ]
      );
      const mfg = mfgRes.rows[0];

      await client.query('COMMIT');

      const tokenPayload: JwtPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        manufacturerId: mfg.id,
      };

      const token = jwt.sign(tokenPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn as any,
      });

      res.status(201).json({
        success: true,
        message: 'Manufacturer registration submitted. Account is pending regulatory admin verification.',
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            full_name: user.full_name,
          },
          manufacturer: {
            id: mfg.id,
            company_name: mfg.company_name,
            license_number: mfg.license_number,
            approval_status: mfg.approval_status,
          },
        },
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, error: err.errors[0].message });
        return;
      }
      res.status(500).json({ success: false, error: err.message || 'Manufacturer registration failed.' });
    } finally {
      client.release();
    }
  }

  /**
   * Get Current Authenticated Profile
   */
  public static async getCurrentUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }

      const result = await query(
        `SELECT u.id, u.email, u.role, u.full_name, u.is_active, u.created_at,
                m.id as manufacturer_id, m.company_name, m.license_number, m.contact_email,
                m.contact_phone, m.address, m.approval_status, m.approved_at, m.rejection_reason
         FROM users u
         LEFT JOIN manufacturers m ON u.id = m.user_id
         WHERE u.id = $1`,
        [req.user.userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }

      const row = result.rows[0];

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: row.id,
            email: row.email,
            role: row.role,
            full_name: row.full_name,
            is_active: row.is_active,
            created_at: row.created_at,
          },
          manufacturer: row.manufacturer_id ? {
            id: row.manufacturer_id,
            company_name: row.company_name,
            license_number: row.license_number,
            contact_email: row.contact_email,
            contact_phone: row.contact_phone,
            address: row.address,
            approval_status: row.approval_status,
            approved_at: row.approved_at,
            rejection_reason: row.rejection_reason,
          } : undefined,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to fetch user profile.' });
    }
  }
}
