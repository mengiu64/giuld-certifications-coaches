import type { ExamMode, ExamResult, ExamSession, QuestionBank } from './types.js';
export declare const createExamSession: (bank: QuestionBank, mode: ExamMode, timeLimitMinutes: number) => ExamSession;
export declare const serializeExamSession: (session: ExamSession) => string;
export declare const deserializeExamSession: (value: string) => ExamSession;
export declare const serializeExamResult: (result: ExamResult) => string;
export declare const deserializeExamResult: (value: string) => ExamResult;
export declare const upsertAnswer: (session: ExamSession, questionIndex: number, answers: string[]) => ExamSession;
export declare const toggleMarkedQuestion: (session: ExamSession, questionIndex: number) => ExamSession;
export declare const recordStudyResult: (session: ExamSession, questionIndex: number, selectedAnswers: string[], isCorrect: boolean) => ExamSession;
