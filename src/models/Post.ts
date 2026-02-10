import mongoose, { Document, Schema } from 'mongoose';

export interface IPost extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  caption: string;
  mediaUrl?: string;
  backgroundUrl?: string;
  images?: string[]; // Array of image URLs
  platform: string[];
  postType?: string; // Type of post (accessories, clothing, electronics, etc.)
  currency?: string; // Currency code (TND, USD, EUR, etc.)
  price?: number; // Product price (float)
  productName?: string; // Product name
  description?: string; // Product description
  backgroundType?: string; // Background type used (white, color, scene)
  backgroundColor?: string; // Background color (hex code)
  useModel?: string; // Whether model was used (yes, no)
  modelEthnicity?: string; // Model ethnicity (european, american, arab, asian)
  modelGender?: string; // Model gender (male, female)
  addText?: string; // Whether text was added to image (yes, no)
  scheduledAt?: Date;
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema<IPost>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  caption: {
    type: String,
    required: false,
    trim: true,
    default: '',
    maxlength: [2200, 'Caption cannot exceed 2200 characters'], // Instagram limit
  },
  mediaUrl: {
    type: String,
    trim: true,
  },
  backgroundUrl: {
    type: String,
    trim: true,
  },
  images: [{
    type: String,
    trim: true,
  }],
  platform: [{
    type: String,
    enum: ['facebook', 'instagram', 'tiktok', 'twitter'],
    required: true,
  }],
  postType: {
    type: String,
    enum: ['accessories', 'clothing', 'electronics', 'furniture', 'beauty', 'food', 'sports', 'books', 'toys', 'automotive', 'home', 'other'],
    trim: true,
  },
  currency: {
    type: String,
    enum: ['DT', '$', '€'],
    default: 'DT',
    trim: true,
  },
  price: {
    type: Number,
  },
  productName: {
    type: String,
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters'],
  },
  backgroundType: {
    type: String,
    enum: ['white', 'color' ,'scene'],
    trim: true,
  },
  backgroundColor: {
    type: String,
    trim: true,
  },
  useModel: {
    type: String,
    enum: ['yes', 'no'],
    trim: true,
  },
  modelEthnicity: {
    type: String,
    enum: ['european', 'american', 'arab', 'asian'],
    trim: true,
  },
  modelGender: {
    type: String,
    enum: ['male', 'female'],
    trim: true,
  },
  addText: {
    type: String,
    enum: ['yes', 'no'],
    trim: true,
  },
  scheduledAt: {
    type: Date,
    validate: {
      validator: function(value: Date) {
        return !value || value > new Date();
      },
      message: 'Scheduled date must be in the future',
    },
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'posted', 'failed'],
    default: 'draft',
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ status: 1 });
PostSchema.index({ scheduledAt: 1 });
PostSchema.index({ platform: 1 });

// Virtual for checking if post is scheduled
PostSchema.virtual('isScheduled').get(function() {
  return this.scheduledAt && this.scheduledAt > new Date();
});

// Ensure virtual fields are serialized
PostSchema.set('toJSON', { virtuals: true });

export const Post = mongoose.model<IPost>('Post', PostSchema);
