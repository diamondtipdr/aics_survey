import type { LogContext } from '../types';
/**
 * Generate an executive report in Spanish using an OpenAI-compatible API.
 *
 * @param name     - User's name (will fall back to "Auditor")
 * @param industry - Industry sector
 * @param totalScore - Total score (16-64)
 * @param pillars  - Array of { label, score } for each pillar
 * @param ctx      - Logging context
 * @returns The AI-generated text content
 */
export declare function generateAiReport(industry: string | undefined, totalScore: number, pillars: {
    label: string;
    score: number;
}[], ctx: LogContext): Promise<string>;
//# sourceMappingURL=ai.service.d.ts.map