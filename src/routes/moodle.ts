import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { withContext } from '../utils/logger';
import {
  getPendingLeads,
  getAllLeads,
  getLeadById,
  markLeadProcessed,
  getMoodleStats,
} from '../services/db.service';
import type { LogContext } from '../types';

const router = Router();

/**
 * GET /api/v1/moodle/leads
 *
 * List all leads, with optional filters.
 *
 * Query params:
 *   ?processed=true|false   — Filter by processed status
 *   ?limit=50               — Max results per page (default 50)
 *   ?offset=0               — Pagination offset
 *   ?minScore=32            — Minimum total score
 *   ?maxScore=48            — Maximum total score
 *   ?industry=Tecnología    — Filter by industry
 */
router.get('/leads', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const ctx: LogContext = { requestId, component: 'MoodleRoute' };
  const logger = withContext(ctx);

  const startTime = Date.now();

  try {
    const processed = req.query.processed !== undefined
      ? req.query.processed === 'true'
      : undefined;

    const { leads, total } = await getAllLeads(
      {
        processed,
        limit: parseInt(String(req.query.limit ?? '50'), 10),
        offset: parseInt(String(req.query.offset ?? '0'), 10),
        minScore: req.query.minScore ? parseInt(String(req.query.minScore), 10) : undefined,
        maxScore: req.query.maxScore ? parseInt(String(req.query.maxScore), 10) : undefined,
        industry: req.query.industry ? String(req.query.industry) : undefined,
      },
      ctx
    );

    logger.info('Moodle leads listed', {
      count: leads.length,
      total,
      elapsedMs: Date.now() - startTime,
    });

    res.json({
      success: true,
      data: leads,
      pagination: {
        total,
        limit: parseInt(String(req.query.limit ?? '50'), 10),
        offset: parseInt(String(req.query.offset ?? '0'), 10),
      },
    });
  } catch (error: any) {
    logger.error('Failed to list Moodle leads', {
      error: error.message,
      elapsedMs: Date.now() - startTime,
    });
    res.status(500).json({
      success: false,
      error: 'Error al obtener leads',
      code: 'ERR_500',
      requestId,
    });
  }
});

/**
 * GET /api/v1/moodle/leads/pending
 *
 * Convenience endpoint: list only unprocessed leads (oldest first).
 * This is the primary endpoint Moodle should poll.
 *
 * Query params:
 *   ?limit=50   — Max results
 *   ?offset=0   — Pagination
 */
router.get('/leads/pending', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const ctx: LogContext = { requestId, component: 'MoodleRoute' };
  const logger = withContext(ctx);

  const startTime = Date.now();

  try {
    const limit = parseInt(String(req.query.limit ?? '50'), 10);
    const offset = parseInt(String(req.query.offset ?? '0'), 10);

    const { leads, total } = await getPendingLeads(limit, offset, ctx);

    logger.info('Moodle pending leads fetched', {
      count: leads.length,
      total,
      elapsedMs: Date.now() - startTime,
    });

    res.json({
      success: true,
      data: leads,
      pagination: { total, limit, offset },
    });
  } catch (error: any) {
    logger.error('Failed to fetch pending leads', {
      error: error.message,
      elapsedMs: Date.now() - startTime,
    });
    res.status(500).json({
      success: false,
      error: 'Error al obtener leads pendientes',
      code: 'ERR_500',
      requestId,
    });
  }
});

/**
 * GET /api/v1/moodle/leads/:id
 *
 * Get a single lead with full details (including AI report).
 */
router.get('/leads/:id', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const ctx: LogContext = { requestId, component: 'MoodleRoute' };
  const logger = withContext(ctx);

  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      res.status(400).json({
        success: false,
        error: 'ID inválido',
        code: 'ERR_400',
        requestId,
      });
      return;
    }

    const lead = await getLeadById(id, ctx);
    if (!lead) {
      res.status(404).json({
        success: false,
        error: 'Lead no encontrado',
        code: 'ERR_404',
        requestId,
      });
      return;
    }

    logger.info('Moodle lead fetched', { leadId: id });
    res.json({ success: true, data: lead });
  } catch (error: any) {
    logger.error('Failed to fetch lead', {
      error: error.message,
      leadId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: 'Error al obtener el lead',
      code: 'ERR_500',
      requestId,
    });
  }
});

/**
 * POST /api/v1/moodle/leads/:id/process
 *
 * Mark a lead as processed (consumed by Moodle).
 * Once marked, it will no longer appear in the pending list.
 */
router.post('/leads/:id/process', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const ctx: LogContext = { requestId, component: 'MoodleRoute' };
  const logger = withContext(ctx);

  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id < 1) {
      res.status(400).json({
        success: false,
        error: 'ID inválido',
        code: 'ERR_400',
        requestId,
      });
      return;
    }

    const ok = await markLeadProcessed(id, ctx);

    if (!ok) {
      res.status(404).json({
        success: false,
        error: 'Lead no encontrado o ya procesado',
        code: 'ERR_404',
        requestId,
      });
      return;
    }

    logger.info('Moodle lead processed', { leadId: id });
    res.json({
      success: true,
      message: `Lead ${id} marcado como procesado`,
    });
  } catch (error: any) {
    logger.error('Failed to process lead', {
      error: error.message,
      leadId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: 'Error al procesar el lead',
      code: 'ERR_500',
      requestId,
    });
  }
});

/**
 * GET /api/v1/moodle/stats
 *
 * Aggregated statistics for the Moodle dashboard.
 * Returns totals, score distribution, and industry breakdown.
 */
router.get('/stats', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const ctx: LogContext = { requestId, component: 'MoodleRoute' };
  const logger = withContext(ctx);

  try {
    const stats = await getMoodleStats(ctx);

    logger.info('Moodle stats served', { requestId });
    res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Failed to compute Moodle stats', {
      error: error.message,
    });
    res.status(500).json({
      success: false,
      error: 'Error al calcular estadísticas',
      code: 'ERR_500',
      requestId,
    });
  }
});

export default router;