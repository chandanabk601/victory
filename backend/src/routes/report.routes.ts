import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticateToken, requireRole, optionalAuth } from '../middleware/auth.middleware';

const router = Router();

// Submit report (logged-in user or guest with email)
router.post('/', optionalAuth, ReportController.submitReport);

// User's own reports
router.get('/my-reports', authenticateToken, ReportController.getMyReports);

// Admin-only review endpoints
router.get('/', authenticateToken, requireRole('admin'), ReportController.listReports);
router.patch('/:id/status', authenticateToken, requireRole('admin'), ReportController.updateReportStatus);

export default router;
