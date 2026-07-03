import type { ExamResult } from '@aws-exam-generator/shared';
import { Link } from 'react-router-dom';
import { ScoreBreakdown } from './ScoreBreakdown';
import { Button } from './common/Button';

export function ResultsView({ result }: { result: ExamResult }) {
  return (
    <div style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }}>
      <h2 style={{ marginTop: 0 }}>Results</h2>
      <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>
        Score: {result.score}% — {result.passed ? 'Passed' : 'Not passed'}
      </p>
      <p>
        Correct answers: {result.correctCount} / {result.totalQuestions}
      </p>
      <ScoreBreakdown result={result} />
      <div style={{ marginTop: '1rem' }}>
        <Link to={`/review/${result.sessionId}`}>
          <Button>Review answers</Button>
        </Link>
      </div>
    </div>
  );
}
