"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.insertLeadMySql = insertLeadMySql;
exports.appendToGoogleSheet = appendToGoogleSheet;
exports.closeDb = closeDb;
const fs_1 = __importDefault(require("fs"));
const promise_1 = __importDefault(require("mysql2/promise"));
const googleapis_1 = require("googleapis");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
// ──────────────────────────────────────────────
// MySQL Connection Pool (singleton)
// ──────────────────────────────────────────────
let pool = null;
function getPool() {
    if (!pool) {
        pool = promise_1.default.createPool({
            host: config_1.config.dbHost,
            port: config_1.config.dbPort,
            user: config_1.config.dbUser,
            password: config_1.config.dbPassword,
            database: config_1.config.dbName,
            waitForConnections: true,
            connectionLimit: 20,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
        });
    }
    return pool;
}
/**
 * Insert a lead record into MySQL (aics_leads table).
 */
async function insertLeadMySql(record, ctx) {
    const logger = (0, logger_1.withContext)(ctx);
    const conn = getPool();
    const sql = `
    INSERT INTO aics_leads
      (name, email, total_score, pillar_1_score, pillar_2_score, pillar_3_score, pillar_4_score, answers, industry, dept_size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
    const values = [
        record.name,
        record.email,
        record.totalScore,
        record.pillar1Score,
        record.pillar2Score,
        record.pillar3Score,
        record.pillar4Score,
        JSON.stringify(record.answers),
        record.industry || null,
        record.deptSize || null,
    ];
    try {
        await conn.execute(sql, values);
        logger.info('Lead inserted into MySQL', { email: record.email });
    }
    catch (error) {
        logger.error('MySQL insert failed', {
            error: error.message,
            code: error.code,
        });
        throw Object.assign(new Error(`Database insert failed: ${error.message}`), { statusCode: 503, retryable: error.code === 'ER_LOCK_DEADLOCK' });
    }
}
// ──────────────────────────────────────────────
// Google Sheets Integration
// ──────────────────────────────────────────────
/**
 * Append a lead record to the configured Google Sheet.
 * Uses a Service Account for authentication.
 */
async function appendToGoogleSheet(record, ctx) {
    const logger = (0, logger_1.withContext)(ctx);
    if (!config_1.config.googleServiceAccountKeyPath || !config_1.config.googleSheetId) {
        logger.warn('Google Sheets not configured — skipping append');
        return;
    }
    try {
        const keyRaw = fs_1.default.readFileSync(config_1.config.googleServiceAccountKeyPath, 'utf-8');
        const serviceAccount = JSON.parse(keyRaw);
        const auth = new googleapis_1.google.auth.JWT({
            email: serviceAccount.client_email,
            key: serviceAccount.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({
            spreadsheetId: config_1.config.googleSheetId,
            range: 'Sheet1!A:H',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [
                    [
                        record.name,
                        record.email,
                        record.totalScore,
                        record.pillar1Score,
                        record.pillar2Score,
                        record.pillar3Score,
                        record.pillar4Score,
                        new Date().toISOString(),
                        record.industry || '',
                        record.deptSize || '',
                    ],
                ],
            },
        });
        logger.info('Lead appended to Google Sheet', { email: record.email });
    }
    catch (error) {
        logger.error('Google Sheets append failed', {
            error: error.message,
        });
        // Non-fatal — log but don't throw
    }
}
/**
 * Gracefully close MySQL pool (call on shutdown).
 */
async function closeDb() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
//# sourceMappingURL=db.service.js.map