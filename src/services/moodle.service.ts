import axios from 'axios';
import { config } from '../utils/config';
import { withContext } from '../utils/logger';
import type { LogContext } from '../types';

/** Default temporary password assigned to new Moodle accounts */
export const MOODLE_TEMP_PASSWORD = 'Auditan.do2026!';

/** Default lastname until the user updates their profile */
export const MOODLE_DEFAULT_LASTNAME = 'Auditor (Actualiza tu perfil)';

/** Standard Moodle role ID for 'Student' */
const MOODLE_ROLE_STUDENT = 5;

/** Result of the Moodle provisioning step */
export interface MoodleProvisionResult {
  userId: number;
  username: string;
  email: string;
  password: string;
  created: boolean;
  enrolled: boolean;
}

/** Moodle REST API error payload */
interface MoodleError {
  exception?: string;
  errorcode?: string;
  message?: string;
}

/**
 * Build a Moodle REST API URL with the shared token and function params.
 * Nested arrays/objects are flattened into indexed params (e.g.
 * `enrolments[0][roleid]=5`) as required by the Moodle REST API.
 */
function buildMoodleUrl(wsfunction: string, params: Record<string, unknown>): string {
  const url = new URL(config.moodleUrl);
  url.searchParams.set('wstoken', config.moodleToken);
  url.searchParams.set('wsfunction', wsfunction);
  url.searchParams.set('moodlewsrestformat', 'json');

  const append = (key: string, value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => append(`${key}[${index}]`, item));
    } else if (value !== null && typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        append(`${key}[${subKey}]`, subValue);
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  };

  for (const [key, value] of Object.entries(params)) {
    append(key, value);
  }
  return url.toString();
}

/**
 * Derive a Moodle firstname from an email address.
 * "chris.vargas@example.com" -> "Chris.vargas"
 */
