import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import scorecardRouter from './routes/scorecard';
import moodleRouter from './routes/moodle';
import { withContext } from './utils/logger';
import { config } from './utils/config';

const app = express();

// ── Trust proxy (required when behind Nginx/reverse proxy) ──
app.set('trust proxy', 1);

// ── Security Middleware ──
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https://quickchart.io'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS — restrict to configured origin in production ──
const corsOrigin = config.corsOrigin;
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(s => s.trim()),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  maxAge: 86400,
}));

app.use(express.json({ limit: '100kb' }));

// ── Rate Limiting ──
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
    code: 'ERR_RATE_LIMIT',
  },
});
app.use(generalLimiter);

// ── Moodle API Key Auth — protects all /api/v1/moodle/* routes ──
app.use('/api/v1/moodle', (req, res, next) => {
  const moodleApiKey = config.moodleApiKey;
  if (!moodleApiKey) {
    res.status(500).json({
      success: false,
      error: 'MOODLE_API_KEY no configurada en el servidor',
      code: 'ERR_CONFIG',
    });
    return;
  }
  const providedKey = req.headers['x-api-key'] as string | undefined;
  if (!providedKey || providedKey !== moodleApiKey) {
    res.status(401).json({
      success: false,
      error: 'No autorizado. X-Api-Key inválida o faltante.',
      code: 'ERR_401',
    });
    return;
  }
  next();
});

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