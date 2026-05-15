import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Volume2, Download, Trash2, Bell, BellOff, Monitor, Palette, Shield, EyeOff, Zap, Settings2, Play, Check, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import Footer from '@/components/Footer';
import AppHeader from '@/components/AppHeader';
const CosmicNebulaBackground = lazy(() => import('@/components/CosmicNebulaBackground'));
import { supabase } from '@/lib/supabase';
import { useNotifications } from '@/hooks/useNotifications';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { soundEffects, CLICK_SOUND_PRESETS, type ClickSoundPreset } from '@/services/soundEffects';
import { toast } from 'sonner';
import profileBanner from '@/assets/profile-banner.jpg';

const ROLE_DISPLAY: Record<string, { label: string; color: string }> = {
  owner: { label: 'OWNER', color: 'text-[hsl(var(--yellow))]' },
  admin: { label: 'ADMIN', color: 'text-primary' },
  moderator: { label: 'MODERATOR', color: 'text-[hsl(var(--cyan))]' },
  server_owner: { label: 'SERVER OWNER', color: 'text-[hsl(var(--yellow))]' },
  integrations_manager: { label: 'INTEGRATIONS', color: 'text-[hsl(var(--purple))]' },
  mod_creator: { label: 'MOD CREATOR', color: 'text-[hsl(var(--green))]' },
  user: { label: 'USER', color: 'text-muted-foreground' },
};

const SettingRow = ({ icon: Icon, iconColor = 'text-primary', label, description, children }: {
  icon: any; iconColor?: string; label: string; description?: string; children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-6 px-6 py-4 hover:bg-muted/[0.04] transition-colors duration-150">
    <div className="flex items-start gap-3 min-w-0">
      <div className="p-2 rounded-lg bg-muted/20 shrink-0 mt-0.5">
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-foreground leading-tight">{label}</p>
        {description && <p className="text-[12px] text-muted-foreground/75 mt-1 leading-snug">{description}</p>}
      </div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const SectionCard = ({ title, icon: Icon, delay, children, variant = 'default' }: {
  title: string; icon: any; delay: number; children: React.ReactNode; variant?: 'default' | 'danger';
}) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.35 }}
    className={`rounded-2xl overflow-hidden backdrop-blur-sm shadow-lg shadow-black/10 ${
      variant === 'danger'
        ? 'border border-destructive/15 bg-card/50'
        : 'border border-border/20 bg-card/50'
    }`}
  >
    <header className="px-6 pt-5 pb-3 flex items-center gap-2.5">
      <Icon className={`w-4 h-4 ${variant === 'danger' ? 'text-destructive/80' : 'text-primary'}`} />
      <h2 className="text-[13px] font-semibold text-foreground/90 uppercase tracking-[0.12em]">{title}</h2>
    </header>
    <div className="divide-y divide-border/[0.08]">{children}</div>
  </motion.section>
);

