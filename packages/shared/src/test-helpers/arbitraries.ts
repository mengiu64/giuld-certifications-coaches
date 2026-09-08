import fc from 'fast-check';
import { AI_TOPIC_SERVICES, QUESTION_LABELS } from '../constants.js';
import type {
  CertificationConfig,
  CertificationLevel,
  ExamSession,
  GeneratedQuestionDraft,
  GenerationPlanItem,
  QuestionFormat,
  QuestionLabel,
} from '../types.js';

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

const sentenceArbitrary = (minWords: number, maxWords: number): fc.Arbitrary<string> =>
  fc.array(fc.constantFrom(...WORD_BANK), { minLength: minWords, maxLength: maxWords }).map((words) =>
    `${words.join(' ')}.`,
  );

export const questionFormatArbitrary: fc.Arbitrary<QuestionFormat> = fc.constantFrom('single-4', 'multi-5', 'multi-6');

const answerCountByFormat: Record<QuestionFormat, number[]> = {
  'single-4': [1],
  'multi-5': [2, 3],
  'multi-6': [2, 3],
};

const optionCountByFormat: Record<QuestionFormat, number> = {
  'single-4': 4,
  'multi-5': 5,
  'multi-6': 6,
};

const isoDateArbitrary = fc.date({
  min: new Date('2000-01-01T00:00:00.000Z'),
  max: new Date('2035-01-01T00:00:00.000Z'),
}).map((value) => value.toISOString());

export const generatedQuestionDraftArbitrary: fc.Arbitrary<GeneratedQuestionDraft> = questionFormatArbitrary.chain((format) => {
  const optionCount = optionCountByFormat[format];
  const labels = QUESTION_LABELS.slice(0, optionCount);
  return fc
    .record({
      services: fc.shuffledSubarray(['EC2', 'S3', 'IAM', 'Lambda', 'VPC', 'RDS'], { minLength: 1, maxLength: 3 }),
      correctAnswers: fc.constantFrom(...answerCountByFormat[format]).chain((answerCount) =>
        fc.shuffledSubarray(labels, { minLength: answerCount, maxLength: answerCount }),
      ),
    })
    .chain(({ services, correctAnswers }) =>
      fc.record({
        stem: sentenceArbitrary(55, 80),
        options: fc.array(sentenceArbitrary(12, 18), { minLength: optionCount, maxLength: optionCount }).map((values) =>
          values.map((text, index) => ({ label: labels[index] as QuestionLabel, text })),
        ),
        correctAnswers: fc.constant(correctAnswers),
        domain: fc.constantFrom('design-new-solutions', 'security', 'deployment'),
        services: fc.constant(services),
        explanation: sentenceArbitrary(60, 90).map((text) => `${services[0]} ${text}`),
        format: fc.constant(format),
        referenceUrl: fc.option(fc.constant('https://docs.aws.amazon.com/example'), { nil: undefined }),
      }),
    );
});

