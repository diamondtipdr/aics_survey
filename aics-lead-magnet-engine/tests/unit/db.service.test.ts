import { insertLeadMySql, appendToGoogleSheet } from '../../src/services/db.service';
import type { LeadRecord, LogContext } from '../../src/types';

// Mock mysql2
jest.mock('mysql2/promise', () => {
  const mockPool = {
    execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
    end: jest.fn(),
  };
  return {
    createPool: jest.fn().mockReturnValue(mockPool),
  };
});

const testCtx: LogContext = {
  requestId: 'test-db',
  component: 'TestDbService',
};

const testLead: LeadRecord = {
  name: 'Test User',
  email: 'test@example.com',
  totalScore: 43,
  pillar1Score: 12,
  pillar2Score: 8,
  pillar3Score: 10,
  pillar4Score: 13,
  answers: Array.from({ length: 16 }, (_, i) => ({
    questionId: i + 1,
    value: (i % 4) + 1 as 1 | 2 | 3 | 4,
  })),
  industry: 'Tecnología',
  deptSize: '11-50',
};

describe('insertLeadMySql', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should insert lead into MySQL successfully', async () => {
    await expect(
      insertLeadMySql(testLead, testCtx)
    ).resolves.toBeUndefined();
  });
});

describe('appendToGoogleSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should attempt Google Sheets append (may be skipped if not configured)', async () => {
    // The function will parse the GOOGLE_SERVICE_ACCOUNT_KEY from env
    await expect(
      appendToGoogleSheet(testLead, testCtx)
    ).resolves.toBeUndefined();
  });
});