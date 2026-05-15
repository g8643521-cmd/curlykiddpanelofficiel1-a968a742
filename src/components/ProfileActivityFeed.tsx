import { useEffect, useState, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Star, Award, TrendingUp, Calendar, Clock, 
  Download, Eye, MessageSquare, Trophy, Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  activity_type: string;
  created_at: string;
  user_id: string;
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  search: Search,
  favorite: Star,
  badge: Award,
  level_up: TrendingUp,
  challenge: Trophy,
  export: Download,
  track: Eye,
  rating: MessageSquare,
  login: Calendar,
  xp: Zap,
};

const activityColors: Record<string, string> = {
  search: 'text-[hsl(var(--cyan))]',
  favorite: 'text-[hsl(var(--yellow))]',
  badge: 'text-[hsl(var(--purple))]',
  level_up: 'text-[hsl(var(--green))]',
  challenge: 'text-[hsl(var(--magenta))]',
  export: 'text-[hsl(var(--cyan))]',
  track: 'text-[hsl(var(--magenta))]',
  rating: 'text-[hsl(var(--yellow))]',
  login: 'text-muted-foreground',
  xp: 'text-[hsl(var(--yellow))]',
};

interface ProfileActivityFeedProps {
  userId?: string;
  limit?: number;
  showTitle?: boolean;
}

const ProfileActivityFeed = memo(({ userId, limit = 10, showTitle = true }: ProfileActivityFeedProps) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      setIsLoading(true);
      try {
        let targetUserId = userId;
        
        if (!targetUserId) {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setIsLoading(false);
            return;
          }
          targetUserId = session.user.id;
        }

        const { data, error } = await supabase
          .from('user_activity')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        setActivities(data || []);
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, [userId, limit]);

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return then.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="glass-card p-6">
        {showTitle && (
          <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            Recent Activity
          </h3>
        )}
        <p className="text-sm text-muted-foreground text-center py-4">
          No recent activity yet
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      {showTitle && (
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          Recent Activity
        </h3>
      )}

      <div className="space-y-3">
        {activities.map((activity, index) => {
          const IconComponent = activityIcons[activity.activity_type] || Zap;
          const colorClass = activityColors[activity.activity_type] || 'text-muted-foreground';

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className={cn('p-2 rounded-lg bg-background/50', colorClass)}>
                <IconComponent className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {activity.activity_type.replace(/_/g, ' ')}
                </p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatTimeAgo(activity.created_at)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

ProfileActivityFeed.displayName = 'ProfileActivityFeed';

export default ProfileActivityFeed;