import type { ExamResult, ExamSession, Question, QuestionBank } from './types.js';
export declare const isAnswerCorrect: (question: Question, selectedAnswers: readonly string[]) => boolean;
export declare const calculateExamResult: (session: ExamSession, bank: QuestionBank) => ExamResult;
