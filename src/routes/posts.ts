import { Router } from 'express';
import { PostController } from '@/controllers/postController';
import { authenticateToken } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Post CRUD operations
router.post('/', validate(schemas.createPost), PostController.createPost);
router.get('/', PostController.getUserPosts);
router.get('/:id', PostController.getPost);
router.put('/:id', validate(schemas.updatePost), PostController.updatePost);
router.delete('/:id', PostController.deletePost);

// Post scheduling and publishing
router.post('/:id/schedule', PostController.schedulePost);
router.post('/:id/publish', PostController.publishPost);

// AI Caption generation endpoints
router.post('/generate-caption', PostController.generateAICaption);
router.post('/generate-tunisian-caption', PostController.generateTunisianCaption);
router.post('/generate-multiple-captions', PostController.generateMultipleCaptions);

export default router;
