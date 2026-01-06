import axios, { AxiosResponse } from 'axios';
import { config } from '@/config';
import { IPost, IMessage, IAutomation } from '@/models';

export interface N8nWebhookData {
  type: 'post_publish' | 'image_enhance' | 'chatbot_response' | 'automation_trigger';
  data: any;
  userId: string;
  timestamp: Date;
}

export class N8nService {
  private static baseUrl: string;
  private static apiKey: string;

  /**
   * Initialize n8n service
   */
  static initialize(): void {
    this.baseUrl = config.n8n.webhookUrl || '';
    this.apiKey = config.n8n.apiKey || '';

    if (!this.baseUrl) {
      console.warn('⚠️ n8n webhook URL not configured');
      return;
    }

    console.log('✅ n8n service initialized');
  }

  /**
   * Send post to n8n for publishing to social platforms
   */
  static async publishPost(post: IPost): Promise<void> {
    try {
      if (!this.baseUrl) {
        throw new Error('n8n webhook URL not configured');
      }

      const webhookData: N8nWebhookData = {
        type: 'post_publish',
        data: {
          postId: post._id,
          caption: post.caption,
          mediaUrl: post.mediaUrl,
          backgroundUrl: post.backgroundUrl,
          platform: post.platform,
          userId: post.userId,
        },
        userId: post.userId.toString(),
        timestamp: new Date(),
      };

      await this.sendWebhook(webhookData);
      console.log(`✅ Post ${post._id} sent to n8n for publishing`);
    } catch (error) {
      console.error('Error sending post to n8n:', error);
      throw new Error('Failed to send post to n8n');
    }
  }

  /**
   * Send image enhancement request to n8n
   */
  static async enhanceImage(postId: string, imageUrl: string, userId: string): Promise<void> {
    try {
      if (!this.baseUrl) {
        throw new Error('n8n webhook URL not configured');
      }

      const webhookData: N8nWebhookData = {
        type: 'image_enhance',
        data: {
          postId,
          imageUrl,
          userId,
        },
        userId,
        timestamp: new Date(),
      };

      await this.sendWebhook(webhookData);
      console.log(`✅ Image enhancement request sent to n8n for post ${postId}`);
    } catch (error) {
      console.error('Error sending image enhancement to n8n:', error);
      throw new Error('Failed to send image enhancement to n8n');
    }
  }

  /**
   * Send chatbot response to n8n
   */
  static async sendChatbotResponse(message: IMessage, response: string): Promise<void> {
    try {
      if (!this.baseUrl) {
        throw new Error('n8n webhook URL not configured');
      }

      const webhookData: N8nWebhookData = {
        type: 'chatbot_response',
        data: {
          originalMessage: {
            id: message._id,
            content: message.content,
            sender: message.sender,
            platform: message.platform,
            timestamp: message.timestamp,
          },
          aiResponse: response,
          userId: message.userId.toString(),
        },
        userId: message.userId.toString(),
        timestamp: new Date(),
      };

      await this.sendWebhook(webhookData);
      console.log(`✅ Chatbot response sent to n8n for message ${message._id}`);
    } catch (error) {
      console.error('Error sending chatbot response to n8n:', error);
      throw new Error('Failed to send chatbot response to n8n');
    }
  }

  /**
   * Trigger automation based on event
   */
  static async triggerAutomation(
    trigger: string,
    data: any,
    userId: string
  ): Promise<void> {
    try {
      if (!this.baseUrl) {
        throw new Error('n8n webhook URL not configured');
      }

      const webhookData: N8nWebhookData = {
        type: 'automation_trigger',
        data: {
          trigger,
          ...data,
        },
        userId,
        timestamp: new Date(),
      };

      await this.sendWebhook(webhookData);
      console.log(`✅ Automation triggered: ${trigger} for user ${userId}`);
    } catch (error) {
      console.error('Error triggering automation:', error);
      throw new Error('Failed to trigger automation');
    }
  }

  /**
   * Send webhook to n8n
   */
  private static async sendWebhook(data: N8nWebhookData): Promise<AxiosResponse> {
    try {
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await axios.post(this.baseUrl, data, {
        headers,
        timeout: 30000, // 30 seconds timeout
      });

      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('n8n webhook error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
      }
      throw error;
    }
  }

  /**
   * Test n8n connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      if (!this.baseUrl) {
        return false;
      }

      const testData: N8nWebhookData = {
        type: 'automation_trigger',
        data: {
          trigger: 'test_connection',
          message: 'Testing n8n connection',
        },
        userId: 'test',
        timestamp: new Date(),
      };

      await this.sendWebhook(testData);
      return true;
    } catch (error) {
      console.error('n8n connection test failed:', error);
      return false;
    }
  }

  /**
   * Get n8n workflow status
   */
  static async getWorkflowStatus(workflowId: string): Promise<any> {
    try {
      if (!this.baseUrl || !this.apiKey) {
        throw new Error('n8n configuration incomplete');
      }

      const response = await axios.get(`${this.baseUrl}/workflows/${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.error('Error getting workflow status:', error);
      throw new Error('Failed to get workflow status');
    }
  }

  /**
   * Execute n8n workflow manually
   */
  static async executeWorkflow(workflowId: string, data: any): Promise<any> {
    try {
      if (!this.baseUrl || !this.apiKey) {
        throw new Error('n8n configuration incomplete');
      }

      const response = await axios.post(
        `${this.baseUrl}/workflows/${workflowId}/execute`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw new Error('Failed to execute workflow');
    }
  }
}
