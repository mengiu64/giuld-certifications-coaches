import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ExamSession, QuestionBankSummary } from '@aws-exam-generator/shared';
import { CertificationSelector } from '../components/CertificationSelector';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { useCertifications } from '../hooks/useCertifications';
import { apiClient } from '../services/api-client';
import { deleteExamSession, getAllSessions } from '../utils/localStorage';

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
  const [resumableSessions, setResumableSessions] = useState<ExamSession[]>(() =>
    getAllSessions().filter((session) => session.status !== 'submitted'),
  );

  useEffect(() => {
    void (async () => {
      try {
        setBanks(await apiClient.getBanks());
      } finally {
        setBanksLoading(false);
      }
    })();
  }, []);

  const banksForCertification = useMemo(
    () =>
      banks
        .filter((bank) => bank.certificationId === selectedCertificationId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [banks, selectedCertificationId],
  );

  const handleDeleteSession = (sessionId: string) => {
    deleteExamSession(sessionId);
    setResumableSessions((current) => current.filter((session) => session.sessionId !== sessionId));
  };

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
        {banksForCertification.length === 0 ? (
          <p style={{ color: '#b45309', marginTop: '1rem' }}>
            No question bank found for {selectedCertificationId}. Visit the <Link to="/admin">admin page</Link> to generate one.
          </p>
        ) : null}
      </div>
      {banksForCertification.length > 0 ? (
        <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0 }}>Question banks for {selectedCertificationId}</h2>
          <p style={{ color: '#6b7280', marginTop: 0 }}>Most recent first. Choose which generated bank to use.</p>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {banksForCertification.map((bank, index) => (
              <div
                key={bank.bankId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.75rem 1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ color: '#4b5563' }}>
                  {index === 0 ? <strong style={{ color: '#059669' }}>Latest • </strong> : null}
                  {bank.bankId} • {bank.questionCount} questions • {new Date(bank.createdAt).toLocaleString()}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button onClick={() => navigate(`/exam/${bank.bankId}`)}>Start exam</Button>
                  <Button style={{ background: '#059669' }} onClick={() => navigate(`/study/${bank.bankId}`)}>
                    Start study mode
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {resumableSessions.length > 0 ? (
        <div style={{ background: '#ffffff', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 10px 25px rgba(0,0,0,0.08)' }}>
          <h2 style={{ marginTop: 0 }}>Resumable sessions</h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {resumableSessions.map((resumableSession) => {
              const sessionBank = banks.find((bank) => bank.bankId === resumableSession.bankId);
              return (
                <div
                  key={resumableSession.sessionId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ color: '#4b5563' }}>
                    {sessionBank?.certificationName ?? resumableSession.certificationId} • {resumableSession.mode === 'exam' ? 'Exam' : 'Study mode'} • {resumableSession.bankId}
                    {resumableSession.status === 'in_progress' ? ' • in progress' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      style={{ background: '#7c3aed' }}
                      onClick={() => navigate(`/${resumableSession.mode}/${resumableSession.bankId}`)}
                    >
                      {resumableSession.mode === 'exam' ? 'Resume exam' : 'Resume study mode'}
                    </Button>
                    <Button
                      style={{ background: '#dc2626' }}
                      onClick={() => handleDeleteSession(resumableSession.sessionId)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