const Settings = () => {
  const navigate = useNavigate();
  const { t, lang, setLang } = useI18n();
  const { userRole } = useAdminStatus();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
    user_id: string;
  } | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(soundEffects.isEnabled());
  const [clickPreset, setClickPreset] = useState<ClickSoundPreset>(soundEffects.getClickPreset());
  const { permissionGranted, requestPermission } = useNotifications();
  const [notificationsEnabled, setNotificationsEnabled] = useState(permissionGranted);
  const [isExporting, setIsExporting] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('ckp-reduced-motion') === 'true');
  const [streamerMode, setStreamerMode] = useState(() => localStorage.getItem('ckp-streamer-mode') === 'true');
  const [compactMode, setCompactMode] = useState(() => localStorage.getItem('ckp-compact-mode') === 'true');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate('/login'); return; }
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', session.user.id)
        .maybeSingle();

      setUserInfo({
        display_name: (profile as any)?.display_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
        avatar_url: (profile as any)?.avatar_url || session.user.user_metadata?.avatar_url || null,
        created_at: session.user.created_at,
        user_id: session.user.id,
      });
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => { setNotificationsEnabled(permissionGranted); }, [permissionGranted]);

  const handleSoundToggle = () => {
    const v = !soundEnabled;
    setSoundEnabled(v);
    soundEffects.setEnabled(v);
    if (v) soundEffects.playClick();
  };

  const handleNotificationToggle = async (checked: boolean) => {
    if (checked) {
      if (!('Notification' in window)) {
        toast.error("Your browser doesn't support notifications");
        return;
      }
      if (Notification.permission === 'denied') {
        toast.error('Notifications blocked. Enable them in your browser settings.');
        return;
      }
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
        toast.success(t('settings.notifications_enabled'));
        return;
      }
      const granted = await requestPermission();
      setNotificationsEnabled(granted);
      if (granted) toast.success(t('settings.notifications_enabled'));
    } else {
      setNotificationsEnabled(false);
      toast.success(t('settings.notifications_disabled'));
    }
  };

  const toggleReducedMotion = () => {
    const v = !reducedMotion;
    setReducedMotion(v);
    localStorage.setItem('ckp-reduced-motion', String(v));
    toast.success(v ? t('settings.reduced_motion_on') : t('settings.animations_restored'));
  };

  const toggleStreamerMode = () => {
    const v = !streamerMode;
    setStreamerMode(v);
    localStorage.setItem('ckp-streamer-mode', String(v));
    toast.success(v ? t('settings.streamer_on') : t('settings.streamer_off'));
  };

  const toggleCompactMode = () => {
    const v = !compactMode;
    setCompactMode(v);
    localStorage.setItem('ckp-compact-mode', String(v));
    toast.success(v ? t('settings.compact_on') : t('settings.compact_off'));
  };

  const exportUserData = async () => {
    if (!userId) return;
    setIsExporting(true);
    try {
      const [profileRes, historyRes, favoritesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('search_history').select('*').eq('user_id', userId),
        supabase.from('server_favorites').select('*').eq('user_id', userId),
      ]);
      const exportData = { exportDate: new Date().toISOString(), profile: profileRes.data, searchHistory: historyRes.data, favorites: favoritesRes.data };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `curlykiddpanel-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('settings.export_success'));
    } catch {
      toast.error(t('settings.export_failed'));
    } finally {
      setIsExporting(false);
    }
  };

  const clearSearchHistory = async () => {
    if (!userId) return;
    try {
      const { error } = await supabase.from('search_history').delete().eq('user_id', userId);
      if (error) throw error;
      toast.success(t('settings.history_cleared'));
    } catch {
      toast.error(t('settings.history_clear_failed'));
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const roleMeta = ROLE_DISPLAY[userRole] || ROLE_DISPLAY.user;
  const displayName = userInfo?.display_name || 'User';
  const initials = displayName[0]?.toUpperCase() || '?';

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      <Suspense fallback={<div className="fixed inset-0 -z-10" style={{ background: 'hsl(230, 25%, 4%)' }} />}>
        <CosmicNebulaBackground />
      </Suspense>
      <MaintenanceBanner />
      <AppHeader />

      <main className="flex-1 relative z-10">
        <div className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
          {/* Hero Banner Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative rounded-2xl overflow-hidden border border-border/30 shadow-2xl shadow-black/40 mb-6"
          >
            <div className="relative h-44 sm:h-52 overflow-hidden">
              <img src={profileBanner} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
            </div>
            <div className="relative px-6 pb-6 -mt-16">
              <div className="flex items-end gap-5">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-card shrink-0">
                  {userInfo?.avatar_url ? (
                    <img src={userInfo.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 text-xl font-bold text-primary">
                      {initials}
                    </div>
                  )}
                </div>
                <div className="pb-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground truncate">{displayName}</h1>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${roleMeta.color}`}>{roleMeta.label}</span>
                    <span className="text-[10px] text-muted-foreground/50">·</span>
                    <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                      <Settings2 className="w-3 h-3" />
                      {t('settings.title')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="space-y-6">
            {/* Appearance & Language */}
            <SectionCard title={t('settings.appearance')} icon={Palette} delay={0.1}>
              <SettingRow icon={Globe} label={t('settings.language')} description={t('settings.choose_language')}>
                <div className="inline-flex p-0.5 bg-muted/30 rounded-lg" role="tablist">
                  <button
                    role="tab"
                    aria-selected={lang === 'en'}
                    onClick={() => setLang('en')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                      lang === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >EN</button>
                  <button
                    role="tab"
                    aria-selected={lang === 'da'}
                    onClick={() => setLang('da')}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                      lang === 'da' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >DA</button>
                </div>
              </SettingRow>
              <SettingRow icon={Zap} label={t('settings.reduced_motion_label')} description={t('settings.reduced_motion_desc2')}>
                <Switch checked={reducedMotion} onCheckedChange={toggleReducedMotion} />
              </SettingRow>
              <SettingRow icon={Monitor} label={t('settings.compact_mode')} description={t('settings.compact_mode_desc')}>
                <Switch checked={compactMode} onCheckedChange={toggleCompactMode} />
              </SettingRow>
            </SectionCard>

            {/* Sound */}
            <SectionCard title={t('settings.sound_notif')} icon={Volume2} delay={0.15}>
              <SettingRow icon={Volume2} label={t('settings.sound_effects')} description={t('settings.sound_desc2')}>
                <Switch checked={soundEnabled} onCheckedChange={handleSoundToggle} />
              </SettingRow>
              {soundEnabled && (
                <div className="px-6 py-4 bg-muted/[0.02]">
                  <p className="text-[11px] text-muted-foreground/70 uppercase tracking-[0.1em] mb-3 font-semibold">{t('settings.click_sound')}</p>
                  <div role="radiogroup" className="flex flex-col gap-1.5">
                    {CLICK_SOUND_PRESETS.map((preset) => {
                      const isSelected = clickPreset === preset.id;
                      return (
                        <div
                          key={preset.id}
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={0}
                          onClick={() => {
                            setClickPreset(preset.id);
                            soundEffects.setClickPreset(preset.id);
                            soundEffects.playClick(preset.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setClickPreset(preset.id);
                              soundEffects.setClickPreset(preset.id);
                              soundEffects.playClick(preset.id);
                            }
                          }}
                          className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                            isSelected
                              ? 'bg-primary/10 ring-1 ring-primary/40'
                              : 'hover:bg-muted/15'
                          }`}
                        >
                          <span
                            className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition-colors ${
                              isSelected ? 'border-primary' : 'border-muted-foreground/40 group-hover:border-muted-foreground/70'
                            }`}
                          >
                            {isSelected && <span className="w-2 h-2 rounded-full bg-primary" />}
                          </span>
                          <span className={`flex-1 text-[13px] font-medium ${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                            {preset.label}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              soundEffects.playClick(preset.id);
                            }}
                            aria-label={`Preview ${preset.label}`}
                            className="p-1.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 transition-colors"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-primary" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <SettingRow icon={notificationsEnabled ? Bell : BellOff} label={t('settings.push_notifications')} description={t('settings.push_desc')}>
                <Switch checked={notificationsEnabled} onCheckedChange={handleNotificationToggle} />
              </SettingRow>
            </SectionCard>

            {/* Privacy & Security */}
            <SectionCard title={t('settings.privacy_security')} icon={Shield} delay={0.2}>
              <SettingRow icon={EyeOff} label={t('settings.streamer_mode')} description={t('settings.streamer_desc2')}>
                <Switch checked={streamerMode} onCheckedChange={toggleStreamerMode} />
              </SettingRow>
            </SectionCard>

            {/* Data Management */}
            <SectionCard title={t('settings.data')} icon={Download} delay={0.25}>
              <SettingRow icon={Download} label={t('settings.export_data')} description={t('settings.export_desc2')}>
                <Button
                  size="sm"
                  onClick={exportUserData}
                  disabled={isExporting}
                  className="h-8 text-xs rounded-lg gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isExporting ? t('settings.exporting') : t('settings.export')}
                </Button>
              </SettingRow>
            </SectionCard>

            {/* Danger Zone */}
            <SectionCard title={t('settings.danger_zone')} icon={AlertTriangle} delay={0.3} variant="danger">
              <SettingRow icon={Trash2} iconColor="text-destructive/70" label={t('settings.clear_history')} description={t('settings.clear_desc2')}>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-lg border-destructive/40 text-destructive/90 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/60"
                    >
                      {t('settings.clear')}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        {t('settings.clear_history')}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete your entire search history. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={clearSearchHistory}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Yes, clear history
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </SettingRow>
            </SectionCard>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Settings;
