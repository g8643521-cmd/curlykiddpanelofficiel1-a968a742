import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Camera, Edit2, Save, X, Crown, Shield, ShieldCheck, Star, Search, Compass,
  Eye, Target, Download, Moon, Sun, Award, Sparkles, Zap, Calendar, ImagePlus, Bug,
  Heart, Globe, Rocket, Clock, Users, Map, Gem, Gift, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge as BadgeUI } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserProfile, Badge, getXpForLevel } from '@/hooks/useUserProfile';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import ProfileCustomization from '@/components/ProfileCustomization';

const accentColorMap: Record<string, string> = {
  cyan: 'hsl(var(--cyan))',
  magenta: 'hsl(var(--magenta))',
  yellow: 'hsl(var(--yellow))',
  green: 'hsl(var(--green))',
  purple: 'hsl(var(--purple))',
  primary: 'hsl(var(--primary))',
};

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Search, Compass, Star, Eye, Target, Download, Moon, Sun, Shield, Crown,
  Bug, Heart, Globe, Rocket, Clock, Users, Map, Gem, Gift, Award,
};

const rarityColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  common: {
    bg: 'bg-muted/50',
    border: 'border-muted-foreground/30',
    text: 'text-muted-foreground',
    glow: '',
  },
  rare: {
    bg: 'bg-[hsl(var(--cyan))]/10',
    border: 'border-[hsl(var(--cyan))]/50',
    text: 'text-[hsl(var(--cyan))]',
    glow: 'shadow-[0_0_15px_hsl(var(--cyan)/0.3)]',
  },
  epic: {
    bg: 'bg-[hsl(var(--purple))]/10',
    border: 'border-[hsl(var(--purple))]/50',
    text: 'text-[hsl(var(--purple))]',
    glow: 'shadow-[0_0_20px_hsl(var(--purple)/0.4)]',
  },
  legendary: {
    bg: 'bg-[hsl(var(--yellow))]/10',
    border: 'border-[hsl(var(--yellow))]/50',
    text: 'text-[hsl(var(--yellow))]',
    glow: 'shadow-[0_0_25px_hsl(var(--yellow)/0.5)]',
  },
};

// Discord-style small badge icon for the badge row
const SmallBadgeIcon = ({ badge, earned = false }: { badge: Badge; earned?: boolean }) => {
  const IconComponent = iconMap[badge.icon] || Award;
  const colors = rarityColors[badge.rarity];

  if (!earned) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.2, y: -2 }}
          className={cn(
            'w-6 h-6 rounded-md flex items-center justify-center cursor-pointer transition-all',
            colors.bg,
            'border',
            colors.border,
            colors.glow
          )}
        >
          <IconComponent className={cn('w-3.5 h-3.5', colors.text)} />
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px]">
        <div className="space-y-1">
          <p className="font-semibold">{badge.name}</p>
          <p className="text-xs text-muted-foreground">{badge.description}</p>
          <div className="flex items-center gap-2 pt-1">
            <BadgeUI variant="outline" className={cn('text-xs capitalize', colors.text)}>
              {badge.rarity}
            </BadgeUI>
            <span className="text-xs text-[hsl(var(--yellow))]">+{badge.xp_required} XP</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

