import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { Match, PublicProfile } from '../lib/types';

export default function Chats() {
  const me = useAuth().profile!;
  const [rows, setRows] = useState<{ match: Match; other?: PublicProfile }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('matches').select('*').order('created_at', { ascending: false }).limit(30);
      const matches = (data ?? []) as Match[];
      const ids = [...new Set(matches.map(m => (m.user1_id === me.id ? m.user2_id : m.user1_id)))];
      const { data: ps } = ids.length ? await supabase.from('public_profiles').select('*').in('id', ids) : { data: [] };
      const byId = new Map((ps ?? []).map((p: PublicProfile) => [p.id, p]));
      setRows(matches.map(m => ({ match: m, other: byId.get(m.user1_id === me.id ? m.user2_id : m.user1_id) })));
      setLoaded(true);
    })();
  }, [me.id]);

  return (
    <Shell>
      <h1>Chats</h1>
      {loaded && rows.length === 0 && <p className="muted">No chats yet. Tap Bunk Now to meet someone.</p>}
      <div className="stack">
        {rows.map(({ match, other }) => (
          <Link key={match.id} to={`/match/${match.id}`} className="card row gap">
            <Avatar name={other?.name ?? '?'} url={other?.photo_url} />
            <div className="grow"><strong>{other?.name ?? 'Student'}</strong><p className="muted">{match.status === 'active' ? 'Active now' : 'Ended'}</p></div>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
