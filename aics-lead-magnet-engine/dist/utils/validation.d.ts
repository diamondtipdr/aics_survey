import { z } from 'zod';
export declare const ScorecardRequestSchema: z.ZodObject<{
    answers: z.ZodEffects<z.ZodArray<z.ZodObject<{
        questionId: z.ZodNumber;
        value: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        questionId: number;
        value: number;
    }, {
        questionId: number;
        value: number;
    }>, "many">, {
        questionId: number;
        value: number;
    }[], {
        questionId: number;
        value: number;
    }[]>;
    dept_size: z.ZodOptional<z.ZodString>;
    industry: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    answers: {
        questionId: number;
        value: number;
    }[];
    dept_size?: string | undefined;
    industry?: string | undefined;
    name?: string | undefined;
    email?: string | undefined;
}, {
    answers: {
        questionId: number;
        value: number;
    }[];
    dept_size?: string | undefined;
    industry?: string | undefined;
    name?: string | undefined;
    email?: string | undefined;
}>;
export type ScorecardInput = z.infer<typeof ScorecardRequestSchema>;
/**
 * Validate a scorecard payload.
 * Returns { success: true, data } or { success: false, errors }
 */
export declare function validatePayload(body: unknown): {
    success: true;
    data: ScorecardInput;
} | {
    success: false;
    errors: string[];
};
export declare function getPillarMap(): readonly [{
    readonly pillarId: 1;
    readonly questions: readonly [1, 2, 3, 4];
    readonly label: "Integración";
}, {
    readonly pillarId: 2;
    readonly questions: readonly [5, 6, 7, 8];
    readonly label: "Automatización";
}, {
    readonly pillarId: 3;
    readonly questions: readonly [9, 10, 11, 12];
    readonly label: "Agilidad";
}, {
    readonly pillarId: 4;
    readonly questions: readonly [13, 14, 15, 16];
    readonly label: "Impacto & Comunicación";
}];
/**
 * Calculate scores from the 16 answers.
 * Returns total + per-pillar breakdown.
 */
export declare function calculateScores(answers: {
    questionId: number;
    value: number;
}[]): {
    totalScore: number;
    maxScore: number;
    pillars: {
        pillarId: 1 | 4 | 2 | 3;
        label: "Integración" | "Automatización" | "Agilidad" | "Impacto & Comunicación";
        score: number;
        maxScore: number;
    }[];
};
//# sourceMappingURL=validation.d.ts.map