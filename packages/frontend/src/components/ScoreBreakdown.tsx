import type { ExamResult } from '@aws-exam-generator/shared';

export function ScoreBreakdown({ result }: { result: ExamResult }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', borderBottom: '1px solid #d1d5db', paddingBottom: '0.5rem' }}>Domain</th>
          <th style={{ textAlign: 'left', borderBottom: '1px solid #d1d5db', paddingBottom: '0.5rem' }}>Correct</th>
          <th style={{ textAlign: 'left', borderBottom: '1px solid #d1d5db', paddingBottom: '0.5rem' }}>Total</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(result.domainBreakdown).map(([domain, stats]) => (
          <tr key={domain}>
            <td style={{ padding: '0.5rem 0' }}>{domain}</td>
            <td>{stats.correct}</td>
            <td>{stats.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
