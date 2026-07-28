import app from './app';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { closeDb } from './services/db.service';

const server = app.listen(config.port, () => {
  logger.info('AICS Lead Magnet Engine started', {
    port: config.port,
    env: config.nodeEnv,
    aiModel: config.openaiModel,
    aiBase: config.openaiApiBase,
    hasMailgun: !!config.mailgunApiKey,
    hasGoogleSheets: !!config.googleSheetId,
    auditEnabled: config.auditEnabled,
  });
});

// ── Graceful Shutdown ──
async function shutdown(signal: string) {
  logger.info(`Received ${signal} — shutting down gracefully...`);

  server.close(async () => {
    await closeDb();
    logger.info('Server shut down complete');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));