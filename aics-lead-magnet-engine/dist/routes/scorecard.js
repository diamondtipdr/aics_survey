"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const validation_1 = require("../utils/validation");
const ai_service_1 = require("../services/ai.service");
const pdf_service_1 = require("../services/pdf.service");
const db_service_1 = require("../services/db.service");
const email_service_1 = require("../services/email.service");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
/**
 * POST /api/v1/scorecard/process
 *
 * Gated workflow:
 * - If email is provided → Full Lead Capture (PDF + DB + Email)
 * - If email is NOT provided → Preview Mode (JSON only)
 */
router.post('/process', async (req, res) => {
    const requestId = (0, uuid_1.v4)();
    const ctx = { requestId, component: 'ScorecardRoute' };
    const logger = (0, logger_1.withContext)(ctx);
    const startTime = Date.now();
    logger.info('Incoming scorecard request', {
        hasEmail: !!req.body?.email,
        hasName: !!req.body?.name,
        answersCount: req.body?.answers?.length,
    });
    try {
        // ── Step A: Validation ──
        const validation = (0, validation_1.validatePayload)(req.body);
        if (!validation.success) {
            logger.warn('Validation failed', { errors: validation.errors });
            const response = {
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
        const pillarDefs = (0, validation_1.getPillarMap)();
        const scores = (0, validation_1.calculateScores)(answers);
        logger.info('Scores calculated', {
            totalScore: scores.totalScore,
            pillars: scores.pillars.map((p) => ({ label: p.label, score: p.score })),
        });
        // ── Step C: AI Analysis ──
        const aiReport = await (0, ai_service_1.generateAiReport)(name, industry, scores.totalScore, scores.pillars.map((p) => ({ label: p.label, score: p.score })), ctx);
        // ── Step D: Conditional Branch ──
        // SCENARIO 1: Preview Mode (no email)
        if (!email) {
            logger.info('Preview mode — returning JSON only', {
                elapsedMs: Date.now() - startTime,
            });
            const response = {
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
        const pdfBuffer = await (0, pdf_service_1.generatePdf)({
            name: userName,
            totalScore: scores.totalScore,
            maxScore: scores.maxScore,
            pillars: scores.pillars,
            aiReport,
        }, ctx);
        // Build lead record
        const leadRecord = {
            name: userName,
            email,
            totalScore: scores.totalScore,
            pillar1Score: scores.pillars[0].score,
            pillar2Score: scores.pillars[1].score,
            pillar3Score: scores.pillars[2].score,
            pillar4Score: scores.pillars[3].score,
            answers: answers,
            industry,
            deptSize: dept_size,
        };
        // Insert into MySQL (fire-and-forget safety — errors are caught)
        try {
            await (0, db_service_1.insertLeadMySql)(leadRecord, ctx);
        }
        catch (dbErr) {
            logger.error('MySQL insert failed — continuing flow', {
                error: dbErr.message,
            });
        }
        // Append to Google Sheets (non-critical — log only)
        try {
            await (0, db_service_1.appendToGoogleSheet)(leadRecord, ctx);
        }
        catch (gsErr) {
            logger.warn('Google Sheets append failed — continuing flow', {
                error: gsErr.message,
            });
        }
        // Build email content
        const emailHtml = (0, email_service_1.buildReportEmailHtml)(userName);
        const pdfFilename = `reporte-aics-${email.replace(/[@.]/g, '-')}.pdf`;
        // Send email via Mailgun
        await (0, email_service_1.sendEmail)(email, '🎯 Tu Reporte de Diagnóstico AICS — Auditoría Inteligente', emailHtml, pdfBuffer, pdfFilename, ctx);
        logger.info('Full lead capture completed', {
            elapsedMs: Date.now() - startTime,
            email,
        });
        const response = {
            mode: 'full',
            success: true,
            message: 'Reporte enviado al correo',
        };
        res.status(200).json(response);
    }
    catch (error) {
        const elapsedMs = Date.now() - startTime;
        const statusCode = error.statusCode || 500;
        const retryable = error.retryable ?? false;
        logger.error('Scorecard process failed', {
            error: error.message,
            statusCode,
            retryable,
            elapsedMs,
        });
        const response = {
            success: false,
            error: statusCode === 500
                ? 'Error interno del servidor'
                : error.message,
            code: `ERR_${statusCode}`,
            requestId,
        };
        res.status(statusCode).json(response);
    }
});
exports.default = router;
//# sourceMappingURL=scorecard.js.map