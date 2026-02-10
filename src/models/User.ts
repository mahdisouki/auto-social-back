import mongoose, { Document, Schema } from 'mongoose';

export interface FacebookPage {
  pageId: string;
  pageName: string;
  accessToken: string;
  category: string;
  connectedAt: Date;
  instagramAccount?: {
    accountId: string;
    username: string;
    accessToken: string;
  };
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  plan: 'free' | 'pro';
  connectedAccounts: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    facebookPages?: FacebookPage[];
  };
  metaUserToken?: string; // User's short-lived access token
  credits: number;
  createdAt: Date;
  updatedAt: Date;
}

const InstagramAccountSchema = new Schema({
  accountId: { type: String, required: true },
  username: { type: String, required: true },
  accessToken: { type: String, required: true },
}, { _id: false });

const FacebookPageSchema = new Schema({
  pageId: { type: String, required: true },
  pageName: { type: String, required: true },
  accessToken: { type: String, required: true },
  category: { type: String },
  connectedAt: { type: Date, default: Date.now },
  instagramAccount: { type: InstagramAccountSchema, default: null },
}, { _id: false });

const ConnectedAccountsSchema = new Schema({
  facebook: { type: String, default: null },
  instagram: { type: String, default: null },
  tiktok: { type: String, default: null },
  facebookPages: { type: [FacebookPageSchema], default: [] },
}, { _id: false });

const UserSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
  },
  plan: {
    type: String,
    enum: ['free', 'pro'],
    default: 'free',
  },
  connectedAccounts: {
    type: ConnectedAccountsSchema,
    default: {},
  },
  metaUserToken: {
    type: String,
    default: null,
  },
  credits: {
    type: Number,
    default: 5,
    min: 0,
  },
}, {
  timestamps: true,
});

// Index for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ createdAt: -1 });

// Transform the output to remove sensitive data
UserSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

export const User = mongoose.model<IUser>('User', UserSchema);
