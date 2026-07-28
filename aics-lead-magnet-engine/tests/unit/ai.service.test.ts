import axios from 'axios';
import { generateAiReport } from '../../src/services/ai.service';
import type { LogContext } from '../../src/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const testCtx: LogContext = {
  requestId: 'test-request-id',
  component: 'TestAiService',
};

const pillars = [
  { label: 'Gobernanza', score: 12 },
  { label: 'Gestión de Riesgos', score: 8 },
  { label: 'Control Interno', score: 10 },
  { label: 'Tecnología', score: 13 },
];

describe('generateAiReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return content on successful API call', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content:
                'El diagnóstico general muestra un nivel de madurez intermedio.\n\nEl pilar más débil es Gestión de Riesgos.\n\nComo Quick Win recomendamos implementar un registro de riesgos básico.',
            },
          },
        ],
        model: 'gpt-4o-mini',
        usage: { total_tokens: 350 },
      },
    });

    const result = await generateAiReport(
      'Carlos Pérez',
      'Tecnología',
      43,
      pillars,
      testCtx
    );

    expect(result).toContain('diagnóstico general');
    expect(result).toContain('Quick Win');
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);

    // Verify the URL uses the configurable endpoint
    const callUrl = mockedAxios.post.mock.calls[0][0];
    expect(callUrl).toContain('/chat/completions');
  });

  it('should use "Auditor" fallback when name is undefined', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: 'Informe para Auditor.' } }],
        model: 'gpt-4o-mini',
        usage: { total_tokens: 50 },
      },
    });

    const result = await generateAiReport(
      undefined,
      'Salud',
      32,
      pillars,
      testCtx
    );

    expect(result).toContain('Auditor');
  });

  it('should throw on empty response content', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: '' } }],
        model: 'gpt-4o-mini',
        usage: { total_tokens: 10 },
      },
    });

    await expect(
      generateAiReport('Test', 'Tech', 40, pillars, testCtx)
    ).rejects.toThrow('empty content');
  });

  it('should throw with status 502 on API error', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { status: 500, data: { error: { message: 'Server Error' } } },
    });

    await expect(
      generateAiReport('Test', 'Tech', 40, pillars, testCtx)
    ).rejects.toMatchObject({
      statusCode: 502,
    });
  });

  it('should mark 429 as retryable', async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: { status: 429, data: { error: { message: 'Rate limited' } } },
    });

    await expect(
      generateAiReport('Test', 'Tech', 40, pillars, testCtx)
    ).rejects.toMatchObject({
      retryable: true,
    });
  });
});