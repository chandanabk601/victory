import { Router } from 'express';
import multer from 'multer';
import { CdscoController } from '../controllers/cdsco.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// Public query endpoint for regulatory reference alerts
router.get('/', CdscoController.listAlerts);

// Admin-only management
router.post('/', authenticateToken, requireRole('admin'), CdscoController.createAlert);
router.patch('/:id/status', authenticateToken, requireRole('admin'), CdscoController.updateAlertStatus);
router.post('/import-csv', authenticateToken, requireRole('admin'), upload.single('file'), CdscoController.importCdscoCsv);

export default router;
