import type { LeadRecord, LogContext } from '../types';
/**
 * Insert a lead record into MySQL (aics_leads table).
 */
export declare function insertLeadMySql(record: LeadRecord, ctx: LogContext): Promise<void>;
/**
 * Append a lead record to the configured Google Sheet.
 * Uses a Service Account for authentication.
 */
export declare function appendToGoogleSheet(record: LeadRecord, ctx: LogContext): Promise<void>;
/**
 * Gracefully close MySQL pool (call on shutdown).
 */
export declare function closeDb(): Promise<void>;
//# sourceMappingURL=db.service.d.ts.map