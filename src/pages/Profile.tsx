import { useState } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

export default function ProfilePage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const me = profile!;
  const [bio, setBio] = useState(me.bio ?? '');
  const [interests, setInterests] = useState(me.interests.join(', '));
  const [msg, setMsg] = useState('');

  const save = async () => {
    const list = interests.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12);
    const { error } = await supabase.from('profiles').update({ bio: bio.trim() || null, interests: list }).eq('id', me.id);
    setMsg(error ? error.message : 'Saved');
    await refreshProfile();
  };
  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) return setMsg('Use an image under 2 MB.');
    const path = `${me.id}/avatar-${Date.now()}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type });
    if (error) return setMsg(error.message);
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    await supabase.from('profiles').update({ photo_url: url }).eq('id', me.id);
    await refreshProfile();
  };

  return (
    <Shell>
      <div className="row gap">
        <Avatar name={me.name} url={me.photo_url} size={72} />
        <div>
          <h1>{me.name} {me.verification_status === 'verified' && <span className="badge" title="College identity verified">✓</span>}</h1>
          <p className="muted">{[me.course, me.department, me.year && `Year ${me.year}`].filter(Boolean).join(' • ')}</p>
        </div>
      </div>
      <div className="card stack">
        <label>Profile photo<input type="file" accept="image/*" onChange={uploadPhoto} /></label>
        <label>Bio<textarea rows={3} maxLength={280} value={bio} onChange={e => setBio(e.target.value)} /></label>
        <label>Interests (comma separated)<input value={interests} onChange={e => setInterests(e.target.value)} placeholder="cricket, chai, coding" /></label>
        {msg && <p className="muted">{msg}</p>}
        <button className="btn btn-primary" onClick={save}>Save</button>
      </div>
      {me.role === 'admin' && <Link className="btn btn-ghost" to="/admin">Admin dashboard</Link>}
      <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
    </Shell>
  );
}
