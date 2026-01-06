import { Request, Response } from 'express';
import { Message, IMessage } from '@/models';
import { AIService } from '@/services/aiService';

export class ChatController {
  /**
   * Process incoming message and generate AI response
   */
  static async respond(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { message, context } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Message is required',
        });
        return;
      }

      // Save incoming message
      const incomingMessage = new Message({
        userId: req.user.userId,
        sender: 'client',
        content: message,
        aiResponse: false,
        platform: 'web', // Default platform
        timestamp: new Date(),
      });

      await incomingMessage.save();

      // Generate AI response
      const aiResponse = await AIService.generateChatbotResponse(message, context);

      // Save AI response
      const responseMessage = new Message({
        userId: req.user.userId,
        sender: 'page',
        content: aiResponse,
        aiResponse: true,
        platform: 'web',
        timestamp: new Date(),
      });

      await responseMessage.save();

      res.status(200).json({
        success: true,
        message: 'Response generated successfully',
        data: {
          incomingMessage: incomingMessage.toJSON(),
          response: responseMessage.toJSON(),
        },
      });
    } catch (error) {
      console.error('Error in chat response:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating chat response',
      });
    }
  }

  /**
   * Get conversation history
   */
  static async getConversation(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { page = 1, limit = 50 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const messages = await Message.find({ userId: req.user.userId })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'name email');

      const total = await Message.countDocuments({ userId: req.user.userId });

      res.status(200).json({
        success: true,
        data: {
          messages: messages.reverse(), // Reverse to show oldest first
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching conversation history',
      });
    }
  }

  /**
   * Get message statistics
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const userId = req.user.userId;

      // Get stats for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalMessages,
        aiResponses,
        clientMessages,
        todayMessages,
        thisWeekMessages,
        platformStats,
      ] = await Promise.all([
        // Total messages
        Message.countDocuments({ userId }),
        
        // AI responses
        Message.countDocuments({ userId, aiResponse: true }),
        
        // Client messages
        Message.countDocuments({ userId, aiResponse: false }),
        
        // Today's messages
        Message.countDocuments({
          userId,
          timestamp: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        }),
        
        // This week's messages
        Message.countDocuments({
          userId,
          timestamp: { $gte: thirtyDaysAgo },
        }),
        
        // Platform statistics
        Message.aggregate([
          { $match: { userId } },
          { $group: { _id: '$platform', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      ]);

      // Calculate response time (mock data for now)
      const avgResponseTime = 2.5; // seconds

      res.status(200).json({
        success: true,
        data: {
          totalMessages,
          aiResponses,
          clientMessages,
          todayMessages,
          thisWeekMessages,
          avgResponseTime,
          platformStats,
          responseRate: totalMessages > 0 ? (aiResponses / totalMessages) * 100 : 0,
        },
      });
    } catch (error) {
      console.error('Error fetching chat stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching chat statistics',
      });
    }
  }

  /**
   * Get recent messages for dashboard
   */
  static async getRecentMessages(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const limit = Number(req.query.limit) || 5;

      const messages = await Message.find({ userId: req.user.userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate('userId', 'name email');

      res.status(200).json({
        success: true,
        data: messages,
      });
    } catch (error) {
      console.error('Error fetching recent messages:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching recent messages',
      });
    }
  }
}