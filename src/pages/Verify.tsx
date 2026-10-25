import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ocrProvider } from '../services/integrations';

const MAX = 5 * 1024 * 1024;

export default function Verify() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!profile) return null;
  if (!profile.college_id) return <Navigate to="/onboarding" replace />;
  if (profile.verification_status === 'verified') return <Navigate to="/" replace />;

  const pick = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file && (!file.type.startsWith('image/') || file.size > MAX)) { setErr('Use a photo under 5 MB (JPG, PNG or WebP).'); return; }
    setErr(''); setter(file);
  };

  const upload = async (file: File, side: string) => {
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${profile.id}/${Date.now()}-${side}.${ext}`;
    const { error } = await supabase.storage.from('id-cards').upload(path, file, { contentType: file.type });
    if (error) throw error;
    return path;
  };

  const submit = async () => {
    if (!front) return;
    setBusy(true); setErr('');
    try {
      const ocr = await ocrProvider.extract(front).catch(() => ({}));
      const frontPath = await upload(front, 'front');
      const backPath = back ? await upload(back, 'back') : null;
      const { error } = await supabase.rpc('submit_verification', { p_front: frontPath, p_back: backPath, p_ocr: ocr });
      if (error) throw error;
      await refreshProfile();
    } catch (e) { setErr((e as Error).message || 'Upload failed. Try again.'); }
    setBusy(false);
  };

  if (profile.verification_status === 'pending') {
    return (
      <div className="app"><main className="page center-col">
        <h1>Review in progress</h1>
        <p className="muted">We are checking your ID. This usually takes a few hours. You will get in automatically once it is approved.</p>
        <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
      </main></div>
    );
  }

  return (
    <div className="app"><main className="page">
      <h1>Verify your college ID</h1>
      {profile.verification_status === 'rejected' && <p className="error">Your last upload was not accepted. Please send a clearer photo.</p>}
      <div className="card stack">
        <p className="muted">Your ID is only seen by our reviewers and is deleted after review. Other students never see it.</p>
        <label>Front of ID (required)<input type="file" accept="image/*" capture="environment" onChange={pick(setFront)} /></label>
        <label>Back of ID (optional)<input type="file" accept="image/*" capture="environment" onChange={pick(setBack)} /></label>
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary" disabled={!front || busy} onClick={submit}>{busy ? 'Uploading…' : 'Submit for review'}</button>
        <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
      </div>
    </main></div>
  );
}
