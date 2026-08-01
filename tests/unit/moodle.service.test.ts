import axios from 'axios';
import {
  provisionMoodleAccount,
  deriveFirstname,
  deriveUsername,
  generateSecurePassword,
  MOODLE_DEFAULT_LASTNAME,
} from '../../src/services/moodle.service';
import type { LogContext } from '../../src/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const testCtx: LogContext = {
  requestId: 'test-moodle',
  component: 'TestMoodleService',
};

describe('deriveUsername', () => {
  it('should return the local part of the email lowercased', () => {
    expect(deriveUsername('Chris.Vargas@Example.com')).toBe('chris.vargas');
  });

  it('should handle emails without a local part', () => {
    expect(deriveUsername('@example.com')).toBe('');
  });
});

describe('deriveFirstname', () => {
  it('should capitalize the first letter of the local part', () => {
    expect(deriveFirstname('chris.vargas@example.com')).toBe('Chris.vargas');
  });

  it('should handle emails without a local part', () => {
    expect(deriveFirstname('@example.com')).toBe('Prospecto');
  });
});

describe('generateSecurePassword', () => {
  it('should generate a 12-character password by default', () => {
    const password = generateSecurePassword();
    expect(password).toHaveLength(12);
  });

  it('should include at least one lowercase, uppercase, digit and symbol', () => {
    for (let i = 0; i < 50; i++) {
      const password = generateSecurePassword();
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[0-9]/);
      expect(password).toMatch(/[^a-zA-Z0-9]/);
    }
  });

  it('should respect a custom length', () => {
    expect(generateSecurePassword(16)).toHaveLength(16);
  });
});

describe('provisionMoodleAccount', () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
  });

  it('should create a user and enrol them in the free course', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: [{ id: 42 }] }) // core_user_create_users
      .mockResolvedValueOnce({ data: null }); // enrol_manual_enrol_users

    const result = await provisionMoodleAccount('Chris.Vargas@example.com', testCtx);

    expect(result).toMatchObject({
      userId: 42,
      username: 'chris.vargas',
      email: 'Chris.Vargas@example.com',
      created: true,
      enrolled: true,
    });
    // A generated password should be returned for a newly created account
    expect(result.password).toHaveLength(12);
    expect(result.password).toMatch(/[a-z]/);
    expect(result.password).toMatch(/[A-Z]/);
    expect(result.password).toMatch(/[0-9]/);
    expect(result.password).toMatch(/[^a-zA-Z0-9]/);

    // First call: create user
    const createCall = mockedAxios.get.mock.calls[0][0] as string;
    expect(createCall).toContain('core_user_create_users');
    expect(createCall).toContain('wstoken=test-moodle-token');
    expect(createCall).toContain('moodlewsrestformat=json');
    // Username is the local part lowercased, not the full email
    expect(createCall).toContain('username%5D=chris.vargas');
    expect(createCall).toContain('lastname%5D=Auditor');
    expect(createCall).toContain('auth_forcepasswordchange');

    // Second call: enrol user
    const enrolCall = mockedAxios.get.mock.calls[1][0] as string;
    expect(enrolCall).toContain('enrol_manual_enrol_users');
    expect(enrolCall).toContain('enrolments%5B0%5D%5Broleid%5D=5');
    expect(enrolCall).toContain('enrolments%5B0%5D%5Buserid%5D=42');
    expect(enrolCall).toContain('enrolments%5B0%5D%5Bcourseid%5D=5');
  });

  it('should skip account creation when the user already exists', async () => {
    mockedAxios.get
      .mockRejectedValueOnce({
        response: {
          data: {
            exception: 'invalidrecord',
            errorcode: 'invalidrecord',
            message: 'Username already exists',
          },
        },
      });

    const result = await provisionMoodleAccount('existing@example.com', testCtx);

    expect(result).toMatchObject({
      userId: 0,
      username: 'existing',
      email: 'existing@example.com',
      password: '',
      created: false,
      enrolled: false,
    });

    // No enrolment should happen for an existing account
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('should throw when Moodle returns an error object', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        exception: 'moodle_exception',
        errorcode: 'invalidparameter',
        message: 'Invalid parameter',
      },
    });

    await expect(
      provisionMoodleAccount('chris@example.com', testCtx)
    ).rejects.toMatchObject({
      statusCode: 502,
      retryable: false,
    });
  });

  it('should skip provisioning when Moodle is not configured', async () => {
    const originalUrl = process.env.MOODLE_URL;
    const originalToken = process.env.MOODLE_TOKEN;
    process.env.MOODLE_URL = '';
    process.env.MOODLE_TOKEN = '';

    // Re-require config so it picks up the new env values
    jest.resetModules();
    const { provisionMoodleAccount: provisionUnconfigured } = require('../../src/services/moodle.service');

    const result = await provisionUnconfigured('chris@example.com', testCtx);
    expect(result).toMatchObject({
      userId: 0,
      username: 'chris',
      created: false,
      enrolled: false,
      password: '',
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();

    process.env.MOODLE_URL = originalUrl;
    process.env.MOODLE_TOKEN = originalToken;
  });
});