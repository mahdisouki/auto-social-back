import { Router } from 'express';
import authRoutes from './auth';
import postRoutes from './posts';
import chatRoutes from './chat';
import uploadRoutes from './upload';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AutoSocial API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/posts', postRoutes);
router.use('/chat', chatRoutes);
router.use('/upload', uploadRoutes);

export default router;
