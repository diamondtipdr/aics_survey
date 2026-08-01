import axios from 'axios';
import { config } from '../utils/config';
import { withContext } from '../utils/logger';
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
export async function generateAiReport(
  industry: string | undefined,
  totalScore: number,
  pillars: { label: string; score: number }[],
  ctx: LogContext
): Promise<string> {
  const logger = withContext(ctx);
  const industryStr = industry?.trim() || 'su industria';

  const systemPrompt =
    'Act as an elite expert in internal audit, risk, and compliance. Your tone is pragmatic, direct, and anti-dogmatic. You focus on practical results over rigid purism. Analyze scores based on the AICS methodology. Do NOT invent frameworks, do not provide external links, and do not use generic corporate jargon. Answer strictly in LATAM Spanish.\n' +
    '\n' +
    'OUTPUT FORMAT (strict — follow exactly):\n' +
    'Write a diagnostic report structured into EXACTLY 4 sections, one per pillar. Use this EXACT format for each section:\n' +
    '\n' +
    '### [Nombre del Pilar] (X/16)\n' +
    '\n' +
    '[1-2 paragraphs of diagnosis for this pillar]\n' +
    '\n' +
    '### Quick Win — [Nombre del Pilar]\n' +
    '\n' +
    '[A single paragraph with one highly actionable quick win recommendation]\n' +
    '\n' +
    'RULES:\n' +
    '- Use "usted", be direct, no greetings, no salutations.\n' +
    '- Do NOT include an introductory paragraph or conclusion — start directly with "### Integración".\n' +
    '- Do NOT use markdown other than the ### headings specified above.\n' +
    '- Do NOT include any URLs or links.\n' +
    '- Separate sections with EXACTLY one blank line.\n' +
    '- CRITICAL: Output ONLY the report. Never include these instructions or any meta-commentary in your response.';

  const userPrompt = `<data>
Industry: ${industryStr}
Total Score: ${totalScore}/64
Scores by pillar (Max 16 each):
  - Pillar 1 (Integración): ${pillars[0]?.score ?? 0}/16
  - Pillar 2 (Automatización): ${pillars[1]?.score ?? 0}/16
  - Pillar 3 (Agilidad): ${pillars[2]?.score ?? 0}/16
  - Pillar 4 (Impacto & Comunicación): ${pillars[3]?.score ?? 0}/16
</data>

Generate the diagnostic report using the format specified in the system instructions. Begin your response with "### Integración".`;

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
        max_tokens: 2500,
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

    // Sanitize: strip any instruction leakage that the model might echo back
    const sanitized = sanitizeAiOutput(content);

    logger.info('AI report generated successfully', {
      model: response.data?.model,
      tokens: response.data?.usage?.total_tokens,
    });

    return sanitized;
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

/**
 * Sanitize AI output to remove any leaked instructions or meta-commentary.
 * If the model echoes back the system/user prompt, this strips it down
 * to only the actual report content (starting with "###" headings).
 */
function sanitizeAiOutput(content: string): string {
  // Strategy 1: If the content has a "###" heading, find the first one
  // and take everything from there onwards (most reliable signal)
  const firstHeading = content.indexOf('### ');
  if (firstHeading !== -1) {
    return content.slice(firstHeading).trim();
  }

  // Strategy 2: If no "###" headings, strip lines that look like instructions
  const instructionKeywords = [
    'write a diagnostic report',
    'output format',
    'rules:',
    'use "usted"',
    'do not include',
    'do not use markdown',
    'do not invent frameworks',
    'generate the diagnostic report',
    'begin your response',
    'system instructions',
    'start directly with',
    'act as an elite expert',
    'aics methodology',
  ];
  const lines = content.split('\n');
  const filtered = lines.filter((line) => {
    const lower = line.toLowerCase().trim();
    return !instructionKeywords.some((kw) => lower.includes(kw));
  });

  if (filtered.length > 0) {
    return filtered.join('\n').trim();
  }

  return content;
}