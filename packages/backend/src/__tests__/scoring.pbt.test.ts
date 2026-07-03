import { describe, expect, it } from '@jest/globals';
import fc from 'fast-check';
import { calculateExamResult, deserializeExamSession, serializeExamSession, type ExamSession, type QuestionBank } from '@aws-exam-generator/shared';
import { examSessionArbitrary } from '@aws-exam-generator/shared/test-helpers';

const questionBank: QuestionBank = {
  bankId: '4da88a57-d9fb-4db2-89eb-53e0a0f5f30f',
  certificationId: 'SAP-C02',
  certificationName: 'AWS Certified Solutions Architect - Professional',
  examCode: 'SAP-C02',
  createdAt: '2024-01-01T00:00:00.000Z',
  questions: [
    {
      questionId: 'cf51f26d-3d92-4c20-b4c7-b4b87a058dc8',
      stem: 'A company uses multiple AWS accounts and needs a repeatable way to apply network controls, protect data, and delegate operations across Regions while maintaining strict security boundaries. Teams require centralized audit visibility, resilient connectivity, and governance automation. The architect must choose an approach that minimizes operational overhead and supports long-term scale. Which option best meets these requirements?',
      options: [
        { label: 'A', text: 'Use AWS Organizations with centralized guardrails, delegated administration, and service-native automation across accounts.' },
        { label: 'B', text: 'Share one administrator role across all teams and manually review every configuration change in spreadsheets.' },
        { label: 'C', text: 'Store production backups on individual developer workstations for faster local access during incidents.' },
        { label: 'D', text: 'Disable centralized logging to reduce data retention costs and rely on application owners for evidence collection.' },
      ],
      correctAnswers: ['A'],
      domain: 'design-solutions-organizational-complexity',
      services: ['Organizations', 'CloudTrail'],
      explanation: 'AWS Organizations with service-native governance patterns provides centralized control while reducing manual effort. Services such as Organizations and CloudTrail support scalable account governance and auditability.',
      format: 'single-4',
      referenceUrl: 'https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices.html',
    },
    {
      questionId: '14e95769-09fa-4a9d-aa8e-f8bfec7cfc6c',
      stem: 'A media platform needs to modernize a batch-based analytics pipeline into a near-real-time design that scales globally, isolates failures, and supports eventual consistency across Regions. The solution should minimize custom polling and preserve decoupling between producers and consumers. Which combination of actions should the architect recommend?',
      options: [
        { label: 'A', text: 'Use Amazon EventBridge for event routing with service integrations and decoupled fan-out across bounded domains.' },
        { label: 'B', text: 'Poll a shared database table from every consumer service and coordinate retries manually with cron jobs.' },
        { label: 'C', text: 'Use Amazon SQS dead-letter queues and idempotent consumers to isolate failures and simplify retries.' },
        { label: 'D', text: 'Depend on a single stateful EC2 instance that serially invokes each consumer without buffering.' },
        { label: 'E', text: 'Disable message durability so backlogs clear faster during traffic spikes and transient downstream outages.' },
      ],
      correctAnswers: ['A', 'C'],
      domain: 'design-new-solutions',
      services: ['EventBridge', 'SQS'],
      explanation: 'EventBridge and SQS provide decoupling, event-driven fan-out, and failure isolation. AWS services such as EventBridge and SQS reduce custom retry logic and improve resilience compared with polling-based designs.',
      format: 'multi-5',
      referenceUrl: 'https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html',
    },
  ],
};

const sessionWithAnswers = (answers: [number, string[]][]): ExamSession => ({
  sessionId: 'da2f4884-0fb5-465b-8787-c6896d8d3230',
  bankId: questionBank.bankId,
  certificationId: questionBank.certificationId,
  mode: 'exam',
  status: 'submitted',
  startedAt: '2024-01-01T00:00:00.000Z',
  timeRemainingMs: 0,
  questionOrder: [0, 1],
  answers,
  markedForReview: [],
});

describe('scoring engine properties', () => {
  it('uses the documented score formula and pass threshold', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 }), (correctCount) => {
        const answers: [number, string[]][] = correctCount === 2
          ? [[0, ['A']], [1, ['A', 'C']]]
          : correctCount === 1
            ? [[0, ['A']], [1, ['A']]]
            : [[0, ['B']], [1, ['A']]];
        const result = calculateExamResult(sessionWithAnswers(answers), questionBank);
        expect(result.score).toBe(Math.round((result.correctCount / result.totalQuestions) * 100));
        expect(result.passed).toBe(result.score >= 75);
      }),
    );
  });

  it('treats multi-answer questions as all-or-nothing', () => {
    const partialResult = calculateExamResult(sessionWithAnswers([[0, ['A']], [1, ['A']]]), questionBank);
    expect(partialResult.correctCount).toBe(1);
    expect(partialResult.score).toBe(50);
  });

  it('round-trips exam sessions through serialization', () => {
    fc.assert(
      fc.property(examSessionArbitrary, (session) => {
        const restored = deserializeExamSession(serializeExamSession(session));
        expect(restored).toEqual(session);
      }),
    );
  });
});
