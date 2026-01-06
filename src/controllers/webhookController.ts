import { Request, Response } from 'express';
import { Post, IPost } from '@/models';
import { N8nService } from '@/services/n8nService';
import { JobScheduler } from '@/jobs/scheduler';

export class WebhookController {
  /**
   * Handle n8n webhook data for a specific user
   */
  static async handleN8nWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { type, data } = req.body;

      if (!type || !data) {
        res.status(400).json({
          success: false,
          message: 'Type and data are required',
        });
        return;
      }

      console.log(`📥 Received n8n webhook for user ${userId}:`, { type, data });

      switch (type) {
        case 'image_processed':
          await WebhookController.handleImageProcessed(userId, data);
          break;

        case 'post_published':
          await WebhookController.handlePostPublished(userId, data);
          break;

        case 'chatbot_delivered':
          await WebhookController.handleChatbotDelivered(userId, data);
          break;

        case 'automation_triggered':
          await WebhookController.handleAutomationTriggered(userId, data);
          break;

        default:
          console.warn(`Unknown webhook type: ${type}`);
          res.status(400).json({
            success: false,
            message: `Unknown webhook type: ${type}`,
          });
          return;
      }

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        data: { type, processed: true },
      });
    } catch (error) {
      console.error('Error processing n8n webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing webhook',
      });
    }
  }

  /**
   * Handle image processing completion
   */
  private static async handleImageProcessed(userId: string, data: any): Promise<void> {
    try {
      const { postId, processedImageUrl, backgroundUrl, status } = data;

      if (!postId) {
        throw new Error('Post ID is required for image processing');
      }

      const updateData: any = {};
      
      if (processedImageUrl) {
        updateData.mediaUrl = processedImageUrl;
      }
      
      if (backgroundUrl) {
        updateData.backgroundUrl = backgroundUrl;
      }

      if (status) {
        updateData.status = status;
      }

      const post = await Post.findOneAndUpdate(
        { _id: postId, userId },
        updateData,
        { new: true }
      );

      if (!post) {
        throw new Error(`Post ${postId} not found for user ${userId}`);
      }

      console.log(`✅ Image processed for post ${postId}:`, updateData);

      // If image processing is complete and post is ready, schedule it if needed
      if (status === 'ready' && post.scheduledAt) {
        await JobScheduler.schedulePost(post._id.toString(), post.scheduledAt);
      }
    } catch (error) {
      console.error('Error handling image processed:', error);
      throw error;
    }
  }

  /**
   * Handle post publishing completion
   */
  private static async handlePostPublished(userId: string, data: any): Promise<void> {
    try {
      const { postId, platform, publishedUrl, status, error } = data;

      if (!postId) {
        throw new Error('Post ID is required for post publishing');
      }

      const updateData: any = {
        status: status === 'success' ? 'posted' : 'failed',
        publishedAt: new Date(),
      };

      if (publishedUrl) {
        updateData.publishedUrl = publishedUrl;
      }

      if (error) {
        updateData.error = error;
      }

      const post = await Post.findOneAndUpdate(
        { _id: postId, userId },
        updateData,
        { new: true }
      );

      if (!post) {
        throw new Error(`Post ${postId} not found for user ${userId}`);
      }

      console.log(`✅ Post ${status} for post ${postId} on ${platform}:`, updateData);

      // Trigger automation if post was successfully published
      if (status === 'success') {
        await N8nService.triggerAutomation('post_published', {
          postId: post._id,
          platform,
          publishedUrl,
        }, userId);
      }
    } catch (error) {
      console.error('Error handling post published:', error);
      throw error;
    }
  }

  /**
   * Handle chatbot message delivery
   */
  private static async handleChatbotDelivered(userId: string, data: any): Promise<void> {
    try {
      const { messageId, platform, status, error } = data;

      console.log(`✅ Chatbot message ${status} for user ${userId} on ${platform}:`, {
        messageId,
        status,
        error,
      });

      // Update message status in database if needed
      // This would require a Message model update to track delivery status
      
      // Trigger automation for successful delivery
      if (status === 'delivered') {
        await N8nService.triggerAutomation('chatbot_delivered', {
          messageId,
          platform,
        }, userId);
      }
    } catch (error) {
      console.error('Error handling chatbot delivered:', error);
      throw error;
    }
  }

  /**
   * Handle automation trigger
   */
  private static async handleAutomationTriggered(userId: string, data: any): Promise<void> {
    try {
      const { trigger, metadata } = data;

      console.log(`🔄 Automation triggered for user ${userId}:`, { trigger, metadata });

      // Log automation trigger for analytics
      // This could be stored in a separate AutomationLog model
      
      // Trigger additional automations based on the trigger type
      switch (trigger) {
        case 'new_message':
          // Could trigger follow-up automations
          break;
        case 'post_published':
          // Could trigger social media monitoring
          break;
        default:
          console.log(`No specific handling for trigger: ${trigger}`);
      }
    } catch (error) {
      console.error('Error handling automation triggered:', error);
      throw error;
    }
  }

  /**
   * Test webhook endpoint
   */
  static async testWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { type = 'test', data = {} } = req.body;

      console.log('🧪 Test webhook received:', { type, data });

      res.status(200).json({
        success: true,
        message: 'Test webhook received successfully',
        data: {
          type,
          data,
          timestamp: new Date().toISOString(),
          server: 'AutoSocial API',
        },
      });
    } catch (error) {
      console.error('Error in test webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing test webhook',
      });
    }
  }

  /**
   * Health check for webhooks
   */
  static async webhookHealth(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        message: 'Webhook service is healthy',
        data: {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        },
      });
    } catch (error) {
      console.error('Error in webhook health check:', error);
      res.status(500).json({
        success: false,
        message: 'Webhook service health check failed',
      });
    }
  }
}
