import axios from 'axios';
import {
  provisionMoodleAccount,
  deriveFirstname,
  MOODLE_TEMP_PASSWORD,
  MOODLE_DEFAULT_LASTNAME,
} from '../../src/services/moodle.service';
import type { LogContext } from '../../src/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const testCtx: LogContext = {
  requestId: 'test-moodle',
  component: 'TestMoodleService',
};

describe('deriveFirstname', () => {
  it('should capitalize the first letter of the local part', () => {
    expect(deriveFirstname('chris.vargas@example.com')).toBe('Chris.vargas');
  });

  it('should handle emails without a local part', () => {
    expect(deriveFirstname('@example.com')).toBe('Prospecto');
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

    const result = await provisionMoodleAccount('chris.vargas@example.com', testCtx);

    expect(result).toMatchObject({
      userId: 42,
      username: 'chris.vargas@example.com',
      email: 'chris.vargas@example.com',
      password: MOODLE_TEMP_PASSWORD,
      created: true,
      enrolled: true,
    });

    // First call: create user
    const createCall = mockedAxios.get.mock.calls[0][0] as string;
    expect(createCall).toContain('core_user_create_users');
    expect(createCall).toContain('wstoken=test-moodle-token');
    expect(createCall).toContain('moodlewsrestformat=json');

    // Second call: enrol user
    const enrolCall = mockedAxios.get.mock.calls[1][0] as string;
    expect(enrolCall).toContain('enrol_manual_enrol_users');
    expect(enrolCall).toContain('enrolments%5B0%5D%5Broleid%5D=5');
    expect(enrolCall).toContain('enrolments%5B0%5D%5Buserid%5D=42');
    expect(enrolCall).toContain('enrolments%5B0%5D%5Bcourseid%5D=5');
  });

  it('should look up an existing user when creation fails with duplicate error', async () => {
    mockedAxios.get
      .mockRejectedValueOnce({
        response: {
          data: {
            exception: 'invalidrecord',
            errorcode: 'invalidrecord',
            message: 'Username already exists',
          },
        },
      })
      .mockResolvedValueOnce({ data: [{ id: 99 }] }) // core_user_get_users_by_field
      .mockResolvedValueOnce({ data: null }); // enrol_manual_enrol_users

    const result = await provisionMoodleAccount('existing@example.com', testCtx);

    expect(result).toMatchObject({
      userId: 99,
      created: false,
      enrolled: true,
    });

    const lookupCall = mockedAxios.get.mock.calls[1][0] as string;
    expect(lookupCall).toContain('core_user_get_users_by_field');
    expect(lookupCall).toContain('field=email');
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
      created: false,
      enrolled: false,
    });
    expect(mockedAxios.get).not.toHaveBeenCalled();

    process.env.MOODLE_URL = originalUrl;
    process.env.MOODLE_TOKEN = originalToken;
  });
});