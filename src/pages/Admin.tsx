import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { College } from '../lib/types';

type Tab = 'overview' | 'verify' | 'reports' | 'colleges';
type Stats = Record<string, number>;
/* eslint-disable @typescript-eslint/no-explicit-any */

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <div className="app admin">
      <main className="page">
        <div className="row between"><h1>Admin</h1><Link className="btn btn-ghost" to="/profile">Exit</Link></div>
        <div className="chips">
          {(['overview', 'verify', 'reports', 'colleges'] as Tab[]).map(t => (
            <button key={t} className={`chip${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{t === 'verify' ? 'Verifications' : t[0].toUpperCase() + t.slice(1)}</button>
          ))}
        </div>
        {tab === 'overview' && <Overview />}
        {tab === 'verify' && <Verifications />}
        {tab === 'reports' && <Reports />}
        {tab === 'colleges' && <Colleges />}
      </main>
    </div>
  );
}

function Overview() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { supabase.rpc('admin_stats').then(({ data }) => setS(data as Stats)); }, []);
  if (!s) return <p className="muted">Loading…</p>;
  const labels: [string, string][] = [['total_students', 'Total students'], ['verified_students', 'Verified'], ['active_users', 'Active now'], ['requests_today', 'Requests today'], ['matches_today', 'Matches today'], ['open_reports', 'Open reports']];
  return <div className="grid">{labels.map(([k, l]) => <div key={k} className="card stat"><strong>{s[k]}</strong><span className="muted">{l}</span></div>)}</div>;
}

function Verifications() {
  const [rows, setRows] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string, string[]>>({});
  const [ids, setIds] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('verification_requests')
      .select('*, user:profiles!verification_requests_user_id_fkey(name, course, department, year)')
      .eq('status', 'pending').order('created_at');
    setRows(data ?? []);
    const out: Record<string, string[]> = {};
    for (const r of data ?? []) {
      const paths = [r.front_path, r.back_path].filter(Boolean) as string[];
      const signed = await Promise.all(paths.map(p => supabase.storage.from('id-cards').createSignedUrl(p, 300)));
      out[r.id] = signed.map(s => s.data?.signedUrl).filter(Boolean) as string[];
    }
    setUrls(out);
  }, []);
  useEffect(() => { load(); }, [load]);

  const review = async (id: string, approve: boolean) => {
    setErr('');
    const note = approve ? null : prompt('Reason (shown internally)') ?? 'Unclear photo';
    const { data, error } = await supabase.rpc('admin_review_verification', { p_id: id, p_approve: approve, p_note: note, p_student_id: ids[id] ?? null });
    if (error) return setErr(error.message);
    const paths = [data?.front, data?.back].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from('id-cards').remove(paths); // retention: delete ID images after review
    load();
  };

  return (
    <div className="stack">
      {err && <p className="error">{err}</p>}
      {rows.length === 0 && <p className="muted">Nothing waiting for review.</p>}
      {rows.map(r => (
        <div key={r.id} className="card stack">
          <strong>{r.user?.name}</strong>
          <p className="muted">{[r.user?.course, r.user?.department, r.user?.year && `Year ${r.user.year}`].filter(Boolean).join(' • ')}</p>
          {r.ocr_data && Object.keys(r.ocr_data).length > 0 && <p className="muted">OCR hint: {JSON.stringify(r.ocr_data)}</p>}
          <div className="row gap wrap">{(urls[r.id] ?? []).map(u => <img key={u} src={u} alt="ID card" className="idimg" />)}</div>
          <label>Student ID (from card)<input value={ids[r.id] ?? ''} onChange={e => setIds({ ...ids, [r.id]: e.target.value })} /></label>
          <div className="row gap">
            <button className="btn btn-primary" onClick={() => review(r.id, true)}>Approve</button>
            <button className="btn btn-danger" onClick={() => review(r.id, false)}>Reject</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Reports() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('reports')
      .select('*, reporter:profiles!reports_reporter_id_fkey(name), reported:profiles!reports_reported_user_id_fkey(name, suspended, flagged)')
      .in('status', ['open', 'reviewing']).order('created_at', { ascending: false });
    setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: string, status: string) => { const { error } = await supabase.rpc('admin_set_report_status', { p_id: id, p_status: status }); if (error) setErr(error.message); load(); };
  const suspend = async (uid: string, on: boolean) => { const { error } = await supabase.rpc('admin_set_suspended', { p_user: uid, p_suspended: on }); if (error) setErr(error.message); load(); };

  return (
    <div className="stack">
      {err && <p className="error">{err}</p>}
      {rows.length === 0 && <p className="muted">No open reports.</p>}
      {rows.map(r => (
        <div key={r.id} className="card stack">
          <strong>{r.reported?.name} {r.reported?.flagged && <span className="tag">Repeated reports</span>} {r.reported?.suspended && <span className="tag">Suspended</span>}</strong>
          <p className="muted">{r.reason.replace('_', ' ')} · reported by {r.reporter?.name}</p>
          {r.description && <p>{r.description}</p>}
          <div className="row gap wrap">
            <button className="btn btn-ghost" onClick={() => setStatus(r.id, 'reviewing')}>Reviewing</button>
            <button className="btn btn-ghost" onClick={() => setStatus(r.id, 'dismissed')}>Dismiss</button>
            <button className="btn btn-primary" onClick={() => setStatus(r.id, 'resolved')}>Resolve</button>
            <button className="btn btn-danger" onClick={() => suspend(r.reported_user_id, !r.reported?.suspended)}>{r.reported?.suspended ? 'Unsuspend' : 'Suspend user'}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Colleges() {
  const [rows, setRows] = useState<College[]>([]);
  const [f, setF] = useState({ name: '', location: '', domain: '' });
  const [err, setErr] = useState('');
  const load = useCallback(async () => { const { data } = await supabase.from('colleges').select('*').order('name'); setRows((data ?? []) as College[]); }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const { error } = await supabase.from('colleges').insert({ name: f.name.trim(), location: f.location.trim() || null, domain: f.domain.trim().toLowerCase() || null });
    if (error) return setErr(error.message);
    setF({ name: '', location: '', domain: '' }); load();
  };
  const toggle = async (c: College) => { await supabase.from('colleges').update({ status: c.status === 'active' ? 'inactive' : 'active' }).eq('id', c.id); load(); };

  return (
    <div className="stack">
      <form className="card stack" onSubmit={add}>
        <h2>Add college</h2>
        <input required placeholder="College name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
        <input placeholder="City" value={f.location} onChange={e => setF({ ...f, location: e.target.value })} />
        <input placeholder="Email domain (optional, e.g. college.edu)" value={f.domain} onChange={e => setF({ ...f, domain: e.target.value })} />
        {err && <p className="error">{err}</p>}
        <button className="btn btn-primary">Add</button>
      </form>
      {rows.map(c => (
        <div key={c.id} className="card row between">
          <div><strong>{c.name}</strong><p className="muted">{[c.location, c.domain].filter(Boolean).join(' · ')}</p></div>
          <button className="btn btn-ghost" onClick={() => toggle(c)}>{c.status === 'active' ? 'Deactivate' : 'Activate'}</button>
        </div>
      ))}
    </div>
  );
}
