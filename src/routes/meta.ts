import { Router } from 'express';
import { MetaController } from '@/controllers/metaController';
import { authenticateToken } from '@/middleware/auth';

const router = Router();

// Facebook OAuth flow - callback doesn't require auth (called by Facebook)
router.get('/auth/facebook', authenticateToken, MetaController.initiateFacebookAuth);
router.get('/auth/facebook/callback', MetaController.handleFacebookCallback);

// Page management
router.get('/pages',authenticateToken, MetaController.getConnectedPages);
router.get('/pages/refresh',authenticateToken, MetaController.refreshPages);
router.delete('/pages/:pageId',authenticateToken, MetaController.disconnectPage);

export default router;
