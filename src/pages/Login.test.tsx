import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../lib/supabase';
import Login from './Login';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn(),
    },
  },
}));

describe('Login', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.signInWithOtp).mockReset();
  });

  it('renders the hero headline and an email field', () => {
    render(<Login />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Find your Bunk Buddy.');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('submits an email with the current origin as the redirect URL', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: { user: null, session: null }, error: null });
    render(<Login />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  student@example.edu  ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }));

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'student@example.edu',
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
  });

  it('shows the sign-in link confirmation after success', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: { user: null, session: null }, error: null });
    render(<Login />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.edu' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }));

    expect(await screen.findByText('We sent a sign-in link to student@example.edu. Open it in this browser.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use a different email' })).toBeInTheDocument();
  });

  it('shows the auth error message', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Unable to send sign-in link' } as never,
    });
    render(<Login />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.edu' } });

    fireEvent.click(screen.getByRole('button', { name: 'Send sign-in link' }));

    expect(await screen.findByText('Unable to send sign-in link')).toBeInTheDocument();
  });
});
