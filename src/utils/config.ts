import dotenv from 'dotenv';
import path from 'path';
import { AppConfig } from '../types';

dotenv.config();

function getEnv(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const config: AppConfig = {
  port: parseInt(getEnv('PORT', '3000'), 10),
  nodeEnv: getEnv('NODE_ENV', 'development'),

  // CORS — comma-separated origins, or * for all
  corsOrigin: getEnv('CORS_ORIGIN', '*'),

  // Rate limiting — max requests per 15-min window
  rateLimitMax: parseInt(getEnv('RATE_LIMIT_MAX', '100'), 10),

  // OpenAI
  openaiApiKey: getEnv('OPENAI_API_KEY'),
  openaiApiBase: getEnv('OPENAI_API_BASE', 'https://api.openai.com/v1'),
  openaiModel: getEnv('OPENAI_MODEL', 'gpt-4o-mini'),

  // MySQL
  dbHost: getEnv('DB_HOST', 'localhost'),
  dbPort: parseInt(getEnv('DB_PORT', '3306'), 10),
  dbUser: getEnv('DB_USER', 'root'),
  dbPassword: getEnv('DB_PASSWORD', ''),
  dbName: getEnv('DB_NAME', 'aics_leads'),

  // Google Sheets
  googleServiceAccountKey: '', // loaded from file at runtime
  googleServiceAccountKeyPath: getEnv('GOOGLE_SERVICE_ACCOUNT_KEY_PATH', getEnv('GOOGLE_SERVICE_ACCOUNT_KEY', '')),
  googleSheetId: getEnv('GOOGLE_SHEET_ID', ''),

  // Mailgun
  mailgunApiKey: getEnv('MAILGUN_API_KEY', ''),
  mailgunDomain: getEnv('MAILGUN_DOMAIN', ''),

  // Moodle API
  moodleApiKey: getEnv('MOODLE_API_KEY', ''),

  // Logging
  logLevel: getEnv('LOG_LEVEL', 'info'),
  logToFile: getEnv('LOG_TO_FILE', 'true') === 'true',
  logFilePath: getEnv('LOG_FILE_PATH', path.join(__dirname, '../../logs/app.log')),
  auditEnabled: getEnv('AUDIT_ENABLED', 'true') === 'true',
};