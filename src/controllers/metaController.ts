import { Request, Response } from 'express';
import { MetaService } from '@/services/metaService';
import { config } from '@/config';

export class MetaController {
  /**
   * Initiate Facebook OAuth flow
   */
  static async initiateFacebookAuth(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // Generate state to prevent CSRF attacks
      const state = `${req.user.userId}-${Date.now()}`;
      
      // Store state in session or return it to frontend to verify on callback
      // For simplicity, we'll include userId in state
      
      // Backend callback URL (Facebook will call this)
      const redirectUri = `${config.server.nodeEnv === 'production' 
        ? process.env.BACKEND_URL || 'https://api.postoryai.com' 
        : 'http://localhost:3000'}/api/meta/auth/facebook/callback`;
      
      const authUrl = MetaService.getFacebookAuthUrl(state, redirectUri);

      res.status(200).json({
        success: true,
        data: {
          authUrl,
          state,
        },
      });
    } catch (error) {
      console.error('Error initiating Facebook auth:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to initiate Facebook authentication',
      });
    }
  }

  /**
   * Handle Facebook OAuth callback
   */
  static async handleFacebookCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code) {
        const frontendUrl = `${config.server.nodeEnv === 'production' 
          ? process.env.FRONTEND_URL || 'https://postoryai.com' 
          : 'http://localhost:3000'}/auth/facebook/error`;
        res.redirect(`${frontendUrl}?error=${encodeURIComponent('Authorization code not provided')}`);
        return;
      }

      if (!state) {
        const frontendUrl = `${config.server.nodeEnv === 'production' 
          ? process.env.FRONTEND_URL || 'https://postoryai.com' 
          : 'http://localhost:3000'}/auth/facebook/error`;
        res.redirect(`${frontendUrl}?error=${encodeURIComponent('State parameter missing')}`);
        return;
      }

      // Extract userId from state (format: userId-timestamp)
      const stateUserId = state.toString().split('-')[0];
      if (!stateUserId) {
        const frontendUrl = `${config.server.nodeEnv === 'production' 
          ? process.env.FRONTEND_URL || 'https://postoryai.com' 
          : 'http://localhost:3000'}/auth/facebook/error`;
        res.redirect(`${frontendUrl}?error=${encodeURIComponent('Invalid state parameter')}`);
        return;
      }

      // Backend callback URL (must match what was used in initiateFacebookAuth)
      const redirectUri = `${config.server.nodeEnv === 'production' 
        ? process.env.BACKEND_URL || 'https://api.postoryai.com' 
        : 'http://localhost:3000'}/api/meta/auth/facebook/callback`;

      // Exchange code for access token
      const shortLivedToken = await MetaService.exchangeCodeForToken(
        code as string,
        redirectUri
      );

      // Save pages and get long-lived token
      const pages = await MetaService.saveUserPages(
        stateUserId,
        shortLivedToken
      );

      // Redirect back to frontend with success
      const frontendUrl = `${config.server.nodeEnv === 'production' 
        ? process.env.FRONTEND_URL || 'https://postoryai.com' 
        : 'http://localhost:3000'}/auth/facebook/success`;

      res.redirect(`${frontendUrl}?success=true&pages=${pages.length}`);
    } catch (error) {
      console.error('Error handling Facebook callback:', error);
      
      const frontendUrl = `${config.server.nodeEnv === 'production' 
        ? process.env.FRONTEND_URL || 'https://postoryai.com' 
        : 'http://localhost:3000'}/auth/facebook/error`;

      res.redirect(`${frontendUrl}?error=${encodeURIComponent(error instanceof Error ? error.message : 'Authentication failed')}`);
    }
  }

  /**
   * Get user's connected Facebook Pages
   */
  static async getConnectedPages(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const pages = await MetaService.getUserConnectedPages(req.user.userId);

      // Remove access tokens from response for security
      const sanitizedPages = pages.map(page => ({
        pageId: page.pageId,
        pageName: page.pageName,
        category: page.category,
        connectedAt: page.connectedAt,
        hasInstagram: !!page.instagramAccount,
        instagramUsername: page.instagramAccount?.username,
      }));

      res.status(200).json({
        success: true,
        data: {
          pages: sanitizedPages,
          count: sanitizedPages.length,
        },
      });
    } catch (error) {
      console.error('Error fetching connected pages:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch connected pages',
      });
    }
  }

  /**
   * Disconnect a Facebook Page
   */
  static async disconnectPage(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      const { pageId } = req.params;

      if (!pageId) {
        res.status(400).json({
          success: false,
          message: 'Page ID is required',
        });
        return;
      }

      await MetaService.disconnectPage(req.user.userId, pageId);

      res.status(200).json({
        success: true,
        message: 'Page disconnected successfully',
      });
    } catch (error) {
      console.error('Error disconnecting page:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to disconnect page',
      });
    }
  }

  /**
   * Refresh user's connected pages (re-fetch from Facebook)
   */
  static async refreshPages(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
        return;
      }

      // This would require the user to have a valid metaUserToken
      // In production, you might want to trigger a re-auth if token is expired
      const { User } = await import('@/models/User');
      const user = await User.findById(req.user.userId);

      if (!user || !user.metaUserToken) {
        res.status(400).json({
          success: false,
          message: 'User has not connected Facebook. Please connect first.',
        });
        return;
      }

      const pages = await MetaService.saveUserPages(
        req.user.userId,
        user.metaUserToken
      );

      const sanitizedPages = pages.map(page => ({
        pageId: page.pageId,
        pageName: page.pageName,
        category: page.category,
        connectedAt: page.connectedAt,
        hasInstagram: !!page.instagramAccount,
        instagramUsername: page.instagramAccount?.username,
      }));

      res.status(200).json({
        success: true,
        message: 'Pages refreshed successfully',
        data: {
          pages: sanitizedPages,
          count: sanitizedPages.length,
        },
      });
    } catch (error) {
      console.error('Error refreshing pages:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to refresh pages',
      });
    }
  }
}
