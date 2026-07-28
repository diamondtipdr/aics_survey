"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.withContext = withContext;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const logDir = path_1.default.dirname(config_1.config.logFilePath);
const jsonFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'HH:mm:ss' }), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    const ctx = meta.context ? ` [${meta.context}]` : '';
    return `${timestamp} ${level}${ctx}: ${message}${Object.keys(meta).length > 1 ? ` ${JSON.stringify(omit(meta, ['context']))}` : ''}`;
}));
const transports = [
    new winston_1.default.transports.Console({ format: consoleFormat }),
];
if (config_1.config.logToFile) {
    transports.push(new winston_1.default.transports.File({
        filename: config_1.config.logFilePath,
        format: jsonFormat,
        maxsize: 10 * 1024 * 1024, // 10 MB
        maxFiles: 5,
    }));
}
exports.logger = winston_1.default.createLogger({
    level: config_1.config.logLevel,
    transports,
});
/** Create a child logger with request/component context */
function withContext(ctx) {
    return exports.logger.child({ context: ctx.component, requestId: ctx.requestId });
}
function omit(obj, keys) {
    const result = { ...obj };
    for (const key of keys)
        delete result[key];
    return result;
}
//# sourceMappingURL=logger.js.map