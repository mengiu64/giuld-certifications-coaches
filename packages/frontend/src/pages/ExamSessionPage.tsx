import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExamSummaryGrid } from '../components/ExamSummaryGrid';
import { ProgressBar } from '../components/ProgressBar';
import { QuestionCard } from '../components/QuestionCard';
import { ResultsView } from '../components/ResultsView';
import { Timer } from '../components/Timer';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useExamSession } from '../hooks/useExamSession';
import { apiClient } from '../services/api-client';
import type { QuestionBank } from '@aws-exam-generator/shared';

const pageStyle: React.CSSProperties = {
  maxWidth: '1000px',
  margin: '2rem auto',
  padding: '0 1rem 2rem',
  display: 'grid',
  gap: '1rem',
};

export function ExamSessionPage() {
  const { bankId } = useParams();
  const navigate = useNavigate();
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const exam = useExamSession(bank);

  useEffect(() => {
    if (!bankId) {
      setError('Missing bank identifier.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        setBank(await apiClient.getBank(bankId));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load bank.');
      } finally {
        setLoading(false);
      }
    })();
  }, [bankId]);

  const selectedAnswers = useMemo(() => {
    if (!exam.session || !exam.currentQuestion) {
      return [];
    }
    return new Map(exam.session.answers).get(exam.currentQuestion.questionIndex) ?? [];
  }, [exam.currentQuestion, exam.session]);

  if (loading) {
    return <LoadingSpinner label="Loading exam session..." />;
  }
  if (error || !bank || !exam.currentQuestion?.question || !exam.session) {
    return <div style={pageStyle}>{error ?? 'Unable to load exam session.'}</div>;
  }
  if (exam.result) {
    return (
      <div style={pageStyle}>
        <ResultsView result={exam.result} />
      </div>
    );
  }

  const session = exam.session;
  const currentPosition = exam.currentIndex + 1;
  const totalQuestions = bank.questions.length;
  const isLastQuestion = currentPosition === totalQuestions;

  if (showSummary) {
    return (
      <div style={pageStyle}>
        <ExamSummaryGrid
          bank={bank}
          session={session}
          onSelectQuestion={(position) => {
            exam.setCurrentIndex(position);
            setShowSummary(false);
          }}
          onBackToExam={() => setShowSummary(false)}
          onSubmit={exam.submit}
        />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0 }}>Exam Mode</h1>
        <Timer timeRemainingMs={session.timeRemainingMs} />
      </div>
      <ProgressBar current={currentPosition} total={totalQuestions} />
      <QuestionCard
        question={exam.currentQuestion.question}
        selectedAnswers={selectedAnswers}
        onChange={(answers) => exam.answerQuestion(exam.currentQuestion!.questionIndex, answers)}
        markForReview={() => exam.toggleReviewMark(exam.currentQuestion!.questionIndex)}
        isMarkedForReview={session.markedForReview.includes(exam.currentQuestion.questionIndex)}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <Button disabled={exam.currentIndex === 0} style={{ background: '#4b5563' }} onClick={() => exam.setCurrentIndex(Math.max(0, exam.currentIndex - 1))}>Previous</Button>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button
            style={{ background: '#f59e0b' }}
            onClick={() => {
              exam.pause();
              navigate('/');
            }}
          >
            Pause
          </Button>
          <Button style={{ background: '#dc2626' }} onClick={exam.submit}>Submit exam</Button>
          <Button onClick={() => isLastQuestion ? setShowSummary(true) : exam.setCurrentIndex(exam.currentIndex + 1)}>
            {isLastQuestion ? 'Finish' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