// Full badge card for the badges section
const BadgeCard = ({ badge, earned = false }: { badge: Badge; earned?: boolean }) => {
  const IconComponent = iconMap[badge.icon] || Award;
  const colors = rarityColors[badge.rarity];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            'relative p-3 rounded-xl border-2 cursor-pointer transition-all duration-300',
            colors.bg,
            colors.border,
            earned ? colors.glow : 'opacity-40 grayscale',
            'group'
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              earned ? colors.bg : 'bg-muted/30'
            )}>
              <IconComponent className={cn('w-5 h-5', earned ? colors.text : 'text-muted-foreground/50')} />
            </div>
            <span className={cn(
              'text-xs font-medium text-center line-clamp-2',
              earned ? 'text-foreground' : 'text-muted-foreground/50'
            )}>
              {badge.name}
            </span>
          </div>
          {earned && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[hsl(var(--green))] flex items-center justify-center"
            >
              <Sparkles className="w-2.5 h-2.5 text-background" />
            </motion.div>
          )}
          {badge.rarity === 'legendary' && earned && (
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[hsl(var(--yellow))/0.1] to-transparent animate-shimmer" />
            </div>
          )}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px]">
        <div className="space-y-1">
          <p className="font-semibold">{badge.name}</p>
          <p className="text-xs text-muted-foreground">{badge.description}</p>
          <div className="flex items-center gap-2 pt-1">
            <BadgeUI variant="outline" className={cn('text-xs capitalize', colors.text)}>
              {badge.rarity}
            </BadgeUI>
            <span className="text-xs text-[hsl(var(--yellow))]">+{badge.xp_required} XP</span>
          </div>
          {earned && badge.earned_at && (
            <p className="text-xs text-muted-foreground pt-1">
              Earned {new Date(badge.earned_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

const UserProfile = () => {
  const {
    profile,
    badges,
    earnedBadges,
    isLoading,
    isUploading,
    uploadAvatar,
    updateDisplayName,
    refetch,
  } = useUserProfile();
  const { isOwner, isAdmin, isModerator } = useAdminStatus();

  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const xpForCurrentLevel = getXpForLevel(profile.level);
  const xpProgress = (profile.xp / xpForCurrentLevel) * 100;
  const earnedBadgeIds = new Set(earnedBadges.map(b => b.id));
  
  // Get accent color
  const accentColor = accentColorMap[(profile as any).accent_color || 'cyan'] || accentColorMap.cyan;

  // Get top 8 earned badges for display in profile header
  const displayBadges = earnedBadges.slice(0, 8);

  const getNameColor = () => {
    // Use custom accent color, or role color as fallback
    if ((profile as any).accent_color && (profile as any).accent_color !== 'primary') {
      return { color: accentColor };
    }
    if (isOwner) return { color: 'hsl(var(--yellow))' };
    if (isAdmin) return { color: 'hsl(var(--magenta))' };
    if (isModerator) return { color: 'hsl(var(--cyan))' };
    return {};
  };

  const getRoleIcon = () => {
    if (isOwner) return <Crown className="w-4 h-4" />;
    if (isAdmin) return <Shield className="w-4 h-4" />;
    if (isModerator) return <ShieldCheck className="w-4 h-4" />;
    return null;
  };

  const getRoleName = () => {
    if (isOwner) return 'Owner';
    if (isAdmin) return 'Admin';
    if (isModerator) return 'Moderator';
    return 'Member';
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleBannerClick = () => {
    bannerInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const result = await uploadAvatar(file);
    if (result) {
      toast.success('Avatar updated successfully!');
    } else {
      toast.error('Failed to upload avatar');
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Banner must be less than 10MB');
      return;
    }

    setIsUploadingBanner(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `banner.${fileExt}`;
      // Use user's folder to match existing RLS policy
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with banner URL in database (add timestamp to prevent caching)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ banner_url: `${publicUrl}?t=${Date.now()}` })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      toast.success('Banner updated successfully!');
      refetch();
    } catch (error) {
      console.error('Banner upload error:', error);
      toast.error('Failed to upload banner');
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    const success = await updateDisplayName(newName.trim());
    if (success) {
      toast.success('Display name updated!');
      setIsEditing(false);
    } else {
      toast.error('Failed to update name');
    }
  };

  // Use banner from database or fallback to gradient with accent color
  const bannerUrl = profile.banner_url;

  return (
    <div className="space-y-6">
      {/* Discord-style Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden"
      >
        {/* Banner Section */}
        <div 
          className="relative h-32 md:h-40 group cursor-pointer"
          onClick={handleBannerClick}
        >
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt="Profile Banner"
              className="w-full h-full object-cover"
            />
          ) : (
            <div 
              className="w-full h-full" 
              style={{ background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)` }}
            />
          )}
          {/* Banner overlay on hover */}
          <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {isUploadingBanner ? (
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            ) : (
              <div className="flex items-center gap-2 text-foreground">
                <ImagePlus className="w-5 h-5" />
                <span className="text-sm font-medium">Change Banner</span>
              </div>
            )}
          </div>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerChange}
            className="hidden"
          />
        </div>

        {/* Profile Info Section */}
        <div className="relative px-4 md:px-6 pb-6">
          {/* Avatar - positioned to overlap banner */}
          <div className="absolute -top-16 left-4 md:left-6">
            <div className="relative group">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="relative w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-4 border-background bg-secondary cursor-pointer"
                onClick={handleAvatarClick}
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
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-foreground" />
                  )}
                </div>
              </motion.div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {/* Online Status Indicator - Dynamic based on session */}
              <div className={`absolute bottom-1 right-1 w-5 h-5 rounded-full border-4 border-background ${profile ? 'bg-[hsl(var(--green))]' : 'bg-destructive'}`} />
            </div>
          </div>

          {/* Discord-style Badges Row (top right) */}
          <div className="flex justify-end pt-2">
            <div className="flex items-center gap-1 p-1.5 rounded-lg bg-background/80">
              {displayBadges.map((badge) => (
                <SmallBadgeIcon key={badge.id} badge={badge} earned={true} />
              ))}
              {earnedBadges.length > 8 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-6 h-6 rounded-md flex items-center justify-center bg-muted/50 border border-muted-foreground/30 cursor-pointer text-xs font-medium text-muted-foreground">
                      +{earnedBadges.length - 8}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{earnedBadges.length - 8} more badges</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {/* User Info - Reduced margin for own profile */}
          <div className="mt-10 md:mt-8">
            {/* Name and Role Row */}
            <div className="flex flex-col gap-1">
              <AnimatePresence mode="wait">
                {isEditing ? (
                  <motion.div
                    key="editing"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Enter new name"
                      className="max-w-[200px]"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={handleSaveName}>
                      <Save className="w-4 h-4 text-[hsl(var(--green))]" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)}>
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="display"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center gap-2"
                  >
                    <h2 className="font-display text-xl md:text-2xl font-bold" style={getNameColor()}>
                      {profile.display_name || 'Anonymous'}
                    </h2>
                    {getRoleIcon() && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="p-1 rounded" style={{ color: accentColor }}>
                            {getRoleIcon()}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{getRoleName()}</TooltipContent>
                      </Tooltip>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => {
                        setNewName(profile.display_name || '');
                        setIsEditing(true);
                      }}
                    >
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status Message */}
              {(profile as any).status_message ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <span>{(profile as any).status_emoji || '💬'}</span>
                  {(profile as any).status_message}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {profile.email}
                </p>
              )}

              {/* Customize Button */}
              <div className="mt-2">
                <ProfileCustomization
                  profileId={profile.id}
                  currentAccentColor={(profile as any).accent_color || 'cyan'}
                  currentBackgroundPattern={(profile as any).background_pattern || 'none'}
                  currentStatusMessage={(profile as any).status_message}
                  currentStatusEmoji={(profile as any).status_emoji}
                  onUpdate={refetch}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="my-4 border-t border-border/50" />

            {/* About Me / Stats Section */}
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

              {/* XP Progress */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Level Progress
                </h4>
                <div className="flex items-center gap-3">
                  <div className="px-2.5 py-1 rounded-md bg-gradient-to-r from-primary to-[hsl(var(--cyan-glow))] text-primary-foreground font-display font-bold text-sm">
                    Lv.{profile.level}
                  </div>
                  <div className="flex-1 space-y-1">
                    <Progress value={xpProgress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-[hsl(var(--yellow))]" />
                        {profile.xp} XP
                      </span>
                      <span>{xpForCurrentLevel} XP</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2">
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <div className="text-lg font-display font-bold text-primary">{profile.total_searches}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Searches</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <div className="text-lg font-display font-bold text-[hsl(var(--magenta))]">{profile.servers_tracked}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Tracked</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <div className="text-lg font-display font-bold text-[hsl(var(--yellow))]">{earnedBadges.length}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Badges</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <div className="text-lg font-display font-bold text-[hsl(var(--green))]">{profile.level}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Level</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
};

export default UserProfile;
