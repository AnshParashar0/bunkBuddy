import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifier } from '../services/integrations';
import type { BunkRequest, InboxItem, Match } from '../lib/types';
import { activityLabel } from '../lib/constants';

/** Incoming requests for me (realtime + poll fallback). Requester identity is never included. */
export function useInbox(uid: string) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from('request_inbox').select('*')
      .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
    setItems((data ?? []) as InboxItem[]);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('inbox:' + uid)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'request_inbox', filter: `recipient_id=eq.${uid}` }, (p) => {
        const row = p.new as InboxItem;
        notifier.notify('Someone is looking for a Bunk Buddy!', `${activityLabel(row.activity)} · ${row.duration_minutes} min`);
        load();
      })
      .subscribe();
    const poll = setInterval(load, 15_000); // DELETE events can't be filtered, so poll to drop taken/expired ones
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [uid, load]);

  const ignore = async (requestId: string) => {
    setItems(xs => xs.filter(x => x.request_id !== requestId));
    await supabase.from('request_inbox').delete().eq('request_id', requestId).eq('recipient_id', uid);
  };
  const accept = async (requestId: string) => {
    const { data, error } = await supabase.rpc('accept_request', { p_request_id: requestId });
    if (error) { await load(); throw error; }
    return data as string;
  };
  return { items, ignore, accept };
}

/** Watch my own request until it is matched / expired. */
export function useMyRequest(requestId: string | null) {
  const [request, setRequest] = useState<BunkRequest | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!requestId) return;
    const { data: r } = await supabase.from('bunk_requests').select('*').eq('id', requestId).maybeSingle();
    setRequest(r as BunkRequest | null);
    if (r?.status === 'matched') {
      const { data: m } = await supabase.from('matches').select('id').eq('request_id', requestId).maybeSingle();
      setMatchId(m?.id ?? null);
    }
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;
    refresh();
    const ch = supabase.channel('req:' + requestId)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bunk_requests', filter: `id=eq.${requestId}` }, () => refresh())
      .subscribe();
    const poll = setInterval(refresh, 10_000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [requestId, refresh]);

  return { request, matchId, refresh };
}

/** My current active match, if any. */
export function useActiveMatch(uid: string) {
  const [match, setMatch] = useState<Match | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from('matches').select('*').eq('status', 'active').limit(1).maybeSingle();
    setMatch(data as Match | null);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel('match-watch:' + uid)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => load()) // RLS limits to my rows
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, load]);
  return match;
}
