import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@/services/authService';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
      };
    }
  }
}

/**
 * Authentication middleware
 * Verifies JWT token and adds user info to request
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
      return;
    }

    const decoded = AuthService.verifyToken(token);
    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user info if token is present, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = AuthService.verifyToken(token);
      req.user = { userId: decoded.userId };
    }
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

/**
 * Admin role middleware
 * Requires authentication and admin role
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const user = await AuthService.getUserById(req.user.userId);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying admin access' 
    });
  }
};

/**
 * Pro plan middleware
 * Requires authentication and pro plan
 */
export const requireProPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const user = await AuthService.getUserById(req.user.userId);
    if (!user || (user.plan !== 'pro' && user.role !== 'admin')) {
      res.status(403).json({ 
        success: false, 
        message: 'Pro plan required for this feature' 
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error verifying plan access' 
    });
  }
};
