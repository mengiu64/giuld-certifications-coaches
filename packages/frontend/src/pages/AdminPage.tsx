import { useEffect, useState } from 'react';
import type { GenerationStatus, QuestionBankSummary } from '@aws-exam-generator/shared';
import { CertificationSelector } from '../components/CertificationSelector';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useCertifications } from '../hooks/useCertifications';
import { apiClient } from '../services/api-client';

const panelStyle: React.CSSProperties = {
  maxWidth: '900px',
  margin: '2rem auto',
  padding: '2rem',
  display: 'grid',
  gap: '1.5rem',
};

export function AdminPage() {
  const { flatCertifications, selectedCertificationId, setSelectedCertificationId, loading, error } = useCertifications();
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const [nextStatus, nextBanks] = await Promise.all([apiClient.getGenerationStatus(), apiClient.getBanks()]);
    setStatus(nextStatus);
    setBanks(nextBanks.filter((bank) => bank.certificationId === selectedCertificationId));
  };

  useEffect(() => {
    void refresh();
  }, [selectedCertificationId]);

  useEffect(() => {
    if (status?.state !== 'running') {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [status?.state, selectedCertificationId]);

  if (loading) {
    return <LoadingSpinner label="Loading admin workspace..." />;
  }
  if (error) {
    return <div style={panelStyle}>{error}</div>;
  }

  return (
    <div style={panelStyle}>
      <div style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '2rem', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }}>
        <h1 style={{ marginTop: 0 }}>Admin</h1>
        <CertificationSelector
          certifications={flatCertifications}
          selectedCertificationId={selectedCertificationId}
          onChange={setSelectedCertificationId}
        />
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <Button
            disabled={status?.state === 'running'}
            onClick={() => {
              void (async () => {
                try {
                  const nextStatus = await apiClient.generateExam(selectedCertificationId);
                  setStatus(nextStatus);
                  setMessage(`Generation started for ${selectedCertificationId}.`);
                } catch (caughtError) {
                  setMessage(caughtError instanceof Error ? caughtError.message : 'Failed to start generation.');
                }
              })();
            }}
          >
            Generate bank
          </Button>
          <Button style={{ background: '#4b5563' }} onClick={() => void refresh()}>Refresh</Button>
        </div>
        {message ? <p style={{ color: '#2563eb' }}>{message}</p> : null}
        {status ? (
          <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '0.5rem', background: '#f9fafb' }}>
            <p style={{ margin: '0 0 0.5rem' }}><strong>Status:</strong> {status.state}</p>
            <p style={{ margin: '0 0 0.5rem' }}>{status.message}</p>
            <p style={{ margin: 0 }}>
              Progress: {status.generatedQuestions}/{status.targetQuestions}
            </p>
          </div>
        ) : null}
      </div>
      <div style={{ background: '#ffffff', borderRadius: '0.75rem', padding: '2rem', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }}>
        <h2 style={{ marginTop: 0 }}>Generated banks for {selectedCertificationId}</h2>
        {banks.length === 0 ? (
          <p>No banks generated yet.</p>
        ) : (
          <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
            {banks.map((bank) => (
              <li key={bank.bankId} style={{ marginBottom: '0.5rem' }}>
                {bank.bankId} — {bank.questionCount} questions — {new Date(bank.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
