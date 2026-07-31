import axios from 'axios';
import FormData from 'form-data';
import { config } from '../utils/config';
import { withContext } from '../utils/logger';
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
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  pdfBuffer: Buffer,
  pdfFilename: string,
  ctx: LogContext,
  textBody?: string
): Promise<void> {
  const logger = withContext(ctx);

  if (!config.mailgunApiKey || !config.mailgunDomain) {
    logger.warn('Mailgun not configured — skipping email dispatch');
    return;
  }

  const form = new FormData();
  form.append('from', `AICS Auditoría <noreply@${config.mailgunDomain}>`);
  form.append('to', to);
  form.append('subject', subject);
  form.append('html', htmlBody);
  if (textBody) form.append('text', textBody);
  form.append('attachment', pdfBuffer, {
    filename: pdfFilename,
    contentType: 'application/pdf',
  });

  try {
    const response = await axios.post(
      `https://api.mailgun.net/v3/${config.mailgunDomain}/messages`,
      form,
      {
        auth: {
          username: 'api',
          password: config.mailgunApiKey,
        },
        headers: form.getHeaders(),
        timeout: 30_000,
      }
    );

    logger.info('Email dispatched via Mailgun', {
      to,
      messageId: response.data?.id,
    });
  } catch (error: any) {
    const status = error?.response?.status;
    const detail = error?.response?.data?.message || error.message;
    logger.error('Mailgun dispatch failed', { status, detail });

    if (status === 401 || status === 403) {
      throw Object.assign(
        new Error(`Mailgun authentication error: ${detail}`),
        { statusCode: 502, retryable: false }
      );
    }

    throw Object.assign(
      new Error(`Email dispatch failed (${status || 'network'}): ${detail}`),
      { statusCode: 502, retryable: status >= 500 || !status }
    );
  }
}

/**
 * Build the professional Spanish email body for the report delivery.
 * Includes the Moodle academy credentials block for the free course.
 */
export function buildReportEmailHtml(userName: string, email: string): string {
  const courseUrl = 'https://auditan.do/cursos/fundamentos';
  const academyUrl = 'https://academia.auditan.do';
  const tempPassword = 'Auditan.do2026!';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f7fa;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;padding:30px 10px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a3a5c 0%,#2a6f97 100%);padding:30px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">
                🎯 Reporte de Diagnóstico AICS
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 20px;">
                Hola <strong>${escapeHtml(userName)}</strong>,
              </p>
              <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">
                Gracias por completar nuestra autoevaluación de madurez en auditoría.
                Hemos preparado un <strong>informe ejecutivo personalizado</strong> con
                el análisis de sus resultados, incluyendo:
              </p>
              <ul style="color:#555;font-size:15px;line-height:1.8;margin:0 0 25px;padding-left:20px;">
                <li>📊 Su puntuación general y desglose por pilares</li>
                <li>📋 Diagnóstico generado por inteligencia artificial</li>
                <li>💡 Recomendaciones y "Quick Wins" accionables</li>
              </ul>
              <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 20px;">
                El informe completo está adjunto en este correo en formato PDF.
              </p>

              <!-- Moodle Academy Credentials -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;margin:25px 0;">
                <tr>
                  <td style="padding:25px;">
                    <h3 style="color:#166534;font-size:17px;margin:0 0 12px;">
                      🎓 ¡Tienes acceso a nuestro curso introductorio gratuito!
                    </h3>
                    <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 15px;">
                      Para que puedas implementar tu plan de acción de inmediato, te hemos creado una cuenta en la
                      <strong>Academia Auditan.do</strong> con acceso al curso
                      <strong>"Fundamentos de Auditoría Inteligente"</strong>.
                    </p>
                    <ul style="color:#555;font-size:14px;line-height:1.8;margin:0 0 15px;padding-left:20px;">
                      <li><strong>URL de la Academia:</strong> <a href="${academyUrl}" target="_blank" style="color:#166534;">${academyUrl}</a></li>
                      <li><strong>Tu Usuario:</strong> ${escapeHtml(email)}</li>
                      <li><strong>Contraseña Temporal:</strong> ${tempPassword}</li>
                    </ul>
                    <p style="color:#888;font-size:13px;line-height:1.5;margin:0;font-style:italic;">
                      Nota: Por seguridad, el sistema te pedirá cambiar esta contraseña al ingresar.
                      Te recomendamos también ir a "Mi Perfil" para actualizar tu nombre y apellido
                      correctos para la emisión de tus futuros certificados.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef6ff;border-radius:8px;border:1px solid #cce5ff;margin:25px 0;">
                <tr>
                  <td style="padding:25px;text-align:center;">
                    <h2 style="color:#1a3a5c;font-size:18px;margin:0 0 10px;">
                      🚀 ¿Listo para el siguiente nivel?
                    </h2>
                    <p style="color:#555;font-size:14px;line-height:1.5;margin:0 0 15px;">
                      Conozca nuestro curso <strong>"Fundamentos de Auditoría Inteligente"</strong>
                      y transforme sus conocimientos en resultados concretos.
                    </p>
                    <a href="${courseUrl}" target="_blank"
                       style="display:inline-block;background:linear-gradient(135deg,#2a6f97 0%,#1a3a5c 100%);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
                      👉 Ver curso
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#888;font-size:13px;line-height:1.5;margin:20px 0 0;border-top:1px solid #eee;padding-top:20px;">
                Si tiene preguntas, responda directamente a este correo.<br>
                <em>Atentamente, el equipo de AICS Capacitación.</em>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fa;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="color:#aaa;font-size:12px;margin:0;">
                AICS Capacitación &bull; Auditoría Inteligente, Control y Supervisión<br>
                Este correo fue enviado a ${escapeHtml(userName)} como parte del servicio de autoevaluación.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Build the plain-text version of the report email, including the
 * Moodle academy credentials block.
 */
export function buildReportEmailText(userName: string, email: string): string {
  const academyUrl = 'https://academia.auditan.do';
  const tempPassword = 'Auditan.do2026!';

  return `
Hola ${userName},

Gracias por completar nuestra autoevaluación de madurez en auditoría.
Hemos preparado un informe ejecutivo personalizado con el análisis de
sus resultados, incluyendo su puntuación general, el desglose por pilares
y recomendaciones accionables. El informe completo está adjunto en este
correo en formato PDF.

¡Tienes acceso a nuestro curso introductorio gratuito!
Para que puedas implementar tu plan de acción de inmediato, te hemos
creado una cuenta en la Academia Auditan.do con acceso al curso
"Fundamentos de Auditoría Inteligente".

- URL de la Academia: ${academyUrl}
- Tu Usuario: ${email}
- Contraseña Temporal: ${tempPassword}

Nota: Por seguridad, el sistema te pedirá cambiar esta contraseña al
ingresar. Te recomendamos también ir a "Mi Perfil" para actualizar tu
nombre y apellido correctos para la emisión de tus futuros certificados.

Atentamente, el equipo de AICS Capacitación.
`.trim();
}