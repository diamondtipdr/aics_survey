import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import scorecardRouter from './routes/scorecard';
import { withContext } from './utils/logger';

const app = express();

// ── Middleware ──
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// ── Request logging middleware ──
app.use((req, _res, next) => {
  const logger = withContext({
    requestId: 'pre-route',
    component: 'Http',
  });
  if (process.env.AUDIT_ENABLED !== 'false') {
    logger.debug('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  }
  next();
});

// ── Health check ──
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── Routes ──
app.use('/api/v1/scorecard', scorecardRouter);

// ── 404 handler ──
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    code: 'ERR_404',
  });
});

// ── Global error handler ──
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const logger = withContext({
      requestId: 'global-error',
      component: 'App',
    });
    logger.error('Unhandled error', {
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'ERR_500',
    });
  }
);

export default app;