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
  name: string | undefined,
  industry: string | undefined,
  totalScore: number,
  pillars: { label: string; score: number }[],
  ctx: LogContext
): Promise<string> {
  const logger = withContext(ctx);
  const userName = name?.trim() || 'Auditor';
  const industryStr = industry?.trim() || 'su industria';

  const pillarStr = pillars
    .map((p) => `${p.label}: ${p.score}/16`)
    .join(', ');

  const systemPrompt =
    'Eres un asistente experto en auditoría que redacta informes ejecutivos. Responde ÚNICAMENTE con el texto del informe, sin introducciones ni despedidas.';

  const userPrompt = `Eres un experto en auditoría. El usuario ${userName} de la industria ${industryStr} obtuvo ${totalScore}/64 puntos. Puntajes por pilar: ${pillarStr}.

Escribe un informe ejecutivo de exactamente 3 párrafos:
1) Diagnóstico general del nivel de madurez en auditoría.
2) El pilar más débil y el riesgo estratégico que representa.
3) Una "Quick Win" accionable y concreta que pueda implementar de inmediato.

REGLAS:
- Tono pragmático y profesional.
- Redacta en español LATAM.
- Trata al usuario de "usted".
- NO saludes ni te despidas.
- No incluyas títulos ni marcadores.
- Solo los 3 párrafos, sin texto adicional.`;

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
        max_tokens: 1024,
        temperature: 0.7,
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