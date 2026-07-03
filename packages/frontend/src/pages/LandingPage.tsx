import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { QuestionBankSummary } from '@aws-exam-generator/shared';
import { CertificationSelector } from '../components/CertificationSelector';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { useCertifications } from '../hooks/useCertifications';
import { apiClient } from '../services/api-client';
import { getActiveSessionId, loadExamSession } from '../utils/localStorage';

const panelStyle: React.CSSProperties = {
  maxWidth: '900px',
  margin: '2rem auto',
  padding: '2rem',
  display: 'grid',
  gap: '1.5rem',
};

export function LandingPage() {
  const navigate = useNavigate();
  const { flatCertifications, selectedCertificationId, setSelectedCertificationId, loading, error } = useCertifications();
  const [banks, setBanks] = useState<QuestionBankSummary[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const activeSession = useMemo(() => {
    const activeSessionId = getActiveSessionId();
    return activeSessionId ? loadExamSession(activeSessionId) : null;
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setBanks(await apiClient.getBanks());
      } finally {
        setBanksLoading(false);
      }
    })();
  }, []);

  const latestBank = useMemo(() =>
    banks.find((bank) => bank.certificationId === selectedCertificationId),
  [banks, selectedCertificationId]);

  if (loading || banksLoading) {
    return <LoadingSpinner label="Loading exam workspace..." />;
  }

  if (error) {
    return <div style={panelStyle}>{error}</div>;
  }

  return (
    <div style={panelStyle}>
      <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }}>
        <h1 style={{ marginTop: 0 }}>AWS Exam Generator</h1>
        <p>Select an AWS certification, generate a question bank from the admin page, then start a timed exam or guided study session.</p>
        <CertificationSelector
          certifications={flatCertifications}
          selectedCertificationId={selectedCertificationId}
          onChange={setSelectedCertificationId}
        />
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <Button disabled={!latestBank} onClick={() => latestBank && navigate(`/exam/${latestBank.bankId}`)}>Start exam</Button>
          <Button disabled={!latestBank} style={{ background: '#059669' }} onClick={() => latestBank && navigate(`/study/${latestBank.bankId}`)}>Start study mode</Button>
          {activeSession && activeSession.certificationId === selectedCertificationId && activeSession.status !== 'submitted' ? (
            <Button style={{ background: '#7c3aed' }} onClick={() => navigate(`/${activeSession.mode}/${activeSession.bankId}`)}>
              Resume active session
            </Button>
          ) : null}
        </div>
        {!latestBank ? (
          <p style={{ color: '#b45309', marginTop: '1rem' }}>
            No question bank found for {selectedCertificationId}. Visit the <Link to="/admin">admin page</Link> to generate one.
          </p>
        ) : (
          <p style={{ color: '#4b5563', marginTop: '1rem' }}>
            Latest bank: {latestBank.bankId} • {latestBank.questionCount} questions • {new Date(latestBank.createdAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
