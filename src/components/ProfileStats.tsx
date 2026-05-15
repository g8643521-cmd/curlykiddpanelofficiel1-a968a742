import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Search,
  Star,
  Trophy,
  TrendingUp,
  Users,
  Server,
  Calendar,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useUserProfile } from '@/hooks/useUserProfile';

const StatCard = memo(({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color,
  delay 
}: { 
  icon: any; 
  label: string; 
  value: string | number;
  subValue?: string;
  color: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="glass-card p-4 group hover:border-primary/30 transition-colors"
  >
    <div className="flex items-start justify-between">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
    </div>
    <div className="mt-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {subValue && (
        <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>
      )}
    </div>
  </motion.div>
));
StatCard.displayName = 'StatCard';

const ProfileStats = () => {
  const { profile, earnedBadges, isLoading } = useUserProfile();

  const stats = useMemo(() => {
    if (!profile) return null;

    const totalSearches = profile.total_searches || 0;
    const serversTracked = profile.servers_tracked || 0;
    const badgeCount = earnedBadges.length;
    const level = profile.level || 1;
    const xp = profile.xp || 0;

    // Calculate rank based on level
    let rank = 'Begynder';
    if (level >= 50) rank = 'Legende';
    else if (level >= 30) rank = 'Ekspert';
    else if (level >= 20) rank = 'Veteran';
    else if (level >= 10) rank = 'Erfaren';
    else if (level >= 5) rank = 'Novice';

    // Calculate activity score (0-100)
    const activityScore = Math.min(100, Math.round(
      (totalSearches * 0.5 + serversTracked * 2 + badgeCount * 5 + level * 3) / 2
    ));

    return {
      totalSearches,
      serversTracked,
      badgeCount,
      level,
      xp,
      rank,
      activityScore,
    };
  }, [profile, earnedBadges]);

  if (isLoading || !stats) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Statistik</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-secondary/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Statistik</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rang:</span>
          <span className="text-sm font-semibold text-primary">{stats.rank}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={Search}
          label="Searches"
          value={stats.totalSearches}
          subValue="Total performed"
          color="bg-[hsl(var(--cyan))]/20 text-[hsl(var(--cyan))]"
          delay={0}
        />
        <StatCard
          icon={Server}
          label="Servers"
          value={stats.serversTracked}
          subValue="Tracked total"
          color="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))]"
          delay={0.1}
        />
        <StatCard
          icon={Trophy}
          label="Badges"
          value={stats.badgeCount}
          subValue="Earned"
          color="bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))]"
          delay={0.2}
        />
        <StatCard
          icon={TrendingUp}
          label="Level"
          value={stats.level}
          subValue={`${stats.xp} XP`}
          color="bg-[hsl(var(--magenta))]/20 text-[hsl(var(--magenta))]"
          delay={0.3}
        />
      </div>

      {/* Activity Score */}
      <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-[hsl(var(--yellow))]" />
            <span className="text-sm font-medium text-foreground">Activity Score</span>
          </div>
          <span className="text-lg font-bold text-[hsl(var(--yellow))]">{stats.activityScore}/100</span>
        </div>
        <Progress value={stats.activityScore} className="h-2" />
        <p className="text-xs text-muted-foreground mt-2">
          Based on searches, tracked servers, badges and level
        </p>
      </div>
    </div>
  );
};

export default memo(ProfileStats);
