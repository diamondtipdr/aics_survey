import type { LogContext } from '../types';
/**
 * Render the HTML report template with dynamic data,
 * then convert to a PDF buffer.
 */
export declare function generatePdf(data: {
    name: string;
    totalScore: number;
    maxScore: number;
    pillars: {
        label: string;
        score: number;
        maxScore: number;
    }[];
    aiReport: string;
    logoBase64?: string;
    radarChartUrl?: string;
}, ctx: LogContext): Promise<Buffer>;
//# sourceMappingURL=pdf.service.d.ts.map