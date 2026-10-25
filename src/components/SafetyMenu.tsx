import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { REPORT_REASONS } from '../lib/constants';

export default function SafetyMenu({ userId, matchId, onBlocked }: { userId: string; matchId: string; onBlocked: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'report'>('menu');
  const [reason, setReason] = useState('harassment');
  const [desc, setDesc] = useState('');
  const [msg, setMsg] = useState('');

  const close = () => { setOpen(false); setMode('menu'); setMsg(''); };
  const block = async () => {
    if (!confirm('Block this student? Your match ends and you will not be matched again.')) return;
    const { error } = await supabase.rpc('block_user', { p_user: userId });
    if (error) return setMsg(error.message);
    close(); onBlocked();
  };
  const report = async () => {
    const { error } = await supabase.rpc('submit_report', { p_user: userId, p_reason: reason, p_description: desc || null, p_match: matchId });
    setMsg(error ? error.message : 'Report sent. Our team will review it.');
    if (!error) setMode('menu');
  };

  return (
    <>
      <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Safety options">⋯</button>
      {open && (
        <div className="sheet-backdrop" onClick={close}>
          <div className="sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            {mode === 'menu' ? (
              <>
                <h3>Safety</h3>
                <button className="btn btn-ghost" onClick={() => setMode('report')}>Report this student</button>
                <button className="btn btn-danger" onClick={block}>Block this student</button>
                <button className="btn btn-ghost" onClick={close}>Close</button>
              </>
            ) : (
              <>
                <h3>What happened?</h3>
                <div className="chips">
                  {REPORT_REASONS.map(r => (
                    <button key={r.key} className={`chip${reason === r.key ? ' on' : ''}`} onClick={() => setReason(r.key)}>{r.label}</button>
                  ))}
                </div>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Add details (optional)" maxLength={1000} rows={3} />
                <button className="btn btn-primary" onClick={report}>Send report</button>
                <button className="btn btn-ghost" onClick={() => setMode('menu')}>Back</button>
              </>
            )}
            {msg && <p className="muted center">{msg}</p>}
          </div>
        </div>
      )}
    </>
  );
}
