export function ProgressBar({ current, total }: { current: number; total: number }) {
  const percentage = total === 0 ? 0 : Math.round((current / total) * 100);
  return (
    <div style={{ display: 'grid', gap: '0.25rem' }}>
      <div style={{ fontWeight: 600, color: '#374151' }}>Question {current} of {total}</div>
      <div style={{ width: '100%', background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden', height: '0.5rem' }}>
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: '#10b981',
            transition: 'width 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}
