import type { ExamSession, QuestionBank } from '@aws-exam-generator/shared';
import { Button } from './common/Button';

type QuestionStatus = 'answered' | 'incomplete' | 'unanswered';

const statusStyles: Record<QuestionStatus, { label: string; background: string; color: string }> = {
  answered: { label: 'Answered', background: '#dcfce7', color: '#166534' },
  incomplete: { label: 'Incomplete', background: '#fef3c7', color: '#92400e' },
  unanswered: { label: 'Not answered', background: '#fee2e2', color: '#991b1b' },
};

export function ExamSummaryGrid({
  bank,
  session,
  onSelectQuestion,
  onBackToExam,
  onSubmit,
}: {
  bank: QuestionBank;
  session: ExamSession;
  onSelectQuestion: (position: number) => void;
  onBackToExam: () => void;
  onSubmit: () => void;
}) {
  const answerMap = new Map(session.answers);
  const items = session.questionOrder.map((questionIndex, position) => {
    const question = bank.questions[questionIndex]!;
    const selectedAnswers = answerMap.get(questionIndex) ?? [];
    const status: QuestionStatus = selectedAnswers.length === 0
      ? 'unanswered'
      : selectedAnswers.length < question.correctAnswers.length
        ? 'incomplete'
        : 'answered';
    const marked = session.markedForReview.includes(questionIndex);
    return { position, questionIndex, status, marked };
  });

  return (
    <div style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Exam summary</h2>
        <Button style={{ background: '#4b5563' }} onClick={onBackToExam}>Back to exam</Button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))',
          gap: '0.5rem',
        }}
      >
        {items.map((item) => {
          const style = statusStyles[item.status];
          return (
            <button
              key={item.questionIndex}
              type="button"
              onClick={() => onSelectQuestion(item.position)}
              style={{
                position: 'relative',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                background: style.background,
                color: style.color,
                padding: '0.5rem 0.25rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title={`Question ${item.position + 1}: ${style.label}${item.marked ? ' • Marked for review' : ''}`}
            >
              {item.position + 1}
              {item.marked ? (
                <span style={{ position: 'absolute', top: '-0.4rem', right: '-0.4rem', color: '#f59e0b' }}>★</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
        {(Object.keys(statusStyles) as QuestionStatus[]).map((status) => (
          <span key={status} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '0.85rem', height: '0.85rem', borderRadius: '0.2rem', background: statusStyles[status].background, border: '1px solid #d1d5db', display: 'inline-block' }} />
            {statusStyles[status].label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: '#f59e0b' }}>★</span>
          Marked for review
        </span>
      </div>
      <Button style={{ background: '#dc2626', justifySelf: 'start' }} onClick={onSubmit}>Submit exam</Button>
    </div>
  );
}
