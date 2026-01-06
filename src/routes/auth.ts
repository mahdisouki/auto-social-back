import { Router } from 'express';
import { AuthController } from '@/controllers/authController';
import { authenticateToken } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';

const router = Router();

// Public routes
router.post('/register', validate(schemas.register), AuthController.register);
router.post('/login', validate(schemas.login), AuthController.login);

// Protected routes
router.get('/me', authenticateToken, AuthController.getProfile);
router.put('/profile', authenticateToken, AuthController.updateProfile);
router.put('/change-password', authenticateToken, AuthController.changePassword);

export default router;
