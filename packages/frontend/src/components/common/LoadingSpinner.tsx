export function LoadingSpinner({ label = 'Loading...' }: { label?: string }) {
  return <div style={{ padding: '1rem', color: '#4b5563' }}>{label}</div>;
}
