import { Router } from 'express';
import { PostController } from '@/controllers/postController';
import { authenticateToken } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Post CRUD operations
router.post('/', validate(schemas.createPost), PostController.createPost);
router.post('/generate', validate(schemas.generatePost), PostController.generateAndCreatePost); // Generate with Python AI and create
router.get('/', PostController.getUserPosts);
router.get('/:id', PostController.getPost);
router.put('/:id', validate(schemas.updatePost), PostController.updatePost);
router.delete('/:id', PostController.deletePost);

// Post scheduling and publishing
router.post('/:id/schedule', validate(schemas.schedulePost), PostController.schedulePost);
router.post('/:id/publish', PostController.publishPost);


export default router;
