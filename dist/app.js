"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const scorecard_1 = __importDefault(require("./routes/scorecard"));
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
// ── Middleware ──
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '100kb' }));
// ── Serve static files from the built SPA ──
app.use(express_1.default.static(path_1.default.join(__dirname, '../dist/public')));
// ── Request logging middleware ──
app.use((req, _res, next) => {
    const logger = (0, logger_1.withContext)({
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
app.use('/api/v1/scorecard', scorecard_1.default);
// ── 404 handler ──
app.use((_req, res) => {
    // If it's an API route, return JSON 404
    if (_req.path.startsWith('/api')) {
        res.status(404).json({
            success: false,
            error: 'Endpoint no encontrado',
            code: 'ERR_404',
        });
    }
    else {
        // Otherwise serve the SPA (React router will handle the route)
        res.sendFile(path_1.default.join(__dirname, '../dist/public/index.html'));
    }
});
// ── Global error handler ──
app.use((err, _req, res, _next) => {
    const logger = (0, logger_1.withContext)({
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
});
exports.default = app;
//# sourceMappingURL=app.js.map