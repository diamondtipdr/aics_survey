import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validatePayload, calculateScores, getPillarMap } from '../utils/validation';
import { generateAiReport } from '../services/ai.service';
import { generatePdf } from '../services/pdf.service';
import { insertLeadMySql, appendToGoogleSheet } from '../services/db.service';
import { sendEmail, buildReportEmailHtml } from '../services/email.service';
import { withContext } from '../utils/logger';
import type { LogContext, ScorecardResponse, LeadRecord, Answer } from '../types';

const router = Router();

/**
 * POST /api/v1/scorecard/process
 *
 * Gated workflow:
 * - If email is provided → Full Lead Capture (PDF + DB + Email)
 * - If email is NOT provided → Preview Mode (JSON only)
 */
router.post('/process', async (req: Request, res: Response) => {
  const requestId = uuidv4();
  const ctx: LogContext = { requestId, component: 'ScorecardRoute' };
  const logger = withContext(ctx);

  const startTime = Date.now();

  logger.info('Incoming scorecard request', {
    hasEmail: !!req.body?.email,
    hasName: !!req.body?.name,
    answersCount: req.body?.answers?.length,
  });

  try {
    // ── Step A: Validation ──
    const validation = validatePayload(req.body);
    if (!validation.success) {
      logger.warn('Validation failed', { errors: validation.errors });
      const response: ScorecardResponse = {
        success: false,
        error: validation.errors.join('; '),
        code: 'VALIDATION_ERROR',
        requestId,
      };
      res.status(400).json(response);
      return;
    }

    const { answers, name, email, industry, dept_size } = validation.data;

    // ── Step B: Score Calculation ──
    const pillarDefs = getPillarMap();
    const scores = calculateScores(answers);

    logger.info('Scores calculated', {
      totalScore: scores.totalScore,
      pillars: scores.pillars.map((p) => ({ label: p.label, score: p.score })),
    });

    // ── Step C: AI Analysis ──
    const aiReport = await generateAiReport(
      name,
      industry,
      scores.totalScore,
      scores.pillars.map((p) => ({ label: p.label, score: p.score })),
      ctx
    );

    // ── Step D: Conditional Branch ──

    // SCENARIO 1: Preview Mode (no email)
    if (!email) {
      logger.info('Preview mode — returning JSON only', {
        elapsedMs: Date.now() - startTime,
      });

      const response: ScorecardResponse = {
        mode: 'preview',
        totalScore: scores.totalScore,
        maxScore: scores.maxScore,
        pillars: scores.pillars,
        aiReport,
      };

      res.status(200).json(response);
      return;
    }

    // SCENARIO 2: Full Lead Capture (with email)
    const userName = name?.trim() || 'Auditor';

    // Generate PDF
    const pdfBuffer = await generatePdf(
      {
        name: userName,
        totalScore: scores.totalScore,
        maxScore: scores.maxScore,
        pillars: scores.pillars,
        aiReport,
      },
      ctx
    );

    // Build lead record
    const leadRecord: LeadRecord = {
      name: userName,
      email,
      totalScore: scores.totalScore,
      pillar1Score: scores.pillars[0]!.score,
      pillar2Score: scores.pillars[1]!.score,
      pillar3Score: scores.pillars[2]!.score,
      pillar4Score: scores.pillars[3]!.score,
      answers: answers as Answer[],
      industry,
      deptSize: dept_size,
    };

    // Insert into MySQL (fire-and-forget safety — errors are caught)
    try {
      await insertLeadMySql(leadRecord, ctx);
    } catch (dbErr: any) {
      logger.error('MySQL insert failed — continuing flow', {
        error: dbErr.message,
      });
    }

    // Append to Google Sheets (non-critical — log only)
    try {
      await appendToGoogleSheet(leadRecord, ctx);
    } catch (gsErr: any) {
      logger.warn('Google Sheets append failed — continuing flow', {
        error: gsErr.message,
      });
    }

    // Build email content
    const emailHtml = buildReportEmailHtml(userName);
    const pdfFilename = `reporte-aics-${email.replace(/[@.]/g, '-')}.pdf`;

    // Send email via Mailgun
    await sendEmail(
      email,
      '🎯 Tu Reporte de Diagnóstico AICS — Auditoría Inteligente',
      emailHtml,
      pdfBuffer,
      pdfFilename,
      ctx
    );

    logger.info('Full lead capture completed', {
      elapsedMs: Date.now() - startTime,
      email,
    });

    const response: ScorecardResponse = {
      mode: 'full',
      success: true,
      message: 'Reporte enviado al correo',
    };

    res.status(200).json(response);
  } catch (error: any) {
    const elapsedMs = Date.now() - startTime;
    const statusCode = error.statusCode || 500;
    const retryable = error.retryable ?? false;

    logger.error('Scorecard process failed', {
      error: error.message,
      statusCode,
      retryable,
      elapsedMs,
    });

    const response: ScorecardResponse = {
      success: false,
      error:
        statusCode === 500
          ? 'Error interno del servidor'
          : error.message,
      code: `ERR_${statusCode}`,
      requestId,
    };

    res.status(statusCode).json(response);
  }
});

export default router;