export function deriveFirstname(email: string): string {
  const local = email.split('@')[0] ?? '';
  if (!local) return 'Prospecto';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/**
 * Call a Moodle REST API function and return its JSON payload.
 * Throws a normalized error with `statusCode` and `retryable` flags.
 */
async function callMoodle(
  wsfunction: string,
  params: Record<string, unknown>,
  ctx: LogContext
): Promise<unknown> {
  const logger = withContext(ctx);

  if (!config.moodleUrl || !config.moodleToken) {
    logger.warn('Moodle not configured — skipping provisioning');
    return null;
  }

  const url = buildMoodleUrl(wsfunction, params);

  try {
    const response = await axios.get(url, { timeout: 30_000 });
    const data = response.data;

    // Moodle returns errors as a JSON object with an `exception` field
    if (data && typeof data === 'object' && 'exception' in data) {
      const moodleErr = data as MoodleError;
      const error = new Error(
        `Moodle ${wsfunction} failed: ${moodleErr.message || moodleErr.errorcode || 'unknown error'}`
      ) as Error & { statusCode: number; retryable: boolean; moodleError?: MoodleError };
      error.statusCode = 502;
      error.retryable = false;
      error.moodleError = moodleErr;
      throw error;
    }

    return data;
  } catch (error: any) {
    // Re-throw already-normalized Moodle errors
    if (error.moodleError) throw error;

    const status = error?.response?.status;
    const responseData = error?.response?.data;
    const detail = responseData?.message || error.message;

    // Moodle may return errors as HTTP responses with an `exception` body
    if (responseData && typeof responseData === 'object' && 'exception' in responseData) {
      const moodleErr = responseData as MoodleError;
      const err = new Error(
        `Moodle ${wsfunction} failed: ${moodleErr.message || moodleErr.errorcode || 'unknown error'}`
      ) as Error & { statusCode: number; retryable: boolean; moodleError?: MoodleError };
      err.statusCode = 502;
      err.retryable = false;
      err.moodleError = moodleErr;
      throw err;
    }

    logger.error(`Moodle ${wsfunction} request failed`, { status, detail });

    throw Object.assign(
      new Error(`Moodle ${wsfunction} request failed (${status || 'network'}): ${detail}`),
      { statusCode: 502, retryable: status >= 500 || !status }
    );
  }
}

/**
 * Look up an existing Moodle user by email.
 * Returns the user id, or null if not found.
 */
async function findUserByEmail(
  email: string,
  ctx: LogContext
): Promise<number | null> {
  const data = await callMoodle(
    'core_user_get_users_by_field',
    { field: 'email', values: [email] },
    ctx
  );

  if (Array.isArray(data) && data.length > 0) {
    const user = data[0] as { id?: number };
    return typeof user.id === 'number' ? user.id : null;
  }
  return null;
}

/**
 * Create a Moodle user via `core_user_create_users`.
 * Returns the new user id.
 */
async function createUser(
  email: string,
  ctx: LogContext
): Promise<number> {
  const username = email.toLowerCase();
  const firstname = deriveFirstname(email);

  const data = await callMoodle(
    'core_user_create_users',
    {
      users: [
        {
          username,
          email,
          firstname,
          lastname: MOODLE_DEFAULT_LASTNAME,
          password: MOODLE_TEMP_PASSWORD,
          preferences: [
            { type: 'auth_forcepasswordchange', value: '1' },
          ],
        },
      ],
    },
    ctx
  );

  if (Array.isArray(data) && data.length > 0) {
    const created = data[0] as { id?: number };
    if (typeof created.id === 'number') return created.id;
  }

  throw Object.assign(
    new Error('Moodle did not return a user id after creation'),
    { statusCode: 502, retryable: false }
  );
}

/**
 * Enrol a user in the free course via `enrol_manual_enrol_users`.
 */
async function enrolUser(
  userId: number,
  ctx: LogContext
): Promise<void> {
  await callMoodle(
    'enrol_manual_enrol_users',
    {
      enrolments: [
        {
          roleid: MOODLE_ROLE_STUDENT,
          userid: userId,
          courseid: config.moodleFreeCourseId,
        },
      ],
    },
    ctx
  );
}

/**
 * Provision a Moodle account for a prospect and enrol them in the free course.
 *
 * Flow:
 *  1. Try to create the user (`core_user_create_users`).
 *  2. If the user already exists (Moodle error), look it up with
 *     `core_user_get_users_by_field` and reuse its id.
 *  3. Enrol the user in the free course (`enrol_manual_enrol_users`).
 *
 * Returns the user id, credentials and provisioning flags.
 */
export async function provisionMoodleAccount(
  email: string,
  ctx: LogContext
): Promise<MoodleProvisionResult> {
  const logger = withContext(ctx);

  if (!config.moodleUrl || !config.moodleToken) {
    logger.warn('Moodle not configured — skipping account provisioning');
    return {
      userId: 0,
      username: email.toLowerCase(),
      email,
      password: MOODLE_TEMP_PASSWORD,
      created: false,
      enrolled: false,
    };
  }

  let userId: number;
  let created = false;

  try {
    userId = await createUser(email, ctx);
    created = true;
    logger.info('Moodle user created', { email, userId });
  } catch (error: any) {
    // If the user already exists, Moodle throws an error — look it up instead.
    const moodleErr = error?.moodleError;
    const isDuplicate =
      moodleErr?.errorcode === 'invalidrecord' ||
      /already exists|duplicate|username/i.test(moodleErr?.message || '');

    if (!isDuplicate) throw error;

    logger.info('Moodle user already exists — looking up existing id', { email });
    const existingId = await findUserByEmail(email, ctx);
    if (!existingId) {
      throw Object.assign(
        new Error(`Moodle user lookup failed for existing email: ${email}`),
        { statusCode: 502, retryable: false }
      );
    }
    userId = existingId;
  }

  await enrolUser(userId, ctx);
  logger.info('Moodle user enrolled in free course', {
    email,
    userId,
    courseId: config.moodleFreeCourseId,
  });

  return {
    userId,
    username: email.toLowerCase(),
    email,
    password: MOODLE_TEMP_PASSWORD,
    created,
    enrolled: true,
  };
}