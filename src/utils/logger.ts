import winston from 'winston';
import { config } from './config';
import { LogContext } from '../types';

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const ctx = meta.context ? ` [${meta.context}]` : '';
    return `${timestamp} ${level}${ctx}: ${message}${
      Object.keys(meta).length > 1 ? ` ${JSON.stringify(omit(meta, ['context']))}` : ''
    }`;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({ format: consoleFormat }),
];

if (config.logToFile) {
  transports.push(
    new winston.transports.File({
      filename: config.logFilePath,
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    })
  );
}

export const logger = winston.createLogger({
  level: config.logLevel,
  transports,
});

/** Create a child logger with request/component context */
export function withContext(ctx: LogContext): winston.Logger {
  return logger.child({ context: ctx.component, requestId: ctx.requestId });
}

function omit(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result = { ...obj };
  for (const key of keys) delete result[key];
  return result;
}