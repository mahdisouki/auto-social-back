import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface Config {
  server: {
    port: number;
    nodeEnv: string;
    corsOrigin: string | string[];
  };
  database: {
    mongoUri: string | undefined;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  openai: {
    apiKey: string | undefined;
  };
  cloudinary: {
    cloudName: string | undefined;
    apiKey: string | undefined;
    apiSecret: string | undefined;
  };
  n8n: {
    webhookUrl: string | undefined;
    apiKey: string | undefined;
  };
  meta: {
    appId: string | undefined;
    appSecret: string | undefined;
    apiVersion: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

export const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174',
      'https://autosocial.app',
      'https://www.autosocial.app',
      'https://postoryai.com'
    ],
  },
  database: {
    mongoUri: process.env.MONGO_URI,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL,
    apiKey: process.env.N8N_API_KEY,
  },
  meta: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    apiVersion: process.env.META_API_VERSION || 'v21.0',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};

// Validate required environment variables
export const validateConfig = (): void => {
  const requiredVars = [
    'MONGO_URI',
    'JWT_SECRET',
    'OPENAI_API_KEY',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars);
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  console.log('✅ Environment configuration validated');
};
