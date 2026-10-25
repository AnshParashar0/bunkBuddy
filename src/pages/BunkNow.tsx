import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell';
import { useMyRequest } from '../hooks/useBunk';
import { useNow } from '../hooks/useNow';
import { supabase } from '../lib/supabase';
import { ACTIVITIES, DURATIONS } from '../lib/constants';

type Step = 'activity' | 'duration' | 'waiting' | 'expired';

export default function BunkNow() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('activity');
  const [activity, setActivity] = useState<string>('');
  const [duration, setDuration] = useState(60);
  const [custom, setCustom] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const expiring = useRef(false);

  const { request, matchId, refresh } = useMyRequest(requestId);
  const now = useNow(1000);

  useEffect(() => { if (matchId) nav(`/match/${matchId}`, { replace: true }); }, [matchId, nav]);

  useEffect(() => {
    if (step === 'waiting' && request && (request.status === 'expired' || request.status === 'cancelled')) setStep('expired');
  }, [request, step]);

  // Local expiry: the server cron runs every minute, so close the request ourselves at 10:00.
  useEffect(() => {
    if (step !== 'waiting' || !request || request.status !== 'open' || expiring.current) return;
    if (now >= new Date(request.expires_at).getTime()) {
      expiring.current = true;
      supabase.rpc('cancel_request', { p_request_id: request.id }).then(() => refresh());
    }
  }, [now, step, request, refresh]);

  const start = async () => {
    setBusy(true); setErr(''); expiring.current = false;
    const { data, error } = await supabase.rpc('create_bunk_request', { p_activity: activity, p_duration: duration });
    setBusy(false);
    if (error) return setErr(error.message);
    setRequestId(data as string); setStep('waiting');
  };
  const cancel = async () => {
    if (requestId) await supabase.rpc('cancel_request', { p_request_id: requestId });
    nav('/');
  };
  const customMinutes = Number(custom);
  const pickCustom = () => { if (customMinutes >= 15 && customMinutes <= 480) setDuration(Math.round(customMinutes)); };

  if (step === 'waiting' || step === 'expired') {
    const left = request ? Math.max(0, Math.floor((new Date(request.expires_at).getTime() - now) / 1000)) : 600;
    return (
      <Shell>
        <div className="center-col">
          {step === 'waiting' ? (
            <>
              <div className="radar" aria-hidden />
              <h1>Finding your Bunk Buddy</h1>
              <p className="muted">Asking free students from your college. {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')} left</p>
              <button className="btn btn-ghost" onClick={cancel}>Cancel request</button>
            </>
          ) : (
            <>
              <h1>No Bunk Buddy found this time</h1>
              <p className="muted">Nobody was free right now. Try again in a bit.</p>
              <button className="btn btn-primary" onClick={start} disabled={busy}>Try again</button>
              <button className="btn btn-ghost" onClick={() => nav('/')}>Back home</button>
              {err && <p className="error">{err}</p>}
            </>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {step === 'activity' ? (
        <>
          <h1>What are you up for?</h1>
          <div className="grid">
            {ACTIVITIES.map(a => (
              <button key={a.key} className={`tile${activity === a.key ? ' on' : ''}`} onClick={() => { setActivity(a.key); setStep('duration'); }}>
                <span aria-hidden>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <h1>How long are you free?</h1>
          <div className="chips">
            {DURATIONS.map(d => <button key={d.minutes} className={`chip${duration === d.minutes && !custom ? ' on' : ''}`} onClick={() => { setCustom(''); setDuration(d.minutes); }}>{d.label}</button>)}
          </div>
          <label>Custom (minutes)
            <input type="number" min={15} max={480} value={custom} placeholder="e.g. 45" onChange={e => setCustom(e.target.value)} onBlur={pickCustom} />
          </label>
          <p className="muted">Visible to verified students from your college only.</p>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-primary big" onClick={() => { pickCustom(); void start(); }} disabled={busy}>{busy ? 'Starting…' : 'Find my Bunk Buddy'}</button>
          <button className="btn btn-ghost" onClick={() => setStep('activity')}>Back</button>
        </>
      )}
    </Shell>
  );
}
