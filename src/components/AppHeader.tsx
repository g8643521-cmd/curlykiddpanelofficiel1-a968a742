import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, Settings, Loader2, XCircle, User, ChevronDown, LayoutGrid, Shield, Mail, Calendar, BadgeCheck, Copy, Check, HelpCircle, Activity } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import DiscordMascot from '@/components/DiscordMascot';
import BrandLogo from '@/components/BrandLogo';
import profileBanner from '@/assets/profile-banner.jpg';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useScanStore } from '@/stores/scanStore';
import { logActivity } from '@/lib/activityLog';
import { getSessionWithTimeout } from '@/lib/authSession';
import { getProfileAvatarUrl } from '@/lib/avatar';
import { syncCurrentUserProfile } from '@/lib/profileSync';
import { useAsyncData } from '@/hooks/useAsyncData';
import { runAsync } from '@/lib/asyncRequest';

interface Profile {
  display_name: string | null;
  role: string | null;
  avatar_url: string | null;
  discord_user_id?: string | null;
  discord_avatar?: string | null;
  banner_url: string | null;
  email: string | null;
  created_at: string | null;
  user_id: string | null;
}

interface AppHeaderProps {
  showBackButton?: boolean;
  title?: string;
  subtitle?: string;
  onLogoClick?: () => void;
}

const PROFILE_CACHE_KEY = 'ckp_profile_cache_v2';

