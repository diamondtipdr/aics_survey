import fs from 'fs';
import mysql from 'mysql2/promise';
import { google } from 'googleapis';
import { config } from '../utils/config';
import { withContext } from '../utils/logger';
import type { LeadRecord, LogContext, Answer, MoodleLead, MoodleStats } from '../types';

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
      (name, email, total_score, pillar_1_score, pillar_2_score, pillar_3_score, pillar_4_score, answers, industry, dept_size, country, ai_report)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    record.country || null,
    record.aiReport || null,
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
      range: 'Sheet1!A:L',
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
            record.country || '',
            record.aiReport || '',
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

// ──────────────────────────────────────────────
// Moodle Integration — Lead Queries
// ──────────────────────────────────────────────

/**
 * Maps a MySQL row to a MoodleLead object.
 */
function rowToMoodleLead(row: any): MoodleLead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    totalScore: row.total_score,
    pillar1Score: row.pillar_1_score,
    pillar2Score: row.pillar_2_score,
    pillar3Score: row.pillar_3_score,
    pillar4Score: row.pillar_4_score,
    answers: typeof row.answers === 'string' ? JSON.parse(row.answers) : row.answers,
    industry: row.industry,
    deptSize: row.dept_size,
    country: row.country,
    aiReport: row.ai_report,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
    processed: !!row.processed,
  };
}

/**
 * Fetch pending (unprocessed) leads, ordered by creation date.
 * @param limit  Max results (default 50)
 * @param offset Pagination offset (default 0)
 */
export async function getPendingLeads(
  limit: number = 50,
  offset: number = 0,
  ctx: LogContext
): Promise<{ leads: MoodleLead[]; total: number }> {
  const logger = withContext(ctx);
  const conn = getPool();

  const [countRows] = await conn.execute(
    'SELECT COUNT(*) AS total FROM aics_leads WHERE processed = FALSE',
  );
  const total = (countRows as any[])[0]?.total ?? 0;

  const [rows] = await conn.execute(
    'SELECT * FROM aics_leads WHERE processed = FALSE ORDER BY created_at ASC LIMIT ? OFFSET ?',
    [limit, offset]
  );

  const leads = (rows as any[]).map(rowToMoodleLead);
  logger.info('Fetched pending leads for Moodle', { count: leads.length, total });
  return { leads, total };
}

/**
 * Fetch all leads (processed + pending), with optional filters.
 */
export async function getAllLeads(
  options: {
    processed?: boolean;
    limit?: number;
    offset?: number;
    minScore?: number;
    maxScore?: number;
    industry?: string;
  },
  ctx: LogContext
): Promise<{ leads: MoodleLead[]; total: number }> {
  const logger = withContext(ctx);
  const conn = getPool();

  const conditions: string[] = [];
  const params: any[] = [];

  if (options.processed !== undefined) {
    conditions.push('processed = ?');
    params.push(options.processed ? 1 : 0);
  }
  if (options.minScore !== undefined) {
    conditions.push('total_score >= ?');
    params.push(options.minScore);
  }
  if (options.maxScore !== undefined) {
    conditions.push('total_score <= ?');
    params.push(options.maxScore);
  }
  if (options.industry) {
    conditions.push('industry = ?');
    params.push(options.industry);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM aics_leads ${where}`,
    params
  );
  const total = (countRows as any[])[0]?.total ?? 0;

  const [rows] = await conn.execute(
    `SELECT * FROM aics_leads ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const leads = (rows as any[]).map(rowToMoodleLead);
  logger.info('Fetched leads for Moodle', { count: leads.length, total, filters: options });
  return { leads, total };
}

/**
 * Get a single lead by ID.
 */
export async function getLeadById(
  id: number,
  ctx: LogContext
): Promise<MoodleLead | null> {
  const logger = withContext(ctx);
  const conn = getPool();

  const [rows] = await conn.execute(
    'SELECT * FROM aics_leads WHERE id = ?',
    [id]
  );

  const result = (rows as any[])[0];
  if (!result) {
    logger.warn('Lead not found', { leadId: id });
    return null;
  }

  return rowToMoodleLead(result);
}

/**
 * Mark a lead as processed (consumed by Moodle).
 */
export async function markLeadProcessed(
  id: number,
  ctx: LogContext
): Promise<boolean> {
  const logger = withContext(ctx);
  const conn = getPool();

  const [result] = await conn.execute(
    'UPDATE aics_leads SET processed = TRUE WHERE id = ? AND processed = FALSE',
    [id]
  );

  const affected = (result as any).affectedRows ?? 0;
  if (affected === 0) {
    logger.warn('Lead not found or already processed', { leadId: id });
    return false;
  }

  logger.info('Lead marked as processed', { leadId: id });
  return true;
}

/**
 * Get aggregated statistics for the Moodle dashboard.
 */
export async function getMoodleStats(ctx: LogContext): Promise<MoodleStats> {
  const logger = withContext(ctx);
  const conn = getPool();

  const [totalRows] = await conn.execute('SELECT COUNT(*) AS total FROM aics_leads');
  const totalLeads = (totalRows as any[])[0]?.total ?? 0;

  const [pendingRows] = await conn.execute(
    'SELECT COUNT(*) AS total FROM aics_leads WHERE processed = FALSE'
  );
  const pendingLeads = (pendingRows as any[])[0]?.total ?? 0;

  const [avgRows] = await conn.execute(
    'SELECT COALESCE(AVG(total_score), 0) AS avg FROM aics_leads'
  );
  const averageScore = Math.round(((avgRows as any[])[0]?.avg ?? 0) * 10) / 10;

  // Score distribution: basic (16-31), intermediate (32-47), advanced (48-64)
  const [distRows] = await conn.execute(`
    SELECT
      SUM(CASE WHEN total_score BETWEEN 16 AND 31 THEN 1 ELSE 0 END) AS basic,
      SUM(CASE WHEN total_score BETWEEN 32 AND 47 THEN 1 ELSE 0 END) AS intermediate,
      SUM(CASE WHEN total_score BETWEEN 48 AND 64 THEN 1 ELSE 0 END) AS advanced
    FROM aics_leads
  `);
  const dist = (distRows as any[])[0] ?? { basic: 0, intermediate: 0, advanced: 0 };

  // Industry breakdown
  const [industryRows] = await conn.execute(`
    SELECT industry, COUNT(*) AS count
    FROM aics_leads
    WHERE industry IS NOT NULL
    GROUP BY industry
    ORDER BY count DESC
  `);
  const industryBreakdown: Record<string, number> = {};
  for (const row of industryRows as any[]) {
    industryBreakdown[row.industry] = row.count;
  }

  const stats: MoodleStats = {
    totalLeads,
    pendingLeads,
    processedLeads: totalLeads - pendingLeads,
    averageScore,
    scoreDistribution: {
      basic: Number(dist.basic),
      intermediate: Number(dist.intermediate),
      advanced: Number(dist.advanced),
    },
    industryBreakdown,
  };

  logger.info('Moodle stats computed', stats);
  return stats;
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