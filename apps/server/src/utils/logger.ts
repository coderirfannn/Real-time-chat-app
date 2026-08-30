import { config } from '../config/index.js';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

export interface LogContext {
  requestId?: string;
  userId?: string;
  module?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export class Logger {
  private module: string;

  constructor(module = 'App') {
    this.module = module;
  }

  private shouldLog(level: LogLevel): boolean {
    const configuredLevel = config.logging.level;
    if (configuredLevel === 'silent') return false;

    const currentPriority = LOG_LEVEL_PRIORITY[level];
    const thresholdPriority = LOG_LEVEL_PRIORITY[configuredLevel as LogLevel] || 30;

    return currentPriority >= thresholdPriority;
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext | Error): string {
    const timestamp = new Date().toISOString();
    const isPretty = config.logging.pretty && config.app.isDevelopment;

    let errorDetails: Record<string, unknown> | undefined;
    let metadata: Record<string, unknown> = {};

    if (context instanceof Error) {
      errorDetails = {
        name: context.name,
        message: context.message,
        stack: context.stack,
      };
    } else if (context) {
      const { ...rest } = context;
      metadata = rest;
    }

    if (isPretty) {
      const colorMap: Record<LogLevel, string> = {
        trace: '\x1b[90m',
        debug: '\x1b[34m',
        info: '\x1b[32m',
        warn: '\x1b[33m',
        error: '\x1b[31m',
        fatal: '\x1b[35m',
      };
      const reset = '\x1b[0m';
      const color = colorMap[level] || reset;
      const metaStr = Object.keys(metadata).length ? ` | ${JSON.stringify(metadata)}` : '';
      const errStr = errorDetails
        ? `\n  Error: ${errorDetails['message']}\n  ${errorDetails['stack']}`
        : '';

      return `[${timestamp}] ${color}${level.toUpperCase()}${reset} [${this.module}] ${message}${metaStr}${errStr}`;
    }

    // Structured JSON log for production/staging/observability
    const logObject = {
      timestamp,
      level,
      module: this.module,
      message,
      environment: config.app.env,
      ...metadata,
      ...(errorDetails ? { error: errorDetails } : {}),
    };

    return JSON.stringify(logObject);
  }

  public trace(message: string, context?: LogContext): void {
    if (this.shouldLog('trace')) {
      // eslint-disable-next-line no-console
      console.log(this.formatMessage('trace', message, context));
    }
  }

  public debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.log(this.formatMessage('debug', message, context));
    }
  }

  public info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(this.formatMessage('info', message, context));
    }
  }

  public warn(message: string, context?: LogContext | Error): void {
    if (this.shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(this.formatMessage('warn', message, context));
    }
  }

  public error(message: string, context?: LogContext | Error): void {
    if (this.shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(this.formatMessage('error', message, context));
    }
  }

  public fatal(message: string, context?: LogContext | Error): void {
    if (this.shouldLog('fatal')) {
      // eslint-disable-next-line no-console
      console.error(this.formatMessage('fatal', message, context));
    }
  }

  public child(submodule: string): Logger {
    return new Logger(`${this.module}:${submodule}`);
  }
}

export const logger = new Logger('ChatLock');
