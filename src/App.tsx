import { Navigate, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Verify from './pages/Verify';
import Home from './pages/Home';
import BunkNow from './pages/BunkNow';
import MatchPage from './pages/Match';
import Chats from './pages/Chats';
import Discover from './pages/Discover';
import ProfilePage from './pages/Profile';
import Admin from './pages/Admin';

const Splash = ({ text = 'Loading…' }: { text?: string }) => <div className="splash">{text}</div>;

/** Route guard: signed in → college chosen → verified (admins skip the student steps). */
function Gate({ children, admin }: { children: ReactElement; admin?: boolean }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <Splash />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <Splash />;
  if (profile.suspended) return <Splash text="This account is suspended. Contact your college admin." />;
  if (admin && profile.role !== 'admin') return <Navigate to="/" replace />;
  if (profile.role !== 'admin') {
    if (!profile.college_id) return <Navigate to="/onboarding" replace />;
    if (profile.verification_status !== 'verified') return <Navigate to="/verify" replace />;
  }
  return children;
}

function AuthOnly({ children }: { children: ReactElement }) {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  return session ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { session } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/onboarding" element={<AuthOnly><Onboarding /></AuthOnly>} />
      <Route path="/verify" element={<AuthOnly><Verify /></AuthOnly>} />
      <Route path="/" element={<Gate><Home /></Gate>} />
      <Route path="/bunk" element={<Gate><BunkNow /></Gate>} />
      <Route path="/match/:id" element={<Gate><MatchPage /></Gate>} />
      <Route path="/chats" element={<Gate><Chats /></Gate>} />
      <Route path="/discover" element={<Gate><Discover /></Gate>} />
      <Route path="/profile" element={<Gate><ProfilePage /></Gate>} />
      <Route path="/admin" element={<Gate admin><Admin /></Gate>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
