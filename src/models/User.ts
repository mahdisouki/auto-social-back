import mongoose, { Document, Schema } from 'mongoose';

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
  };
  createdAt: Date;
  updatedAt: Date;
}

const ConnectedAccountsSchema = new Schema({
  facebook: { type: String, default: null },
  instagram: { type: String, default: null },
  tiktok: { type: String, default: null },
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
