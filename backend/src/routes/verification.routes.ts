import { Router } from 'express';
import { VerificationController } from '../controllers/verification.controller';
import { optionalAuth, authenticateToken } from '../middleware/auth.middleware';
import { verificationRateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Public medicine verification endpoint (supports optional logged-in user identification)
router.post('/verify', verificationRateLimiter, optionalAuth, VerificationController.verify);

// Logged-in user personal scan history
router.get('/my-history', authenticateToken, VerificationController.getUserScanHistory);

export default router;
