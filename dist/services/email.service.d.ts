import type { LogContext } from '../types';
/**
 * Send an email via the Mailgun REST API with a PDF attachment.
 *
 * @param to        - Recipient email address
 * @param subject   - Email subject
 * @param htmlBody  - HTML email body (Spanish)
 * @param pdfBuffer - Raw PDF bytes to attach
 * @param pdfFilename - Filename for the attachment
 * @param ctx       - Logging context
 */
export declare function sendEmail(to: string, subject: string, htmlBody: string, pdfBuffer: Buffer, pdfFilename: string, ctx: LogContext): Promise<void>;
/**
 * Build the professional Spanish email body for the report delivery.
 */
export declare function buildReportEmailHtml(userName: string): string;
//# sourceMappingURL=email.service.d.ts.map