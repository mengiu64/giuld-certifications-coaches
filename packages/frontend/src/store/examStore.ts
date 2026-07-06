import { calculateExamResult, certificationRegistry, createExamSession, isAnswerCorrect, recordStudyResult, toggleMarkedQuestion, upsertAnswer, type ExamMode, type ExamResult, type ExamSession, type QuestionBank } from '@aws-exam-generator/shared';
import { addSessionToIndex, getAllSessions, loadExamResult, removeSessionFromIndex, saveExamResult, saveExamSession } from '../utils/localStorage';

export const initializeSession = (bank: QuestionBank, mode: ExamMode): ExamSession => {
  const existingSession = getAllSessions().find(
    (candidate) => candidate.bankId === bank.bankId && candidate.mode === mode && candidate.status !== 'submitted',
  );
  if (existingSession) {
    return existingSession;
  }
  const certification = certificationRegistry.getById(bank.certificationId);
  const session = createExamSession(bank, mode, certification?.timeLimitMinutes ?? 180);
  saveExamSession(session);
  addSessionToIndex(session.sessionId);
  return session;
};

export const persistSession = (session: ExamSession): ExamSession => {
  saveExamSession(session);
  if (session.status === 'submitted') {
    removeSessionFromIndex(session.sessionId);
  } else {
    addSessionToIndex(session.sessionId);
  }
  return session;
};

export const getResumeQuestionOrderIndex = (session: ExamSession): number => {
  if (session.questionOrder.length === 0) {
    return 0;
  }

  // In study mode, a question only counts as "done" once it has been checked (studyResults),
  // not merely answered - otherwise resuming could skip past questions the user never actually
  // checked, landing them on the last question with most of the bank still unchecked.
  const completedQuestionIndexes = session.mode === 'study'
    ? (session.studyResults ?? []).map((result) => result.questionIndex)
    : session.answers.map(([questionIndex]) => questionIndex);

  if (completedQuestionIndexes.length === 0) {
    return 0;
  }

  const orderPositionByQuestion = new Map<number, number>();
  for (const [position, questionIndex] of session.questionOrder.entries()) {
    orderPositionByQuestion.set(questionIndex, position);
  }

  const lastCompletedPosition = completedQuestionIndexes.reduce((maxPosition, questionIndex) => {
    const position = orderPositionByQuestion.get(questionIndex);
    if (position === undefined) {
      return maxPosition;
    }
    return Math.max(maxPosition, position);
  }, -1);

  if (lastCompletedPosition < 0) {
    return 0;
  }

  return Math.min(lastCompletedPosition + 1, session.questionOrder.length - 1);
};

export const pauseSession = (session: ExamSession): ExamSession =>
  persistSession({ ...session, status: 'paused' });

export const resumeSession = (session: ExamSession): ExamSession =>
  persistSession({ ...session, status: 'in_progress' });

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

export const saveStudyAnswer = (session: ExamSession, questionIndex: number, answers: string[]): ExamSession => {
  const updated = answerQuestion(session, questionIndex, answers);
  // Changing the answer invalidates any previous "check answers" result for this question,
  // so the correct-answer reveal disappears again until the user checks again.
  const studyResults = updated.studyResults?.filter((result) => result.questionIndex !== questionIndex);
  return persistSession({ ...updated, studyResults });
};

export const checkStudyAnswer = (session: ExamSession, bank: QuestionBank, questionIndex: number): ExamSession => {
  const question = bank.questions[questionIndex]!;
  const selectedAnswers = new Map(session.answers).get(questionIndex) ?? [];
  const isCorrect = isAnswerCorrect(question, selectedAnswers);
  return persistSession(recordStudyResult(session, questionIndex, selectedAnswers, isCorrect));
};

export const restoreResult = (sessionId: string): ExamResult | null => loadExamResult(sessionId);
