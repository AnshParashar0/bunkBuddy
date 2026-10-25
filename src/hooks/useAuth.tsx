import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';
import { notifier } from '../services/integrations';

interface AuthState {
  session: Session | null; profile: Profile | null; loading: boolean;
  refreshProfile: () => Promise<void>; signOut: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const uid = session?.user.id;

  const refreshProfile = useCallback(async () => {
    if (!uid) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile(data as Profile | null);
  }, [uid]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s)); // only set state here
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) { setProfile(null); return; }
    refreshProfile().finally(() => setLoading(false));
    // live updates: admin approves verification, suspension, availability expiry
    const ch = supabase.channel('profile:' + uid)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` }, () => refreshProfile())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [uid, refreshProfile]);

  useEffect(() => {
    if (uid) void notifier.requestPermission();
  }, [uid]);

  // Heartbeat: "online" = active in the last 30 minutes (used by matching)
  useEffect(() => {
    if (!uid) return;
    const beat = () => { if (document.visibilityState === 'visible') void supabase.rpc('touch_activity'); };
    beat();
    const t = setInterval(beat, 60_000);
    document.addEventListener('visibilitychange', beat);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', beat); };
  }, [uid]);

  const signOut = async () => { await supabase.auth.signOut(); };
  return <Ctx.Provider value={{ session, profile, loading, refreshProfile, signOut }}>{children}</Ctx.Provider>;
}
