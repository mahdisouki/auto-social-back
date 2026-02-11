import { Request, Response } from 'express';
import { Post, IPost } from '@/models';
import { PostService } from '@/services/postService';
import { AIService } from '@/services/aiService';

export class PostController {
  /**
   * Create a new post
   */
  static async createPost(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { 
        caption, 
        platform, 
        scheduledAt, 
        images, 
        postType, 
        currency, 
        price, 
        productName, 
        description,
        backgroundType,
        backgroundColor,
        useModel,
        modelEthnicity,
        modelGender,
        addText
      } = req.body;

      const postData = {
        userId: req.user.userId,
        caption,
        platform,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        images: images || [],
        postType,
        currency,
        price,
        productName,
        description,
        backgroundType,
        backgroundColor,
        useModel,
        ...(useModel === 'yes' && { modelEthnicity, modelGender }), // Only include model details if model is used
        addText,
      };

      const post = await PostService.createPost(postData);

      res.status(201).json({
        success: true,
        message: 'Post created successfully',
        data: post,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Post creation failed',
      });
    }
  }

  /**
   * Get user's posts
   */
  static async getUserPosts(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { page = 1, limit = 10, status, platform, createdAt } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const filter: any = { userId: req.user.userId };
      if (status) filter.status = status;
      if (platform) filter.platform = platform;
      if (createdAt) filter.createdAt = { $gte: new Date(createdAt as string) };

      const posts = await Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'name email');

      const total = await Post.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          posts,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching posts',
      });
    }
  }

  /**
   * Get a specific post
   */
  static async getPost(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;

      const post = await Post.findOne({ 
        _id: id, 
        userId: req.user.userId 
      }).populate('userId', 'name email');

      if (!post) {
        res.status(404).json({
          success: false,
          message: 'Post not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: post,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching post',
      });
    }
  }

  /**
   * Update a post
   */
  static async updatePost(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const updateData = { ...req.body };

      // Remove fields that shouldn't be updated directly
      delete updateData.userId;
      delete updateData._id;
      delete updateData.createdAt;

      // Convert scheduledAt to Date if provided
      if (updateData.scheduledAt) {
        updateData.scheduledAt = new Date(updateData.scheduledAt);
      } else if (updateData.scheduledAt === null) {
        updateData.$unset = updateData.$unset || {};
        (updateData.$unset as Record<string, 1>).scheduledAt = 1;
        delete updateData.scheduledAt;
      }

      // Empty string for postType means clear it (enum doesn't allow '')
      if (updateData.postType === '') {
        delete updateData.postType;
        updateData.$unset = updateData.$unset || {};
        (updateData.$unset as Record<string, 1>).postType = 1;
      }

      const post = await Post.findOneAndUpdate(
        { _id: id, userId: req.user.userId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!post) {
        res.status(404).json({
          success: false,
          message: 'Post not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Post updated successfully',
        data: post,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Post update failed',
      });
    }
  }

  /**
   * Delete a post
   */
  static async deletePost(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;

      const post = await Post.findOneAndDelete({ 
        _id: id, 
        userId: req.user.userId 
      });

      if (!post) {
        res.status(404).json({
          success: false,
          message: 'Post not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Post deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting post',
      });
    }
  }

  /**
   * Schedule a post
   */
  static async schedulePost(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const { scheduledAt } = req.body;

      const post = await PostService.schedulePost(id, req.user.userId, new Date(scheduledAt));

      res.status(200).json({
        success: true,
        message: 'Post scheduled successfully',
        data: post,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Post scheduling failed',
      });
    }
  }

  /**
   * Publish a post immediately
   */
  static async publishPost(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const { targetPageIds } = req.body; // Optional: specific Facebook pages to post to

      const result = await PostService.publishPost(id, req.user.userId, targetPageIds);

      res.status(200).json({
        success: true,
        message: 'Post published successfully',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Post publishing failed',
      });
    }
  }

  /**
   * Generate AI caption with Pollinations API
   */
  static async generateAICaption(req: Request, res: Response): Promise<void> {
    try {
      const { 
        prompt, 
        platform = 'instagram',
        language = 'english',
        tone = 'friendly',
        audience = 'general',
        length = 'medium',
        count = 1
      } = req.body;

      if (!prompt) {
        res.status(400).json({
          success: false,
          message: 'Prompt is required',
        });
        return;
      }

      const caption = await AIService.generateCaption(prompt, platform, {
        language,
        tone,
        audience,
        length,
        count
      });

      res.json({
        success: true,
        data: {
          caption,
          prompt,
          platform,
          options: { language, tone, audience, length, count }
        },
      });
    } catch (error) {
      console.error('Error generating AI caption:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate caption',
      });
    }
  }

  /**
   * Generate Tunisian dialect caption
   */
  static async generateTunisianCaption(req: Request, res: Response): Promise<void> {
    try {
      const { 
        prompt, 
        platform = 'facebook',
        tone = 'friendly',
        audience = 'general'
      } = req.body;

      if (!prompt) {
        res.status(400).json({
          success: false,
          message: 'Prompt is required',
        });
        return;
      }

      const caption = await AIService.generateTunisianCaption(prompt, platform, tone, audience);

      res.json({
        success: true,
        data: {
          caption,
          prompt,
          platform,
          language: 'tunisian',
          tone,
          audience
        },
      });
    } catch (error) {
      console.error('Error generating Tunisian caption:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate Tunisian caption',
      });
    }
  }

  /**
   * Generate multiple caption options
   */
  static async generateMultipleCaptions(req: Request, res: Response): Promise<void> {
    try {
      const { 
        prompt, 
        platform = 'instagram',
        count = 3,
        language = 'english',
        tone = 'friendly',
        audience = 'general'
      } = req.body;

      if (!prompt) {
        res.status(400).json({
          success: false,
          message: 'Prompt is required',
        });
        return;
      }

      const captions = await AIService.generateMultipleCaptions(prompt, platform, count, {
        language,
        tone,
        audience
      });

      res.json({
        success: true,
        data: {
          captions,
          prompt,
          platform,
          count: captions.length,
          options: { language, tone, audience }
        },
      });
    } catch (error) {
      console.error('Error generating multiple captions:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate captions',
      });
    }
  }
}
