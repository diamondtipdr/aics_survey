import axios from 'axios';
import { config } from '../utils/config';
import { withContext } from '../utils/logger';
import type { LogContext } from '../types';

const log = withContext({ requestId: 'system', component: 'AiService' });

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
export async function generateAiReport(
  industry: string | undefined,
  totalScore: number,
  pillars: { label: string; score: number }[],
  ctx: LogContext
): Promise<string> {
  const logger = withContext(ctx);
  const industryStr = industry?.trim() || 'su industria';

  const pillarStr = pillars
    .map((p) => `Pillar ${p.label.split(' ')[0]} (${p.label}): ${p.score}/16`)
    .join('\n');

  const systemPrompt =
    'Act as an elite expert in internal audit, risk, and compliance. Your tone is pragmatic, direct, and anti-dogmatic. You focus on practical results over rigid purism. Analyze scores based on the AICS methodology. Do NOT invent frameworks, do not provide external links, and do not use generic corporate jargon. Answer strictly in LATAM Spanish.';

  const userPrompt = `The user from the ${industryStr} industry scored ${totalScore}/64 points.
Scores by pillar (Max 16 each):
Pillar 1 (Integración): ${pillars[0]?.score ?? 0}
Pillar 2 (Automatización): ${pillars[1]?.score ?? 0}
Pillar 3 (Agilidad): ${pillars[2]?.score ?? 0}
Pillar 4 (Impacto & Comunicación): ${pillars[3]?.score ?? 0}

Write a strict 5-paragraph diagnostic report.
Paragraph 1: Direct assessment of their overall maturity level based on the total score.
Paragraph 2: Brief diagnosis of Pillar 1 and exactly ONE highly actionable advice (Quick Win) to improve it.
Paragraph 3: Brief diagnosis of Pillar 2 and exactly ONE highly actionable advice (Quick Win) to improve it.
Paragraph 4: Brief diagnosis of Pillar 3 and exactly ONE highly actionable advice (Quick Win) to improve it.
Paragraph 5: Brief diagnosis of Pillar 4 and exactly ONE highly actionable advice (Quick Win) to improve it.

RULES: Use 'usted', be direct, no greetings, no markdown, just plain text separated by newlines. DO NOT INCLUDE ANY URLS OR LINKS.`;

  logger.info('Calling AI provider', {
    model: config.openaiModel,
    baseUrl: config.openaiApiBase,
  });

  try {
    const response = await axios.post(
      `${config.openaiApiBase}/chat/completions`,
      {
        model: config.openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.2,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        timeout: 30_000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('AI response returned empty content');
    }

    logger.info('AI report generated successfully', {
      model: response.data?.model,
      tokens: response.data?.usage?.total_tokens,
    });

    return content;
  } catch (error: any) {
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

    throw Object.assign(
      new Error(`AI provider error (${status || 'network'}): ${detail}`),
      { statusCode: 502, retryable: status >= 500 || !status }
    );
  }
}