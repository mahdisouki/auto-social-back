import { Post, IPost } from '@/models';
import { User } from '@/models/User';
import { AIService } from './aiService';
import { N8nService } from './n8nService';
import { MetaService } from './metaService';
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
      // Check credits before creating (admin bypass)
      const user = await User.findById(data.userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.role !== 'admin') {
        // Use default 5 for existing users without credits field (migration)
        const credits = user.credits === undefined || user.credits === null ? 5 : user.credits;
        if (credits < 1) {
          throw new Error('Insufficient credits. You need 1 credit to create a post.');
        }
        user.credits = credits - 1;
        await user.save();
      }

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
        await JobScheduler.schedulePost(post._id.toString(), data.scheduledAt, data.userId);
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
      await JobScheduler.schedulePost(postId, scheduledAt, userId);

      return post;
    } catch (error) {
      console.error('Error scheduling post:', error);
      throw new Error('Failed to schedule post');
    }
  }

  /**
   * Publish a post immediately
   */
  static async publishPost(postId: string, userId: string, targetPageIds?: string[]): Promise<IPost> {
    try {
      const post = await Post.findOne({ _id: postId, userId });
      if (!post) {
        throw new Error('Post not found');
      }

      console.log(`📤 [PostService.publishPost] postId=${postId} userId=${userId} status=${post.status}`);

      if (post.status === 'posted') {
        throw new Error('Post has already been published');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const publishedResults: any[] = [];
      const errors: string[] = [];

      // Check if post targets Facebook or Instagram
      const hasMetaPlatform = post.platform.some(p => p === 'facebook' || p === 'instagram');
      
      if (hasMetaPlatform && user.connectedAccounts.facebookPages?.length) {
        // Publish via Meta Graph API
        const pages = targetPageIds 
          ? user.connectedAccounts.facebookPages.filter(p => targetPageIds.includes(p.pageId))
          : user.connectedAccounts.facebookPages;

        for (const page of pages) {
          try {
            // Determine which platforms to post to for this page
            const platformsToPost = post.platform.filter(p => {
              if (p === 'facebook') return true;
              if (p === 'instagram' && page.instagramAccount) return true;
              return false;
            });

            for (const platform of platformsToPost) {
              if (platform === 'facebook') {
                // Post to Facebook Page
                const imageUrl = post.images?.[0] || post.mediaUrl;
                const result = await MetaService.postToFacebookPage(
                  page.pageId,
                  page.accessToken,
                  post.caption,
                  imageUrl
                );
                
                publishedResults.push({
                  platform: 'facebook',
                  pageId: page.pageId,
                  pageName: page.pageName,
                  postId: result.post_id,
                });
              } else if (platform === 'instagram' && page.instagramAccount) {
                // Post to Instagram
                const imageUrl = post.images?.[0] || post.mediaUrl;
                if (!imageUrl) {
                  errors.push(`Instagram post requires an image for page ${page.pageName}`);
                  continue;
                }

                const result = await MetaService.postToInstagram(
                  page.instagramAccount.accountId,
                  page.accessToken,
                  imageUrl,
                  post.caption
                );
                
                publishedResults.push({
                  platform: 'instagram',
                  pageId: page.pageId,
                  pageName: page.pageName,
                  instagramAccountId: page.instagramAccount.accountId,
                  instagramUsername: page.instagramAccount.username,
                  postId: result.id,
                });
              }
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to post to ${page.pageName}: ${errorMsg}`);
            console.error(`Error posting to page ${page.pageId}:`, error);
          }
        }

        // If we have non-Meta platforms, also send to n8n
        const nonMetaPlatforms = post.platform.filter(p => p !== 'facebook' && p !== 'instagram');
        if (nonMetaPlatforms.length > 0) {
          try {
            // Create a temporary post object with only non-Meta platforms
            const tempPost = { ...post.toObject(), platform: nonMetaPlatforms };
            // Cast through unknown to avoid type mismatch (toObject returns plain object, not Mongoose Document)
            await N8nService.publishPost(tempPost as unknown as IPost);
          } catch (error) {
            errors.push(`Failed to publish to other platforms via n8n: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } else {
        // No Meta platforms or no connected pages - use n8n for all platforms
        await N8nService.publishPost(post);
      }

      // Update post status
      if (publishedResults.length > 0 || errors.length === 0) {
        post.status = 'posted';
        // Store published results in post metadata if needed
        (post as any).publishedResults = publishedResults;
      } else {
        post.status = 'failed';
        (post as any).publishedErrors = errors;
      }

      post.scheduledAt = undefined; // Clear scheduled time since it's being published now
      await post.save();

      if (errors.length > 0 && publishedResults.length === 0) {
        throw new Error(`Failed to publish post: ${errors.join('; ')}`);
      }

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
