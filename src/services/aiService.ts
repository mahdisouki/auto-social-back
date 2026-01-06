import OpenAI from 'openai';
import { config } from '@/config';

export class AIService {
  private static openai: OpenAI;

  /**
   * Initialize OpenAI client
   */
  static initialize(): void {
    if (!config.openai.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });

    console.log('✅ OpenAI service initialized');
  }

  /**
   * Generate a social media caption from a prompt using Pollinations API
   */
  static async generateCaption(
    prompt: string, 
    platform: string = 'instagram',
    options: {
      language?: 'english' | 'french' | 'tunisian' | 'arabic';
      tone?: 'luxury' | 'friendly' | 'funny' | 'professional' | 'casual';
      audience?: 'men' | 'women' | 'teens' | 'general' | 'luxury_buyers';
      length?: 'short' | 'medium' | 'long';
      count?: number; // Number of caption options to generate
    } = {}
  ): Promise<string> {
    try {
      const {
        language = 'english',
        tone = 'friendly',
        audience = 'general',
        length = 'medium',
        count = 1
      } = options;

      // Build the Pollinations API prompt
      const pollinationsPrompt = this.buildPollinationsPrompt(
        prompt,
        platform,
        language,
        tone,
        audience,
        length,
        count
      );

      // Encode the prompt for URL
      const encodedPrompt = encodeURIComponent(pollinationsPrompt);
      const pollinationsUrl = `https://text.pollinations.ai/${encodedPrompt}?model=openai`;

      console.log('Pollinations API URL:', pollinationsUrl);

      // Make the API request
      const response = await fetch(pollinationsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/plain',
        },
      });

      if (!response.ok) {
        throw new Error(`Pollinations API error: ${response.status} ${response.statusText}`);
      }

      const caption = await response.text();
      
      if (!caption || caption.trim().length === 0) {
        throw new Error('Failed to generate caption from Pollinations API');
      }

      return caption.trim();
    } catch (error) {
      console.error('Error generating caption with Pollinations API:', error);
      
      // Fallback to OpenAI if Pollinations fails
      console.log('Falling back to OpenAI...');
      return this.generateCaptionWithOpenAI(prompt, platform);
    }
  }

  /**
   * Fallback method using OpenAI (original implementation)
   */
  private static async generateCaptionWithOpenAI(prompt: string, platform: string = 'instagram'): Promise<string> {
    try {
      if (!this.openai) {
        this.initialize();
      }

      const systemPrompt = this.getSystemPromptForPlatform(platform);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Create a social media caption for: ${prompt}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const caption = completion.choices[0]?.message?.content?.trim();
      if (!caption) {
        throw new Error('Failed to generate caption');
      }

      return caption;
    } catch (error) {
      console.error('Error generating caption with OpenAI:', error);
      throw new Error('Failed to generate AI caption');
    }
  }

  /**
   * Generate Tunisian dialect caption (specialized method)
   */
  static async generateTunisianCaption(
    prompt: string,
    platform: string = 'facebook',
    tone: 'luxury' | 'friendly' | 'funny' | 'casual' = 'friendly',
    audience: 'men' | 'women' | 'teens' | 'general' = 'general'
  ): Promise<string> {
    return this.generateCaption(prompt, platform, {
      language: 'tunisian',
      tone,
      audience,
      length: 'medium',
      count: 1
    });
  }

  /**
   * Generate multiple caption options
   */
  static async generateMultipleCaptions(
    prompt: string,
    platform: string = 'instagram',
    count: number = 3,
    options: {
      language?: 'english' | 'french' | 'tunisian' | 'arabic';
      tone?: 'luxury' | 'friendly' | 'funny' | 'professional' | 'casual';
      audience?: 'men' | 'women' | 'teens' | 'general' | 'luxury_buyers';
    } = {}
  ): Promise<string[]> {
    const caption = await this.generateCaption(prompt, platform, {
      ...options,
      count
    });

    // Split multiple captions if they exist
    const captions = caption.split('\n').filter(c => c.trim().length > 0);
    return captions.length > 0 ? captions : [caption];
  }

  /**
   * Build the prompt for Pollinations API
   */
  private static buildPollinationsPrompt(
    prompt: string,
    platform: string,
    language: string,
    tone: string,
    audience: string,
    length: string,
    count: number
  ): string {
    const platformNames = {
      instagram: 'Instagram',
      facebook: 'Facebook',
      tiktok: 'TikTok',
      twitter: 'Twitter',
      linkedin: 'LinkedIn'
    };

    const languageNames = {
      english: 'English',
      french: 'French',
      tunisian: 'Tunisian Arabic (Tunisian Darija)',
      arabic: 'Arabic'
    };

    const toneDescriptions = {
      luxury: 'luxury and elegant',
      friendly: 'friendly and warm',
      funny: 'funny and humorous',
      professional: 'professional and formal',
      casual: 'casual and relaxed'
    };

    const audienceDescriptions = {
      men: 'for men',
      women: 'for women',
      teens: 'for teenagers',
      general: 'for general audience',
      luxury_buyers: 'for luxury buyers'
    };

    const lengthDescriptions = {
      short: 'short and concise',
      medium: 'medium length',
      long: 'long and detailed'
    };

    const platformName = platformNames[platform as keyof typeof platformNames] || 'Instagram';
    const languageName = languageNames[language as keyof typeof languageNames] || 'English';
    const toneDesc = toneDescriptions[tone as keyof typeof toneDescriptions] || 'friendly';
    const audienceDesc = audienceDescriptions[audience as keyof typeof audienceDescriptions] || 'general audience';
    const lengthDesc = lengthDescriptions[length as keyof typeof lengthDescriptions] || 'medium length';

    let pollinationsPrompt = `Write a ${platformName} caption about ${prompt}`;
    
    if (tone !== 'friendly') {
      pollinationsPrompt += ` with a ${toneDesc} tone`;
    }
    
    if (audience !== 'general') {
      pollinationsPrompt += ` ${audienceDesc}`;
    }
    
    pollinationsPrompt += ` in ${languageName}`;
    
    if (length !== 'medium') {
      pollinationsPrompt += ` (${lengthDesc})`;
    }

    if (count > 1) {
      pollinationsPrompt += ` - provide ${count} different options`;
    }

    return pollinationsPrompt;
  }

  /**
   * Generate hashtags for a caption
   */
  static async generateHashtags(caption: string, platform: string = 'instagram'): Promise<string[]> {
    try {
      if (!this.openai) {
        this.initialize();
      }

      const maxHashtags = platform === 'instagram' ? 30 : 5; // Platform-specific limits

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Generate relevant hashtags for social media posts. Return only hashtags separated by spaces, no explanations. Maximum ${maxHashtags} hashtags.`,
          },
          {
            role: 'user',
            content: `Generate hashtags for this caption: ${caption}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.5,
      });

      const hashtagsText = completion.choices[0]?.message?.content?.trim();
      if (!hashtagsText) {
        return [];
      }

      // Parse hashtags and ensure they start with #
      const hashtags = hashtagsText
        .split(/\s+/)
        .filter(tag => tag.length > 0)
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .slice(0, maxHashtags);

      return hashtags;
    } catch (error) {
      console.error('Error generating hashtags:', error);
      return [];
    }
  }

  /**
   * Generate a chatbot response
   */
  static async generateChatbotResponse(message: string, context?: string): Promise<string> {
    try {
      if (!this.openai) {
        this.initialize();
      }

      const systemPrompt = `You are a helpful social media customer service chatbot. 
      Respond professionally and helpfully to customer inquiries. 
      Keep responses concise and friendly. 
      If you don't know something, politely ask for more information or direct them to contact support.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: context ? `Context: ${context}\n\nMessage: ${message}` : message,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content?.trim();
      if (!response) {
        throw new Error('Failed to generate chatbot response');
      }

      return response;
    } catch (error) {
      console.error('Error generating chatbot response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  /**
   * Generate image using DALL-E
   */
  static async generateImage(prompt: string, size: '256x256' | '512x512' | '1024x1024' = '512x512'): Promise<string> {
    try {
      if (!this.openai) {
        this.initialize();
      }

      const response = await this.openai.images.generate({
        model: 'dall-e-2',
        prompt: prompt,
        n: 1,
        size: size,
      });

      const imageUrl = response.data?.[0]?.url;
      if (!imageUrl) {
        throw new Error('Failed to generate image');
      }

      return imageUrl;
    } catch (error) {
      console.error('Error generating image:', error);
      throw new Error('Failed to generate AI image');
    }
  }

  /**
   * Get platform-specific system prompt
   */
  private static getSystemPromptForPlatform(platform: string): string {
    const prompts = {
      instagram: `Create engaging Instagram captions that are:
      - 150-300 characters for optimal engagement
      - Include relevant emojis
      - Use line breaks for readability
      - Include a call-to-action when appropriate
      - Match the brand's voice and tone`,

      facebook: `Create Facebook post captions that are:
      - 40-80 characters for optimal engagement
      - Professional yet engaging
      - Include relevant hashtags (1-3)
      - Encourage interaction and sharing`,

      tiktok: `Create TikTok captions that are:
      - Short and punchy (under 100 characters)
      - Include trending hashtags
      - Use emojis to add personality
      - Create urgency or excitement`,

      twitter: `Create Twitter captions that are:
      - Under 280 characters
      - Include relevant hashtags (1-2)
      - Use emojis sparingly
      - Encourage retweets and engagement`,
    };

    return prompts[platform as keyof typeof prompts] || prompts.instagram;
  }

  /**
   * Enhance an existing caption with AI
   */
  static async enhanceCaption(caption: string, platform: string): Promise<string> {
    try {
      if (!this.openai) {
        this.initialize();
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Enhance this social media caption to make it more engaging and platform-appropriate. Keep the original meaning but improve the language, add emojis, and optimize for ${platform}.`,
          },
          {
            role: 'user',
            content: `Enhance this caption: ${caption}`,
          },
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      const enhancedCaption = completion.choices[0]?.message?.content?.trim();
      if (!enhancedCaption) {
        throw new Error('Failed to enhance caption');
      }

      return enhancedCaption;
    } catch (error) {
      console.error('Error enhancing caption:', error);
      throw new Error('Failed to enhance caption');
    }
  }
}
