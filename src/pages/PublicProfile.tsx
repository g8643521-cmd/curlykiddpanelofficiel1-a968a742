// @ts-nocheck
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, Calendar, Zap, Award, Crown, Shield, ShieldCheck, User, Lock, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge as BadgeUI } from '@/components/ui/badge';
import ParticleBackground from '@/components/ParticleBackground';
import ProfileActivityFeed from '@/components/ProfileActivityFeed';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import Footer from '@/components/Footer';
import { usePageMeta } from '@/hooks/usePageMeta';

interface PublicProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  accent_color: string | null;
  background_pattern: string | null;
  status_message: string | null;
  status_emoji: string | null;
  level: number;
  xp: number;
  total_searches: number;
  servers_tracked: number;
  created_at: string | null;
  role: string | null;
  show_email: boolean;
  show_stats: boolean;
  show_badges: boolean;
  show_level: boolean;
  show_activity: boolean;
}

type PublicProfileRow = Omit<PublicProfile, 'email' | 'role'> & { email_public: string | null };

const backgroundPatterns: Record<string, string> = {
  none: '',
  dots: 'radial-gradient(circle, hsl(var(--primary)/0.15) 1px, transparent 1px)',
  grid: 'linear-gradient(hsl(var(--primary)/0.1) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.1) 1px, transparent 1px)',
  diagonal: 'repeating-linear-gradient(45deg, hsl(var(--primary)/0.05), hsl(var(--primary)/0.05) 10px, transparent 10px, transparent 20px)',
  waves: 'repeating-linear-gradient(115deg, transparent, transparent 20px, hsl(var(--primary)/0.05) 20px, hsl(var(--primary)/0.05) 40px)',
  circuit: 'linear-gradient(90deg, hsl(var(--primary)/0.1) 1px, transparent 1px), linear-gradient(hsl(var(--primary)/0.1) 1px, transparent 1px)',
};

interface Badge {
  id: string;
  name: string;
  icon: string;
  rarity: string;
  color: string;
}

const accentColors: Record<string, string> = {
  cyan: 'hsl(var(--cyan))',
  magenta: 'hsl(var(--magenta))',
  yellow: 'hsl(var(--yellow))',
  green: 'hsl(var(--green))',
  purple: 'hsl(var(--purple))',
  primary: 'hsl(var(--primary))',
};

const getXpForLevel = (level: number): number => {
  return Math.floor(100 * Math.pow(1.5, level - 1));
};

const PublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const profileName = profile?.display_name || 'Player';
  usePageMeta({
    title: `${profileName} — CurlyKiddPanel Profile`,
    description: `View ${profileName}'s public CurlyKiddPanel profile: badges, activity and FiveM stats.`,
    path: id ? `/user/${id}` : undefined,
    image: profile?.avatar_url || undefined,
    type: 'profile',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      try {
        // Try to fetch by ID first, then by display_name
        let { data, error } = await (supabase as any)
          .from('profiles_public_profile')
          .select('id, display_name, email_public, avatar_url, banner_url, accent_color, background_pattern, status_message, status_emoji, level, xp, total_searches, servers_tracked, created_at, show_email, show_stats, show_badges, show_level, show_activity')
          .eq('id', id)
          .maybeSingle();

        if (!data) {
          // Try by display name
          const result = await (supabase as any)
            .from('profiles_public_profile')
            .select('id, display_name, email_public, avatar_url, banner_url, accent_color, background_pattern, status_message, status_emoji, level, xp, total_searches, servers_tracked, created_at, show_email, show_stats, show_badges, show_level, show_activity')
            .ilike('display_name', id)
            .maybeSingle();
          
          data = result.data;
          error = result.error;
        }

        if (error || !data) {
          setNotFound(true);
        } else {
          const row = data as PublicProfileRow;
          setProfile({
            ...(row as any),
            email: row.email_public,
            role: null,
          } as PublicProfile);
          
          // Fetch user badges
          const { data: userBadges } = await supabase
            .from('user_badges')
            .select('badge_id')
            .eq('user_id', row.id);

          if (userBadges && userBadges.length > 0) {
            const badgeIds = userBadges.map(ub => ub.badge_id);
            const { data: badgeData } = await supabase
              .from('badges')
              .select('id, name, icon, rarity, color')
              .in('id', badgeIds);
            
            if (badgeData) {
              setBadges(badgeData);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen relative">
        <ParticleBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
          <h1 className="font-display text-4xl font-bold text-foreground mb-4">User Not Found</h1>
          <p className="text-muted-foreground mb-6">This profile doesn't exist or has been removed.</p>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const accentColor = accentColors[profile.accent_color || 'cyan'] || accentColors.cyan;
  const xpForLevel = getXpForLevel(profile.level);
  const xpProgress = (profile.xp / xpForLevel) * 100;

  const getRoleInfo = () => {
    switch (profile.role) {
      case 'owner':
        return { icon: Crown, color: 'text-[hsl(var(--yellow))]', name: 'Owner' };
      case 'admin':
        return { icon: Shield, color: 'text-[hsl(var(--magenta))]', name: 'Admin' };
      case 'moderator':
        return { icon: ShieldCheck, color: 'text-[hsl(var(--cyan))]', name: 'Moderator' };
      case 'mod_creator':
        return { icon: Package, color: 'text-[hsl(var(--green))]', name: 'Mod Creator' };
      default:
        return null;
    }
  };

  const roleInfo = getRoleInfo();

  return (
    <div className="min-h-screen relative">
      <ParticleBackground />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 bg-background/50 backdrop-blur-xl">
        <div className="w-full px-4 h-16 flex items-center">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-[hsl(var(--cyan))]/20 flex items-center justify-center border border-primary/30">
                <Server className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <h1 className="font-display text-lg font-bold text-foreground">CurlyKiddPanel</h1>
                <p className="text-xs text-muted-foreground">User Profile</p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto"
        >
          {/* Profile Card */}
          <div 
            className="glass-card overflow-hidden"
            style={{
              backgroundImage: profile.background_pattern && profile.background_pattern !== 'none' 
                ? backgroundPatterns[profile.background_pattern] 
                : undefined,
              backgroundSize: profile.background_pattern === 'dots' ? '20px 20px' 
                : profile.background_pattern === 'grid' || profile.background_pattern === 'circuit' ? '30px 30px' 
                : undefined,
            }}
          >
            {/* Banner */}
            <div 
              className="h-32 md:h-40"
              style={{
                background: profile.banner_url 
                  ? `url(${profile.banner_url}) center/cover` 
                  : `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)`
              }}
            />

            {/* Profile Info */}
            <div className="relative px-4 md:px-6 pb-6">
              {/* Avatar */}
              <div className="absolute -top-16 left-4 md:left-6">
                <div 
                  className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-4 border-background bg-secondary"
                  style={{ boxShadow: `0 0 20px ${accentColor}40` }}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-[hsl(var(--magenta))]/20">
                      <User className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
                {/* Status Indicator */}
                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-[hsl(var(--green))] border-4 border-background" />
              </div>

              {/* Badges Row - Respect privacy */}
              {profile.show_badges && badges.length > 0 && (
                <div className="flex justify-end pt-2">
                  <div className="flex items-center gap-1 p-1.5 rounded-lg bg-background/80">
                    {badges.slice(0, 6).map((badge) => (
                      <Tooltip key={badge.id}>
                        <TooltipTrigger asChild>
                          <div className="w-6 h-6 rounded-md flex items-center justify-center bg-muted/50 border border-muted-foreground/30">
                            <Award className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{badge.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {badges.length > 6 && (
                      <div className="w-6 h-6 rounded-md flex items-center justify-center bg-muted/50 border border-muted-foreground/30 text-xs font-medium text-muted-foreground">
                        +{badges.length - 6}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* User Info - More top margin to clear avatar on all screens */}
              <div className="pt-12">
                <div className="flex items-center gap-2">
                  <h2 
                    className="font-display text-xl md:text-2xl font-bold"
                    style={{ color: accentColor }}
                  >
                    {profile.display_name || 'Anonymous'}
                  </h2>
                  {roleInfo && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn("p-1 rounded", roleInfo.color)}>
                          <roleInfo.icon className="w-4 h-4" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{roleInfo.name}</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Email - Respect privacy */}
                {profile.show_email && profile.email && (
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                )}

                {/* Status Message */}
                {profile.status_message && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                    <span>{profile.status_emoji || '💬'}</span>
                    {profile.status_message}
                  </p>
                )}

                {/* Divider */}
                <div className="my-4 border-t border-border/50" />

                {/* About Section */}
                <div className="space-y-4">
                  {/* Member Since */}
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Member Since
                    </h4>
                    <p className="text-sm text-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      }) : 'Unknown'}
                    </p>
                  </div>

                  {/* Level Progress - Respect privacy */}
                  {profile.show_level && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Level Progress
                      </h4>
                      <div className="flex items-center gap-3">
                        <div 
                          className="px-2.5 py-1 rounded-md font-display font-bold text-sm text-primary-foreground"
                          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}80)` }}
                        >
                          Lv.{profile.level}
                        </div>
                        <div className="flex-1 space-y-1">
                          <Progress value={xpProgress} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-[hsl(var(--yellow))]" />
                              {profile.xp} XP
                            </span>
                            <span>{xpForLevel} XP</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stats Grid - Respect privacy */}
                  {profile.show_stats && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-lg font-display font-bold text-primary">{profile.total_searches}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Searches</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-lg font-display font-bold text-[hsl(var(--magenta))]">{profile.servers_tracked}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Tracked</div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <div className="text-lg font-display font-bold text-[hsl(var(--yellow))]">{badges.length}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">Badges</div>
                      </div>
                    </div>
                  )}

                  {/* Hidden Content Notice */}
                  {(!profile.show_stats || !profile.show_level) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-muted/20">
                      <Lock className="w-3.5 h-3.5" />
                      Some information is hidden by this user
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Activity Feed - Respect privacy */}
          {profile.show_activity && (
            <div className="mt-6">
              <ProfileActivityFeed userId={profile.id} limit={5} />
            </div>
          )}
        </motion.div>
      </main>

      <Footer />
    </div>
  );
};

export default PublicProfile;