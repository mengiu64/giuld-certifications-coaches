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

const getSessionIndex = (): string[] => {
  const stored = window.localStorage.getItem(LOCAL_STORAGE_KEYS.sessionIndex);
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const saveSessionIndex = (sessionIds: string[]): void => {
  window.localStorage.setItem(LOCAL_STORAGE_KEYS.sessionIndex, JSON.stringify(sessionIds));
};

export const addSessionToIndex = (sessionId: string): void => {
  const index = getSessionIndex();
  if (!index.includes(sessionId)) {
    saveSessionIndex([...index, sessionId]);
  }
};

export const removeSessionFromIndex = (sessionId: string): void => {
  const index = getSessionIndex();
  saveSessionIndex(index.filter((id) => id !== sessionId));
};

export const getAllSessions = (): ExamSession[] => {
  const index = getSessionIndex();
  const sessions: ExamSession[] = [];
  const staleIds: string[] = [];
  for (const sessionId of index) {
    const session = loadExamSession(sessionId);
    if (session) {
      sessions.push(session);
    } else {
      staleIds.push(sessionId);
    }
  }
  if (staleIds.length > 0) {
    saveSessionIndex(index.filter((id) => !staleIds.includes(id)));
  }
  return sessions;
};

export const deleteExamSession = (sessionId: string): void => {
  window.localStorage.removeItem(sessionKey(sessionId));
  window.localStorage.removeItem(resultKey(sessionId));
  removeSessionFromIndex(sessionId);
};

export const setSelectedCertification = (certificationId: string): void => {
  window.localStorage.setItem(LOCAL_STORAGE_KEYS.selectedCertification, certificationId);
};

export const getSelectedCertification = (): string | null => window.localStorage.getItem(LOCAL_STORAGE_KEYS.selectedCertification);
