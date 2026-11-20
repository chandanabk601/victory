import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Enforce admin-only access for all routes in this router
router.use(authenticateToken, requireRole('admin'));

// Dashboard aggregated metrics
router.get('/dashboard-stats', AdminController.getDashboardStats);

// User management
router.get('/users', AdminController.listUsers);
router.patch('/users/:id/status', AdminController.toggleUserStatus);

// Manufacturer management
router.get('/manufacturers', AdminController.listManufacturers);
router.post('/manufacturers/:id/approve', AdminController.approveManufacturer);
router.post('/manufacturers/:id/reject', AdminController.rejectManufacturer);
router.post('/manufacturers/:id/suspend', AdminController.suspendManufacturer);

// Global batches and scans
router.get('/batches', AdminController.listAllBatches);
router.get('/scans', AdminController.listScanHistory);

export default router;
