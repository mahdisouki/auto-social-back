import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sender: 'client' | 'page';
  content: string;
  aiResponse: boolean;
  platform: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  sender: {
    type: String,
    enum: ['client', 'page'],
    required: [true, 'Sender is required'],
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [2000, 'Message content cannot exceed 2000 characters'],
  },
  aiResponse: {
    type: Boolean,
    default: false,
  },
  platform: {
    type: String,
    required: [true, 'Platform is required'],
    enum: ['facebook', 'instagram', 'tiktok', 'twitter'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
MessageSchema.index({ userId: 1, timestamp: -1 });
MessageSchema.index({ platform: 1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ aiResponse: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
