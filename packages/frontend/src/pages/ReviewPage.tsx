import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { QuestionBank } from '@aws-exam-generator/shared';
import { QuestionCard } from '../components/QuestionCard';
import { ResultsView } from '../components/ResultsView';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { apiClient } from '../services/api-client';
import { loadExamResult, loadExamSession } from '../utils/localStorage';

type Filter = 'all' | 'correct' | 'incorrect' | 'marked';

const pageStyle: React.CSSProperties = {
  maxWidth: '1100px',
  margin: '2rem auto',
  padding: '0 1rem 2rem',
  display: 'grid',
  gap: '1rem',
};

export function ReviewPage() {
  const { sessionId } = useParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const session = sessionId ? loadExamSession(sessionId) : null;
  const result = sessionId ? loadExamResult(sessionId) : null;

  useEffect(() => {
    if (!session) {
      setError('Session not found in localStorage.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        setBank(await apiClient.getBank(session.bankId));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load bank for review.');
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  const items = useMemo(() => {
    if (!session || !bank) {
      return [];
    }
    const answerMap = new Map(session.answers);
    return session.questionOrder.map((questionIndex) => {
      const question = bank.questions[questionIndex]!;
      const selectedAnswers = answerMap.get(questionIndex) ?? [];
      const isCorrect = selectedAnswers.length === question.correctAnswers.length &&
        [...selectedAnswers].sort().every((answer, index) => answer === [...question.correctAnswers].sort()[index]);
      const marked = session.markedForReview.includes(questionIndex);
      return { question, questionIndex, selectedAnswers, isCorrect, marked };
    }).filter((item) => {
      switch (filter) {
        case 'correct':
          return item.isCorrect;
        case 'incorrect':
          return !item.isCorrect;
        case 'marked':
          return item.marked;
        default:
          return true;
      }
    });
  }, [bank, filter, session]);

  if (loading) {
    return <LoadingSpinner label="Loading review page..." />;
  }
  if (error || !session || !bank) {
    return <div style={pageStyle}>{error ?? 'Unable to review session.'}</div>;
  }

  return (
    <div style={pageStyle}>
      {result ? <ResultsView result={result} /> : null}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {(['all', 'correct', 'incorrect', 'marked'] as Filter[]).map((value) => (
          <Button
            key={value}
            style={{ background: filter === value ? '#2563eb' : '#6b7280' }}
            onClick={() => setFilter(value)}
          >
            {value}
          </Button>
        ))}
      </div>
      {items.map((item) => (
        <QuestionCard
          key={item.question.questionId}
          question={item.question}
          selectedAnswers={item.selectedAnswers}
          onChange={() => undefined}
          showCorrectAnswers
        />
      ))}
    </div>
  );
}
