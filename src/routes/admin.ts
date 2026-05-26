import { Router } from 'express';
import { AdminController } from '@/controllers/adminController';
import { authenticateToken, requireAdmin } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

router.get('/users', validate(schemas.adminUsersQuery, 'query'), AdminController.listUsers);
router.get(
  '/users/:userId',
  validate(schemas.adminUserParams, 'params'),
  AdminController.getUser
);
router.patch(
  '/users/:userId',
  validate(schemas.adminUserParams, 'params'),
  validate(schemas.adminUpdateUser),
  AdminController.updateUser
);
router.delete(
  '/users/:userId',
  validate(schemas.adminUserParams, 'params'),
  AdminController.deleteUser
);

router.get('/posts', validate(schemas.adminPostsQuery, 'query'), AdminController.listPosts);
router.get(
  '/posts/:id',
  validate(schemas.adminPostParams, 'params'),
  AdminController.getPost
);
router.put(
  '/posts/:id',
  validate(schemas.adminPostParams, 'params'),
  validate(schemas.updatePost),
  AdminController.updatePost
);
router.delete(
  '/posts/:id',
  validate(schemas.adminPostParams, 'params'),
  AdminController.deletePost
);

export default router;
