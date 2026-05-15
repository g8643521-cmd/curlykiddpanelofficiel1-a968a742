import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Medal, Zap, Search, Star, Crown, Shield, ShieldCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface LeaderboardEntry {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  xp: number;
  total_searches: number;
  servers_tracked: number;
}

interface LeaderboardBan {
  user_id: string;
}

interface UserRole {
  user_id: string;
  role: 'admin' | 'moderator' | 'user' | 'owner';
}

type SortField = 'level' | 'total_searches' | 'servers_tracked';

const Leaderboard = () => {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [bannedUserIds, setBannedUserIds] = useState<Set<string>>(new Set());
  const [userRolesMap, setUserRolesMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>('level');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id || null);

      // Fetch banned users and user roles in parallel
      const [bansResult, rolesResult, profilesResult] = await Promise.all([
        supabase.from('leaderboard_bans').select('user_id'),
        supabase.from('user_roles').select('user_id, role'),
        (supabase as any)
          .from('profiles_public')
          .select('id, display_name, avatar_url, level, xp, total_searches, servers_tracked')
          .order(sortBy, { ascending: false })
          .limit(50),
      ]);

      const bannedIds = new Set<string>((bansResult.data || []).map((b: LeaderboardBan) => b.user_id));
      setBannedUserIds(bannedIds);

      // Build user roles map
      const rolesMap = new Map<string, string>();
      (rolesResult.data || []).forEach((r: UserRole) => {
        rolesMap.set(r.user_id, r.role);
      });
      setUserRolesMap(rolesMap);

      if (profilesResult.error) {
        console.error('Error fetching leaderboard:', profilesResult.error);
      } else {
        // Filter out banned users and limit to 10
        const rows = (profilesResult.data || []) as unknown as LeaderboardEntry[];
        const filteredData = rows
          .filter((entry) => !bannedIds.has(entry.id))
          .slice(0, 10);
        setEntries(filteredData);
      }

      setIsLoading(false);
    };

    fetchLeaderboard();
  }, [sortBy]);

  const handleProfileClick = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/user/${userId}`);
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-[hsl(var(--yellow))]" />;
      case 2:
        return <Medal className="w-5 h-5 text-[hsl(180,10%,70%)]" />;
      case 3:
        return <Medal className="w-5 h-5 text-[hsl(30,60%,50%)]" />;
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-muted-foreground">{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-[hsl(var(--yellow))]/20 to-transparent border-[hsl(var(--yellow))]/30';
      case 2:
        return 'bg-gradient-to-r from-[hsl(180,10%,70%)]/10 to-transparent border-[hsl(180,10%,70%)]/20';
      case 3:
        return 'bg-gradient-to-r from-[hsl(30,60%,50%)]/10 to-transparent border-[hsl(30,60%,50%)]/20';
      default:
        return 'bg-secondary/30 border-border/50';
    }
  };

  const getRoleBadge = (userId: string) => {
    const role = userRolesMap.get(userId);
    if (!role || role === 'user') return null;
    
    switch (role) {
      case 'owner':
        return (
          <Badge className="bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))] border-[hsl(var(--yellow))]/50 text-xs px-1.5 py-0">
            <Crown className="w-3 h-3 mr-0.5" />
            Owner
          </Badge>
        );
      case 'admin':
        return (
          <Badge className="bg-[hsl(var(--magenta))]/20 text-[hsl(var(--magenta))] border-[hsl(var(--magenta))]/50 text-xs px-1.5 py-0">
            <Shield className="w-3 h-3 mr-0.5" />
            Admin
          </Badge>
        );
      case 'moderator':
        return (
          <Badge className="bg-[hsl(var(--cyan))]/20 text-[hsl(var(--cyan))] border-[hsl(var(--cyan))]/50 text-xs px-1.5 py-0">
            <ShieldCheck className="w-3 h-3 mr-0.5" />
            Mod
          </Badge>
        );
      default:
        return null;
    }
  };

  const sortOptions: { value: SortField; label: string; icon: React.ReactNode }[] = [
    { value: 'level', label: 'Level', icon: <Zap className="w-4 h-4" /> },
    { value: 'total_searches', label: 'Searches', icon: <Search className="w-4 h-4" /> },
    { value: 'servers_tracked', label: 'Tracked', icon: <Star className="w-4 h-4" /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[hsl(var(--yellow))]" />
          Leaderboard
        </h3>
        <div className="flex items-center gap-1">
          {sortOptions.map((option) => (
            <Button
              key={option.value}
              variant={sortBy === option.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy(option.value)}
              className="gap-1 text-xs"
            >
              {option.icon}
              <span className="hidden sm:inline">{option.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No users found</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, index) => {
            const rank = index + 1;
            const isCurrentUser = entry.id === currentUserId;

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={(e) => handleProfileClick(entry.id, e)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:scale-[1.01]',
                  getRankBg(rank),
                  isCurrentUser && 'ring-2 ring-primary/50',
                  'hover:border-primary/50'
                )}
              >
                {/* Rank */}
                <div className="w-8 flex items-center justify-center">
                  {getRankIcon(rank)}
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                  {entry.avatar_url ? (
                    <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-[hsl(var(--magenta))]/20">
                      <span className="text-sm font-bold text-muted-foreground">
                        {(entry.display_name || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Name & Level */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate hover:text-primary transition-colors">
                      {entry.display_name || 'Anonymous'}
                    </span>
                    {getRoleBadge(entry.id)}
                    {isCurrentUser && (
                      <Badge variant="outline" className="text-xs border-primary text-primary">
                        You
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-[hsl(var(--yellow))]" />
                      Lv.{entry.level}
                    </span>
                    <span>{entry.xp} XP</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden sm:flex items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-bold text-primary">{entry.total_searches}</p>
                    <p className="text-xs text-muted-foreground">Searches</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-[hsl(var(--magenta))]">{entry.servers_tracked}</p>
                    <p className="text-xs text-muted-foreground">Tracked</p>
                  </div>
                </div>

                {/* View Profile Icon */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-2 rounded-lg hover:bg-primary/10 transition-colors">
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>View Profile</TooltipContent>
                </Tooltip>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default Leaderboard;
