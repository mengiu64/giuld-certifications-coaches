import fc from 'fast-check';
import { QUESTION_LABELS } from '../constants.js';
const WORD_BANK = [
    'aws',
    'architecture',
    'resilience',
    'security',
    'managed',
    'service',
    'deployment',
    'operations',
    'monitoring',
    'governance',
    'scaling',
    'regional',
    'network',
    'storage',
    'compliance',
    'availability',
    'migration',
    'analytics',
    'automation',
    'policy',
];
const sentenceArbitrary = (minWords, maxWords) => fc.array(fc.constantFrom(...WORD_BANK), { minLength: minWords, maxLength: maxWords }).map((words) => `${words.join(' ')}.`);
export const questionFormatArbitrary = fc.constantFrom('single-4', 'multi-5', 'multi-6');
const answerCountByFormat = {
    'single-4': [1],
    'multi-5': [2, 3],
    'multi-6': [2, 3],
};
const optionCountByFormat = {
    'single-4': 4,
    'multi-5': 5,
    'multi-6': 6,
};
const isoDateArbitrary = fc.date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2035-01-01T00:00:00.000Z'),
}).map((value) => value.toISOString());
export const generatedQuestionDraftArbitrary = questionFormatArbitrary.chain((format) => {
    const optionCount = optionCountByFormat[format];
    const labels = QUESTION_LABELS.slice(0, optionCount);
    return fc
        .record({
        services: fc.shuffledSubarray(['EC2', 'S3', 'IAM', 'Lambda', 'VPC', 'RDS'], { minLength: 1, maxLength: 3 }),
        correctAnswers: fc.constantFrom(...answerCountByFormat[format]).chain((answerCount) => fc.shuffledSubarray(labels, { minLength: answerCount, maxLength: answerCount })),
    })
        .chain(({ services, correctAnswers }) => fc.record({
        stem: sentenceArbitrary(55, 80),
        options: fc.array(sentenceArbitrary(12, 18), { minLength: optionCount, maxLength: optionCount }).map((values) => values.map((text, index) => ({ label: labels[index], text }))),
        correctAnswers: fc.constant(correctAnswers),
        domain: fc.constantFrom('design-new-solutions', 'security', 'deployment'),
        services: fc.constant(services),
        explanation: sentenceArbitrary(60, 90).map((text) => `${services[0]} ${text}`),
        format: fc.constant(format),
        referenceUrl: fc.option(fc.constant('https://docs.aws.amazon.com/example'), { nil: undefined }),
    }));
});
export const examSessionArbitrary = fc.record({
    sessionId: fc.uuid(),
    bankId: fc.uuid(),
    certificationId: fc.constantFrom('SAP-C02', 'SAA-C03', 'DVA-C02'),
    mode: fc.constantFrom('exam', 'study'),
    status: fc.constantFrom('in_progress', 'submitted', 'paused'),
    startedAt: isoDateArbitrary,
    timeRemainingMs: fc.integer({ min: 0, max: 10_800_000 }),
    questionOrder: fc.uniqueArray(fc.integer({ min: 0, max: 30 }), { maxLength: 10 }),
    answers: fc.array(fc.tuple(fc.integer({ min: 0, max: 30 }), fc.uniqueArray(fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F'), { minLength: 1, maxLength: 3 })), { maxLength: 10 }),
    markedForReview: fc.uniqueArray(fc.integer({ min: 0, max: 30 }), { maxLength: 10 }),
    studyResults: fc.option(fc.array(fc.record({
        questionIndex: fc.integer({ min: 0, max: 30 }),
        selectedAnswers: fc.uniqueArray(fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F'), { minLength: 1, maxLength: 3 }),
        isCorrect: fc.boolean(),
        answeredAt: isoDateArbitrary,
    }), { maxLength: 10 }), { nil: undefined }),
});
//# sourceMappingURL=arbitraries.js.map