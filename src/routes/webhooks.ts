import { Router } from 'express';
import { WebhookController } from '@/controllers/webhookController';

const router = Router();

/**
 * Webhook endpoint for n8n to send processed data back
 */
router.post('/n8n/:userId', WebhookController.handleN8nWebhook);

/**
 * Test webhook endpoint
 */
router.post('/test', WebhookController.testWebhook);

/**
 * Webhook health check
 */
router.get('/health', WebhookController.webhookHealth);

export default router;
