import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('./hooks/useAuth', () => ({ useAuth: mockUseAuth }));
vi.mock('./pages/Login', () => ({ default: () => <div>Login page</div> }));
vi.mock('./pages/Onboarding', () => ({ default: () => <div>Onboarding page</div> }));
vi.mock('./pages/Verify', () => ({ default: () => <div>Verify page</div> }));
vi.mock('./pages/Home', () => ({ default: () => <div>Home page</div> }));
vi.mock('./pages/BunkNow', () => ({ default: () => <div>Bunk page</div> }));
vi.mock('./pages/Match', () => ({ default: () => <div>Match page</div> }));
vi.mock('./pages/Chats', () => ({ default: () => <div>Chats page</div> }));
vi.mock('./pages/Discover', () => ({ default: () => <div>Discover page</div> }));
vi.mock('./pages/Profile', () => ({ default: () => <div>Profile page</div> }));
vi.mock('./pages/Admin', () => ({ default: () => <div>Admin page</div> }));

const session = { user: { id: 'student-1' } };
const profile = {
  id: 'student-1',
  name: 'Student',
  college_id: 'college-1',
  verification_status: 'verified',
  role: 'student',
  suspended: false,
};

function renderAt(path: string, auth: { session: unknown; profile: unknown; loading: boolean }) {
  mockUseAuth.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App route guards', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('redirects an unauthenticated visitor to login', () => {
    renderAt('/', { session: null, profile: null, loading: false });
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects a session without a college to onboarding', () => {
    renderAt('/', { session, profile: { ...profile, college_id: null }, loading: false });
    expect(screen.getByText('Onboarding page')).toBeInTheDocument();
  });

  it('redirects a pending student to verification', () => {
    renderAt('/', { session, profile: { ...profile, verification_status: 'pending' }, loading: false });
    expect(screen.getByText('Verify page')).toBeInTheDocument();
  });

  it('renders Home for a verified student', () => {
    renderAt('/', { session, profile, loading: false });
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });

  it('redirects a non-admin visitor away from admin', () => {
    renderAt('/admin', { session, profile, loading: false });
    expect(screen.getByText('Home page')).toBeInTheDocument();
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument();
  });
});
