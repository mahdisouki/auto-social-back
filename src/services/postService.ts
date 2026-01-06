import { Post, IPost } from '@/models';
import { AIService } from './aiService';
import { N8nService } from './n8nService';
import { JobScheduler } from '@/jobs/scheduler';

export interface CreatePostData {
  userId: string;
  caption: string;
  platform: string[];
  scheduledAt?: Date;
  images?: string[];
  postType?: string;
  currency?: string;
  price?: string;
  productName?: string;
  description?: string;
  backgroundType?: string;
  backgroundColor?: string;
  useModel?: string;
  modelGender?: string;
  addText?: string;
}

export class PostService {
  /**
   * Create a new post with AI-generated content
   */
  static async createPost(data: CreatePostData): Promise<IPost> {
    try {
      // Create the post
      const post = new Post({
        userId: data.userId,
        caption: data.caption,
        platform: data.platform,
        scheduledAt: data.scheduledAt,
        images: data.images || [],
        status: data.scheduledAt ? 'scheduled' : 'draft',
        postType: data.postType,
        currency: data.currency,
        price: data.price,
        productName: data.productName,
        description: data.description,
        backgroundType: data.backgroundType,
        backgroundColor: data.backgroundColor,
        useModel: data.useModel,
        modelGender: data.modelGender,
        addText: data.addText,
      });

      await post.save();

      // If scheduled, add to job scheduler
      if (data.scheduledAt) {
        await JobScheduler.schedulePost(post._id.toString(), data.scheduledAt);
      }

      return post;
    } catch (error) {
      console.error('Error creating post:', error);
      throw new Error('Failed to create post');
    }
  }

  /**
   * Schedule a post for later publishing
   */
  static async schedulePost(postId: string, userId: string, scheduledAt: Date): Promise<IPost> {
    try {
      const post = await Post.findOne({ _id: postId, userId });
      if (!post) {
        throw new Error('Post not found');
      }

      if (scheduledAt <= new Date()) {
        throw new Error('Scheduled date must be in the future');
      }

      // Update post status and scheduled time
      post.scheduledAt = scheduledAt;
      post.status = 'scheduled';
      await post.save();

      // Add to job scheduler
      await JobScheduler.schedulePost(postId, scheduledAt);

      return post;
    } catch (error) {
      console.error('Error scheduling post:', error);
      throw new Error('Failed to schedule post');
    }
  }

  /**
   * Publish a post immediately
   */
  static async publishPost(postId: string, userId: string): Promise<IPost> {
    try {
      const post = await Post.findOne({ _id: postId, userId });
      if (!post) {
        throw new Error('Post not found');
      }

      if (post.status === 'posted') {
        throw new Error('Post has already been published');
      }

      // Update post status
      post.status = 'posted';
      post.scheduledAt = undefined; // Clear scheduled time since it's being published now
      await post.save();

      // Send to n8n for publishing to social platforms
      await N8nService.publishPost(post);

      return post;
    } catch (error) {
      console.error('Error publishing post:', error);
      
      // Update post status to failed
      await Post.findByIdAndUpdate(postId, { status: 'failed' });
      
      throw new Error('Failed to publish post');
    }
  }

  /**
   * Enhance a post with AI
   */
  static async enhancePost(postId: string, userId: string): Promise<IPost> {
    try {
      const post = await Post.findOne({ _id: postId, userId });
      if (!post) {
        throw new Error('Post not found');
      }

      // Enhance caption for each platform
      const enhancedCaptions: { [key: string]: string } = {};
      
      for (const platform of post.platform) {
        const enhancedCaption = await AIService.enhanceCaption(post.caption, platform);
        enhancedCaptions[platform] = enhancedCaption;
      }

      // Generate hashtags
      const hashtags = await AIService.generateHashtags(post.caption, post.platform[0]);

      // Update post with enhanced content
      post.caption = enhancedCaptions[post.platform[0]] || post.caption;
      await post.save();

      return post;
    } catch (error) {
      console.error('Error enhancing post:', error);
      throw new Error('Failed to enhance post');
    }
  }

  /**
   * Generate image for a post
   */
  static async generateImageForPost(postId: string, userId: string): Promise<IPost> {
    try {
      const post = await Post.findOne({ _id: postId, userId });
      if (!post) {
        throw new Error('Post not found');
      }

      // Generate image using product info
      const prompt = `${post.productName || 'Product'}: ${post.description || ''}`;
      const imageUrl = await AIService.generateImage(prompt);

      // Update post with generated image
      post.mediaUrl = imageUrl;
      await post.save();

      return post;
    } catch (error) {
      console.error('Error generating image for post:', error);
      throw new Error('Failed to generate image for post');
    }
  }

  /**
   * Get posts statistics for a user
   */
  static async getPostStats(userId: string): Promise<{
    total: number;
    draft: number;
    scheduled: number;
    posted: number;
    failed: number;
  }> {
    try {
      const stats = await Post.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {
        total: 0,
        draft: 0,
        scheduled: 0,
        posted: 0,
        failed: 0,
      };

      stats.forEach(stat => {
        result[stat._id as keyof typeof result] = stat.count;
        result.total += stat.count;
      });

      return result;
    } catch (error) {
      console.error('Error getting post stats:', error);
      throw new Error('Failed to get post statistics');
    }
  }

  /**
   * Get scheduled posts that are ready to be published
   */
  static async getReadyToPublishPosts(): Promise<IPost[]> {
    try {
      const now = new Date();
      return await Post.find({
        status: 'scheduled',
        scheduledAt: { $lte: now },
      });
    } catch (error) {
      console.error('Error getting ready to publish posts:', error);
      throw new Error('Failed to get ready to publish posts');
    }
  }
}
