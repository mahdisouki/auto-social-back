import { Request, Response } from 'express';
import { AuthService } from '@/services/authService';
import { validate, schemas } from '@/middleware/validation';

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password } = req.body;

      const result = await AuthService.registerUser({
        name,
        email,
        password,
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await AuthService.loginUser({
        email,
        password,
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Login failed',
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const user = await AuthService.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: user.toJSON(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching user profile',
      });
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { name, email } = req.body;
      const updatedUser = await AuthService.updateProfile(req.user.userId, {
        name,
        email,
      });

      if (!updatedUser) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser.toJSON(),
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Profile update failed',
      });
    }
  }

  /**
   * Change password
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      // Verify current password
      const user = await AuthService.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const bcrypt = require('bcryptjs');
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
        });
        return;
      }

      // Update password
      await AuthService.updatePassword(req.user.userId, newPassword);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error changing password',
      });
    }
  }
}
