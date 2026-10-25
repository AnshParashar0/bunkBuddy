import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Feedback({ matchId, onDone }: { matchId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const submit = async () => {
    const { error } = await supabase.rpc('submit_feedback', { p_match: matchId, p_rating: rating, p_note: note || null });
    if (error) return setErr(error.message);
    onDone();
  };
  return (
    <div className="card stack">
      <h2>How was it?</h2>
      <div className="chips" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} role="radio" aria-checked={rating === n} className={`chip${rating === n ? ' on' : ''}`} onClick={() => setRating(n)}>{n} ★</button>
        ))}
      </div>
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Anything to add? (optional)" maxLength={500} rows={2} />
      {err && <p className="error">{err}</p>}
      <button className="btn btn-primary" disabled={!rating} onClick={submit}>Send feedback</button>
      <button className="btn btn-ghost" onClick={onDone}>Skip</button>
    </div>
  );
}
