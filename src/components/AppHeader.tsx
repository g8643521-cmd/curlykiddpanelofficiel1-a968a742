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

interface Profile {
  display_name: string | null;
  role: string | null;
  avatar_url: string | null;
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

const PROFILE_CACHE_KEY = 'ckp_profile_cache';

const getCachedProfile = (): Profile | null => {
  try {
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

const AppHeader = ({ showBackButton = false, title, subtitle, onLogoClick }: AppHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, isOwner, isModerator, userRole } = useAdminStatus();
  const { t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(getCachedProfile);
  const [copiedId, setCopiedId] = useState(false);
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      const metaName =
        session.user.user_metadata?.display_name ||
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
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
      // Drop cache if it belongs to a different user
      if (profile && profile.user_id !== session.user.id) {
        setProfile(sessionFallback);
      } else if (!profile) {
        setProfile(sessionFallback);
      }
      supabase
        .from('profiles')
        .select('display_name, role, avatar_url, banner_url')
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (data) {
            const profileData: Profile = {
              ...sessionFallback,
              ...data,
              display_name: data.display_name || sessionFallback.display_name,
              avatar_url: data.avatar_url || session.user.user_metadata?.avatar_url || null,
            };
            setProfile(profileData);
            setCachedProfile(profileData);
          } else if (error) {
            setProfile(sessionFallback);
            setCachedProfile(sessionFallback);
          }
        });
    });
  }, []);

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
                    <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" />
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
              <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden border-border/40 shadow-2xl">
                {/* Profile banner */}
                <div className="relative h-24 overflow-hidden bg-muted/40">
                  <img
                    src={profile?.banner_url || profileBanner}
                    alt=""
                    aria-hidden
                    loading="eager"
                    decoding="sync"
                    fetchPriority="high"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>

                {/* Profile header */}
                <div className="px-4 pb-4 -mt-12 relative">
                  <div className="flex items-end gap-3 mb-3">
                    <div className="relative">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="w-16 h-16 rounded-full object-cover ring-4 ring-background shadow-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center ring-4 ring-background shadow-lg">
                          <span className="text-xl font-bold text-primary">
                            {(profile?.display_name || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[hsl(var(--green))] ring-2 ring-background" title="Online" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-[15px] font-semibold text-foreground truncate">
                      {profile?.display_name || t('nav.user_fallback')}
                    </p>
                    <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    {getRoleBadge()}
                    <span className="text-[10px] text-muted-foreground/60">·</span>
                    <span className="text-[11px] text-muted-foreground/80 capitalize">{userRole || profile?.role || 'user'}</span>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-1.5 rounded-lg bg-muted/30 border border-border/40 p-2.5">
                    <div className="flex items-center gap-2 text-[11px]">
                      <Mail className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                      <span className="text-muted-foreground/90 truncate flex-1" title={profile?.email || ''}>
                        {profile?.email || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <Calendar className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                      <span className="text-muted-foreground/90 flex-1">
                        Joined {formatJoined(profile?.created_at ?? null)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <User className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                      <span className="text-muted-foreground/90 font-mono truncate flex-1" title={profile?.user_id || ''}>
                        {profile?.user_id ? `${profile.user_id.slice(0, 8)}…${profile.user_id.slice(-4)}` : '—'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyId(); }}
                        className="p-1 rounded hover:bg-background/60 transition-colors text-muted-foreground/70 hover:text-foreground"
                        title="Copy user ID"
                      >
                        {copiedId ? <Check className="w-3 h-3 text-[hsl(var(--green))]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Menu actions */}
                <div className="p-1.5 border-t border-border/30">
                  <p className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    Account
                  </p>
                  <DropdownMenuItem onSelect={() => navigate('/profile')} className="gap-2.5 cursor-pointer rounded-md">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">View profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/settings')} className="gap-2.5 cursor-pointer rounded-md">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate('/profile')} className="gap-2.5 cursor-pointer rounded-md">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">Activity</span>
                  </DropdownMenuItem>

                  {(isAdmin || isOwner) && (
                    <>
                      <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        Staff
                      </p>
                      <DropdownMenuItem onSelect={() => navigate('/admin')} className="gap-2.5 cursor-pointer rounded-md">
                        <Shield className="w-4 h-4 text-[hsl(var(--magenta))]" />
                        <span className="flex-1">Admin panel</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  <p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    Workspace
                  </p>
                  <DropdownMenuItem onSelect={() => navigate('/dashboard')} className="gap-2.5 cursor-pointer rounded-md text-primary focus:text-primary">
                    <LayoutGrid className="w-4 h-4" />
                    <span className="flex-1 font-medium">Open full menu</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => window.open('https://docs.lovable.dev', '_blank')} className="gap-2.5 cursor-pointer rounded-md">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1">Help & support</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout} className="gap-2.5 cursor-pointer rounded-md text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4" />
                    <span className="flex-1">{t('nav.logout')}</span>
                  </DropdownMenuItem>
                </div>

                <div className="px-3 py-2 bg-muted/20 border-t border-border/30 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/60">Curly Kidd Panel</span>
                  <span className="text-[10px] text-muted-foreground/40 font-mono">v1.0</span>
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
