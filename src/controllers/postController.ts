import { Request, Response } from 'express';
import { Post, IPost } from '@/models';
import { User } from '@/models/User';
import { PostService } from '@/services/postService';
import { AIService } from '@/services/aiService';
import { cloudinary } from '@/config/cloudinary';
import { config } from '@/config';
import axios from 'axios';
import FormData from 'form-data';

export class PostController {
  private static addOneHour(date: Date): Date {
    return new Date(date.getTime() + 60 * 60 * 1000);
  }
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
        updateData.scheduledAt = PostController.addOneHour(new Date(updateData.scheduledAt));
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
   * Get engagement for all published posts (cached; use ?sync=true to refresh from Meta)
   */
  static async getAllPostsEngagement(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const shouldSync = req.query.sync === 'true';
      const data = await PostService.getAllPostsEngagement(req.user.userId, shouldSync);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get posts engagement',
      });
    }
  }

  /**
   * Get post engagement, optionally syncing from Meta API
   */
  static async getPostEngagement(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { id } = req.params;
      const shouldSync = req.query.sync !== 'false';

      const post = shouldSync
        ? await PostService.syncPostEngagement(id, req.user.userId)
        : await Post.findOne({ _id: id, userId: req.user.userId });

      if (!post) {
        res.status(404).json({
          success: false,
          message: 'Post not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          postId: post._id,
          engagement: post.engagement || {
            likesCount: 0,
            commentsCount: 0,
            lastSyncedAt: null,
          },
          platformPosts: post.platformPosts || [],
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get post engagement',
      });
    }
  }

  /**
   * Generate post with AI and create it (calls Python AI service)
   */
  static async generateAndCreatePost(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const {
        imageBase64, // Original product image (base64)
        postType,
        currency,
        price,
        backgroundType,
        backgroundColor,
        useModel,
        modelType,
        modelEthnicity,
        modelGender,
        customModelImage, // base64 image for custom model
        sceneReference, // base64 image for scene reference
        addText,
        addPrice,
        generateCaption,
        captionLanguage,
      } = req.body;

      // Validate required fields
      if (!imageBase64) {
        res.status(400).json({
          success: false,
          message: 'Product image (imageBase64) is required',
        });
        return;
      }

      // Check credits for generation (1 credit per 3 images; admins bypass)
      const user = await User.findById(req.user!.userId);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      if (user.role !== 'admin') {
        const generationCount = user.generationCount ?? 0;
        const credits = user.credits ?? 5;

        // On 3rd generation we deduct 1 credit - ensure user has at least 1
        if (generationCount === 2 && credits < 1) {
          res.status(400).json({
            success: false,
            message: 'Insufficient credits. You need 1 credit for every 3 image generations.',
          });
          return;
        }
      }

      // Prepare form data for Python AI service
      console.log('🤖 Calling Python AI service at:', config.pythonAi.url);
      
      const formData = new FormData();
      
      // Convert base64 to buffer and add as file
      const imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      formData.append('file', imageBuffer, { filename: 'product.jpg', contentType: 'image/jpeg' });
      
      // Add all parameters
      formData.append('background_type', backgroundType || 'white');
      formData.append('background_color', backgroundColor || '#ffffff');
      formData.append('use_model', useModel || 'no');
      formData.append('model_type', modelType || 'ai');
      formData.append('model_ethnicity', modelEthnicity || '');
      formData.append('model_gender', modelGender || '');
      formData.append('add_text', addText || 'no');
      formData.append('add_price', addPrice || 'no');
      formData.append('price', price || '');
      formData.append('currency', currency || 'DT');
      formData.append('generate_caption', generateCaption || 'yes');
      formData.append('caption_language', captionLanguage || 'french');
      formData.append('post_type', postType || 'other');
      
      // Add custom model image if provided
      if (customModelImage) {
        const customModelBuffer = Buffer.from(customModelImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        formData.append('custom_model_image', customModelBuffer, { filename: 'model.jpg', contentType: 'image/jpeg' });
      }
      
      // Add scene reference image if provided
      if (sceneReference) {
        const sceneRefBuffer = Buffer.from(sceneReference.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        formData.append('scene_reference', sceneRefBuffer, { filename: 'scene.jpg', contentType: 'image/jpeg' });
      }

      try {
        // Call Python AI service
        const aiResponse = await axios.post(
          `${config.pythonAi.url}/edit-product`,
          formData,
          {
            headers: formData.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            timeout: 300000, // 5 minute timeout for AI generation
          }
        );

        const { image: generatedImageBase64, caption, language } = aiResponse.data;
        
        console.log('✅ AI service responded successfully');
        console.log('📝 Generated caption:', caption?.substring(0, 100) || 'N/A');

        // Deduct 1 credit every 3 generations (admins bypass)
        if (user.role !== 'admin') {
          const newCount = (user.generationCount ?? 0) + 1;
          if (newCount >= 3) {
            user.credits = Math.max(0, (user.credits ?? 5) - 1);
            user.generationCount = 0;
          } else {
            user.generationCount = newCount;
          }
          await user.save();
        }

        // Return the AI-generated image and caption to frontend
        // Frontend will handle upload to Cloudinary and post creation
        res.status(200).json({
          success: true,
          message: 'Image generated successfully',
          data: {
            image: generatedImageBase64,
            caption: caption || '',
            language: language || captionLanguage,
          },
        });
      } catch (aiError: any) {
        console.error('❌ Python AI service error:', aiError.response?.data || aiError.message);
        res.status(500).json({
          success: false,
          message: 'Failed to generate image with AI service',
          error: aiError.response?.data?.detail || aiError.message,
        });
        return;
      }
    } catch (error) {
      console.error('❌ Error in generateAndCreatePost:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate post',
      });
    }
  }
}
