import request from 'supertest';
import app from '../../src/app';
import fixtures from '../fixtures/sample-payload.json';
import * as aiService from '../../src/services/ai.service';
import * as pdfService from '../../src/services/pdf.service';
import * as dbService from '../../src/services/db.service';
import * as emailService from '../../src/services/email.service';

// Mock all external services
jest.mock('../../src/services/ai.service');
jest.mock('../../src/services/pdf.service');
jest.mock('../../src/services/db.service');
jest.mock('../../src/services/email.service');

const mockedAi = aiService as jest.Mocked<typeof aiService>;
const mockedPdf = pdfService as jest.Mocked<typeof pdfService>;
const mockedDb = dbService as jest.Mocked<typeof dbService>;
const mockedEmail = emailService as jest.Mocked<typeof emailService>;

const aiReportText =
  'Diagnóstico general: nivel intermedio.\n\nEl pilar más débil es Gestión de Riesgos.\n\nQuick Win: implementar registro de riesgos.';

beforeEach(() => {
  jest.clearAllMocks();
  mockedAi.generateAiReport.mockResolvedValue(aiReportText);
  mockedPdf.generatePdf.mockResolvedValue(Buffer.from('%PDF-1.4 fake'));
  mockedDb.insertLeadMySql.mockResolvedValue(undefined);
  mockedDb.appendToGoogleSheet.mockResolvedValue(undefined);
  mockedEmail.sendEmail.mockResolvedValue(undefined);
});

describe('POST /api/v1/scorecard/process', () => {
  it('should return preview mode (no email)', async () => {
    const res = await request(app)
      .post('/api/v1/scorecard/process')
      .send(fixtures.validPreview)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body.mode).toBe('preview');
    expect(res.body.totalScore).toBe(43);
    expect(res.body.pillars).toHaveLength(4);
    expect(res.body.aiReport).toBe(aiReportText);

    // Should NOT call DB, PDF, or Email services
    expect(mockedPdf.generatePdf).not.toHaveBeenCalled();
    expect(mockedDb.insertLeadMySql).not.toHaveBeenCalled();
    expect(mockedDb.appendToGoogleSheet).not.toHaveBeenCalled();
    expect(mockedEmail.sendEmail).not.toHaveBeenCalled();
  });

  it('should return full lead capture (with email)', async () => {
    const res = await request(app)
      .post('/api/v1/scorecard/process')
      .send(fixtures.validFull)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body.mode).toBe('full');
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('correo');

    // Should call PDF, DB, and Email services
    expect(mockedPdf.generatePdf).toHaveBeenCalledTimes(1);
    expect(mockedDb.insertLeadMySql).toHaveBeenCalledTimes(1);
    expect(mockedDb.appendToGoogleSheet).toHaveBeenCalledTimes(1);
    expect(mockedEmail.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('should fallback to "Auditor" when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/scorecard/process')
      .send(fixtures.noNamePreview)
      .expect(200);

    expect(res.body.mode).toBe('preview');
    expect(res.body.totalScore).toBe(32);

    // AI should have been called
    expect(mockedAi.generateAiReport).toHaveBeenCalledTimes(1);
    const aiCallName = mockedAi.generateAiReport.mock.calls[0][0];
    expect(aiCallName).toBeUndefined(); // original name is undefined
  });

  it('should return 400 for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/scorecard/process')
      .send(fixtures.invalidEmail)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for missing answers', async () => {
    const res = await request(app)
      .post('/api/v1/scorecard/process')
      .send(fixtures.invalidMissingAnswers)
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('should return 502 when AI service fails', async () => {
    mockedAi.generateAiReport.mockRejectedValueOnce({
      message: 'AI provider error',
      statusCode: 502,
    });

    const res = await request(app)
      .post('/api/v1/scorecard/process')
      .send(fixtures.validPreview)
      .expect(502);

    expect(res.body.success).toBe(false);
  });

  it('should handle DB failure gracefully in full mode', async () => {
    mockedDb.insertLeadMySql.mockRejectedValueOnce(
      new Error('Connection failed')
    );

    const res = await request(app)
      .post('/api/v1/scorecard/process')
      .send(fixtures.validFull)
      .expect(200);

    // Should still succeed — DB errors are non-fatal in the flow
    expect(res.body.mode).toBe('full');
    expect(res.body.success).toBe(true);
  });

  it('should return 200 on health check', async () => {
    const res = await request(app)
      .get('/health')
      .expect(200);

    expect(res.body.status).toBe('ok');
  });
});