// @ts-nocheck
import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Pencil, Check, X, Loader2, Camera, LinkIcon, Unlink, Eye, EyeOff, ExternalLink, Shield, Clock, ShieldCheck, Key, Copy, ArrowRight, Fingerprint, Activity, UserCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import Footer from '@/components/Footer';
import AppHeader from '@/components/AppHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { usePresence } from '@/hooks/usePresence';
import { toast } from 'sonner';
import profileBanner from '@/assets/profile-banner.jpg';
import { getProfileAvatarUrl } from '@/lib/avatar';
import { syncCurrentUserProfile } from '@/lib/profileSync';
import { runAsync } from '@/lib/asyncRequest';
import { apiFetch } from '@/lib/apiFetch';
import { ErrorCard } from '@/components/feedback/ErrorCard';

const ROLE_DISPLAY: Record<string, { label: string; color: string }> = {
  owner: { label: 'OWNER', color: 'text-[hsl(var(--yellow))]' },
  admin: { label: 'ADMIN', color: 'text-primary' },
  moderator: { label: 'MODERATOR', color: 'text-[hsl(var(--cyan))]' },
  server_owner: { label: 'SERVER OWNER', color: 'text-[hsl(var(--yellow))]' },
  integrations_manager: { label: 'INTEGRATIONS', color: 'text-[hsl(var(--purple))]' },
  mod_creator: { label: 'MOD CREATOR', color: 'text-[hsl(var(--green))]' },
  user: { label: 'USER', color: 'text-muted-foreground' },
};

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    provider: string;
    user_id: string;
    discord_user_id: string | null;
    discord_username: string | null;
    discord_avatar: string | null;
    discord_guild_member: boolean | null;
    discord_guild_status: string | null;
    discord_guild_checked_at: string | null;
    email_confirmed_at: string | null;
    phone: string | null;
    updated_at: string | null;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLinkingDiscord, setIsLinkingDiscord] = useState(false);
  const [showUserId, setShowUserId] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [discordInviteUrl, setDiscordInviteUrl] = useState<string | null>(null);
  const { userRole } = useAdminStatus();

  const copyToClipboard = useCallback(async (value: string, field: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(`${label} copied`);
      setTimeout(() => setCopiedField(prev => (prev === field ? null : prev)), 1500);
    } catch {
      toast.error('Could not copy');
    }
  }, []);

  const formatRelative = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '—';
    const diff = Date.now() - then;
    const sec = Math.round(diff / 1000);
    if (sec < 45) return 'just now';
    const min = Math.round(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
    const mo = Math.round(day / 30);
    if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`;
    const yr = Math.round(mo / 12);
    return `${yr} year${yr === 1 ? '' : 's'} ago`;
  };

  const formatExact = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
  };

  usePresence();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const checkAuth = async () => {
      setAuthError(null);
      const sessionOutcome = await runAsync(
        async () => (await supabase.auth.getSession()).data.session,
        { timeoutMs: 5000, signal: controller.signal, label: 'Profile:getSession' },
      );
      if (cancelled) return;
      if (!sessionOutcome.ok) {
        setAuthError(sessionOutcome.error.message);
        setIsCheckingAuth(false);
        return;
      }
      const session = sessionOutcome.data;
      if (!session) {
        navigate('/login');
        return;
      }
      const user = session.user;
      void syncCurrentUserProfile().catch(() => null);

      const profileOutcome = await runAsync(
        async (signal) => {
          const { data, error } = await supabase
            .from('profiles')
            .select('display_name, avatar_url, discord_user_id, discord_username, discord_avatar, discord_guild_member, discord_guild_status, discord_guild_checked_at')
            .eq('user_id', user.id)
            .abortSignal(signal)
            .maybeSingle();
          if (error) throw new Error(error.message);
          return data;
        },
        { timeoutMs: 6000, signal: controller.signal, label: 'Profile:fetchProfile' },
      );
      if (cancelled) return;
      const profile: any = profileOutcome.ok ? profileOutcome.data : null;
      if (!profileOutcome.ok) {
        console.warn('[Profile] profile fetch failed', profileOutcome.error);
      }

      setUserInfo({
        email: user.email || '',
        display_name: profile?.display_name || user.user_metadata?.full_name || null,
        avatar_url: getProfileAvatarUrl(profile) || user.user_metadata?.avatar_url || null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || null,
        provider: user.app_metadata?.provider || 'email',
        user_id: user.id,
        discord_user_id: profile?.discord_user_id || null,
        discord_username: profile?.discord_username || null,
        discord_avatar: profile?.discord_avatar || null,
        discord_guild_member: profile?.discord_guild_member ?? null,
        discord_guild_status: profile?.discord_guild_status || null,
        discord_guild_checked_at: profile?.discord_guild_checked_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        phone: user.phone || null,
        updated_at: user.updated_at || null,
      });
      setIsCheckingAuth(false);

      // Non-critical — fire-and-forget with timeout.
      void runAsync(
        async (signal) => {
          const { data } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'social_discord')
            .abortSignal(signal)
            .maybeSingle();
          return data?.value as string | null | undefined;
        },
        { timeoutMs: 4000, signal: controller.signal, label: 'Profile:discordInvite' },
      ).then((res) => {
        if (!cancelled && res.ok && res.data) setDiscordInviteUrl(res.data);
      });
    };

    void checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) navigate('/login');
    });

    return () => {
      cancelled = true;
      controller.abort();
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Handle Discord OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code || isLinkingDiscord) return;

    const handleCallback = async () => {
      setIsLinkingDiscord(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const redirectUri = `${window.location.origin}/profile`;
        const outcome = await apiFetch<any>(
          `/api/public/discord-oauth?action=callback`,
          {
            method: 'POST',
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${session.access_token}`,
            },
            json: { code, redirect_uri: redirectUri },
          },
          { timeoutMs: 10000, label: 'discord-oauth:callback' },
        );

        // Clean URL
        window.history.replaceState({}, '', '/profile');

        if (!outcome.ok || outcome.data?.error) {
          toast.error(outcome.ok ? 'Discord linking failed' : outcome.error.message);
          return;
        }

        const data = outcome.data;
        const discord = data.discord;
        setUserInfo(prev => prev ? {
          ...prev,
          discord_user_id: discord.id,
          discord_username: discord.username,
          discord_avatar: discord.avatar,
          avatar_url: discord.avatar || prev.avatar_url,
          discord_guild_member: data.guild_member ?? data.joined_guild ?? prev.discord_guild_member,
          discord_guild_status: data.guild_status || prev.discord_guild_status,
          discord_guild_checked_at: new Date().toISOString(),
        } : prev);
        const joinMsg = data.joined_guild ? ' & joined Discord server!' : '';
        toast.success(`Discord linked: ${discord.username}${joinMsg}`);
      } finally {
        setIsLinkingDiscord(false);
      }
    };

    handleCallback();
  }, [searchParams]);

  const handleLinkDiscord = async () => {
    const isEmbedded = window.self !== window.top;
    let oauthTab: Window | null = null;

    if (isEmbedded) {
      oauthTab = window.open('about:blank', '_blank');
      if (oauthTab) {
        oauthTab.document.title = 'Opening Discord';
        oauthTab.document.body.innerHTML = '<p style="font-family: sans-serif; padding: 24px;">Opening Discord authorization…</p>';
      }
    }

    const redirectUri = `${window.location.origin}/profile`;
    const fnUrl = `/api/public/discord-oauth?action=initiate&redirect_uri=${encodeURIComponent(redirectUri)}`;
    const outcome = await apiFetch<{ url?: string }>(
      fnUrl,
      { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } },
      { timeoutMs: 8000, label: 'discord-oauth:initiate' },
    );

    if (!outcome.ok || !outcome.data?.url) {
      oauthTab?.close();
      toast.error(outcome.ok ? 'Could not start Discord linking' : outcome.error.message);
      return;
    }

    const url = outcome.data.url;
    if (oauthTab) {
      try { oauthTab.opener = null; } catch {}
      oauthTab.location.href = url;
      toast.success('Discord authorization opened in a new tab');
      return;
    }
    if (isEmbedded) {
      try { window.top?.location.assign(url); return; } catch {}
    }
    window.location.href = url;
  };

  const handleUnlinkDiscord = async () => {
    setIsLinkingDiscord(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const outcome = await apiFetch<{ success?: boolean }>(
        `/api/public/discord-oauth?action=unlink`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        },
        { timeoutMs: 8000, label: 'discord-oauth:unlink' },
      );

      if (!outcome.ok) {
        toast.error(outcome.error.message);
        return;
      }
      if (outcome.data?.success) {
        setUserInfo(prev => prev ? {
          ...prev,
          discord_user_id: null,
          discord_username: null,
          discord_avatar: null,
          discord_guild_member: null,
          discord_guild_status: null,
          discord_guild_checked_at: null,
        } : prev);
        toast.success('Discord unlinked');
      }
    } finally {
      setIsLinkingDiscord(false);
    }
  };

  const refreshDiscordMembership = async () => {
    setIsLinkingDiscord(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const outcome = await apiFetch<{ member?: boolean; status?: string; error?: string }>(
        '/api/public/discord-oauth?action=membership',
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        },
        { timeoutMs: 8000, label: 'discord-oauth:membership' },
      );
      if (!outcome.ok || outcome.data?.error) {
        toast.error(outcome.ok ? (outcome.data?.error || 'Could not check Discord membership') : outcome.error.message);
        return;
      }
      const data = outcome.data;
      setUserInfo(prev => prev ? {
        ...prev,
        discord_guild_member: data.member ?? null,
        discord_guild_status: data.status || null,
        discord_guild_checked_at: new Date().toISOString(),
      } : prev);
      toast.success(data.member ? 'Discord membership verified' : 'Discord membership not found');
    } finally {
      setIsLinkingDiscord(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userInfo) return;
    if (!file.type.startsWith('image/')) { toast.error(t('profile.select_image')); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(t('profile.image_size')); return; }

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userInfo.user_id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) { toast.error(t('profile.avatar_failed')); return; }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', userInfo.user_id);

      if (updateError) { toast.error(t('profile.update_failed')); return; }

      setUserInfo({ ...userInfo, avatar_url: avatarUrl });
      toast.success(t('profile.avatar_updated'));
    } catch {
      toast.error(t('profile.something_wrong'));
    } finally {
      setIsUploadingAvatar(false);
    }
  };


  const handleSaveName = async () => {
    if (!userInfo || !newName.trim()) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: newName.trim() })
      .eq('user_id', userInfo.user_id);

    if (error) {
      toast.error(t('profile.name_failed'));
    } else {
      setUserInfo({ ...userInfo, display_name: newName.trim() });
      toast.success(t('profile.name_updated'));
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (authError && !userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <ErrorCard
          title="Could not load profile"
          message={authError}
          onRetry={() => { setIsCheckingAuth(true); setAuthError(null); window.location.reload(); }}
        />
      </div>
    );
  }

  const roleMeta = ROLE_DISPLAY[userRole] || ROLE_DISPLAY.user;
  const displayName = userInfo?.display_name || 'Unknown';
  const userIdShort = userInfo?.user_id?.slice(0, 8) || '—';
  const memberSince = userInfo?.created_at
    ? new Date(userInfo.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : '—';
  const initials = displayName[0]?.toUpperCase() || '?';

  // Mask email: show first 3 chars + domain
  const maskedEmail = (() => {
    const email = userInfo?.email || '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.slice(0, 3);
    return `${visible}${'•'.repeat(Math.max(local.length - 3, 2))}@${domain}`;
  })();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MaintenanceBanner />
      <AppHeader />

      <main className="flex-1 relative z-10">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Hero Banner Card */}
            <div className="relative rounded-2xl overflow-hidden border border-border/30 shadow-2xl shadow-black/40">
              {/* Banner Image */}
              <div className="relative h-44 sm:h-52 overflow-hidden">
                <img
                  src={profileBanner}
                  alt=""
                  className="w-full h-full object-cover"
                  width={1920}
                  height={512}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
              </div>

              {/* Avatar + Name overlay */}
              <div className="relative px-6 pb-6 -mt-16">
                <div className="flex items-end gap-5">
                  {/* Avatar */}
                  <div className="relative shrink-0 group">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-card">
                      {userInfo?.avatar_url ? (
                        <img src={userInfo.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-2xl font-bold text-primary">
                          {initials}
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {isUploadingAvatar ? (
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6 text-white" />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploadingAvatar} />
                    </label>
                  </div>

                  {/* Name + Badge */}
                  <div className="pb-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        {t('profile.active_member')}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder={t('profile.enter_name')}
                          className="h-9 text-lg font-bold bg-background/60 border-border/40"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                        />
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-primary" onClick={handleSaveName} disabled={isSaving}>
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground" onClick={() => setIsEditing(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground truncate">
                          {displayName}
                        </h1>
                        <button
                          onClick={() => { setNewName(displayName); setIsEditing(true); }}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm p-6 text-center hover:border-border/50 transition-colors"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">{t('profile.user_id')}</p>
                <p className="text-xl font-display font-bold text-foreground tracking-tight">{userIdShort}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm p-6 text-center hover:border-border/50 transition-colors"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">{t('profile.rank')}</p>
                <p className={`text-xl font-display font-bold tracking-tight ${roleMeta.color}`}>{roleMeta.label}</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm p-6 text-center hover:border-border/50 transition-colors"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-2">{t('profile.member_since')}</p>
                <p className="text-xl font-display font-bold text-primary tracking-tight">{memberSince}</p>
              </motion.div>
            </div>

            <TooltipProvider delayDuration={150}>
            {/* Identity Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border/15 flex items-center gap-2">
                <UserCircle2 className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-foreground tracking-tight">Identity</h3>
              </div>
              <div className="divide-y divide-border/10">
                {/* Email */}
                <div className="px-6 py-5 flex items-center justify-between gap-4 group">
                  <span className="text-sm text-muted-foreground/90">Email</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm font-medium text-foreground font-mono tracking-wide truncate">
                      {showEmail ? userInfo?.email : maskedEmail}
                    </span>
                    <button
                      onClick={() => setShowEmail(prev => !prev)}
                      className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors opacity-60 group-hover:opacity-100"
                      title={showEmail ? 'Hide email' : 'Reveal email'}
                    >
                      {showEmail ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(userInfo?.email || '', 'email', 'Email')}
                      className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors opacity-60 group-hover:opacity-100"
                      title="Copy email"
                    >
                      {copiedField === 'email'
                        ? <Check className="w-3.5 h-3.5 text-[hsl(var(--green))] animate-in zoom-in-50 duration-200" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* User ID */}
                <div className="px-6 py-5 flex items-center justify-between gap-4 group">
                  <span className="text-sm text-muted-foreground/90">User ID</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-xs font-mono text-foreground/80 select-none transition-all duration-300 truncate ${showUserId ? 'blur-none' : 'blur-sm'}`}>
                      {userInfo?.user_id}
                    </span>
                    <button
                      onClick={() => setShowUserId(prev => !prev)}
                      className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors opacity-60 group-hover:opacity-100"
                      title={showUserId ? 'Hide ID' : 'Reveal ID'}
                    >
                      {showUserId ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(userInfo?.user_id || '', 'uid', 'User ID')}
                      className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors opacity-60 group-hover:opacity-100"
                      title="Copy User ID"
                    >
                      {copiedField === 'uid'
                        ? <Check className="w-3.5 h-3.5 text-[hsl(var(--green))] animate-in zoom-in-50 duration-200" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Role */}
                <div className="px-6 py-5 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground/90">Role</span>
                  <span className={`text-sm font-bold ${roleMeta.color}`}>{roleMeta.label}</span>
                </div>
              </div>
            </motion.div>

            {/* Access Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-6 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border/15 flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-foreground tracking-tight">Access</h3>
              </div>
              <div className="divide-y divide-border/10">
                <div className="px-6 py-5 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground/90">Sign-in provider</span>
                  <span className="text-sm font-medium text-foreground capitalize">{userInfo?.provider}</span>
                </div>
                <div className="px-6 py-5 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground/90">Status</span>
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--green))]">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--green))] opacity-60 animate-ping" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--green))] shadow-[0_0_8px_hsl(var(--green))]" />
                    </span>
                    Active now
                  </span>
                </div>
                <div className="px-6 py-5 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground/90">Email verified</span>
                  {userInfo?.email_confirmed_at ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--green))]">
                      <Check className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--yellow))]">
                      <X className="w-3.5 h-3.5" />
                      Unverified
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Activity Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border/15 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-foreground tracking-tight">Activity</h3>
              </div>
              <div className="divide-y divide-border/10">
                <div className="px-6 py-5 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground/90">Last sign-in</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-medium text-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4">
                        {formatRelative(userInfo?.last_sign_in_at)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{formatExact(userInfo?.last_sign_in_at)}</TooltipContent>
                  </Tooltip>
                </div>
                <div className="px-6 py-5 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground/90">Account created</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-medium text-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4">
                        {formatRelative(userInfo?.created_at)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{formatExact(userInfo?.created_at)}</TooltipContent>
                  </Tooltip>
                </div>
                <div className="px-6 py-5 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground/90">Last updated</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm font-medium text-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4">
                        {formatRelative(userInfo?.updated_at)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{formatExact(userInfo?.updated_at)}</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </motion.div>

            {/* Security Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="mt-6 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border/15 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="text-base font-semibold text-foreground tracking-tight">Security</h3>
              </div>
              <div className="divide-y divide-border/10">
                <div className="px-6 py-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Two-factor authentication</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Add an extra layer of protection to your account.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/settings?section=security')}
                    className="shrink-0 gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    Set up
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="px-6 py-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Password</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Change your password regularly to stay secure.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate('/settings?section=security')}
                    className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    Manage
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
            </TooltipProvider>

            {/* Discord Integration Card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="mt-6 rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border/15">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                  Discord
                </h3>
              </div>
              <div className="px-6 py-5">
                {userInfo?.discord_user_id ? (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {userInfo.discord_avatar ? (
                        <img src={userInfo.discord_avatar} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-bold text-sm">
                          {userInfo.discord_username?.[0]?.toUpperCase() || 'D'}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{userInfo.discord_username}</p>
                        <p className="text-xs text-muted-foreground">ID: {userInfo.discord_user_id}</p>
                        <p className="text-xs text-muted-foreground">
                          Server status: {userInfo.discord_guild_member ? 'Member of CurlyKidd Discord' : 'Not connected to CurlyKidd Discord'}
                          {userInfo.discord_guild_status ? ` · ${userInfo.discord_guild_status}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!userInfo.discord_guild_member && discordInviteUrl && (
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <a href={discordInviteUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-4 h-4" />
                            Join
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={refreshDiscordMembership}
                        disabled={isLinkingDiscord}
                      >
                        {isLinkingDiscord ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Activity className="w-4 h-4 mr-1" />}
                        Check
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUnlinkDiscord}
                        disabled={isLinkingDiscord}
                        className="text-destructive hover:text-destructive"
                      >
                        {isLinkingDiscord ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Unlink className="w-4 h-4 mr-1" />}
                        Unlink
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">No Discord account linked</p>
                    <Button
                      onClick={handleLinkDiscord}
                      disabled={isLinkingDiscord}
                      size="sm"
                      className="bg-[#5865F2] hover:bg-[#4752C4] text-white"
                    >
                      {isLinkingDiscord ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <LinkIcon className="w-4 h-4 mr-1" />}
                      Link Discord
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Profile;
