import { sendEmail, buildReportEmailHtml } from '../../src/services/email.service';
import type { LogContext } from '../../src/types';

jest.mock('axios');
const testCtx: LogContext = {
  requestId: 'test-email',
  component: 'TestEmailService',
};

describe('buildReportEmailHtml', () => {
  it('should generate valid HTML with the user name', () => {
    const html = buildReportEmailHtml('María García');
    expect(html).toContain('María García');
    expect(html).toContain('Reporte de Diagnóstico AICS');
    expect(html).toContain('Fundamentos de Auditoría Inteligente');
    expect(html).toContain('auditan.do/cursos/fundamentos');
  });

  it('should escape HTML in user names', () => {
    const html = buildReportEmailHtml('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
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