import { validatePayload, calculateScores } from '../../src/utils/validation';
import fixtures from '../fixtures/sample-payload.json';

describe('validatePayload', () => {
  it('should accept a valid preview payload (no email)', () => {
    const result = validatePayload(fixtures.validPreview);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.answers).toHaveLength(16);
      expect(result.data.name).toBe('Carlos Pérez');
      expect(result.data.email).toBeUndefined();
    }
  });

  it('should accept a valid full capture payload (with email)', () => {
    const result = validatePayload(fixtures.validFull);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('carlos@example.com');
    }
  });

  it('should reject payload with missing answers', () => {
    const result = validatePayload(fixtures.invalidMissingAnswers);
    expect(result.success).toBe(false);
  });

  it('should reject payload with fewer than 16 answers', () => {
    const result = validatePayload(fixtures.invalidFewAnswers);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('should reject invalid email format', () => {
    const result = validatePayload(fixtures.invalidEmail);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('email'))).toBe(true);
    }
  });

  it('should accept payload with no name (falls back to Auditor)', () => {
    const result = validatePayload(fixtures.noNamePreview);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBeUndefined();
    }
  });

  it('should reject empty body', () => {
    const result = validatePayload({});
    expect(result.success).toBe(false);
  });
});

describe('calculateScores', () => {
  it('should calculate correct total and pillar scores for valid input', () => {
    const scores = calculateScores(fixtures.validPreview.answers);
    expect(scores.totalScore).toBe(43);
    expect(scores.maxScore).toBe(64);
    expect(scores.pillars).toHaveLength(4);
    // Pillar 1: questions 1-4 => 3+4+2+3 = 12
    expect(scores.pillars[0].score).toBe(12);
    // Pillar 2: questions 5-8 => 2+1+3+2 = 8
    expect(scores.pillars[1].score).toBe(8);
    // Pillar 3: questions 9-12 => 4+3+2+1 = 10
    expect(scores.pillars[2].score).toBe(10);
    // Pillar 4: questions 13-16 => 4+3+2+4 = 13
    expect(scores.pillars[3].score).toBe(13);
  });

  it('should handle minimum scores (all 1s)', () => {
    const answers = Array.from({ length: 16 }, (_, i) => ({
      questionId: i + 1,
      value: 1 as const,
    }));
    const scores = calculateScores(answers);
    expect(scores.totalScore).toBe(16);
    scores.pillars.forEach((p) => expect(p.score).toBe(4));
  });

  it('should handle maximum scores (all 4s)', () => {
    const answers = Array.from({ length: 16 }, (_, i) => ({
      questionId: i + 1,
      value: 4 as const,
    }));
    const scores = calculateScores(answers);
    expect(scores.totalScore).toBe(64);
    scores.pillars.forEach((p) => {
      expect(p.score).toBe(16);
      expect(p.maxScore).toBe(16);
    });
  });
});