import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { College } from '../lib/types';

export default function Onboarding() {
  const { profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [colleges, setColleges] = useState<College[]>([]);
  const [depts, setDepts] = useState<{ name: string }[]>([]);
  const [f, setF] = useState({ college: profile?.college_id ?? '', name: profile?.name ?? '', course: profile?.course ?? '', department: profile?.department ?? '', year: profile?.year ?? 1 });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.from('colleges').select('*').eq('status', 'active').order('name').then(({ data }) => setColleges((data ?? []) as College[])); }, []);
  useEffect(() => {
    if (!f.college) return setDepts([]);
    supabase.from('departments').select('name').eq('college_id', f.college).order('name').then(({ data }) => setDepts(data ?? []));
  }, [f.college]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.rpc('complete_onboarding', { p_college: f.college, p_name: f.name, p_course: f.course, p_department: f.department, p_year: f.year });
    if (error) { setBusy(false); return setErr(error.message); }
    await refreshProfile(); setBusy(false);
    nav('/', { replace: true }); // Gate sends unverified students to /verify
  };

  return (
    <div className="app">
      <main className="page">
        <h1>Set up your profile</h1>
        <form className="card stack" onSubmit={submit}>
          <label>College
            <select required value={f.college} onChange={e => setF({ ...f, college: e.target.value, department: '' })}>
              <option value="">Select your college</option>
              {colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Full name<input required minLength={2} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
          <label>Course<input required placeholder="B.Tech, MBA…" value={f.course} onChange={e => setF({ ...f, course: e.target.value })} /></label>
          <label>Department
            <select required value={f.department} onChange={e => setF({ ...f, department: e.target.value })}>
              <option value="">Select department</option>
              {depts.map(d => <option key={d.name}>{d.name}</option>)}
            </select>
          </label>
          <label>Year
            <select value={f.year} onChange={e => setF({ ...f, year: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </label>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Continue'}</button>
        </form>
      </main>
    </div>
  );
}
