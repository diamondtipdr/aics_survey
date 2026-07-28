"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function getEnv(key, fallback) {
    const val = process.env[key] ?? fallback;
    if (val === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return val;
}
exports.config = {
    port: parseInt(getEnv('PORT', '3000'), 10),
    nodeEnv: getEnv('NODE_ENV', 'development'),
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
    googleServiceAccountKey: getEnv('GOOGLE_SERVICE_ACCOUNT_KEY', ''),
    googleSheetId: getEnv('GOOGLE_SHEET_ID', ''),
    // Mailgun
    mailgunApiKey: getEnv('MAILGUN_API_KEY', ''),
    mailgunDomain: getEnv('MAILGUN_DOMAIN', ''),
    // Logging
    logLevel: getEnv('LOG_LEVEL', 'info'),
    logToFile: getEnv('LOG_TO_FILE', 'true') === 'true',
    logFilePath: getEnv('LOG_FILE_PATH', '/app/logs/app.log'),
    auditEnabled: getEnv('AUDIT_ENABLED', 'true') === 'true',
};
//# sourceMappingURL=config.js.map