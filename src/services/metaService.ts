import axios, { AxiosResponse } from 'axios';
import { config } from '@/config';
import { User } from '@/models/User';
import { FacebookPage } from '@/models/User';

interface MetaAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookPageData {
  id: string;
  name: string;
  category: string;
  access_token: string;
}

interface InstagramAccountData {
  id: string;
  username: string;
}

export class MetaService {
  private static readonly GRAPH_API_BASE = 'https://graph.facebook.com';

  /**
   * Get Facebook OAuth URL
   */
  static getFacebookAuthUrl(state: string, redirectUri: string): string {
    if (!config.meta.appId) {
      throw new Error('Meta App ID not configured');
    }

    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'instagram_basic',
      'instagram_content_publish',
      'business_management',
    ].join(',');

    // Use www.facebook.com for OAuth dialog, not graph.facebook.com
    return `https://www.facebook.com/${config.meta.apiVersion}/dialog/oauth?` +
      `client_id=${config.meta.appId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}&` +
      `scope=${scopes}&` +
      `response_type=code`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCodeForToken(
    code: string,
    redirectUri: string
  ): Promise<string> {
    if (!config.meta.appId || !config.meta.appSecret) {
      throw new Error('Meta App credentials not configured');
    }

    try {
      const response: AxiosResponse<MetaAccessTokenResponse> = await axios.get(
        `${this.GRAPH_API_BASE}/${config.meta.apiVersion}/oauth/access_token`,
        {
          params: {
            client_id: config.meta.appId,
            client_secret: config.meta.appSecret,
            redirect_uri: redirectUri,
            code,
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw new Error('Failed to exchange authorization code for access token');
    }
  }

  /**
   * Get long-lived user access token (60 days)
   */
  static async getLongLivedToken(shortLivedToken: string): Promise<string> {
    if (!config.meta.appId || !config.meta.appSecret) {
      throw new Error('Meta App credentials not configured');
    }

    try {
      const response: AxiosResponse<MetaAccessTokenResponse> = await axios.get(
        `${this.GRAPH_API_BASE}/${config.meta.apiVersion}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: config.meta.appId,
            client_secret: config.meta.appSecret,
            fb_exchange_token: shortLivedToken,
          },
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('Error getting long-lived token:', error);
      throw new Error('Failed to get long-lived access token');
    }
  }

  /**
   * Get user's Facebook Pages
   */
  static async getUserPages(userAccessToken: string): Promise<FacebookPageData[]> {
    try {
      const response: AxiosResponse<{ data: FacebookPageData[] }> = await axios.get(
        `${this.GRAPH_API_BASE}/${config.meta.apiVersion}/me/accounts`,
        {
          params: {
            access_token: userAccessToken,
            fields: 'id,name,category,access_token',
          },
        }
      );

      return response.data.data;
    } catch (error) {
      console.error('Error fetching user pages:', error);
      throw new Error('Failed to fetch Facebook Pages');
    }
  }

  /**
   * Get Instagram Business Account linked to a Facebook Page
   */
  static async getInstagramAccount(pageId: string, pageAccessToken: string): Promise<InstagramAccountData | null> {
    try {
      const response: AxiosResponse<{ instagram_business_account?: InstagramAccountData }> = await axios.get(
        `${this.GRAPH_API_BASE}/${config.meta.apiVersion}/${pageId}`,
        {
          params: {
            access_token: pageAccessToken,
            fields: 'instagram_business_account{id,username}',
          },
        }
      );

      return response.data.instagram_business_account || null;
    } catch (error) {
      console.error('Error fetching Instagram account:', error);
      // Instagram account might not be linked, return null
      return null;
    }
  }

  /**
   * Post to Facebook Page
   */
  static async postToFacebookPage(
    pageId: string,
    pageAccessToken: string,
    message: string,
    imageUrl?: string
  ): Promise<{ id: string; post_id: string }> {
    try {
      let result;

      if (imageUrl) {
        // Post with photo
        const photoResponse = await axios.post(
          `${this.GRAPH_API_BASE}/${config.meta.apiVersion}/${pageId}/photos`,
          {
            url: imageUrl,
            message,
            access_token: pageAccessToken,
            privacy: { value: 'EVERYONE' },
          }
        );
        result = photoResponse.data;
      } else {
        // Post text only
        const feedResponse = await axios.post(
          `${this.GRAPH_API_BASE}/${config.meta.apiVersion}/${pageId}/feed`,
          {
            message,
            access_token: pageAccessToken,
            privacy: { value: 'EVERYONE' },
          }
        );
        result = feedResponse.data;
      }

      return {
        id: result.id,
        post_id: result.id || result.post_id,
      };
    } catch (error: any) {
      console.error('Error posting to Facebook Page:', error.response?.data || error.message);
      throw new Error(`Failed to post to Facebook Page: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Post to Instagram Business Account
   */
  static async postToInstagram(
    instagramAccountId: string,
    pageAccessToken: string,
    imageUrl: string,
    caption: string
  ): Promise<{ id: string }> {
    try {
      // Step 1: Create media container
      const createMediaResponse = await axios.post(
        `${this.GRAPH_API_BASE}/${config.meta.apiVersion}/${instagramAccountId}/media`,
        {
          image_url: imageUrl,
          caption,
          access_token: pageAccessToken,
        }
      );

      const creationId = createMediaResponse.data.id;

      // Step 2: Publish the media
      const publishResponse = await axios.post(
        `${this.GRAPH_API_BASE}/${config.meta.apiVersion}/${instagramAccountId}/media_publish`,
        {
          creation_id: creationId,
          access_token: pageAccessToken,
        }
      );

      return {
        id: publishResponse.data.id,
      };
    } catch (error: any) {
      console.error('Error posting to Instagram:', error.response?.data || error.message);
      throw new Error(`Failed to post to Instagram: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Save user's Facebook Pages to database
   */
  static async saveUserPages(
    userId: string,
    userAccessToken: string
  ): Promise<FacebookPage[]> {
    try {
      // Get long-lived token
      const longLivedToken = await this.getLongLivedToken(userAccessToken);

      // Get user's pages
      const pagesData = await this.getUserPages(longLivedToken);

      const savedPages: FacebookPage[] = [];

      for (const pageData of pagesData) {
        // Get Instagram account if linked
        const instagramAccount = await this.getInstagramAccount(
          pageData.id,
          pageData.access_token
        );

        const page: FacebookPage = {
          pageId: pageData.id,
          pageName: pageData.name,
          accessToken: pageData.access_token, // Page access token (doesn't expire if managed properly)
          category: pageData.category || '',
          connectedAt: new Date(),
          instagramAccount: instagramAccount
            ? {
                accountId: instagramAccount.id,
                username: instagramAccount.username,
                accessToken: pageData.access_token, // Instagram uses page token
              }
            : undefined,
        };

        savedPages.push(page);
      }

      // Update user in database
      await User.findByIdAndUpdate(userId, {
        'connectedAccounts.facebookPages': savedPages,
        metaUserToken: longLivedToken,
      });

      return savedPages;
    } catch (error) {
      console.error('Error saving user pages:', error);
      throw error;
    }
  }

  /**
   * Remove a Facebook Page from user's connected accounts
   */
  static async disconnectPage(userId: string, pageId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $pull: {
        'connectedAccounts.facebookPages': { pageId },
      },
    });
  }

  /**
   * Get user's connected pages
   */
  static async getUserConnectedPages(userId: string): Promise<FacebookPage[]> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return user.connectedAccounts.facebookPages || [];
  }

  /**
   * Validate access token
   */
  static async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.GRAPH_API_BASE}/${config.meta.apiVersion}/me`,
        {
          params: {
            access_token: accessToken,
          },
        }
      );

      return !!response.data.id;
    } catch (error) {
      return false;
    }
  }
}
