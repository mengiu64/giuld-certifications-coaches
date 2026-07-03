import { calculateExamResult, certificationRegistry, createExamSession, isAnswerCorrect, recordStudyResult, toggleMarkedQuestion, upsertAnswer, type ExamMode, type ExamResult, type ExamSession, type QuestionBank } from '@aws-exam-generator/shared';
import { clearActiveSessionId, getActiveSessionId, loadExamResult, loadExamSession, saveExamResult, saveExamSession, setActiveSessionId } from '../utils/localStorage';

export const initializeSession = (bank: QuestionBank, mode: ExamMode): ExamSession => {
  const activeSessionId = getActiveSessionId();
  if (activeSessionId) {
    const activeSession = loadExamSession(activeSessionId);
    if (activeSession && activeSession.bankId === bank.bankId && activeSession.mode === mode && activeSession.status !== 'submitted') {
      return activeSession;
    }
  }
  const certification = certificationRegistry.getById(bank.certificationId);
  const session = createExamSession(bank, mode, certification?.timeLimitMinutes ?? 180);
  saveExamSession(session);
  setActiveSessionId(session.sessionId);
  return session;
};

export const persistSession = (session: ExamSession): ExamSession => {
  saveExamSession(session);
  if (session.status === 'submitted') {
    clearActiveSessionId();
  } else {
    setActiveSessionId(session.sessionId);
  }
  return session;
};

export const answerQuestion = (session: ExamSession, questionIndex: number, answers: string[]): ExamSession =>
  persistSession(upsertAnswer(session, questionIndex, answers));

export const toggleReviewMark = (session: ExamSession, questionIndex: number): ExamSession =>
  persistSession(toggleMarkedQuestion(session, questionIndex));

export const submitSession = (session: ExamSession, bank: QuestionBank): { session: ExamSession; result: ExamResult } => {
  const submittedSession: ExamSession = persistSession({ ...session, status: 'submitted', timeRemainingMs: 0 });
  const result = calculateExamResult(submittedSession, bank);
  saveExamResult(result);
  return { session: submittedSession, result };
};

export const saveStudyAnswer = (session: ExamSession, bank: QuestionBank, questionIndex: number, answers: string[]): ExamSession => {
  const updated = answerQuestion(session, questionIndex, answers);
  const isCorrect = isAnswerCorrect(bank.questions[questionIndex]!, answers);
  return persistSession(recordStudyResult(updated, questionIndex, answers, isCorrect));
};

export const restoreResult = (sessionId: string): ExamResult | null => loadExamResult(sessionId);
