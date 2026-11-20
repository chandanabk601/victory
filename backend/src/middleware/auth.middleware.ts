import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../database/db';
import { JwtPayload, UserRole } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload & {
    full_name?: string;
    approval_status?: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : null;

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Check if user exists and is active in database
    const userRes = await query(
      'SELECT id, email, role, full_name, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      res.status(403).json({
        success: false,
        error: 'User account is deactivated or no longer exists.',
      });
      return;
    }

    const dbUser = userRes.rows[0];

    // If manufacturer, check manufacturer approval status
    let mfgId = decoded.manufacturerId;
    let mfgApprovalStatus: string | undefined;

    if (dbUser.role === 'manufacturer') {
      const mfgRes = await query(
        'SELECT id, approval_status FROM manufacturers WHERE user_id = $1',
        [dbUser.id]
      );
      if (mfgRes.rows.length > 0) {
        mfgId = mfgRes.rows[0].id;
        mfgApprovalStatus = mfgRes.rows[0].approval_status;
      }
    }

    req.user = {
      userId: dbUser.id,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      full_name: dbUser.full_name,
      manufacturerId: mfgId,
      approval_status: mfgApprovalStatus,
    };

    next();
  } catch (err: any) {
    res.status(403).json({
      success: false,
      error: 'Invalid or expired authentication token.',
    });
    return;
  }
};

/**
   * Optional authentication for guest flows that can also link to logged in users.
   */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.split(' ')[1] 
    : null;

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
  } catch (err) {
    // Ignore invalid token in optional auth
  }

  next();
};

/**
   * Role-based access control middleware
   */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Access denied. Requires one of the following roles: [${allowedRoles.join(', ')}].`,
      });
      return;
    }

    next();
  };
};

/**
   * Middleware requiring approved manufacturer status
   */
export const requireApprovedManufacturer = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'manufacturer') {
    res.status(403).json({
      success: false,
      error: 'Access denied. Manufacturer role required.',
    });
    return;
  }

  if (req.user.approval_status !== 'approved') {
    res.status(403).json({
      success: false,
      error: `Manufacturer account is ${req.user.approval_status || 'pending'}. Only approved manufacturers can perform this action.`,
    });
    return;
  }

  next();
};
