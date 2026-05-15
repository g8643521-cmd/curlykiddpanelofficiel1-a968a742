import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Search, Download, Star, Compass, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  challenge_type: string;
  target_count: number;
  xp_reward: number;
}

interface ChallengeProgress {
  challenge_id: string;
  progress: number;
  completed: boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Search, Download, Star, Compass, Target,
};

const DailyChallenges = () => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [progress, setProgress] = useState<Record<string, ChallengeProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [timeUntilReset, setTimeUntilReset] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Fetch challenges
      const { data: challengeData } = await supabase
        .from('daily_challenges')
        .select('*')
        .eq('is_active', true);

      if (challengeData) {
        setChallenges(challengeData);
      }

      // Fetch today's progress
      const today = new Date().toISOString().split('T')[0];
      const { data: progressData } = await supabase
        .from('user_daily_progress')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('created_at', today);

      if (progressData) {
        const progressMap: Record<string, ChallengeProgress> = {};
        progressData.forEach((p) => {
          progressMap[p.challenge_id] = p;
        });
        setProgress(progressMap);
      }

      setIsLoading(false);
    };

    fetchData();

    // Update time until reset
    const updateTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeUntilReset(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);

    return () => clearInterval(interval);
  }, []);

  const completedCount = Object.values(progress).filter(p => p.completed).length;
  const totalChallenges = challenges.length;

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <Target className="w-5 h-5 text-[hsl(var(--magenta))]" />
          Daily Challenges
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Resets in {timeUntilReset}</span>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-[hsl(var(--magenta))]/10 to-transparent border border-[hsl(var(--magenta))]/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Today's Progress</span>
          <span className="text-sm font-medium text-foreground">
            {completedCount} / {totalChallenges} Completed
          </span>
        </div>
        <Progress value={(completedCount / totalChallenges) * 100} className="h-2" />
      </div>

      {/* Challenges List */}
      <div className="space-y-3">
        {challenges.map((challenge, index) => {
          const IconComponent = iconMap[challenge.challenge_type] || Target;
          const userProgress = progress[challenge.id];
          const currentProgress = userProgress?.progress || 0;
          const isCompleted = userProgress?.completed || false;
          const progressPercent = Math.min((currentProgress / challenge.target_count) * 100, 100);

          return (
            <motion.div
              key={challenge.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'p-4 rounded-xl border transition-all',
                isCompleted
                  ? 'bg-[hsl(var(--green))]/10 border-[hsl(var(--green))]/30'
                  : 'bg-secondary/30 border-border/50'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                  isCompleted
                    ? 'bg-[hsl(var(--green))]/20'
                    : 'bg-[hsl(var(--magenta))]/20'
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-[hsl(var(--green))]" />
                  ) : (
                    <IconComponent className="w-5 h-5 text-[hsl(var(--magenta))]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className={cn(
                      'font-medium',
                      isCompleted ? 'text-[hsl(var(--green))]' : 'text-foreground'
                    )}>
                      {challenge.title}
                    </h4>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-xs flex-shrink-0',
                        isCompleted 
                          ? 'border-[hsl(var(--green))]/50 text-[hsl(var(--green))]'
                          : 'border-[hsl(var(--yellow))]/50 text-[hsl(var(--yellow))]'
                      )}
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      {challenge.xp_reward} XP
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground mb-2">
                    {challenge.description}
                  </p>

                  <div className="flex items-center gap-2">
                    <Progress value={progressPercent} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {currentProgress} / {challenge.target_count}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {challenges.length === 0 && (
        <p className="text-center text-muted-foreground py-4">
          No challenges available today
        </p>
      )}
    </motion.div>
  );
};

export default DailyChallenges;
