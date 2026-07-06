import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import type { QuestionBank } from '@aws-exam-generator/shared';
import { ProgressBar } from '../components/ProgressBar';
import { QuestionCard } from '../components/QuestionCard';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useStudyMode } from '../hooks/useStudyMode';
import { apiClient } from '../services/api-client';

const pageStyle: React.CSSProperties = {
  maxWidth: '1000px',
  margin: '2rem auto',
  padding: '0 1rem 2rem',
  display: 'grid',
  gap: '1rem',
};

export function StudyModePage() {
  const { bankId } = useParams();
  const navigate = useNavigate();
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const study = useStudyMode(bank);

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
    if (!study.session || !study.currentQuestion) {
      return [];
    }
    return new Map(study.session.answers).get(study.currentQuestion.questionIndex) ?? [];
  }, [study.currentQuestion, study.session]);

  if (loading) {
    return <LoadingSpinner label="Loading study mode..." />;
  }
  if (error || !bank || !study.currentQuestion?.question || !study.session) {
    return <div style={pageStyle}>{error ?? 'Unable to load study mode.'}</div>;
  }

  const answeredSet = new Set(study.session.studyResults?.map((result) => result.questionIndex) ?? []);
  const studySession = study.session;
  const isChecked = answeredSet.has(study.currentQuestion.questionIndex);
  const allQuestionsChecked = answeredSet.size === bank.questions.length;

  return (
    <div style={pageStyle}>
      <h1 style={{ marginBottom: 0 }}>Study Mode</h1>
      <ProgressBar current={study.currentIndex + 1} total={bank.questions.length} />
      <QuestionCard
        question={study.currentQuestion.question}
        selectedAnswers={selectedAnswers}
        onChange={(answers) => study.answerQuestion(study.currentQuestion!.questionIndex, answers)}
        showCorrectAnswers={isChecked}
        immediateResult
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <Button disabled={study.currentIndex === 0} style={{ background: '#4b5563' }} onClick={() => study.setCurrentIndex(Math.max(0, study.currentIndex - 1))}>Previous</Button>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button
            style={{ background: '#f59e0b' }}
            onClick={() => {
              study.pause();
              navigate('/');
            }}
          >
            Pause
          </Button>
          <Button
            disabled={selectedAnswers.length === 0 || isChecked}
            style={{ background: '#0ea5e9' }}
            onClick={() => study.checkAnswer(study.currentQuestion!.questionIndex)}
          >
            Check answers
          </Button>
          {isChecked ? (
            <Button disabled={study.currentIndex === bank.questions.length - 1} onClick={() => study.setCurrentIndex(Math.min(bank.questions.length - 1, study.currentIndex + 1))}>Next</Button>
          ) : null}
        </div>
      </div>
      {allQuestionsChecked ? (
        <Button style={{ background: '#7c3aed', justifySelf: 'start' }} onClick={() => navigate(`/review/${studySession.sessionId}`)}>
          Review answers
        </Button>
      ) : null}
    </div>
  );
}
