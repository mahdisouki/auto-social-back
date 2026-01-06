import { Types } from 'mongoose';

/**
 * Check if a string is a valid MongoDB ObjectId
 */
export const isValidObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

/**
 * Generate a random string of specified length
 */
export const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Format date to ISO string
 */
export const formatDate = (date: Date): string => {
  return date.toISOString();
};

/**
 * Calculate time difference in minutes
 */
export const getTimeDifferenceInMinutes = (date1: Date, date2: Date): number => {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60);
};

/**
 * Sanitize filename for safe storage
 */
export const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Truncate text to specified length
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

/**
 * Generate pagination metadata
 */
export const generatePaginationMeta = (
  page: number,
  limit: number,
  total: number
) => {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    hasNext: page < Math.ceil(total / limit),
    hasPrev: page > 1,
  };
};
