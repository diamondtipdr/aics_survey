"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScorecardRequestSchema = void 0;
exports.validatePayload = validatePayload;
exports.getPillarMap = getPillarMap;
exports.calculateScores = calculateScores;
const zod_1 = require("zod");
// Each answer: questionId 1-16, value 1-4
const AnswerSchema = zod_1.z.object({
    questionId: zod_1.z.number().int().min(1).max(16),
    value: zod_1.z.number().int().min(1).max(4),
});
// Inbound payload schema
exports.ScorecardRequestSchema = zod_1.z.object({
    answers: zod_1.z
        .array(AnswerSchema)
        .length(16, { message: 'Exactly 16 answers are required' })
        .refine((answers) => {
        const ids = answers.map((a) => a.questionId).sort((a, b) => a - b);
        return ids[0] === 1 && ids[15] === 16;
    }, { message: 'Answers must include questionIds 1 through 16' }),
    dept_size: zod_1.z.string().max(50).optional(),
    industry: zod_1.z.string().max(255).optional(),
    name: zod_1.z.string().max(255).optional(),
    email: zod_1.z.string().email('Invalid email format').optional(),
});
/**
 * Validate a scorecard payload.
 * Returns { success: true, data } or { success: false, errors }
 */
function validatePayload(body) {
    const result = exports.ScorecardRequestSchema.safeParse(body);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        errors: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    };
}
/** PILLAR DEFINITIONS — 4 questions per pillar (16 total) */
const PILLAR_MAP = [
    { pillarId: 1, questions: [1, 2, 3, 4], label: 'Integración' },
    { pillarId: 2, questions: [5, 6, 7, 8], label: 'Automatización' },
    { pillarId: 3, questions: [9, 10, 11, 12], label: 'Agilidad' },
    { pillarId: 4, questions: [13, 14, 15, 16], label: 'Impacto & Comunicación' },
];
function getPillarMap() {
    return PILLAR_MAP;
}
/**
 * Calculate scores from the 16 answers.
 * Returns total + per-pillar breakdown.
 */
function calculateScores(answers) {
    const answerMap = new Map(answers.map((a) => [a.questionId, a.value]));
    const totalScore = answers.reduce((sum, a) => sum + a.value, 0);
    const pillars = PILLAR_MAP.map((pillar) => {
        const score = pillar.questions.reduce((sum, qId) => sum + (answerMap.get(qId) ?? 0), 0);
        return {
            pillarId: pillar.pillarId,
            label: pillar.label,
            score,
            maxScore: 16,
        };
    });
    return {
        totalScore,
        maxScore: 64,
        pillars,
    };
}
//# sourceMappingURL=validation.js.map