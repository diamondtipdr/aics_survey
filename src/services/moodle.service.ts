import axios from 'axios';
import { config } from '../utils/config';
import { withContext } from '../utils/logger';
import type { LogContext } from '../types';

/** Default lastname until the user updates their profile */
export const MOODLE_DEFAULT_LASTNAME = 'Auditor';

/** Standard Moodle role ID for 'Student' */
const MOODLE_ROLE_STUDENT = 5;

/** Result of the Moodle provisioning step */
export interface MoodleProvisionResult {
  userId: number;
  username: string;
  email: string;
  /** Temporary password — only set when a new account was created */
  password: string;
  created: boolean;
  enrolled: boolean;
}

/**
 * Generate a secure random temporary password (12 chars) that satisfies
 * Moodle's default password policy: at least one lowercase, one uppercase,
 * one digit and one non-alphanumeric symbol.
 */
export function generateSecurePassword(length = 12): string {
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()-_=+';

  const all = lower + upper + digits + symbols;
  const randomChar = (pool: string): string =>
    pool[Math.floor(Math.random() * pool.length)];

  // Guarantee at least one of each required class, then fill the rest.
  const chars = [
    randomChar(lower),
    randomChar(upper),
    randomChar(digits),
    randomChar(symbols),
  ];

  while (chars.length < length) {
    chars.push(randomChar(all));
  }

  // Shuffle so the guaranteed characters are not always at the start.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  return chars.join('');
}

/**
 * Derive a Moodle username from an email address: the local part (before
 * `@`) lowercased. "Chris.Vargas@Example.com" -> "chris.vargas".
 */
export function deriveUsername(email: string): string {
  return (email.split('@')[0] ?? '').toLowerCase();
}

/**
 * Derive a Moodle firstname from an email address: the local part with the
 * first letter capitalized. "chris.vargas@example.com" -> "Chris.vargas".
 */
export function deriveFirstname(email: string): string {
  const local = email.split('@')[0] ?? '';
  if (!local) return 'Prospecto';
  return local.charAt(0).toUpperCase() + local.slice(1);
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
 * Create a Moodle user via `core_user_create_users`.
 * Returns the new user id and the temporary password assigned.
 */
async function createUser(
  email: string,
  ctx: LogContext
): Promise<{ id: number; password: string }> {
  const username = deriveUsername(email);
  const firstname = deriveFirstname(email);
  const password = generateSecurePassword();

  const data = await callMoodle(
    'core_user_create_users',
    {
      users: [
        {
          username,
          email,
          firstname,
          lastname: MOODLE_DEFAULT_LASTNAME,
          password,
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
    if (typeof created.id === 'number') return { id: created.id, password };
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
 *  1. Try to create the user (`core_user_create_users`) with a generated
 *     temporary password.
 *  2. If the user already exists (Moodle error), capture the exception
 *     silently and skip account creation — no new credentials are issued.
 *  3. Enrol the newly created user in the free course
 *     (`enrol_manual_enrol_users`).
 *
 * Returns the user id, credentials and provisioning flags. When the account
 * already existed, `created` is `false` and `password` is empty so the email
 * can omit the credentials block.
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
      username: deriveUsername(email),
      email,
      password: '',
      created: false,
      enrolled: false,
    };
  }

  let userId: number;
  let password = '';
  let created = false;

  try {
    const createdUser = await createUser(email, ctx);
    userId = createdUser.id;
    password = createdUser.password;
    created = true;
    logger.info('Moodle user created', { email, userId });
  } catch (error: any) {
    // If the user already exists, Moodle throws an error — capture it
    // silently and skip account creation (no new credentials).
    const moodleErr = error?.moodleError;
    const isDuplicate =
      moodleErr?.errorcode === 'invalidrecord' ||
      /already exists|duplicate|username/i.test(moodleErr?.message || '');

    if (!isDuplicate) throw error;

    logger.info('Moodle user already exists — skipping account creation', { email });
    return {
      userId: 0,
      username: deriveUsername(email),
      email,
      password: '',
      created: false,
      enrolled: false,
    };
  }

  await enrolUser(userId, ctx);
  logger.info('Moodle user enrolled in free course', {
    email,
    userId,
    courseId: config.moodleFreeCourseId,
  });

  return {
    userId,
    username: deriveUsername(email),
    email,
    password,
    created,
    enrolled: true,
  };
}