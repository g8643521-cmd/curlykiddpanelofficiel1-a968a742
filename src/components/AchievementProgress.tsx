import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  Lock,
  Search,
  Star,
  Target,
  Trophy,
  Zap,
  Users,
  Clock,
  Gift,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useUserProfile } from '@/hooks/useUserProfile';
import { cn } from '@/lib/utils';

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: any;
  requirement: number;
  currentValue: number;
  xpReward: number;
  color: string;
  isCompleted: boolean;
};

const AchievementProgress = () => {
  const { profile, earnedBadges, isLoading } = useUserProfile();

  const achievements = useMemo((): Achievement[] => {
    if (!profile) return [];

    const totalSearches = profile.total_searches || 0;
    const serversTracked = profile.servers_tracked || 0;
    const badgeCount = earnedBadges.length;
    const level = profile.level || 1;

    return [
      {
        id: 'first_search',
        name: 'First Search',
        description: 'Perform your first server search',
        icon: Search,
        requirement: 1,
        currentValue: totalSearches,
        xpReward: 10,
        color: 'cyan',
        isCompleted: totalSearches >= 1,
      },
      {
        id: 'search_veteran',
        name: 'Search Veteran',
        description: 'Perform 50 server searches',
        icon: Search,
        requirement: 50,
        currentValue: Math.min(totalSearches, 50),
        xpReward: 100,
        color: 'cyan',
        isCompleted: totalSearches >= 50,
      },
      {
        id: 'server_tracker',
        name: 'Server Tracker',
        description: 'Track 10 different servers',
        icon: Target,
        requirement: 10,
        currentValue: Math.min(serversTracked, 10),
        xpReward: 50,
        color: 'green',
        isCompleted: serversTracked >= 10,
      },
      {
        id: 'badge_collector',
        name: 'Badge Collector',
        description: 'Earn 5 badges',
        icon: Award,
        requirement: 5,
        currentValue: Math.min(badgeCount, 5),
        xpReward: 75,
        color: 'yellow',
        isCompleted: badgeCount >= 5,
      },
      {
        id: 'level_master',
        name: 'Level Master',
        description: 'Reach level 10',
        icon: Trophy,
        requirement: 10,
        currentValue: Math.min(level, 10),
        xpReward: 150,
        color: 'magenta',
        isCompleted: level >= 10,
      },
      {
        id: 'search_master',
        name: 'Search Master',
        description: 'Perform 200 server searches',
        icon: Zap,
        requirement: 200,
        currentValue: Math.min(totalSearches, 200),
        xpReward: 300,
        color: 'purple',
        isCompleted: totalSearches >= 200,
      },
    ];
  }, [profile, earnedBadges]);

  const completedCount = achievements.filter(a => a.isCompleted).length;
  const overallProgress = (completedCount / achievements.length) * 100;

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-[hsl(var(--yellow))]" />
          <h3 className="font-display font-semibold text-foreground">Achievement Fremskridt</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-secondary/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const colorMap: Record<string, string> = {
    cyan: 'hsl(var(--cyan))',
    green: 'hsl(var(--green))',
    yellow: 'hsl(var(--yellow))',
    magenta: 'hsl(var(--magenta))',
    purple: 'hsl(var(--purple))',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[hsl(var(--yellow))]" />
          <h3 className="font-display font-semibold text-foreground">Achievement Fremskridt</h3>
        </div>
        <Badge variant="outline" className="text-[hsl(var(--yellow))]">
          {completedCount}/{achievements.length}
        </Badge>
      </div>

      {/* Overall Progress */}
      <div className="mb-4 p-3 rounded-lg bg-secondary/20 border border-border/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Samlet fremskridt</span>
          <span className="text-sm text-[hsl(var(--yellow))]">{Math.round(overallProgress)}%</span>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {/* Achievement List */}
      <div className="space-y-3">
        {achievements.map((achievement, index) => {
          const Icon = achievement.icon as React.ComponentType<{ className?: string }>;
          const progress = (achievement.currentValue / achievement.requirement) * 100;
          const color = colorMap[achievement.color];

          return (
            <motion.div
              key={achievement.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'p-3 rounded-lg border transition-all',
                achievement.isCompleted
                  ? 'bg-[hsl(var(--green))]/10 border-[hsl(var(--green))]/30'
                  : 'bg-secondary/20 border-border/30'
              )}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    achievement.isCompleted ? 'bg-[hsl(var(--green))]/20' : 'bg-secondary/50'
                  )}
                  style={{ color: achievement.isCompleted ? 'hsl(var(--green))' : color }}
                >
                  {achievement.isCompleted ? (
                    <Trophy className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-sm font-medium',
                      achievement.isCompleted ? 'text-[hsl(var(--green))]' : 'text-foreground'
                    )}>
                      {achievement.name}
                    </span>
                    {!achievement.isCompleted && (
                      <Badge variant="outline" className="text-xs" style={{ color }}>
                        +{achievement.xpReward} XP
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  
                  {!achievement.isCompleted && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>{achievement.currentValue} / {achievement.requirement}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  )}
                </div>

                {/* Status */}
                {achievement.isCompleted && (
                  <Badge className="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/30">
                    ✓ Completed
                  </Badge>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default memo(AchievementProgress);
