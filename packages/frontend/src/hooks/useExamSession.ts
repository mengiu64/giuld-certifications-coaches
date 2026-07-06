import { useEffect, useMemo, useState } from 'react';
import type { ExamResult, ExamSession, QuestionBank } from '@aws-exam-generator/shared';
import {
  answerQuestion,
  getResumeQuestionOrderIndex,
  initializeSession,
  pauseSession,
  resumeSession,
  persistSession,
  submitSession,
  toggleReviewMark,
} from '../store/examStore';

export const useExamSession = (bank: QuestionBank | null) => {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!bank) {
      return;
    }
    const initialized = initializeSession(bank, 'exam');
    const resumed = initialized.status === 'paused' ? resumeSession(initialized) : initialized;
    setSession(resumed);
    setCurrentIndex(getResumeQuestionOrderIndex(resumed));
  }, [bank]);

  useEffect(() => {
    if (!session || session.mode !== 'exam' || session.status !== 'in_progress') {
      return;
    }
    const timer = window.setInterval(() => {
      setSession((current) => {
        if (!current || current.status !== 'in_progress') {
          return current;
        }
        const next = { ...current, timeRemainingMs: Math.max(0, current.timeRemainingMs - 1000) };
        const persisted = persistSession(next);
        return persisted;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!bank || !session || session.timeRemainingMs > 0 || session.status !== 'in_progress') {
      return;
    }
    const submitted = submitSession(session, bank);
    setSession(submitted.session);
    setResult(submitted.result);
  }, [bank, session]);

  const currentQuestion = useMemo(() => {
    if (!bank || !session) {
      return null;
    }
    const questionIndex = session.questionOrder[currentIndex] ?? 0;
    return {
      question: bank.questions[questionIndex] ?? null,
      questionIndex,
    };
  }, [bank, currentIndex, session]);

  return {
    session,
    result,
    currentIndex,
    currentQuestion,
    setCurrentIndex,
    answerQuestion: (questionIndex: number, answers: string[]) => {
      if (!session) {
        return;
      }
      setSession(answerQuestion(session, questionIndex, answers));
    },
    toggleReviewMark: (questionIndex: number) => {
      if (!session) {
        return;
      }
      setSession(toggleReviewMark(session, questionIndex));
    },
    submit: () => {
      if (!session || !bank) {
        return;
      }
      const submitted = submitSession(session, bank);
      setSession(submitted.session);
      setResult(submitted.result);
    },
    pause: () => {
      if (!session) {
        return;
      }
      setSession(pauseSession(session));
    },
  };
};
