import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '@/models';
import { config } from '@/config';

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<IUser, 'password'>;
  token: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  static async registerUser(data: RegisterData): Promise<AuthResponse> {
    const { name, email, password } = data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Generate JWT token
    const token = this.generateToken(user._id.toString());

    return {
      user: user.toJSON() as any,
      token,
    };
  }

  /**
   * Login user
   */
  static async loginUser(data: LoginData): Promise<AuthResponse> {
    const { email, password } = data;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = this.generateToken(user._id.toString());

    return {
      user: user.toJSON() as any,
      token,
    };
  }

  /**
   * Generate JWT token
   */
  static generateToken(userId: string): string {
    return (jwt as any).sign(
      { userId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): { userId: string } {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<IUser | null> {
    return await User.findById(userId);
  }

  /**
   * Update user password
   */
  static async updatePassword(userId: string, newPassword: string): Promise<void> {
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await User.findByIdAndUpdate(userId, { password: hashedPassword });
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updateData: Partial<RegisterData>): Promise<IUser | null> {
    const allowedUpdates = ['name', 'email'];
    const updates: any = {};

    for (const field of allowedUpdates) {
      if (updateData[field as keyof RegisterData]) {
        updates[field] = updateData[field as keyof RegisterData];
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new Error('No valid fields to update');
    }

    // Check if email is being updated and if it's already taken
    if (updates.email) {
      const existingUser = await User.findOne({ 
        email: updates.email, 
        _id: { $ne: userId } 
      });
      if (existingUser) {
        throw new Error('Email is already taken');
      }
    }

    return await User.findByIdAndUpdate(userId, updates, { new: true });
  }
}
