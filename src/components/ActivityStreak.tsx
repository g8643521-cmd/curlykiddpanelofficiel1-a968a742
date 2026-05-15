import { memo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Flame, Calendar, Gift, Zap, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type StreakData = {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  total_active_days: number;
};

const MILESTONE_REWARDS = [
  { days: 3, xp: 25, label: '3-day streak' },
  { days: 7, xp: 50, label: 'Weekly warrior' },
  { days: 14, xp: 100, label: '2 weeks strong' },
  { days: 30, xp: 200, label: 'Monthly master' },
  { days: 100, xp: 500, label: 'Legend status' },
];

const ActivityStreak = () => {
  const [streakData, setStreakData] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [claimedToday, setClaimedToday] = useState(false);

  const fetchStreakData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Get user's activity logs to calculate streak
      const { data: activities } = await supabase
        .from('user_activity')
        .select('created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(365);

      if (!activities || activities.length === 0) {
        setStreakData({
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null,
          total_active_days: 0,
        });
        setIsLoading(false);
        return;
      }

      // Calculate unique active days
      const activeDays = new Set<string>();
      activities.forEach(a => {
        const date = new Date(a.created_at).toISOString().split('T')[0];
        activeDays.add(date);
      });

      // Calculate current streak
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      let currentStreak = 0;
      let checkDate = activeDays.has(today) ? today : yesterday;
      
      if (activeDays.has(today) || activeDays.has(yesterday)) {
        while (activeDays.has(checkDate)) {
          currentStreak++;
          const prevDate = new Date(checkDate);
          prevDate.setDate(prevDate.getDate() - 1);
          checkDate = prevDate.toISOString().split('T')[0];
        }
      }

      // Calculate longest streak
      const sortedDays = Array.from(activeDays).sort();
      let longestStreak = 0;
      let tempStreak = 1;

      for (let i = 1; i < sortedDays.length; i++) {
        const prevDate = new Date(sortedDays[i - 1]);
        const currDate = new Date(sortedDays[i]);
        const diffDays = (currDate.getTime() - prevDate.getTime()) / 86400000;

        if (diffDays === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);

      setStreakData({
        current_streak: currentStreak,
        longest_streak: longestStreak,
        last_activity_date: activities[0]?.created_at || null,
        total_active_days: activeDays.size,
      });

      // Check if already active today
      setClaimedToday(activeDays.has(today));
    } catch (error) {
      console.error('Error fetching streak data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStreakData();
  }, [fetchStreakData]);

  const handleClaimDaily = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Log daily check-in activity
      await supabase.from('user_activity').insert({
        user_id: session.user.id,
        activity_type: 'daily_checkin',
        title: 'Daily check-in',
        description: 'Check-in to maintain streak',
      });

      setClaimedToday(true);
      toast.success('Daily check-in recorded! 🔥');
      fetchStreakData();
    } catch (error) {
      console.error('Error claiming daily:', error);
      toast.error('Could not record check-in');
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-[hsl(var(--orange))]" />
          <h3 className="font-display font-semibold text-foreground">Activity Streak</h3>
        </div>
        <div className="h-32 rounded-lg bg-secondary/50 animate-pulse" />
      </div>
    );
  }

  if (!streakData) return null;

  const nextMilestone = MILESTONE_REWARDS.find(m => m.days > streakData.current_streak);
  const progressToNext = nextMilestone 
    ? (streakData.current_streak / nextMilestone.days) * 100 
    : 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <h3 className="font-display font-semibold text-foreground">Activity Streak</h3>
        </div>
        {!claimedToday && (
          <Button size="sm" onClick={handleClaimDaily} className="gap-2">
            <Gift className="w-4 h-4" />
            Check-in
          </Button>
        )}
        {claimedToday && (
          <Badge className="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/30">
            ✓ Active today
          </Badge>
        )}
      </div>

      {/* Streak Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30">
          <motion.div
            key={streakData.current_streak}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            className="text-3xl font-bold text-orange-500"
          >
            {streakData.current_streak}
          </motion.div>
          <p className="text-xs text-muted-foreground mt-1">Current</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="text-2xl font-bold text-[hsl(var(--yellow))]">
            {streakData.longest_streak}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Longest</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-secondary/30 border border-border/50">
          <div className="text-2xl font-bold text-[hsl(var(--cyan))]">
            {streakData.total_active_days}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Active days</p>
        </div>
      </div>

      {/* Next Milestone */}
      {nextMilestone && (
        <div className="p-4 rounded-lg bg-secondary/20 border border-border/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[hsl(var(--yellow))]" />
              <span className="text-sm font-medium text-foreground">Next milestone</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[hsl(var(--yellow))]" />
              <span className="text-sm font-semibold text-[hsl(var(--yellow))]">+{nextMilestone.xp} XP</span>
            </div>
          </div>
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{streakData.current_streak} days</span>
              <span>{nextMilestone.days} days - {nextMilestone.label}</span>
            </div>
            <Progress value={progressToNext} className="h-2" />
          </div>
        </div>
      )}

      {/* Milestone badges */}
      <div className="flex flex-wrap gap-2 mt-4">
        {MILESTONE_REWARDS.map((milestone) => (
          <Badge
            key={milestone.days}
            variant="outline"
            className={
              streakData.current_streak >= milestone.days
                ? 'bg-[hsl(var(--green))]/10 text-[hsl(var(--green))] border-[hsl(var(--green))]/30'
                : 'opacity-50'
            }
          >
            {milestone.days}d
          </Badge>
        ))}
      </div>
    </motion.div>
  );
};

export default memo(ActivityStreak);
