import { generatePdf } from '../../src/services/pdf.service';
import type { LogContext } from '../../src/types';

const testCtx: LogContext = {
  requestId: 'test-pdf',
  component: 'TestPdfService',
};

const testData = {
  name: 'Test User',
  totalScore: 43,
  maxScore: 64,
  pillars: [
    { label: 'Gobernanza y Liderazgo', score: 12, maxScore: 16 },
    { label: 'Gestión de Riesgos', score: 8, maxScore: 16 },
    { label: 'Control Interno', score: 10, maxScore: 16 },
    { label: 'Tecnología y Datos', score: 13, maxScore: 16 },
  ],
  aiReport:
    'El diagnóstico general muestra un nivel de madurez intermedio.\n\nEl pilar más débil es Gestión de Riesgos.\n\nComo Quick Win recomendamos implementar un registro de riesgos básico.',
};

describe('generatePdf', () => {
  it('should generate a PDF buffer from template data', async () => {
    // This test requires Chromium — if not available, skip gracefully
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generatePdf(testData, testCtx);
    } catch (err: any) {
      if (
        err.message?.includes('Failed to launch') ||
        err.message?.includes('ENOENT') ||
        err.message?.includes('chromium')
      ) {
        console.warn('Skipping PDF test — Chromium not available in CI');
        return;
      }
      throw err;
    }

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(100);
    // PDF magic header
    expect(pdfBuffer.slice(0, 5).toString()).toBe('%PDF-');
  });
});