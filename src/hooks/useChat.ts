import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Message } from '../lib/types';

export function useChat(matchId: string) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    let alive = true;
    supabase.from('messages').select('*').eq('match_id', matchId).order('created_at').then(({ data }) => {
      if (alive) setMessages((data ?? []) as Message[]);
    });
    const ch = supabase.channel('chat:' + matchId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` }, (p) => {
        const m = p.new as Message;
        setMessages(xs => (xs.some(x => x.id === m.id) ? xs : [...xs, m]));
      })
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [matchId]);

  const send = useCallback(async (senderId: string, text: string) => {
    const message = text.trim().slice(0, 1000);
    if (!message) return;
    const { data, error } = await supabase.from('messages').insert({ match_id: matchId, sender_id: senderId, message }).select().single();
    if (error) throw error;
    setMessages(xs => (xs.some(x => x.id === data.id) ? xs : [...xs, data as Message]));
  }, [matchId]);

  return { messages, send };
}
