import { useEffect, useRef, useState } from 'react';
import { useChat } from '../hooks/useChat';
import { clock } from '../lib/constants';

export default function Chat({ matchId, myId, disabled }: { matchId: string; myId: string; disabled?: boolean }) {
  const { messages, send } = useChat(matchId);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = text; setText(''); setErr('');
    try { await send(myId, t); } catch { setText(t); setErr('Message not sent. Try again.'); }
  };

  return (
    <div className="chat">
      <div className="chat-log">
        {messages.length === 0 && <p className="muted center">Say hi. Chat is only visible to the two of you.</p>}
        {messages.map(m => (
          <div key={m.id} className={`bubble ${m.sender_id === myId ? 'me' : 'them'}`}>
            <span>{m.message}</span><time>{clock(m.created_at)}</time>
          </div>
        ))}
        <div ref={end} />
      </div>
      {err && <p className="error">{err}</p>}
      <form className="chat-input" onSubmit={submit}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={disabled ? 'This match has ended' : 'Message'} maxLength={1000} disabled={disabled} aria-label="Message" />
        <button className="btn btn-primary" disabled={disabled || !text.trim()}>Send</button>
      </form>
    </div>
  );
}
