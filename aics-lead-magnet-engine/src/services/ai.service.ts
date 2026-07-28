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
    'Eres Christian Vargas, un experto estricto y pragmático en auditoría interna. Tu tarea es exclusivamente analizar puntajes basados en la metodología AICS. NO inventes frameworks, NO proporciones enlaces externos, NO uses jerga corporativa genérica. Responde estrictamente en español LATAM.';

  const userPrompt = `El usuario de la industria ${industryStr} obtuvo ${totalScore}/64 puntos.
Puntajes por pilar (Máximo 16 cada uno):
Pillar 1 (Integración Metodológica): ${pillars[0]?.score ?? 0}
Pillar 2 (Automatización de Datos): ${pillars[1]?.score ?? 0}
Pillar 3 (Agilidad y Ejecución): ${pillars[2]?.score ?? 0}
Pillar 4 (Impacto y Comunicación): ${pillars[3]?.score ?? 0}

Escribe un informe estricto de exactamente 3 párrafos.
Párrafo 1: Evaluación directa de su nivel de madurez general basado en el puntaje total.
Párrafo 2: Identifica el pilar con menor puntaje específico. Explica el riesgo operativo de fallar en este pilar específico (sé altamente específico en auditoría).
Párrafo 3: Da exactamente UN consejo accionable y pragmático (Quick Win) para mejorar ese pilar más débil.

REGLAS: Usa 'usted', sé directo, sin saludos, sin markdown, solo texto plano separado por saltos de línea. NO INCLUYAS NINGÚN ENLACE O URL.`;

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