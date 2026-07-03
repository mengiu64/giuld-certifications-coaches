const formatTime = (timeRemainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(timeRemainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
};

export function Timer({ timeRemainingMs }: { timeRemainingMs: number }) {
  return (
    <div style={{ fontWeight: 700, color: timeRemainingMs < 300_000 ? '#dc2626' : '#111827' }}>
      Time remaining: {formatTime(timeRemainingMs)}
    </div>
  );
}
