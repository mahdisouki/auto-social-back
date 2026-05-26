import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Post } from '@/models';
import { User } from '@/models/User';
import { JobScheduler } from '@/jobs/scheduler';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class AdminController {
  static async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, search, role, plan } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const filter: Record<string, unknown> = {};

      if (role) filter.role = role;
      if (plan) filter.plan = plan;
      if (search && typeof search === 'string' && search.trim()) {
        const q = escapeRegex(search.trim());
        filter.$or = [
          { email: new RegExp(q, 'i') },
          { name: new RegExp(q, 'i') },
        ];
      }

      const users = await User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

      const total = await User.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)) || 1,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching users',
      });
    }
  }

  static async getUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select('-password');
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const postCounts = await Post.aggregate<{ _id: string; count: number }>([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);

      const countsByStatus = Object.fromEntries(
        postCounts.map((row) => [row._id, row.count])
      );

      res.status(200).json({
        success: true,
        data: {
          user,
          postCountsByStatus: countsByStatus,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user',
      });
    }
  }

  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const existing = await User.findById(userId);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const { name, email, role, plan, credits, generationCount } = req.body;

      if (role === 'user' && req.user.userId === userId && existing.role === 'admin') {
        res.status(400).json({
          success: false,
          message: 'You cannot remove your own admin role',
        });
        return;
      }

      const updates: Record<string, unknown> = {};

      if (name !== undefined) updates.name = name;
      if (email !== undefined) {
        const taken = await User.findOne({
          email,
          _id: { $ne: userId },
        });
        if (taken) {
          res.status(400).json({
            success: false,
            message: 'Email is already taken',
          });
          return;
        }
        updates.email = email;
      }
      if (role !== undefined) updates.role = role;
      if (plan !== undefined) updates.plan = plan;
      if (credits !== undefined) updates.credits = credits;
      if (generationCount !== undefined) updates.generationCount = generationCount;

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          message: 'No valid fields to update',
        });
        return;
      }

      const user = await User.findByIdAndUpdate(userId, updates, {
        new: true,
        runValidators: true,
      }).select('-password');

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: user,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'User update failed',
      });
    }
  }

  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      if (req.user.userId === userId) {
        res.status(400).json({
          success: false,
          message: 'You cannot delete your own account',
        });
        return;
      }

      const existing = await User.findById(userId);
      if (!existing) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      if (existing.role === 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
          res.status(400).json({
            success: false,
            message: 'Cannot delete the last admin user',
          });
          return;
        }
      }

      const scheduledPosts = await Post.find({
        userId,
        status: 'scheduled',
      }).select('_id');

      for (const p of scheduledPosts) {
        await JobScheduler.cancelScheduledPost(p._id.toString());
      }

      await Post.deleteMany({ userId });
      await User.findByIdAndDelete(userId);

      res.status(200).json({
        success: true,
        message: 'User and their posts deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error deleting user',
      });
    }
  }

  static async listPosts(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, userId, status, platform, createdAt } =
        req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const filter: Record<string, unknown> = {};
      if (userId) filter.userId = userId;
      if (status) filter.status = status;
      if (platform) filter.platform = platform;
      if (createdAt)
        filter.createdAt = { $gte: new Date(createdAt as string) };

      const posts = await Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('userId', 'name email role');

      const total = await Post.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          posts,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit)) || 1,
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

  static async getPost(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const post = await Post.findById(id).populate('userId', 'name email role');

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

  static async updatePost(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: Record<string, unknown> = { ...req.body };

      delete updateData.userId;
      delete updateData._id;
      delete updateData.createdAt;

      if (updateData.scheduledAt) {
        updateData.scheduledAt = new Date(updateData.scheduledAt as string);
      } else if (updateData.scheduledAt === null) {
        updateData.$unset = updateData.$unset || {};
        (updateData.$unset as Record<string, 1>).scheduledAt = 1;
        delete updateData.scheduledAt;
      }

      if (updateData.postType === '') {
        delete updateData.postType;
        updateData.$unset = updateData.$unset || {};
        (updateData.$unset as Record<string, 1>).postType = 1;
      }

      const post = await Post.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).populate('userId', 'name email role');

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

  static async deletePost(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const post = await Post.findById(id);
      if (!post) {
        res.status(404).json({
          success: false,
          message: 'Post not found',
        });
        return;
      }

      if (post.status === 'scheduled') {
        await JobScheduler.cancelScheduledPost(post._id.toString());
      }

      await Post.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Post deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error deleting post',
      });
    }
  }
}
