export function ProgressBar({ current, total }: { current: number; total: number }) {
  const percentage = total === 0 ? 0 : Math.round((current / total) * 100);
  return (
    <div style={{ width: '100%', background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
      <div
        style={{
          width: `${percentage}%`,
          background: '#10b981',
          color: '#ffffff',
          padding: '0.35rem 0',
          textAlign: 'center',
          transition: 'width 0.2s ease',
        }}
      >
        {percentage}%
      </div>
    </div>
  );
}
