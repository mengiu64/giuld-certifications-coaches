import { LOCAL_STORAGE_KEYS, deserializeExamResult, deserializeExamSession, serializeExamResult, serializeExamSession, type ExamResult, type ExamSession } from '@aws-exam-generator/shared';

const sessionKey = (sessionId: string): string => `${LOCAL_STORAGE_KEYS.examSessionPrefix}${sessionId}`;
const resultKey = (sessionId: string): string => `${LOCAL_STORAGE_KEYS.examResultPrefix}${sessionId}`;

export const saveExamSession = (session: ExamSession): void => {
  window.localStorage.setItem(sessionKey(session.sessionId), serializeExamSession(session));
};

export const loadExamSession = (sessionId: string): ExamSession | null => {
  const stored = window.localStorage.getItem(sessionKey(sessionId));
  return stored ? deserializeExamSession(stored) : null;
};

export const saveExamResult = (result: ExamResult): void => {
  window.localStorage.setItem(resultKey(result.sessionId), serializeExamResult(result));
};

export const loadExamResult = (sessionId: string): ExamResult | null => {
  const stored = window.localStorage.getItem(resultKey(sessionId));
  return stored ? deserializeExamResult(stored) : null;
};

export const setActiveSessionId = (sessionId: string): void => {
  window.localStorage.setItem(LOCAL_STORAGE_KEYS.activeSession, sessionId);
};

export const getActiveSessionId = (): string | null => window.localStorage.getItem(LOCAL_STORAGE_KEYS.activeSession);

export const clearActiveSessionId = (): void => {
  window.localStorage.removeItem(LOCAL_STORAGE_KEYS.activeSession);
};

export const setSelectedCertification = (certificationId: string): void => {
  window.localStorage.setItem(LOCAL_STORAGE_KEYS.selectedCertification, certificationId);
};

export const getSelectedCertification = (): string | null => window.localStorage.getItem(LOCAL_STORAGE_KEYS.selectedCertification);
