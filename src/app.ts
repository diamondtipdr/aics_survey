import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import scorecardRouter from './routes/scorecard';
import moodleRouter from './routes/moodle';
import { withContext } from './utils/logger';

const app = express();

// ── Middleware ──
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// ── Serve static files from the built SPA ──
app.use(express.static(path.join(__dirname, '../dist/public')));

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
app.use('/api/v1/moodle', moodleRouter);

// ── 404 handler ──
app.use((_req, res) => {
  // If it's an API route, return JSON 404
  if (_req.path.startsWith('/api')) {
    res.status(404).json({
      success: false,
      error: 'Endpoint no encontrado',
      code: 'ERR_404',
    });
  } else {
    // Otherwise serve the SPA (React router will handle the route)
    res.sendFile(path.join(__dirname, '../dist/public/index.html'));
  }
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