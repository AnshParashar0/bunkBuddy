import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../components/Shell';
import { useAuth } from '../hooks/useAuth';
import { useInbox, useActiveMatch } from '../hooks/useBunk';
import { useNow } from '../hooks/useNow';
import { supabase } from '../lib/supabase';
import { AVAILABILITY, DURATIONS, activityIcon, activityLabel, clock, minutesLeft } from '../lib/constants';
import type { Availability } from '../lib/types';

export default function Home() {
  const { profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const me = profile!;
  const { items, ignore, accept } = useInbox(me.id);
  const match = useActiveMatch(me.id);
  const now = useNow(15_000);
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState('');

  const expired = me.availability_until && new Date(me.availability_until).getTime() <= now;
  const status: Availability = expired ? 'busy' : me.availability_status;

  const setStatus = async (s: Availability, minutes: number | null) => {
    setErr('');
    const { error } = await supabase.rpc('set_availability', { p_status: s, p_minutes: minutes });
    if (error) setErr(error.message);
    setPicking(false);
    await refreshProfile();
  };
  const onAccept = async (id: string) => {
    try { nav(`/match/${await accept(id)}`); } catch (e) { setErr((e as Error).message); }
  };

  return (
    <Shell>
      <header className="row between">
        <div>
          <p className="muted">Hey {me.name.split(' ')[0]}</p>
          <h1>Who's free right now?</h1>
        </div>
      </header>

      {match && (
        <Link to={`/match/${match.id}`} className="banner">You have an active Bunk Buddy. Open chat</Link>
      )}

      <section className="bunk-stage">
        <button className="bunk-btn" onClick={() => nav('/bunk')} aria-label="Bunk now">
          <span>BUNK</span><span>NOW</span>
        </button>
      </section>

      <section className="card stack">
        <div className="row between">
          <h2>Your status</h2>
          {status === 'available' && me.availability_until && <span className="muted">Free until {clock(me.availability_until)}</span>}
        </div>
        <div className="chips">
          {AVAILABILITY.map(a => (
            <button key={a.key} className={`chip${status === a.key ? ' on' : ''}`} title={a.hint}
              onClick={() => (a.key === 'available' ? setPicking(p => !p) : setStatus(a.key, 60))}>
              {a.label}
            </button>
          ))}
        </div>
        {picking && (
          <div className="stack">
            <p className="muted">How long are you free?</p>
            <div className="chips">
              {DURATIONS.map(d => <button key={d.minutes} className="chip" onClick={() => setStatus('available', d.minutes)}>{d.label}</button>)}
            </div>
          </div>
        )}
        {status !== 'available' && <p className="muted">Set yourself to Available to get Bunk requests from your college.</p>}
        {err && <p className="error">{err}</p>}
      </section>

      <section className="stack">
        <h2>Looking for company</h2>
        {items.length === 0 && <p className="muted">No one right now. We will notify you the moment someone is.</p>}
        {items.map(i => (
          <article key={i.request_id} className="card request">
            <span className="request-icon" aria-hidden>{activityIcon(i.activity)}</span>
            <div className="grow">
              <strong>Someone is looking for a Bunk Buddy!</strong>
              <p className="muted">{activityLabel(i.activity)} · {i.duration_minutes} min · {minutesLeft(i.expires_at, now)} min left</p>
            </div>
            <div className="row gap">
              <button className="btn btn-primary" onClick={() => onAccept(i.request_id)}>Accept</button>
              <button className="btn btn-ghost" onClick={() => ignore(i.request_id)}>Ignore</button>
            </div>
          </article>
        ))}
      </section>
    </Shell>
  );
}