export const examSessionArbitrary: fc.Arbitrary<ExamSession> = fc.record({
  sessionId: fc.uuid(),
  bankId: fc.uuid(),
  certificationId: fc.constantFrom('SAP-C02', 'SAA-C03', 'DVA-C02'),
  mode: fc.constantFrom('exam', 'study'),
  status: fc.constantFrom('in_progress', 'submitted', 'paused'),
  startedAt: isoDateArbitrary,
  timeRemainingMs: fc.integer({ min: 0, max: 10_800_000 }),
  questionOrder: fc.uniqueArray(fc.integer({ min: 0, max: 30 }), { maxLength: 10 }),
  answers: fc.array(
    fc.tuple(
      fc.integer({ min: 0, max: 30 }),
      fc.uniqueArray(fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F'), { minLength: 1, maxLength: 3 }),
    ),
    { maxLength: 10 },
  ),
  markedForReview: fc.uniqueArray(fc.integer({ min: 0, max: 30 }), { maxLength: 10 }),
  studyResults: fc.option(
    fc.array(
      fc.record({
        questionIndex: fc.integer({ min: 0, max: 30 }),
        selectedAnswers: fc.uniqueArray(fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F'), { minLength: 1, maxLength: 3 }),
        isCorrect: fc.boolean(),
        answeredAt: isoDateArbitrary,
      }),
      { maxLength: 10 },
    ),
    { nil: undefined },
  ),
});


// --- Arbitraries per la distribuzione dei topic AI ---

/**
 * Genera una chiave topic valida: pattern [a-z0-9-]+, lunghezza 1-20.
 * Utilizza un sottoinsieme di caratteri consentiti per generare stringhe conformi allo schema.
 */
const topicKeyArbitrary: fc.Arbitrary<string> = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')),
  { minLength: 1, maxLength: 20 },
);

/**
 * Genera un oggetto `topicDistribution` valido: Record<string, number> con 1-10 entry,
 * chiavi conformi al pattern [a-z0-9-]+, valori interi 1-100, somma totale ≤ 100.
 */
export const topicDistributionArbitrary: fc.Arbitrary<Record<string, number>> = fc
  .integer({ min: 1, max: 10 })
  .chain((numEntries) =>
    fc
      .tuple(
        fc.uniqueArray(topicKeyArbitrary, { minLength: numEntries, maxLength: numEntries }),
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: numEntries, maxLength: numEntries }),
      )
      .map(([keys, rawValues]) => {
        // Riduce i valori proporzionalmente affinché la somma non superi 100
        const rawSum = rawValues.reduce((a, b) => a + b, 0);
        const values =
          rawSum <= 100
            ? rawValues
            : rawValues.map((v) => Math.max(1, Math.floor((v / rawSum) * 100)));
        // Ricalcola per sicurezza: se la somma supera 100 dopo floor, scala l'ultimo
        const finalSum = values.reduce((a, b) => a + b, 0);
        if (finalSum > 100 && values.length > 0) {
          values[values.length - 1] = Math.max(1, (values[values.length - 1] ?? 1) - (finalSum - 100));
        }
        const result: Record<string, number> = {};
        for (let i = 0; i < keys.length; i++) {
          result[keys[i]!] = values[i]!;
        }
        return result;
      }),
  );

/**
 * Genera un dominio di certificazione con id, nome e percentuale.
 */
const certificationDomainArbitrary = fc.record({
  id: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')), { minLength: 3, maxLength: 15 }),
  name: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz'.split('')), {
    minLength: 5,
    maxLength: 30,
  }),
  percentage: fc.integer({ min: 1, max: 100 }),
});

/**
 * Genera un array di domini le cui percentuali sommano esattamente a 100.
 * Produce 2-6 domini con distribuzione realistica.
 */
const domainsArrayArbitrary: fc.Arbitrary<{ id: string; name: string; percentage: number }[]> = fc
  .integer({ min: 2, max: 6 })
  .chain((count) =>
    fc
      .tuple(
        fc.array(certificationDomainArbitrary, { minLength: count, maxLength: count }),
        fc.array(fc.integer({ min: 1, max: 50 }), { minLength: count, maxLength: count }),
      )
      .map(([domains, weights]) => {
        // Normalizza i pesi affinché sommino esattamente a 100
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const percentages = weights.map((w) => Math.max(1, Math.floor((w / totalWeight) * 100)));
        const diff = 100 - percentages.reduce((a, b) => a + b, 0);
        percentages[0] = (percentages[0] ?? 0) + diff;
        return domains.map((d, i) => ({ ...d, percentage: percentages[i] ?? 1 }));
      }),
  );

/**
 * Genera un oggetto `CertificationConfig` completo con `topicDistribution` opzionale.
 * I domini hanno percentuali che sommano a 100, formatDistribution somma a 100,
 * totalQuestions è un intero ragionevole.
 */
