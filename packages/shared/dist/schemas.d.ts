import { z } from 'zod';
export declare const questionFormatSchema: z.ZodEnum<["single-4", "multi-5", "multi-6"]>;
export declare const questionLabelSchema: z.ZodEnum<["A", "B", "C", "D", "E", "F"]>;
export declare const certificationLevelSchema: z.ZodEnum<["professional", "associate", "specialty"]>;
export declare const examModeSchema: z.ZodEnum<["exam", "study"]>;
export declare const examSessionStatusSchema: z.ZodEnum<["in_progress", "submitted", "paused"]>;
export declare const generationStateSchema: z.ZodEnum<["idle", "running", "completed", "failed"]>;
export declare const questionOptionSchema: z.ZodObject<{
    label: z.ZodEnum<["A", "B", "C", "D", "E", "F"]>;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    label: "A" | "B" | "C" | "D" | "E" | "F";
    text: string;
}, {
    label: "A" | "B" | "C" | "D" | "E" | "F";
    text: string;
}>;
export declare const generatedQuestionDraftSchema: z.ZodObject<{
    stem: z.ZodString;
    options: z.ZodArray<z.ZodObject<{
        label: z.ZodEnum<["A", "B", "C", "D", "E", "F"]>;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        label: "A" | "B" | "C" | "D" | "E" | "F";
        text: string;
    }, {
        label: "A" | "B" | "C" | "D" | "E" | "F";
        text: string;
    }>, "many">;
    correctAnswers: z.ZodArray<z.ZodString, "many">;
    domain: z.ZodString;
    services: z.ZodArray<z.ZodString, "many">;
    explanation: z.ZodString;
    format: z.ZodEnum<["single-4", "multi-5", "multi-6"]>;
    referenceUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    stem: string;
    options: {
        label: "A" | "B" | "C" | "D" | "E" | "F";
        text: string;
    }[];
    correctAnswers: string[];
    domain: string;
    services: string[];
    explanation: string;
    format: "single-4" | "multi-5" | "multi-6";
    referenceUrl?: string | undefined;
}, {
    stem: string;
    options: {
        label: "A" | "B" | "C" | "D" | "E" | "F";
        text: string;
    }[];
    correctAnswers: string[];
    domain: string;
    services: string[];
    explanation: string;
    format: "single-4" | "multi-5" | "multi-6";
    referenceUrl?: string | undefined;
}>;
export declare const questionSchema: z.ZodObject<{
    stem: z.ZodString;
    options: z.ZodArray<z.ZodObject<{
        label: z.ZodEnum<["A", "B", "C", "D", "E", "F"]>;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        label: "A" | "B" | "C" | "D" | "E" | "F";
        text: string;
    }, {
        label: "A" | "B" | "C" | "D" | "E" | "F";
        text: string;
    }>, "many">;
    correctAnswers: z.ZodArray<z.ZodString, "many">;
    domain: z.ZodString;
    services: z.ZodArray<z.ZodString, "many">;
    explanation: z.ZodString;
    format: z.ZodEnum<["single-4", "multi-5", "multi-6"]>;
    referenceUrl: z.ZodOptional<z.ZodString>;
} & {
    questionId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    questionId: string;
    stem: string;
    options: {
        label: "A" | "B" | "C" | "D" | "E" | "F";
        text: string;
    }[];
    correctAnswers: string[];
    domain: string;
    services: string[];
    explanation: string;
    format: "single-4" | "multi-5" | "multi-6";
    referenceUrl?: string | undefined;
}, {
    questionId: string;
    stem: string;
    options: {
        label: "A" | "B" | "C" | "D" | "E" | "F";
        text: string;
    }[];
    correctAnswers: string[];
    domain: string;
    services: string[];
    explanation: string;
    format: "single-4" | "multi-5" | "multi-6";
    referenceUrl?: string | undefined;
}>;
export declare const questionBankSchema: z.ZodObject<{
    bankId: z.ZodString;
    certificationId: z.ZodString;
    certificationName: z.ZodString;
    examCode: z.ZodString;
    createdAt: z.ZodString;
    questions: z.ZodArray<z.ZodObject<{
        stem: z.ZodString;
        options: z.ZodArray<z.ZodObject<{
            label: z.ZodEnum<["A", "B", "C", "D", "E", "F"]>;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }, {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }>, "many">;
        correctAnswers: z.ZodArray<z.ZodString, "many">;
        domain: z.ZodString;
        services: z.ZodArray<z.ZodString, "many">;
        explanation: z.ZodString;
        format: z.ZodEnum<["single-4", "multi-5", "multi-6"]>;
        referenceUrl: z.ZodOptional<z.ZodString>;
    } & {
        questionId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        questionId: string;
        stem: string;
        options: {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }[];
        correctAnswers: string[];
        domain: string;
        services: string[];
        explanation: string;
        format: "single-4" | "multi-5" | "multi-6";
        referenceUrl?: string | undefined;
    }, {
        questionId: string;
        stem: string;
        options: {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }[];
        correctAnswers: string[];
        domain: string;
        services: string[];
        explanation: string;
        format: "single-4" | "multi-5" | "multi-6";
        referenceUrl?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    bankId: string;
    certificationId: string;
    certificationName: string;
    examCode: string;
    createdAt: string;
    questions: {
        questionId: string;
        stem: string;
        options: {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }[];
        correctAnswers: string[];
        domain: string;
        services: string[];
        explanation: string;
        format: "single-4" | "multi-5" | "multi-6";
        referenceUrl?: string | undefined;
    }[];
}, {
    bankId: string;
    certificationId: string;
    certificationName: string;
    examCode: string;
    createdAt: string;
    questions: {
        questionId: string;
        stem: string;
        options: {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }[];
        correctAnswers: string[];
        domain: string;
        services: string[];
        explanation: string;
        format: "single-4" | "multi-5" | "multi-6";
        referenceUrl?: string | undefined;
    }[];
}>;
export declare const studyQuestionResultSchema: z.ZodObject<{
    questionIndex: z.ZodNumber;
    selectedAnswers: z.ZodArray<z.ZodString, "many">;
    isCorrect: z.ZodBoolean;
    answeredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    questionIndex: number;
    selectedAnswers: string[];
    isCorrect: boolean;
    answeredAt: string;
}, {
    questionIndex: number;
    selectedAnswers: string[];
    isCorrect: boolean;
    answeredAt: string;
}>;
export declare const examSessionSchema: z.ZodObject<{
    sessionId: z.ZodString;
    bankId: z.ZodString;
    certificationId: z.ZodString;
    mode: z.ZodEnum<["exam", "study"]>;
    status: z.ZodEnum<["in_progress", "submitted", "paused"]>;
    startedAt: z.ZodString;
    timeRemainingMs: z.ZodNumber;
    questionOrder: z.ZodArray<z.ZodNumber, "many">;
    answers: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodArray<z.ZodString, "many">], null>, "many">;
    markedForReview: z.ZodArray<z.ZodNumber, "many">;
    studyResults: z.ZodOptional<z.ZodArray<z.ZodObject<{
        questionIndex: z.ZodNumber;
        selectedAnswers: z.ZodArray<z.ZodString, "many">;
        isCorrect: z.ZodBoolean;
        answeredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        questionIndex: number;
        selectedAnswers: string[];
        isCorrect: boolean;
        answeredAt: string;
    }, {
        questionIndex: number;
        selectedAnswers: string[];
        isCorrect: boolean;
        answeredAt: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "in_progress" | "submitted" | "paused";
    bankId: string;
    certificationId: string;
    sessionId: string;
    mode: "exam" | "study";
    startedAt: string;
    timeRemainingMs: number;
    questionOrder: number[];
    answers: [number, string[]][];
    markedForReview: number[];
    studyResults?: {
        questionIndex: number;
        selectedAnswers: string[];
        isCorrect: boolean;
        answeredAt: string;
    }[] | undefined;
}, {
    status: "in_progress" | "submitted" | "paused";
    bankId: string;
    certificationId: string;
    sessionId: string;
    mode: "exam" | "study";
    startedAt: string;
    timeRemainingMs: number;
    questionOrder: number[];
    answers: [number, string[]][];
    markedForReview: number[];
    studyResults?: {
        questionIndex: number;
        selectedAnswers: string[];
        isCorrect: boolean;
        answeredAt: string;
    }[] | undefined;
}>;
export declare const examResultSchema: z.ZodObject<{
    sessionId: z.ZodString;
    bankId: z.ZodString;
    completedAt: z.ZodString;
    score: z.ZodNumber;
    passed: z.ZodBoolean;
    totalQuestions: z.ZodNumber;
    correctCount: z.ZodNumber;
    domainBreakdown: z.ZodRecord<z.ZodString, z.ZodObject<{
        correct: z.ZodNumber;
        total: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        correct: number;
        total: number;
    }, {
        correct: number;
        total: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    bankId: string;
    sessionId: string;
    completedAt: string;
    score: number;
    passed: boolean;
    totalQuestions: number;
    correctCount: number;
    domainBreakdown: Record<string, {
        correct: number;
        total: number;
    }>;
}, {
    bankId: string;
    sessionId: string;
    completedAt: string;
    score: number;
    passed: boolean;
    totalQuestions: number;
    correctCount: number;
    domainBreakdown: Record<string, {
        correct: number;
        total: number;
    }>;
}>;
export declare const certificationDomainSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    percentage: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    percentage: number;
}, {
    id: string;
    name: string;
    percentage: number;
}>;
export declare const certificationConfigSchema: z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    examCode: z.ZodString;
    level: z.ZodEnum<["professional", "associate", "specialty"]>;
    domains: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        percentage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        percentage: number;
    }, {
        id: string;
        name: string;
        percentage: number;
    }>, "many">;
    formatDistribution: z.ZodObject<{
        singleAnswer4Options: z.ZodNumber;
        multiAnswer5Options: z.ZodNumber;
        multiAnswer6Options: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        singleAnswer4Options: number;
        multiAnswer5Options: number;
        multiAnswer6Options: number;
    }, {
        singleAnswer4Options: number;
        multiAnswer5Options: number;
        multiAnswer6Options: number;
    }>;
    totalQuestions: z.ZodNumber;
    timeLimitMinutes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    examCode: string;
    totalQuestions: number;
    id: string;
    displayName: string;
    level: "professional" | "associate" | "specialty";
    domains: {
        id: string;
        name: string;
        percentage: number;
    }[];
    formatDistribution: {
        singleAnswer4Options: number;
        multiAnswer5Options: number;
        multiAnswer6Options: number;
    };
    timeLimitMinutes: number;
}, {
    examCode: string;
    totalQuestions: number;
    id: string;
    displayName: string;
    level: "professional" | "associate" | "specialty";
    domains: {
        id: string;
        name: string;
        percentage: number;
    }[];
    formatDistribution: {
        singleAnswer4Options: number;
        multiAnswer5Options: number;
        multiAnswer6Options: number;
    };
    timeLimitMinutes: number;
}>;
export declare const questionBankSummarySchema: z.ZodObject<{
    bankId: z.ZodString;
    certificationId: z.ZodString;
    certificationName: z.ZodString;
    examCode: z.ZodString;
    createdAt: z.ZodString;
    questionCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    bankId: string;
    certificationId: string;
    certificationName: string;
    examCode: string;
    createdAt: string;
    questionCount: number;
}, {
    bankId: string;
    certificationId: string;
    certificationName: string;
    examCode: string;
    createdAt: string;
    questionCount: number;
}>;
export declare const documentationResultSchema: z.ZodObject<{
    title: z.ZodString;
    url: z.ZodString;
    snippet: z.ZodString;
    service: z.ZodString;
    domain: z.ZodString;
    source: z.ZodLiteral<"aws-docs-mock">;
}, "strip", z.ZodTypeAny, {
    domain: string;
    title: string;
    url: string;
    snippet: string;
    service: string;
    source: "aws-docs-mock";
}, {
    domain: string;
    title: string;
    url: string;
    snippet: string;
    service: string;
    source: "aws-docs-mock";
}>;
export declare const generationStatusSchema: z.ZodObject<{
    state: z.ZodEnum<["idle", "running", "completed", "failed"]>;
    certificationId: z.ZodOptional<z.ZodString>;
    bankId: z.ZodOptional<z.ZodString>;
    generatedQuestions: z.ZodNumber;
    targetQuestions: z.ZodNumber;
    startedAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodString;
    lastError: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    checkpointPath: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    state: "idle" | "running" | "completed" | "failed";
    generatedQuestions: number;
    targetQuestions: number;
    updatedAt: string;
    bankId?: string | undefined;
    certificationId?: string | undefined;
    startedAt?: string | undefined;
    lastError?: string | undefined;
    checkpointPath?: string | undefined;
}, {
    message: string;
    state: "idle" | "running" | "completed" | "failed";
    generatedQuestions: number;
    targetQuestions: number;
    updatedAt: string;
    bankId?: string | undefined;
    certificationId?: string | undefined;
    startedAt?: string | undefined;
    lastError?: string | undefined;
    checkpointPath?: string | undefined;
}>;
export declare const generationCheckpointSchema: z.ZodObject<{
    certificationId: z.ZodString;
    bankId: z.ZodString;
    createdAt: z.ZodString;
    questionCount: z.ZodNumber;
    questions: z.ZodArray<z.ZodObject<{
        stem: z.ZodString;
        options: z.ZodArray<z.ZodObject<{
            label: z.ZodEnum<["A", "B", "C", "D", "E", "F"]>;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }, {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }>, "many">;
        correctAnswers: z.ZodArray<z.ZodString, "many">;
        domain: z.ZodString;
        services: z.ZodArray<z.ZodString, "many">;
        explanation: z.ZodString;
        format: z.ZodEnum<["single-4", "multi-5", "multi-6"]>;
        referenceUrl: z.ZodOptional<z.ZodString>;
    } & {
        questionId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        questionId: string;
        stem: string;
        options: {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }[];
        correctAnswers: string[];
        domain: string;
        services: string[];
        explanation: string;
        format: "single-4" | "multi-5" | "multi-6";
        referenceUrl?: string | undefined;
    }, {
        questionId: string;
        stem: string;
        options: {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }[];
        correctAnswers: string[];
        domain: string;
        services: string[];
        explanation: string;
        format: "single-4" | "multi-5" | "multi-6";
        referenceUrl?: string | undefined;
    }>, "many">;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    bankId: string;
    certificationId: string;
    createdAt: string;
    questions: {
        questionId: string;
        stem: string;
        options: {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }[];
        correctAnswers: string[];
        domain: string;
        services: string[];
        explanation: string;
        format: "single-4" | "multi-5" | "multi-6";
        referenceUrl?: string | undefined;
    }[];
    questionCount: number;
    updatedAt: string;
}, {
    bankId: string;
    certificationId: string;
    createdAt: string;
    questions: {
        questionId: string;
        stem: string;
        options: {
            label: "A" | "B" | "C" | "D" | "E" | "F";
            text: string;
        }[];
        correctAnswers: string[];
        domain: string;
        services: string[];
        explanation: string;
        format: "single-4" | "multi-5" | "multi-6";
        referenceUrl?: string | undefined;
    }[];
    questionCount: number;
    updatedAt: string;
}>;