const getCachedProfile = (): Profile | null => {
  try {
    // Drop legacy cache entries that may be missing newer fields
    sessionStorage.removeItem('ckp_profile_cache');
    const cached = sessionStorage.getItem(PROFILE_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const setCachedProfile = (profile: Profile) => {
  try {
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {}
};

type SyncState = 'idle' | 'loading' | 'ok' | 'error' | 'missing';

const STATE_STYLES: Record<SyncState, string> = {
  idle: 'bg-muted/40 text-muted-foreground/70',
  loading: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  ok: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  error: 'bg-destructive/20 text-destructive border border-destructive/40',
  missing: 'bg-muted/40 text-muted-foreground/80 border border-border/40',
};

const STATE_DOTS: Record<SyncState, string> = {
  idle: 'bg-muted-foreground/40',
  loading: 'bg-amber-400 animate-pulse',
  ok: 'bg-emerald-400',
  error: 'bg-destructive',
  missing: 'bg-muted-foreground/40',
};

const StatusPill = ({ label, state, title }: { label: string; state: SyncState; title?: string }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide ${STATE_STYLES[state]}`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${STATE_DOTS[state]}`} />
    {label}: {state}
  </span>
);

const AppHeader = ({ showBackButton = false, title, subtitle, onLogoClick }: AppHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isOwner, isModerator, userRole } = useAdminStatus();
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(getCachedProfile);
  const [copiedId, setCopiedId] = useState(false);
  const [fetchState, setFetchState] = useState<'loading' | 'ok' | 'error' | 'no-session'>('loading');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'loading' | 'ok' | 'error' | 'missing'>('idle');
  const [bannerStatus, setBannerStatus] = useState<'idle' | 'loading' | 'ok' | 'error' | 'missing'>('idle');
  const { isScanning, scanServerId, scanServerName, progress, stopScan } = useScanStore();

  const handleCopyId = () => {
    if (!profile?.user_id) return;
    navigator.clipboard.writeText(profile.user_id).then(() => {
      setCopiedId(true);
      toast.success('User ID copied');
      setTimeout(() => setCopiedId(false), 1500);
    });
  };

  const formatJoined = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  };

  // Standardized profile fetch — hard timeout, abort on unmount, single retry.
  useAsyncData(
    async (signal) => {
      const sessionOutcome = await runAsync(
        async () => {
          const { data } = await supabase.auth.getSession();
          return data.session;
        },
        { timeoutMs: 5000, signal, label: 'AppHeader:getSession' },
      );
      if (!sessionOutcome.ok || !sessionOutcome.data) {
        return { state: 'no-session' as const };
      }
      const session = sessionOutcome.data;
      const emailName = session.user.email ? session.user.email.split('@')[0] : null;
      const metaName =
        session.user.user_metadata?.display_name ||
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        session.user.user_metadata?.preferred_username ||
        session.user.user_metadata?.user_name ||
        emailName ||
        null;
      const sessionFallback: Profile = {
        display_name: metaName || t('nav.user_fallback'),
        role: null,
        avatar_url: session.user.user_metadata?.avatar_url || null,
        banner_url: null,
        email: session.user.email || null,
        created_at: session.user.created_at || null,
        user_id: session.user.id,
      };
      // Fire-and-forget sync — never blocks the UI.
      void syncCurrentUserProfile().catch(() => null);

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, role, avatar_url, discord_user_id, discord_avatar, banner_url')
        .eq('user_id', session.user.id)
        .abortSignal(signal)
        .maybeSingle();

      if (error) {
        const err = error as { message?: string; code?: string; details?: string; hint?: string };
        const parts = [err.code, err.message, err.details, err.hint].filter(Boolean);
        return {
          state: 'error' as const,
          profile: sessionFallback,
          message: parts.join(' · ') || 'unknown error',
        };
      }
      if (!data) {
        return { state: 'ok' as const, profile: sessionFallback };
      }
      const profileData: Profile = {
        ...sessionFallback,
        ...data,
        display_name:
          (data.display_name && data.display_name.trim() && data.display_name.trim().toLowerCase() !== 'user')
            ? data.display_name
            : sessionFallback.display_name,
        avatar_url: getProfileAvatarUrl(data) || session.user.user_metadata?.avatar_url || null,
      };
      return { state: 'ok' as const, profile: profileData };
    },
    [],
    {
      timeoutMs: 8000,
      label: 'AppHeader:profile',
      onSuccess: (result) => {
        if (result.state === 'no-session') {
          setFetchState('no-session');
          return;
        }
        const next = result.profile;
        setProfile((prev) => (prev && prev.user_id === next.user_id ? { ...prev, ...next } : next));
        setCachedProfile(next);
        setFetchState(result.state === 'ok' ? 'ok' : 'error');
        setFetchError(result.state === 'error' ? result.message : null);
        setAvatarStatus(next.avatar_url ? 'loading' : 'missing');
        setBannerStatus(next.banner_url ? 'loading' : 'missing');
      },
      onError: (err) => {
        setFetchState('error');
        setFetchError(err.message);
      },
    },
  );

  const handleLogout = async () => {
    void logActivity({ category: 'auth', action: 'User logged out', severity: 'info' });
    sessionStorage.removeItem(PROFILE_CACHE_KEY);
    await supabase.auth.signOut();
    toast.success(t('nav.logged_out'));
    navigate('/login');
  };

  const hasStoredSession = () => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
          const raw = localStorage.getItem(key);
          if (raw && raw.includes('access_token')) return true;
        }
      }
    } catch {}
    return false;
  };

  const handleLogoClick = () => {
    if (onLogoClick) {
      onLogoClick();
      return;
    }
    // Navigate instantly — never await network/auth calls on a click
    navigate(hasStoredSession() ? '/dashboard' : '/login');
  };

  const handleStopActiveScan = async () => {
    const startedAt = progress?.startedAt?.toISOString();
    const activeServerId = scanServerId;

    stopScan();

    try {
      if (activeServerId && startedAt) {
        const { data, error } = await supabase.functions.invoke('discord-member-check', {
          body: {
            action: 'stop-scan',
            serverId: activeServerId,
            scanStartedAt: startedAt,
          },
        });

        if (error || data?.success === false) {
          throw new Error(error?.message || data?.error || 'Failed to stop scan');
        }
      }

      toast.info('Scan stopped. Discord has been notified.');
    } catch {
      toast.error('Stop signal sent locally, but Discord confirmation failed');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    `relative px-1 py-1 text-sm font-medium transition-colors cursor-pointer ${
      isActive(path)
        ? 'text-foreground'
        : 'text-muted-foreground/70 hover:text-foreground'
    }`;

  const getRoleBadge = () => {
    if (isOwner) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[hsl(var(--yellow))]/15 text-[hsl(var(--yellow))] border border-[hsl(var(--yellow))]/20">
          Owner
        </span>
      );
    }
    if (isAdmin) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[hsl(var(--magenta))]/15 text-[hsl(var(--magenta))] border border-[hsl(var(--magenta))]/20">
          Admin
        </span>
      );
    }
    if (isModerator) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[hsl(var(--cyan))]/15 text-[hsl(var(--cyan))] border border-[hsl(var(--cyan))]/20">
          Moderator
        </span>
      );
    }
    if (userRole === 'mod_creator') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[hsl(var(--green))]/15 text-[hsl(var(--green))] border border-[hsl(var(--green))]/20">
          Mod Creator
        </span>
      );
    }
    if (userRole === 'server_owner') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[hsl(var(--yellow))]/15 text-[hsl(var(--yellow))] border border-[hsl(var(--yellow))]/20">
          Server Owner
        </span>
      );
    }
    if (userRole === 'integrations_manager') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[hsl(var(--cyan))]/15 text-[hsl(var(--cyan))] border border-[hsl(var(--cyan))]/20">
          Integrations Manager
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
        User
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/20 bg-background/60 backdrop-blur-2xl">
      <div className="container mx-auto px-6">
        <div className="flex items-center h-14">
          <div className="relative">
            <button
              onClick={handleLogoClick}
              className="flex items-center hover:opacity-80 transition-opacity cursor-pointer mr-8"
            >
              <BrandLogo size="md" />
            </button>
            <DiscordMascot />
          </div>

          <nav className="flex items-center gap-6 flex-1">
            {isAdmin && (
              <button onClick={() => navigate('/admin')} className={navLinkClass('/admin')}>
                {t('nav.admin_label')}
              </button>
            )}
            <button onClick={() => navigate('/cheaters')} className={navLinkClass('/cheaters')}>
              {t('nav.cheater_db_label')}
            </button>
            <button onClick={() => navigate('/mods')} className={navLinkClass('/mods')}>
              {t('nav.mods_label')}
            </button>
            <button onClick={() => navigate('/coordinates')} className={navLinkClass('/coordinates')}>
              {t('nav.coords_label')}
            </button>
            <button onClick={() => navigate('/bot')} className={navLinkClass('/bot')}>
              Bot
              <span className="ml-1.5 px-1 py-px rounded text-[8px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/25 leading-none align-top">Beta</span>
            </button>
          </nav>

          {isScanning && (
            <div onClick={() => navigate('/bot')} className="flex items-center gap-2 px-3 py-1.5 mr-4 rounded-lg border border-primary/30 bg-primary/10 animate-pulse cursor-pointer hover:bg-primary/20 transition-colors">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" style={{ animationDuration: '1s' }} />
              <span className="text-xs font-medium text-primary whitespace-nowrap">
                Scanning {scanServerName}…
              </span>
              <button
                onClick={handleStopActiveScan}
                className="p-0.5 rounded hover:bg-destructive/20 transition-colors cursor-pointer"
                title="Stop scan"
              >
                <XCircle className="w-3.5 h-3.5 text-destructive" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Preload profile banner so it appears instantly when the menu opens */}
            <img
              src={profile?.banner_url || profileBanner}
              alt=""
              aria-hidden
              loading="eager"
              decoding="async"
              className="hidden"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border/30 bg-card/40 hover:bg-card/60 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">
                        {(profile?.display_name || '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {profile ? (
                    <span className="text-sm text-foreground font-medium">{profile.display_name || t('nav.user_fallback')}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground animate-pulse">{t('nav.loading')}</span>
                  )}
                  {getRoleBadge()}
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-[320px] p-0 overflow-hidden border-border/50 bg-card/95 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] rounded-xl"
              >
                {/* Banner with gradient overlay */}
                <div className="relative h-[88px] overflow-hidden bg-gradient-to-br from-primary/20 via-muted/40 to-muted/20">
                  <img
                    src={profile?.banner_url || profileBanner}
                    alt=""
                    aria-hidden
                    loading="eager"
                    decoding="sync"
                    fetchPriority="high"
                    className="absolute inset-0 w-full h-full object-cover"
                    onLoad={() => setBannerStatus(profile?.banner_url ? 'ok' : 'missing')}
                    onError={() => setBannerStatus('error')}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                  {fetchState === 'error' && (
                    <div
                      className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-destructive/90 text-destructive-foreground text-[9px] font-medium shadow"
                      title={fetchError ?? 'Sync error'}
                    >
                      <XCircle className="w-2.5 h-2.5" /> Sync error
                    </div>
                  )}
                </div>

                {/* Identity */}
                <div className="px-4 pb-3 -mt-10 relative">
                  <div className="relative inline-block mb-2.5">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="w-[68px] h-[68px] rounded-full object-cover ring-[3px] ring-card shadow-xl"
                        onLoad={() => setAvatarStatus('ok')}
                        onError={() => setAvatarStatus('error')}
                      />
                    ) : (
                      <div className="w-[68px] h-[68px] rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center ring-[3px] ring-card shadow-xl">
                        <span className="text-2xl font-semibold text-primary">
                          {(profile?.display_name || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span
                      className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-[hsl(var(--green))] ring-[3px] ring-card"
                      title="Online"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-[15px] font-semibold text-foreground truncate leading-tight">
                      {profile?.display_name || t('nav.user_fallback')}
                    </p>
                    <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
                  </div>
                  <p className="text-[12px] text-muted-foreground/80 truncate mb-2.5" title={profile?.email || ''}>
                    {profile?.email || '—'}
                  </p>

                  <div className="flex items-center gap-2 mb-3">
                    {getRoleBadge()}
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 pt-2.5 border-t border-border/40">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {formatJoined(profile?.created_at ?? null)}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyId(); }}
                      className="flex items-center gap-1 font-mono hover:text-foreground transition-colors group"
                      title={profile?.user_id || 'Copy user ID'}
                    >
                      <span>{profile?.user_id ? `${profile.user_id.slice(0, 6)}…${profile.user_id.slice(-4)}` : '—'}</span>
                      {copiedId ? (
                        <Check className="w-3 h-3 text-[hsl(var(--green))]" />
                      ) : (
                        <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Menu */}
                <div className="px-1.5 py-1.5 border-t border-border/40 bg-background/30">
                  <DropdownMenuItem
                    onSelect={() => navigate('/profile')}
                    className="gap-2.5 cursor-pointer rounded-md py-2 px-2.5 text-[13px] focus:bg-accent/60"
                  >
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">View profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => navigate('/settings')}
                    className="gap-2.5 cursor-pointer rounded-md py-2 px-2.5 text-[13px] focus:bg-accent/60"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => navigate('/profile')}
                    className="gap-2.5 cursor-pointer rounded-md py-2 px-2.5 text-[13px] focus:bg-accent/60"
                  >
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">Activity</span>
                  </DropdownMenuItem>

                  {(isAdmin || isOwner) && (
                    <>
                      <DropdownMenuSeparator className="my-1 bg-border/40" />
                      <DropdownMenuItem
                        onSelect={() => navigate('/admin')}
                        className="gap-2.5 cursor-pointer rounded-md py-2 px-2.5 text-[13px] focus:bg-accent/60"
                      >
                        <Shield className="w-4 h-4 text-[hsl(var(--magenta))]" />
                        <span className="flex-1">Admin panel</span>
                        <span className="text-[9px] uppercase tracking-wider text-[hsl(var(--magenta))] font-semibold">
                          Staff
                        </span>
                      </DropdownMenuItem>
                    </>
                  )}

                  <DropdownMenuSeparator className="my-1 bg-border/40" />

                  <DropdownMenuItem
                    onSelect={() => navigate('/dashboard')}
                    className="gap-2.5 cursor-pointer rounded-md py-2 px-2.5 text-[13px] text-primary focus:text-primary focus:bg-primary/10"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span className="flex-1 font-medium">Open dashboard</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => window.open('https://docs.lovable.dev', '_blank')}
                    className="gap-2.5 cursor-pointer rounded-md py-2 px-2.5 text-[13px] focus:bg-accent/60"
                  >
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">Help & support</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1 bg-border/40" />

                  <DropdownMenuItem
                    onSelect={handleLogout}
                    className="gap-2.5 cursor-pointer rounded-md py-2 px-2.5 text-[13px] text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="flex-1">{t('nav.logout')}</span>
                  </DropdownMenuItem>
                </div>

                <div className="px-3.5 py-2 bg-muted/20 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-muted-foreground/70 tracking-wide">Curly Kidd Panel</span>
                  <span className="text-[10px] text-muted-foreground/50 font-mono">v1.0</span>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => navigate('/settings')}
              className="p-1.5 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-card/60 transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('nav.logout')}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