export const certificationConfigWithTopicsArbitrary: fc.Arbitrary<CertificationConfig> = fc
  .tuple(
    domainsArrayArbitrary,
    fc.option(topicDistributionArbitrary, { nil: undefined }),
    fc.integer({ min: 10, max: 200 }),
    fc.constantFrom<CertificationLevel>('professional', 'associate', 'specialty'),
  )
  .chain(([domains, topicDist, totalQuestions, level]) => {
    // Genera una formatDistribution che somma a 100
    return fc
      .tuple(fc.integer({ min: 10, max: 80 }), fc.integer({ min: 5, max: 40 }))
      .map(([single4Pct, multi5Pct]) => {
        const multi6Pct = Math.max(0, 100 - single4Pct - multi5Pct);
        const base = {
          id: `CERT-${level.toUpperCase().slice(0, 3)}-01`,
          displayName: `Test Certification ${level}`,
          examCode: `TST-${level.charAt(0).toUpperCase()}01`,
          level,
          domains,
          formatDistribution: {
            singleAnswer4Options: single4Pct,
            multiAnswer5Options: multi5Pct,
            multiAnswer6Options: multi6Pct,
          },
          totalQuestions,
          timeLimitMinutes: 180,
        };
        // Assegna topicDistribution solo se definito (rispetta exactOptionalPropertyTypes)
        if (topicDist !== undefined) {
          return { ...base, topicDistribution: topicDist } satisfies CertificationConfig;
        }
        return base satisfies CertificationConfig;
      });
  });

/**
 * Genera un `GenerationPlanItem` con campo `topic` opzionale.
 * Quando presente, il topic è una stringa valida conforme al pattern [a-z0-9-]+.
 */
export const generationPlanItemWithTopicArbitrary: fc.Arbitrary<GenerationPlanItem> = fc.record({
  domainId: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz-'.split('')), { minLength: 3, maxLength: 15 }),
  format: questionFormatArbitrary,
  topic: fc.option(topicKeyArbitrary, { nil: undefined }),
});

/**
 * Applica variazioni casuali di maiuscole/minuscole a una stringa.
 * Usato per testare il confronto case-insensitive dei servizi AI.
 */
const randomCaseArbitrary = (s: string): fc.Arbitrary<string> =>
  fc.constantFrom('lower', 'upper', 'mixed').map((casing) => {
    if (casing === 'lower') return s.toLowerCase();
    if (casing === 'upper') return s.toUpperCase();
    // Caso misto: alterna maiuscole e minuscole
    return s
      .split('')
      .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
      .join('');
  });

/**
 * Genera un array di servizi con un mix di servizi AI (da AI_TOPIC_SERVICES)
 * e servizi non-AI, applicando variazioni casuali di casing.
 * Utile per testare la validazione case-insensitive dei servizi AI.
 */
export const aiServicesArrayArbitrary: fc.Arbitrary<string[]> = fc
  .tuple(
    // Servizi AI con variazioni di casing
    fc.shuffledSubarray([...AI_TOPIC_SERVICES], { minLength: 0, maxLength: AI_TOPIC_SERVICES.length }),
    // Servizi non-AI casuali
    fc.array(
      fc.constantFrom('Amazon EC2', 'Amazon S3', 'AWS Lambda', 'Amazon RDS', 'Amazon DynamoDB', 'AWS CloudFormation'),
      { minLength: 0, maxLength: 3 },
    ),
  )
  .chain(([aiServices, nonAiServices]) => {
    // Applica casing casuale a ciascun servizio AI
    if (aiServices.length === 0) {
      return fc.constant([...nonAiServices]);
    }
    const aiWithCasing = aiServices.map((s) => randomCaseArbitrary(s));
    return fc.tuple(...(aiWithCasing as [fc.Arbitrary<string>, ...fc.Arbitrary<string>[]])).map((aiCased) => [
      ...aiCased,
      ...nonAiServices,
    ]);
  })
  // Garantisce almeno un elemento nell'array risultante
  .filter((arr) => arr.length > 0);
