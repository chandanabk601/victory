import { z } from 'zod';

export const registerUserSchema = z.object({
  email: z.string().email('Valid email is required').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters').trim(),
});

export const loginSchema = z.object({
  email: z.string().email('Valid email is required').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export const registerManufacturerSchema = z.object({
  email: z.string().email('Valid user email is required').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  full_name: z.string().min(2, 'Contact representative name is required').trim(),
  company_name: z.string().min(2, 'Company legal name is required').trim(),
  license_number: z.string().min(3, 'Drug manufacturing license number is required').trim(),
  contact_email: z.string().email('Company official contact email is required').toLowerCase().trim(),
  contact_phone: z.string().optional(),
  address: z.string().optional(),
});

export const createMedicineSchema = z.object({
  medicine_name: z.string().min(2, 'Medicine generic name is required').trim(),
  brand_name: z.string().optional(),
  manufacturer_name: z.string().optional(),
  composition: z.string().optional(),
  strength: z.string().optional(),
  dosage_form: z.string().optional(),
  therapeutic_class: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

export const registerBatchSchema = z.object({
  medicine_id: z.string().uuid('Valid medicine ID (UUID) is required'),
  batch_number: z.string().min(1, 'Batch number is required').trim(),
  manufacturing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Manufacturing date must be in YYYY-MM-DD format'),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be in YYYY-MM-DD format'),
}).refine(
  (data) => new Date(data.expiry_date) > new Date(data.manufacturing_date),
  {
    message: 'Expiry date must be strictly after manufacturing date',
    path: ['expiry_date'],
  }
);

export const submitReportSchema = z.object({
  serial_id: z.string().optional(),
  batch_id: z.string().uuid().optional(),
  reporter_email: z.string().email().optional(),
  reason: z.enum([
    'Suspected counterfeit',
    'Expired medicine',
    'Damaged packaging',
    'Suspicious QR code',
    'Incorrect medicine details',
    'Other',
  ]),
  description: z.string().min(10, 'Please provide a detailed description (min 10 characters)'),
});

export const verifySerialSchema = z.object({
  serial_id: z.string().min(3, 'Valid serial ID is required').trim(),
});
