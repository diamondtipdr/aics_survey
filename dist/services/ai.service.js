"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAiReport = generateAiReport;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
const log = (0, logger_1.withContext)({ requestId: 'system', component: 'AiService' });
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
async function generateAiReport(industry, totalScore, pillars, ctx) {
    const logger = (0, logger_1.withContext)(ctx);
    const industryStr = industry?.trim() || 'su industria';
    const pillarStr = pillars
        .map((p) => `Pillar ${p.label.split(' ')[0]} (${p.label}): ${p.score}/16`)
        .join('\n');
    const systemPrompt = 'Act as an elite expert in internal audit, risk, and compliance. Your tone is pragmatic, direct, and anti-dogmatic. You focus on practical results over rigid purism. Analyze scores based on the AICS methodology. Do NOT invent frameworks, do not provide external links, and do not use generic corporate jargon. Answer strictly in LATAM Spanish.';
    const userPrompt = `The user from the ${industryStr} industry scored ${totalScore}/64 points.
Scores by pillar (Max 16 each):
Pillar 1 (Integración): ${pillars[0]?.score ?? 0}
Pillar 2 (Automatización): ${pillars[1]?.score ?? 0}
Pillar 3 (Agilidad): ${pillars[2]?.score ?? 0}
Pillar 4 (Impacto & Comunicación): ${pillars[3]?.score ?? 0}

Write a diagnostic report structured into EXACTLY 4 sections, one per pillar. Use the following EXACT format for each section:

### [Nombre del Pilar] (X/16)

[1-2 paragraphs of diagnosis for this pillar]

### Quick Win — [Nombre del Pilar]

[A single paragraph with one highly actionable quick win recommendation]

RULES:
- Use 'usted', be direct, no greetings, no salutations.
- Do NOT include an introductory paragraph or conclusion — start directly with "### Integración".
- Do NOT use markdown other than the ### headings specified above.
- Do NOT include any URLs or links.
- Separate sections with EXACTLY one blank line.`;
    logger.info('Calling AI provider', {
        model: config_1.config.openaiModel,
        baseUrl: config_1.config.openaiApiBase,
    });
    try {
        const response = await axios_1.default.post(`${config_1.config.openaiApiBase}/chat/completions`, {
            model: config_1.config.openaiModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            max_tokens: 1500,
            temperature: 0.2,
        }, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config_1.config.openaiApiKey}`,
            },
            timeout: 30_000,
        });
        const content = response.data?.choices?.[0]?.message?.content?.trim();
        if (!content) {
            throw new Error('AI response returned empty content');
        }
        logger.info('AI report generated successfully', {
            model: response.data?.model,
            tokens: response.data?.usage?.total_tokens,
        });
        return content;
    }
    catch (error) {
        const status = error?.response?.status;
        const detail = error?.response?.data?.error?.message || error.message;
        logger.error('AI provider call failed', { status, detail });
        if (status === 429) {
            // Rate limit — suggest retry
            throw Object.assign(new Error(`AI rate limit exceeded: ${detail}`), {
                statusCode: 502,
                retryable: true,
            });
        }
        if (status === 401 || status === 403) {
            throw Object.assign(new Error(`AI authentication error: ${detail}`), {
                statusCode: 502,
                retryable: false,
            });
        }
        throw Object.assign(new Error(`AI provider error (${status || 'network'}): ${detail}`), { statusCode: 502, retryable: status >= 500 || !status });
    }
}
//# sourceMappingURL=ai.service.js.map