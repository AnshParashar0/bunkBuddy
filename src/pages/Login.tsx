import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) return setErr(error.message);
    setStep('sent');
  };

  return (
    <div className="app login">
      <div className="hero">
        <h1>Bored in class?<br />Find your Bunk Buddy.</h1>
        <p>Connect with verified students from your college who are free right now.</p>
      </div>
      <div className="card stack">
        {step === 'email' ? (
          <form className="stack" onSubmit={sendCode}>
            <label>Email<input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@college.edu" /></label>
            <p className="muted">Use your college email for instant verification.</p>
            {err && <p className="error">{err}</p>}
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send sign-in link'}</button>
          </form>
        ) : (
          <div className="stack">
            <h2>Check your email</h2>
            <p>We sent a sign-in link to {email}. Open it in this browser.</p>
            <button type="button" className="btn btn-ghost" onClick={() => setStep('email')}>Use a different email</button>
          </div>
        )}
      </div>
    </div>
  );
}
