import { useEffect, useMemo, useState } from 'react';
import type { ExamSession, QuestionBank } from '@aws-exam-generator/shared';
import { initializeSession, saveStudyAnswer } from '../store/examStore';

export const useStudyMode = (bank: QuestionBank | null) => {
  const [session, setSession] = useState<ExamSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!bank) {
      return;
    }
    setSession(initializeSession(bank, 'study'));
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
      if (!session || !bank) {
        return;
      }
      setSession(saveStudyAnswer(session, bank, questionIndex, answers));
    },
  };
};
