import fs from 'fs';
import mysql from 'mysql2/promise';
import { google } from 'googleapis';
import { config } from '../utils/config';
import { withContext } from '../utils/logger';
import type { LeadRecord, LogContext, Answer } from '../types';

// ──────────────────────────────────────────────
// MySQL Connection Pool (singleton)
// ──────────────────────────────────────────────
let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
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
export async function insertLeadMySql(
  record: LeadRecord,
  ctx: LogContext
): Promise<void> {
  const logger = withContext(ctx);
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
  } catch (error: any) {
    logger.error('MySQL insert failed', {
      error: error.message,
      code: error.code,
    });
    throw Object.assign(
      new Error(`Database insert failed: ${error.message}`),
      { statusCode: 503, retryable: error.code === 'ER_LOCK_DEADLOCK' }
    );
  }
}

// ──────────────────────────────────────────────
// Google Sheets Integration
// ──────────────────────────────────────────────

/**
 * Append a lead record to the configured Google Sheet.
 * Uses a Service Account for authentication.
 */
export async function appendToGoogleSheet(
  record: LeadRecord,
  ctx: LogContext
): Promise<void> {
  const logger = withContext(ctx);

  if (!config.googleServiceAccountKeyPath || !config.googleSheetId) {
    logger.warn('Google Sheets not configured — skipping append');
    return;
  }

  try {
    const keyRaw = fs.readFileSync(config.googleServiceAccountKeyPath, 'utf-8');
    const serviceAccount = JSON.parse(keyRaw);

    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheetId,
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
  } catch (error: any) {
    logger.error('Google Sheets append failed', {
      error: error.message,
    });
    // Non-fatal — log but don't throw
  }
}

/**
 * Gracefully close MySQL pool (call on shutdown).
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}