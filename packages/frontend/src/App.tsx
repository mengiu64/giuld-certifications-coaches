import { Link, Route, Routes } from 'react-router-dom';
import { AdminPage } from './pages/AdminPage';
import { ExamSessionPage } from './pages/ExamSessionPage';
import { LandingPage } from './pages/LandingPage';
import { ReviewPage } from './pages/ReviewPage';
import { StudyModePage } from './pages/StudyModePage';

const navStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  padding: '1rem 1.5rem',
  background: '#111827',
};

const linkStyle: React.CSSProperties = {
  color: '#f9fafb',
  textDecoration: 'none',
  fontWeight: 600,
};

export default function App() {
  return (
    <div>
      <nav style={navStyle}>
        <Link to="/" style={linkStyle}>Home</Link>
        <Link to="/admin" style={linkStyle}>Admin</Link>
      </nav>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/exam/:bankId" element={<ExamSessionPage />} />
        <Route path="/study/:bankId" element={<StudyModePage />} />
        <Route path="/review/:sessionId" element={<ReviewPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </div>
  );
}
