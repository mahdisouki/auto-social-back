import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Validation middleware factory
 * Creates middleware that validates request data against a Joi schema
 */
export const validate = (schema: Joi.ObjectSchema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[property], { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
      return;
    }

    // Replace the original data with validated and sanitized data
    req[property] = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  // User registration
  register: Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters',
      'any.required': 'Name is required'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    })
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    })
  }),

  // Post creation
  createPost: Joi.object({
    caption: Joi.string().max(2200).optional().allow('').messages({
      'string.max': 'Caption cannot exceed 2200 characters'
    }),
    platform: Joi.array().items(
      Joi.string().valid('facebook', 'instagram', 'tiktok', 'twitter')
    ).min(1).required().messages({
      'array.min': 'At least one platform must be selected',
      'any.required': 'Platform selection is required'
    }),
    scheduledAt: Joi.date().greater('now').optional().messages({
      'date.greater': 'Scheduled date must be in the future'
    }),
    images: Joi.array().items(Joi.string()).max(5).optional().messages({
      'array.max': 'Maximum 5 images allowed'
    }),
    postType: Joi.string().optional(),
    currency: Joi.string().optional(),
    price: Joi.string().optional(),
    productName: Joi.string().optional(),
    description: Joi.string().optional(),
    backgroundType: Joi.string().valid('white', 'color', 'scene').optional(),
    backgroundColor: Joi.string().optional(),
    useModel: Joi.string().valid('yes', 'no').optional(),
    modelGender: Joi.string().valid('male', 'female').optional(),
    addText: Joi.string().valid('yes', 'no').optional()
  }),

  // Post update
  updatePost: Joi.object({
    caption: Joi.string().max(2200).optional().allow(''),
    platform: Joi.array().items(
      Joi.string().valid('facebook', 'instagram', 'tiktok', 'twitter')
    ).min(1).optional(),
    scheduledAt: Joi.date().greater('now').optional().allow(null).messages({
      'date.greater': 'Scheduled date must be in the future'
    }),
    postType: Joi.string().valid(
      'accessories', 'clothing', 'electronics', 'furniture', 'beauty', 'food',
      'sports', 'books', 'toys', 'automotive', 'home', 'other'
    ).optional().allow(''),
    productName: Joi.string().max(200).optional().allow(''),
    description: Joi.string().max(1000).optional().allow(''),
    price: Joi.string().optional().allow(''),
    currency: Joi.string().valid('TND', 'USD', 'EUR').optional(),
  }),

  // Message creation
  createMessage: Joi.object({
    content: Joi.string().max(2000).required().messages({
      'string.max': 'Message content cannot exceed 2000 characters',
      'any.required': 'Message content is required'
    }),
    platform: Joi.string().valid('facebook', 'instagram', 'tiktok', 'twitter').required().messages({
      'any.required': 'Platform is required'
    }),
    sender: Joi.string().valid('client', 'page').required().messages({
      'any.required': 'Sender type is required'
    })
  }),

  // Chat response
  chatResponse: Joi.object({
    message: Joi.string().max(2000).required().messages({
      'string.max': 'Message cannot exceed 2000 characters',
      'any.required': 'Message is required'
    }),
    context: Joi.string().max(500).optional().messages({
      'string.max': 'Context cannot exceed 500 characters'
    })
  }),


  // Automation creation
  createAutomation: Joi.object({
    trigger: Joi.string().valid('new_message', 'scheduled_post', 'post_published', 'user_registered').required().messages({
      'any.required': 'Trigger type is required'
    }),
    n8nWebhookUrl: Joi.string().uri().required().messages({
      'string.uri': 'Please provide a valid webhook URL',
      'any.required': 'Webhook URL is required'
    }),
    metadata: Joi.object().optional()
  }),

  // ObjectId validation
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'Invalid ID format',
    'any.required': 'ID is required'
  })
};
