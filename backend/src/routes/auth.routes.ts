import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

// Consumer user registration
router.post('/register', authRateLimiter, AuthController.registerUser);

// Manufacturer registration
router.post('/register-manufacturer', authRateLimiter, AuthController.registerManufacturer);

// Universal login (Admin, Manufacturer, Consumer)
router.post('/login', authRateLimiter, AuthController.login);

// Get current profile
router.get('/me', authenticateToken, AuthController.getCurrentUser);

export default router;
