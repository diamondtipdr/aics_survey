"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = require("./utils/config");
const logger_1 = require("./utils/logger");
const db_service_1 = require("./services/db.service");
const server = app_1.default.listen(config_1.config.port, () => {
    logger_1.logger.info('AICS Lead Magnet Engine started', {
        port: config_1.config.port,
        env: config_1.config.nodeEnv,
        aiModel: config_1.config.openaiModel,
        aiBase: config_1.config.openaiApiBase,
        hasMailgun: !!config_1.config.mailgunApiKey,
        hasGoogleSheets: !!config_1.config.googleSheetId,
        auditEnabled: config_1.config.auditEnabled,
    });
});
// ── Graceful Shutdown ──
async function shutdown(signal) {
    logger_1.logger.info(`Received ${signal} — shutting down gracefully...`);
    server.close(async () => {
        await (0, db_service_1.closeDb)();
        logger_1.logger.info('Server shut down complete');
        process.exit(0);
    });
    // Force exit after 10 seconds
    setTimeout(() => {
        logger_1.logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10_000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
//# sourceMappingURL=server.js.map