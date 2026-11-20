import { Router } from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import manufacturerRoutes from './manufacturer.routes';
import medicineRoutes from './medicine.routes';
import verificationRoutes from './verification.routes';
import reportRoutes from './report.routes';
import cdscoRoutes from './cdsco.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/manufacturer', manufacturerRoutes);
router.use('/medicines', medicineRoutes);
router.use('/verification', verificationRoutes);
router.use('/reports', reportRoutes);
router.use('/cdsco', cdscoRoutes);

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'VICTORY Pharmaceutical Verification Engine',
    version: '1.0.0',
  });
});

export default router;
