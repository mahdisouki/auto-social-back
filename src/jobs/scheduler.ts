import Agenda from 'agenda';
import { config } from '@/config';
import { PostService } from '@/services/postService';
import { N8nService } from '@/services/n8nService';

export class JobScheduler {
  private static agenda: Agenda;

  /**
   * Initialize Agenda job scheduler
   */
  static async initialize(): Promise<void> {
    try {
      if (!config.database.mongoUri) {
        throw new Error('MongoDB URI is required for job scheduling');
      }

      this.agenda = new Agenda({
        db: { address: config.database.mongoUri },
        processEvery: '30 seconds', // Check for jobs every 30 seconds
      });

      // Define job types
      this.defineJobs();

      // Start the agenda
      await this.agenda.start();

      console.log('✅ Job scheduler initialized');
    } catch (error) {
      console.error('❌ Failed to initialize job scheduler:', error);
      throw error;
    }
  }

  /**
   * Define all job types
   */
  private static defineJobs(): void {
    // Schedule post publishing job
    this.agenda.define('publish-post', async (job: any) => {
      const { postId, userId } = job.attrs.data;
      const now = new Date();
      const scheduledFor = job.attrs.nextRunAt;
      console.log(`📅 [publish-post] Job started`, {
        postId,
        userId,
        scheduledFor: scheduledFor?.toISOString?.(),
        serverTime: now.toISOString(),
        isPastDue: scheduledFor ? scheduledFor <= now : 'unknown',
      });

      try {
        console.log(`📅 Publishing scheduled post: ${postId}`);
        await PostService.publishPost(postId, userId);
        console.log(`✅ Successfully published post: ${postId}`);
      } catch (error) {
        console.error(`❌ Failed to publish post ${postId}:`, error);

        // Update post status to failed
        try {
          const { Post } = await import('@/models');
          await Post.findByIdAndUpdate(postId, { status: 'failed' });
        } catch (updateError) {
          console.error(`❌ Failed to update post status for ${postId}:`, updateError);
        }
      } finally {
        console.log(`📅 [publish-post] Job finished for postId=${postId}`);
      }
    });

    // Clean up old jobs
    this.agenda.define('cleanup-old-jobs', async () => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 days ago

        const result = await this.agenda.cancel({
          nextRunAt: { $lt: cutoffDate },
          type: 'single',
        });

        console.log(`🧹 Cleaned up ${result} old jobs`);
      } catch (error) {
        console.error('❌ Error cleaning up old jobs:', error);
      }
    });

    // Health check job
    this.agenda.define('health-check', async () => {
      try {
        const jobCount = await this.agenda.jobs({ nextRunAt: { $exists: true } });
        const now = new Date();
        console.log(`💓 Scheduler health check: ${jobCount.length} jobs scheduled (serverTime=${now.toISOString()})`);

        const publishJobs = await this.agenda.jobs({
          name: 'publish-post',
          nextRunAt: { $exists: true },
        });
        publishJobs.forEach((j: any) => {
          const next = j.attrs.nextRunAt;
          const due = next ? next <= now : false;
          const msUntilRun = next ? next.getTime() - now.getTime() : null;
          console.log(
            `   📅 publish-post ${j.attrs.data?.postId} nextRunAt=${next?.toISOString?.()} due=${due} msUntilRun=${msUntilRun}`
          );
        });
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
    });
  }

  /**
   * Schedule a post for publishing
   */
  static async schedulePost(postId: string, scheduledAt: Date, userId: string): Promise<void> {
    try {
      const job = this.agenda.create('publish-post', {
        postId,
        userId,
      });

      await job.schedule(scheduledAt).save();
      console.log(`📅 Scheduled post ${postId} for ${scheduledAt.toISOString()}`);
    } catch (error) {
      console.error('❌ Failed to schedule post:', error);
      throw new Error('Failed to schedule post');
    }
  }

  /**
   * Schedule a post for publishing with user ID
   */
  static async schedulePostWithUser(postId: string, userId: string, scheduledAt: Date): Promise<void> {
    try {
      const job = this.agenda.create('publish-post', {
        postId,
        userId,
      });

      await job.schedule(scheduledAt).save();
      console.log(`📅 Scheduled post ${postId} for user ${userId} at ${scheduledAt.toISOString()}`);
    } catch (error) {
      console.error('❌ Failed to schedule post with user:', error);
      throw new Error('Failed to schedule post');
    }
  }

  /**
   * Cancel a scheduled post
   */
  static async cancelScheduledPost(postId: string): Promise<void> {
    try {
      const result = await this.agenda.cancel({
        name: 'publish-post',
        'data.postId': postId,
      });

      if (result && result > 0) {
        console.log(`❌ Cancelled scheduled post: ${postId}`);
      } else {
        console.log(`⚠️ No scheduled job found for post: ${postId}`);
      }
    } catch (error) {
      console.error('❌ Failed to cancel scheduled post:', error);
      throw new Error('Failed to cancel scheduled post');
    }
  }

  /**
   * Schedule recurring cleanup job
   */
  static async scheduleCleanup(): Promise<void> {
    try {
      await this.agenda.every('1 day', 'cleanup-old-jobs');
      console.log('📅 Scheduled daily cleanup job');
    } catch (error) {
      console.error('❌ Failed to schedule cleanup job:', error);
    }
  }

  /**
   * Schedule health check job
   */
  static async scheduleHealthCheck(): Promise<void> {
    try {
      await this.agenda.every('5 minutes', 'health-check');
      console.log('📅 Scheduled health check job');
    } catch (error) {
      console.error('❌ Failed to schedule health check job:', error);
    }
  }

  /**
   * Get scheduled jobs for a user
   */
  static async getScheduledJobs(userId: string): Promise<any[]> {
    try {
      const jobs = await this.agenda.jobs({
        name: 'publish-post',
        'data.userId': userId,
        nextRunAt: { $exists: true },
      });

      return jobs.map(job => ({
        id: job.attrs._id,
        postId: job.attrs.data.postId,
        scheduledAt: job.attrs.nextRunAt,
        status: job.attrs.failedAt ? 'failed' : 'scheduled',
      }));
    } catch (error) {
      console.error('❌ Failed to get scheduled jobs:', error);
      throw new Error('Failed to get scheduled jobs');
    }
  }

  /**
   * Get all scheduled jobs
   */
  static async getAllScheduledJobs(): Promise<any[]> {
    try {
      const jobs = await this.agenda.jobs({
        nextRunAt: { $exists: true },
      });

      return jobs.map(job => ({
        id: job.attrs._id,
        name: job.attrs.name,
        data: job.attrs.data,
        scheduledAt: job.attrs.nextRunAt,
        status: job.attrs.failedAt ? 'failed' : 'scheduled',
      }));
    } catch (error) {
      console.error('❌ Failed to get all scheduled jobs:', error);
      throw new Error('Failed to get scheduled jobs');
    }
  }

  /**
   * Gracefully shutdown the scheduler
   */
  static async shutdown(): Promise<void> {
    try {
      if (this.agenda) {
        await this.agenda.stop();
        console.log('✅ Job scheduler shutdown complete');
      }
    } catch (error) {
      console.error('❌ Error shutting down job scheduler:', error);
    }
  }
}
