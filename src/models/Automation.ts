import mongoose, { Document, Schema } from 'mongoose';

export interface IAutomation extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  trigger: 'new_message' | 'scheduled_post' | 'post_published' | 'user_registered';
  n8nWebhookUrl: string;
  active: boolean;
  metadata?: {
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AutomationSchema = new Schema<IAutomation>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  trigger: {
    type: String,
    enum: ['new_message', 'scheduled_post', 'post_published', 'user_registered'],
    required: [true, 'Trigger type is required'],
  },
  n8nWebhookUrl: {
    type: String,
    required: [true, 'n8n webhook URL is required'],
    trim: true,
    match: [/^https?:\/\/.+/, 'Please enter a valid webhook URL'],
  },
  active: {
    type: Boolean,
    default: true,
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
AutomationSchema.index({ userId: 1, trigger: 1 });
AutomationSchema.index({ active: 1 });
AutomationSchema.index({ trigger: 1 });

export const Automation = mongoose.model<IAutomation>('Automation', AutomationSchema);
