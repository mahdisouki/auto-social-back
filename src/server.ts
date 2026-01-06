import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { config, validateConfig } from '@/config';
import { connectDatabase } from '@/config/database';
import { configureCloudinary } from '@/config/cloudinary';
import { AIService } from '@/services/aiService';
import { N8nService } from '@/services/n8nService';
import { JobScheduler } from '@/jobs/scheduler';

import apiRoutes from '@/routes';
import webhookRoutes from '@/routes/webhooks';

class AutoSocialServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.server.corsOrigin,
        methods: ['GET', 'POST'],
      },
    });

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeSocketIO();
  }

  private initializeMiddlewares(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: config.server.corsOrigin,
      credentials: true,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        success: false,
        message: 'Too many requests, please try again later.',
      },
    });
    this.app.use('/api', limiter);

    // Logging
    this.app.use(morgan('combined'));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Static files
    this.app.use('/uploads', express.static('uploads'));
  }

  private initializeRoutes(): void {
    // API routes
    this.app.use('/api', apiRoutes);
    
    // Webhook routes (no rate limiting)
    this.app.use('/webhooks', webhookRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'AutoSocial API Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
      });
    });

    // Error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Error:', err);
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
      });
    });
  }

  private initializeSocketIO(): void {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Join user room for personalized updates
      socket.on('join-user-room', (userId: string) => {
        socket.join(`user-${userId}`);
        console.log(`👤 User ${userId} joined their room`);
      });

      // Handle post updates
      socket.on('post-update', (data) => {
        socket.to(`user-${data.userId}`).emit('post-updated', data);
      });

      // Handle message updates
      socket.on('message-update', (data) => {
        socket.to(`user-${data.userId}`).emit('message-updated', data);
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      });
    });
  }

  public async start(): Promise<void> {
    try {
      // Validate configuration
      validateConfig();

      // Connect to database
      await connectDatabase();

      // Initialize services
      configureCloudinary();
      AIService.initialize();
      N8nService.initialize();

      // Initialize job scheduler
      await JobScheduler.initialize();
      await JobScheduler.scheduleCleanup();
      await JobScheduler.scheduleHealthCheck();

      // Start server
      this.server.listen(config.server.port, () => {
        console.log(`🚀 AutoSocial server running on port ${config.server.port}`);
        console.log(`📱 Environment: ${config.server.nodeEnv}`);
        console.log(`🌐 CORS Origin: ${config.server.corsOrigin}`);
      });

      // Graceful shutdown
      process.on('SIGTERM', this.gracefulShutdown.bind(this));
      process.on('SIGINT', this.gracefulShutdown.bind(this));

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(): Promise<void> {
    console.log('🛑 Shutting down server gracefully...');
    
    try {
      // Stop accepting new connections
      this.server.close(() => {
        console.log('✅ HTTP server closed');
      });

      // Shutdown job scheduler
      await JobScheduler.shutdown();

      // Close database connection
      const { disconnectDatabase } = await import('@/config/database');
      await disconnectDatabase();

      console.log('✅ Graceful shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new AutoSocialServer();
server.start().catch((error) => {
  console.error('❌ Failed to start AutoSocial server:', error);
  process.exit(1);
});

export default server;
