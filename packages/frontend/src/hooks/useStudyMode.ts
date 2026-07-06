import { useEffect, useMemo, useState } from 'react';
import type { ExamSession, QuestionBank } from '@aws-exam-generator/shared';
import { checkStudyAnswer, getResumeQuestionOrderIndex, initializeSession, pauseSession, resumeSession, saveStudyAnswer } from '../store/examStore';

export const useStudyMode = (bank: QuestionBank | null) => {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!bank) {
      return;
    }
    const initialized = initializeSession(bank, 'study');
    const resumed = initialized.status === 'paused' ? resumeSession(initialized) : initialized;
    setSession(resumed);
    setCurrentIndex(getResumeQuestionOrderIndex(resumed));
  }, [bank]);

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
    currentIndex,
    currentQuestion,
    setCurrentIndex,
    answerQuestion: (questionIndex: number, answers: string[]) => {
      if (!session) {
        return;
      }
      setSession(saveStudyAnswer(session, questionIndex, answers));
    },
    checkAnswer: (questionIndex: number) => {
      if (!session || !bank) {
        return;
      }
      setSession(checkStudyAnswer(session, bank, questionIndex));
    },
    pause: () => {
      if (!session) {
        return;
      }
      setSession(pauseSession(session));
    },
  };
};
