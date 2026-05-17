import { useEffect, useState } from 'react';
import { ShieldAlert, Lock, LogOut, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { getSessionWithTimeout } from '@/lib/authSession';

type ProfileStatus = {
  status: string | null;
  suspended_reason: string | null;
  suspended_at: string | null;
  flagged_reason: string | null;
  flagged_at: string | null;
};

export default function AccountStatusGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: { session } } = await getSessionWithTimeout();
      if (!session) {
        if (active) { setProfile(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('status, suspended_reason, suspended_at, flagged_reason, flagged_at')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (active) {
        setProfile((data as ProfileStatus) || { status: 'active', suspended_reason: null, suspended_at: null, flagged_reason: null, flagged_at: null });
        setLoading(false);
      }
    };

    load();

    // Only reload on real identity changes — NOT on TOKEN_REFRESHED, which
    // fires every time the tab regains focus and would otherwise re-query
    // the profile + flash a loading state.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        load();
      }
    });

    // Realtime: react instantly when admin changes status
    let channel: ReturnType<typeof supabase.channel> | null = null;
    getSessionWithTimeout().then(({ data: { session } }) => {
      if (!session || !active) return;
      const realtimeChannel = supabase.channel(`profile_status:${session.user.id}:${Date.now()}:${Math.random()}`);

      realtimeChannel.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `user_id=eq.${session.user.id}` },
        (payload: any) => {
          if (!active) return;
          const n = payload.new || {};
          setProfile({
            status: n.status,
            suspended_reason: n.suspended_reason,
            suspended_at: n.suspended_at,
            flagged_reason: n.flagged_reason,
            flagged_at: n.flagged_at,
          });
        }
      );

      realtimeChannel.subscribe();
      channel = realtimeChannel;
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return <>{children}</>;

  const status = profile?.status ?? 'active';

  if (status === 'banned' || status === 'suspended') {
    const isBanned = status === 'banned';
    const reason = isBanned ? profile?.flagged_reason : profile?.suspended_reason;
    const at = isBanned ? profile?.flagged_at : profile?.suspended_at;

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-auto bg-gradient-to-br from-red-950 via-red-900 to-black p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(239,68,68,0.25),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 [background-image:linear-gradient(rgba(239,68,68,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.05)_1px,transparent_1px)] [background-size:40px_40px] pointer-events-none" />

        <div className="relative max-w-lg w-full">
          <div className="rounded-2xl border-2 border-red-500/40 bg-black/70 backdrop-blur-xl shadow-[0_0_60px_-10px_rgba(239,68,68,0.5)] overflow-hidden">
            <div className="bg-red-500/10 border-b border-red-500/30 px-6 py-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-red-400">
                {isBanned ? 'Permanent Restriction' : 'Account Suspended'}
              </span>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex items-start gap-5">
                <div className="shrink-0 w-16 h-16 rounded-2xl bg-red-500/15 ring-2 ring-red-500/40 flex items-center justify-center">
                  {isBanned ? (
                    <ShieldAlert className="w-8 h-8 text-red-400" strokeWidth={2.25} />
                  ) : (
                    <Lock className="w-8 h-8 text-red-400" strokeWidth={2.25} />
                  )}
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-white">
                    {isBanned ? 'Account Banned' : 'Account Suspended'}
                  </h1>
                  <p className="mt-1.5 text-sm text-red-200/80 leading-relaxed">
                    {isBanned
                      ? 'Your access to this platform has been permanently revoked by an administrator.'
                      : 'Your account has been temporarily suspended. You cannot access the platform until this is lifted.'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4 space-y-3">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-red-400/70 mb-1">Reason</div>
                  <div className="text-sm text-white/90 leading-relaxed">
                    {reason || <span className="italic text-white/40">No reason provided.</span>}
                  </div>
                </div>
                {at && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-red-400/70 mb-1">Effective</div>
                    <div className="text-sm text-white/90 font-mono">
                      {new Date(at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-white/50">
                <Mail className="w-3.5 h-3.5" />
                <span>Contact an administrator to appeal this decision.</span>
              </div>

              <Button
                variant="outline"
                className="w-full border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/login', { replace: true });
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}