import { Router } from 'express';
import { ChatController } from '@/controllers/chatController';
import { authenticateToken } from '@/middleware/auth';
import { validate, schemas } from '@/middleware/validation';

const router = Router();

// All chat routes require authentication
router.use(authenticateToken);

// Chat response endpoint
router.post('/respond', 
  validate(schemas.chatResponse),
  ChatController.respond
);

// Get conversation history
router.get('/conversation', ChatController.getConversation);

// Get chat statistics
router.get('/stats', ChatController.getStats);

// Get recent messages for dashboard
router.get('/recent', ChatController.getRecentMessages);

export default router;