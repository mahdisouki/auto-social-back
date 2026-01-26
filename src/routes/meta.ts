import { Router } from 'express';
import { MetaController } from '@/controllers/metaController';
import { authenticateToken } from '@/middleware/auth';

const router = Router();

// Facebook OAuth flow - callback doesn't require auth (called by Facebook)
router.get('/auth/facebook', authenticateToken, MetaController.initiateFacebookAuth);
router.get('/auth/facebook/callback', MetaController.handleFacebookCallback);

// Page management
router.get('/pages', MetaController.getConnectedPages);
router.get('/pages/refresh', MetaController.refreshPages);
router.delete('/pages/:pageId', MetaController.disconnectPage);

export default router;
