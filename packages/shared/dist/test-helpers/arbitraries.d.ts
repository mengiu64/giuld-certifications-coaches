import fc from 'fast-check';
import type { ExamSession, GeneratedQuestionDraft, QuestionFormat } from '../types.js';
export declare const questionFormatArbitrary: fc.Arbitrary<QuestionFormat>;
export declare const generatedQuestionDraftArbitrary: fc.Arbitrary<GeneratedQuestionDraft>;
export declare const examSessionArbitrary: fc.Arbitrary<ExamSession>;
