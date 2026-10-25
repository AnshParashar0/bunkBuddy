import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import Chat from '../components/Chat';
import SafetyMenu from '../components/SafetyMenu';
import Feedback from '../components/Feedback';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Match, PublicProfile } from '../lib/types';

export default function MatchPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const me = useAuth().profile!;
  const [match, setMatch] = useState<Match | null>(null);
  const [partner, setPartner] = useState<PublicProfile | null>(null);
  const [partnerId, setPartnerId] = useState('');
  const [spots, setSpots] = useState<string[]>([]);
  const [showSpots, setShowSpots] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data: m } = await supabase.from('matches').select('*').eq('id', id!).maybeSingle();
    if (!m) { nav('/', { replace: true }); return; }
    setMatch(m as Match);
    const pid = m.user1_id === me.id ? m.user2_id : m.user1_id;
    setPartnerId(pid);
    const { data: p } = await supabase.from('public_profiles').select('*').eq('id', pid).maybeSingle();
    setPartner(p as PublicProfile | null);
  }, [id, me.id, nav]);

  useEffect(() => {
    load();
    const ch = supabase.channel('match:' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);

  useEffect(() => {
    if (!me.college_id) return;
    supabase.from('campus_locations').select('name').eq('college_id', me.college_id).order('name').then(({ data }) => setSpots((data ?? []).map(d => d.name)));
  }, [me.college_id]);

  if (!match) return <div className="splash">Loading…</div>;
  const ended = match.status === 'ended';

  const setSpot = async (name: string) => {
    const { error } = await supabase.rpc('set_meeting_spot', { p_match: match.id, p_spot: name });
    if (error) setErr(error.message);
    setShowSpots(false); load();
  };
  const endMatch = async () => {
    if (!confirm('End this match?')) return;
    await supabase.rpc('end_match', { p_match: match.id });
    load();
  };

  return (
    <div className="app match">
      <header className="match-head">
        <button className="icon-btn" onClick={() => nav('/')} aria-label="Back">←</button>
        <Avatar name={partner?.name ?? '?'} url={partner?.photo_url} size={40} />
        <div className="grow">
          <strong>{partner?.name ?? 'Your Bunk Buddy'} {partner?.verified && <span className="badge" title="College identity verified">✓</span>}</strong>
          <p className="muted">{[partner?.course, partner?.department, partner?.year && `Year ${partner.year}`].filter(Boolean).join(' • ')}</p>
        </div>
        {!ended && partnerId && <SafetyMenu userId={partnerId} matchId={match.id} onBlocked={() => nav('/', { replace: true })} />}
      </header>

      {ended ? (
        <main className="page">
          <div className="card stack center"><h2>Match ended</h2><p className="muted">Hope you had a good time.</p></div>
          {!feedbackDone ? <Feedback matchId={match.id} onDone={() => { setFeedbackDone(true); nav('/'); }} /> : null}
        </main>
      ) : (
        <>
          <div className="found">
            <h1>BUNK BUDDY FOUND!</h1>
            <p>{match.meeting_spot ? `Meet at ${match.meeting_spot}` : 'Pick a spot to meet. Exact location is never shared.'}</p>
            <div className="row gap center-row">
              <button className="btn btn-light" onClick={() => setShowSpots(s => !s)}>Share meeting spot</button>
              <button className="btn btn-ghost-light" onClick={endMatch}>End match</button>
            </div>
            {showSpots && <div className="chips center-row">{spots.map(s => <button key={s} className="chip" onClick={() => setSpot(s)}>{s}</button>)}</div>}
            {err && <p className="error">{err}</p>}
          </div>
          <Chat matchId={match.id} myId={me.id} />
        </>
      )}
    </div>
  );
}
