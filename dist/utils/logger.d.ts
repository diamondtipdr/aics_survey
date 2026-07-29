import winston from 'winston';
import { LogContext } from '../types';
export declare const logger: winston.Logger;
/** Create a child logger with request/component context */
export declare function withContext(ctx: LogContext): winston.Logger;
//# sourceMappingURL=logger.d.ts.map