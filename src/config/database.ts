import mongoose from 'mongoose';
import { config } from './index';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = config.database.mongoUri;
    
    if (!mongoUri) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});
