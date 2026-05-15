// @ts-nocheck
import { useState, useEffect, memo, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Search, Star, Award, TrendingUp, Trophy, Download, Eye, MessageSquare, Zap, Calendar, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { useFriendSystem } from '@/hooks/useFriendSystem';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface FriendActivity {
  id: string;
  user_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  metadata: unknown;
  created_at: string;
  user: {
    display_name: string | null;
    avatar_url: string | null;
  };
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

const activityColors: Record<string, { bg: string; text: string; glow: string }> = {
  search: { bg: 'bg-[hsl(var(--cyan))]/10', text: 'text-[hsl(var(--cyan))]', glow: 'shadow-[0_0_12px_hsl(var(--cyan)/0.3)]' },
  favorite: { bg: 'bg-[hsl(var(--yellow))]/10', text: 'text-[hsl(var(--yellow))]', glow: 'shadow-[0_0_12px_hsl(var(--yellow)/0.3)]' },
  badge: { bg: 'bg-[hsl(var(--purple))]/10', text: 'text-[hsl(var(--purple))]', glow: 'shadow-[0_0_12px_hsl(var(--purple)/0.3)]' },
  level_up: { bg: 'bg-[hsl(var(--green))]/10', text: 'text-[hsl(var(--green))]', glow: 'shadow-[0_0_12px_hsl(var(--green)/0.3)]' },
  challenge: { bg: 'bg-[hsl(var(--magenta))]/10', text: 'text-[hsl(var(--magenta))]', glow: 'shadow-[0_0_12px_hsl(var(--magenta)/0.3)]' },
  export: { bg: 'bg-[hsl(var(--cyan))]/10', text: 'text-[hsl(var(--cyan))]', glow: 'shadow-[0_0_12px_hsl(var(--cyan)/0.3)]' },
  track: { bg: 'bg-[hsl(var(--magenta))]/10', text: 'text-[hsl(var(--magenta))]', glow: 'shadow-[0_0_12px_hsl(var(--magenta)/0.3)]' },
  rating: { bg: 'bg-[hsl(var(--yellow))]/10', text: 'text-[hsl(var(--yellow))]', glow: 'shadow-[0_0_12px_hsl(var(--yellow)/0.3)]' },
  login: { bg: 'bg-muted/30', text: 'text-muted-foreground', glow: '' },
  xp: { bg: 'bg-[hsl(var(--yellow))]/10', text: 'text-[hsl(var(--yellow))]', glow: 'shadow-[0_0_12px_hsl(var(--yellow)/0.3)]' },
};

const FriendsActivityFeed = memo(({ limit = 10 }: { limit?: number }) => {
  const navigate = useNavigate();
  const { friends } = useFriendSystem();
  const [activities, setActivities] = useState<FriendActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const fetchFriendsActivity = async () => {
      if (friends.length === 0) {
        setActivities([]);
        setIsLoading(false);
        return;
      }

      const friendIds = friends.map(f => f.id);

      const { data, error } = await supabase
        .from('user_activity')
        .select(`
          id,
          user_id,
          activity_type,
          title,
          description,
          metadata,
          created_at
        `)
        .in('user_id', friendIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to fetch friends activity:', error);
        setIsLoading(false);
        return;
      }

      const userIds = [...new Set(data?.map(a => a.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles_public_profile')
        .select('id, display_name, avatar_url, show_activity')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const activitiesWithUsers = (data || [])
        .filter(activity => {
          const profile = profileMap.get(activity.user_id);
          return profile?.show_activity !== false;
        })
        .map(activity => ({
          ...activity,
          user: {
            display_name: profileMap.get(activity.user_id)?.display_name || null,
            avatar_url: profileMap.get(activity.user_id)?.avatar_url || null,
          },
        }));

      setActivities(activitiesWithUsers);
      setIsLoading(false);
    };

    fetchFriendsActivity();
  }, [friends, limit]);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/10 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--magenta))]/20 to-[hsl(var(--purple))]/20 flex items-center justify-center border border-[hsl(var(--magenta))]/30">
              <Activity className="h-5 w-5 text-[hsl(var(--magenta))]" />
            </div>
            {activities.length > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-[hsl(var(--magenta))] rounded-full flex items-center justify-center shadow-[0_0_10px_hsl(var(--magenta)/0.5)]">
                <span className="text-[10px] font-bold text-white">{activities.length}</span>
              </div>
            )}
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Friends Activity</h3>
            <p className="text-xs text-muted-foreground">
              {activities.length > 0 ? `${activities.length} recent updates` : 'Recent activity from friends'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/50"
          >
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-muted-foreground font-medium">
                    {friends.length === 0 ? 'Add friends to see their activity' : 'No recent activity from friends'}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Activity will appear here when your friends are active</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  <AnimatePresence mode="popLayout">
                    {activities.map((activity, index) => {
                      const IconComponent = activityIcons[activity.activity_type] || Activity;
                      const colors = activityColors[activity.activity_type] || { bg: 'bg-muted/30', text: 'text-muted-foreground', glow: '' };

                      return (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ delay: index * 0.03, duration: 0.2 }}
                          className="group relative flex items-start gap-4 p-3 rounded-xl bg-secondary/5 hover:bg-secondary/15 border border-transparent hover:border-border/50 transition-all duration-200"
                        >
                          {/* Timeline connector */}
                          {index < activities.length - 1 && (
                            <div className="absolute left-[27px] top-[52px] w-0.5 h-[calc(100%-20px)] bg-gradient-to-b from-border/50 to-transparent" />
                          )}

                          {/* Avatar */}
                          <button
                            onClick={() => navigate(`/user/${activity.user_id}`)}
                            className="relative shrink-0 group/avatar"
                          >
                            <Avatar className="h-10 w-10 border-2 border-border/50 group-hover/avatar:border-primary/50 transition-colors">
                              <AvatarImage src={activity.user.avatar_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {activity.user.display_name?.[0]?.toUpperCase() || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${colors.bg} border-2 border-background flex items-center justify-center ${colors.glow}`}>
                              <IconComponent className={`h-2.5 w-2.5 ${colors.text}`} />
                            </div>
                          </button>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-center gap-2 mb-0.5">
                              <button 
                                onClick={() => navigate(`/user/${activity.user_id}`)}
                                className="font-semibold text-foreground hover:text-primary transition-colors truncate"
                              >
                                {activity.user.display_name || 'Unknown'}
                              </button>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/80 leading-relaxed">{activity.title}</p>
                            {activity.description && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">{activity.description}</p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

FriendsActivityFeed.displayName = 'FriendsActivityFeed';

export default FriendsActivityFeed;
