import { config } from '@/config';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export class Logger {
  private static isDevelopment = config.server.nodeEnv === 'development';

  static error(message: string, error?: any): void {
    console.error(`❌ [ERROR] ${message}`, error || '');
  }

  static warn(message: string, data?: any): void {
    console.warn(`⚠️ [WARN] ${message}`, data || '');
  }

  static info(message: string, data?: any): void {
    console.log(`ℹ️ [INFO] ${message}`, data || '');
  }

  static debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(`🐛 [DEBUG] ${message}`, data || '');
    }
  }

  static success(message: string, data?: any): void {
    console.log(`✅ [SUCCESS] ${message}`, data || '');
  }
}
