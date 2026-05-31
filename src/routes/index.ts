import { Router } from 'express';
import authRoutes from './auth';
import postRoutes from './posts';
import chatRoutes from './chat';
import uploadRoutes from './upload';
import metaRoutes from './meta';
import adminRoutes from './admin';

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
router.use('/meta', metaRoutes);
router.use('/admin', adminRoutes);

export default router;
