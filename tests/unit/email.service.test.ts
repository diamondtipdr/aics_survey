import { sendEmail, buildReportEmailHtml, buildReportEmailText } from '../../src/services/email.service';
import type { LogContext } from '../../src/types';

jest.mock('axios');
const testCtx: LogContext = {
  requestId: 'test-email',
  component: 'TestEmailService',
};

describe('buildReportEmailHtml', () => {
  it('should generate valid HTML with the user name', () => {
    const html = buildReportEmailHtml('María García', 'maria@example.com');
    expect(html).toContain('María García');
    expect(html).toContain('Reporte de Diagnóstico AICS');
    expect(html).toContain('Fundamentos de Auditoría Inteligente');
    expect(html).toContain('auditan.do/cursos/fundamentos');
  });

  it('should include the Moodle academy credentials block when provided', () => {
    const html = buildReportEmailHtml('María García', 'maria@example.com', {
      username: 'maria',
      password: 'TempPass123!',
    });
    expect(html).toContain('¡Tienes acceso a nuestro curso introductorio gratuito!');
    expect(html).toContain('Academia Auditoría Inteligente');
    expect(html).toContain('https://academia.auditan.do');
    expect(html).toContain('Su usuario es:');
    expect(html).toContain('maria');
    expect(html).toContain('Su contraseña temporal es:');
    expect(html).toContain('TempPass123!');
    expect(html).toContain('actualizar su nombre y contraseña por seguridad');
  });

  it('should omit the credentials block when no credentials are provided', () => {
    const html = buildReportEmailHtml('María García', 'maria@example.com');
    expect(html).not.toContain('¡Tienes acceso a nuestro curso introductorio gratuito!');
    expect(html).not.toContain('Su contraseña temporal es:');
    expect(html).not.toContain('Academia Auditoría Inteligente');
  });

  it('should escape HTML in user names and emails', () => {
    const html = buildReportEmailHtml('<script>alert("xss")</script>', 'a<b@example.com');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('a<b@example.com');
  });
});

describe('buildReportEmailText', () => {
  it('should include the Moodle credentials in plain text when provided', () => {
    const text = buildReportEmailText('María García', 'maria@example.com', {
      username: 'maria',
      password: 'TempPass123!',
    });
    expect(text).toContain('María García');
    expect(text).toContain('https://academia.auditan.do');
    expect(text).toContain('Su usuario es: maria');
    expect(text).toContain('Su contraseña temporal es: TempPass123!');
    expect(text).toContain('Fundamentos de Auditoría Inteligente');
  });

  it('should omit the credentials block when no credentials are provided', () => {
    const text = buildReportEmailText('María García', 'maria@example.com');
    expect(text).not.toContain('Su contraseña temporal es:');
    expect(text).not.toContain('Academia Auditoría Inteligente');
  });
});

describe('sendEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use Mailgun API to send email with PDF attachment', async () => {
    const axios = require('axios');
    axios.post.mockResolvedValueOnce({
      data: { id: '<20240728123456.1.mailgun@mg.example.com>' },
    });

    const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
    await sendEmail(
      'test@example.com',
      'Test Subject',
      '<p>HTML body</p>',
      pdfBuffer,
      'report.pdf',
      testCtx
    );

    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, formData, config] = axios.post.mock.calls[0];
    expect(url).toContain('mg.example.com');
    expect(config.auth.password).toBe('test-mailgun-key');
  });

  it('should throw on Mailgun auth error', async () => {
    const axios = require('axios');
    axios.post.mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Unauthorized' } },
    });

    const pdfBuffer = Buffer.from('%PDF');
    await expect(
      sendEmail(
        'test@example.com',
        'Subject',
        '<p>Body</p>',
        pdfBuffer,
        'report.pdf',
        testCtx
      )
    ).rejects.toMatchObject({
      statusCode: 502,
      retryable: false,
    });
  });
});