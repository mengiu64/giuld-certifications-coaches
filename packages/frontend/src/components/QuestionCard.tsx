import type { Question } from '@aws-exam-generator/shared';

const containerStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '0.75rem',
  padding: '1.5rem',
  boxShadow: '0 10px 25px rgba(0,0,0,0.08)',
};

export function QuestionCard({
  question,
  selectedAnswers,
  onChange,
  showCorrectAnswers = false,
  immediateResult,
  markForReview,
  isMarkedForReview,
}: {
  question: Question;
  selectedAnswers: string[];
  onChange: (answers: string[]) => void;
  showCorrectAnswers?: boolean;
  immediateResult?: boolean;
  markForReview?: () => void;
  isMarkedForReview?: boolean;
}) {
  const isMulti = question.format !== 'single-4';
  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <p style={{ color: '#6b7280', marginTop: 0, fontWeight: 700 }}>{question.domain}</p>
          <p style={{ lineHeight: 1.6 }}>{question.stem}</p>
        </div>
        {markForReview ? (
          <button
            type="button"
            onClick={markForReview}
            style={{ border: 'none', background: 'transparent', color: isMarkedForReview ? '#f59e0b' : '#6b7280', cursor: 'pointer' }}
          >
            {isMarkedForReview ? '★ Marked' : '☆ Mark for review'}
          </button>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {question.options.map((option) => {
          const checked = selectedAnswers.includes(option.label);
          const isCorrect = question.correctAnswers.includes(option.label);
          const background = showCorrectAnswers
            ? isCorrect
              ? '#dcfce7'
              : checked
                ? '#fee2e2'
                : '#ffffff'
            : checked
              ? '#dbeafe'
              : '#ffffff';
          return (
            <label key={option.label} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', background }}>
              <input
                type={isMulti ? 'checkbox' : 'radio'}
                name={question.questionId}
                checked={checked}
                onChange={() => {
                  if (isMulti) {
                    onChange(checked ? selectedAnswers.filter((answer) => answer !== option.label) : [...selectedAnswers, option.label]);
                  } else {
                    onChange([option.label]);
                  }
                }}
              />
              <span><strong>{option.label}.</strong> {option.text}</span>
            </label>
          );
        })}
      </div>
      {showCorrectAnswers ? (
        <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '0.5rem', background: immediateResult ? '#eff6ff' : '#f9fafb' }}>
          <p style={{ marginTop: 0, fontWeight: 700 }}>
            Correct answers: {question.correctAnswers.join(', ')}
          </p>
          <p style={{ marginBottom: 0, lineHeight: 1.6 }}>{question.explanation}</p>
          {question.referenceUrl ? (
            <a href={question.referenceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '0.75rem' }}>
              AWS reference
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
