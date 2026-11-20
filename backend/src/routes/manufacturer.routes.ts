import { Router } from 'express';
import { ManufacturerController } from '../controllers/manufacturer.controller';
import { authenticateToken, requireRole, requireApprovedManufacturer } from '../middleware/auth.middleware';

const router = Router();

// Base protection: Must be authenticated as a manufacturer
router.use(authenticateToken, requireRole('manufacturer'));

// Manufacturer dashboard and profile status
router.get('/dashboard', ManufacturerController.getDashboard);

// Batch list
router.get('/batches', ManufacturerController.listMyBatches);

// Batch registration (Requires APPROVED status)
router.post('/batches', requireApprovedManufacturer, ManufacturerController.registerBatch);

// Batch revision (Requires APPROVED status)
router.put('/batches/:id/revise', requireApprovedManufacturer, ManufacturerController.reviseBatch);

// Download QR code PNG
router.get('/batches/:serialId/qr', ManufacturerController.downloadQrCode);

export default router;
