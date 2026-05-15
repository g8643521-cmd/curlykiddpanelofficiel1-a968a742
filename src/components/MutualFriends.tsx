import { useState, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSocialFeatures } from '@/hooks/useSocialFeatures';
import { useNavigate } from 'react-router-dom';

interface MutualFriendsProps {
  userId: string;
  compact?: boolean;
}

interface MutualFriend {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

const MutualFriends = memo(({ userId, compact = false }: MutualFriendsProps) => {
  const navigate = useNavigate();
  const { getMutualFriends } = useSocialFeatures();
  const [mutuals, setMutuals] = useState<MutualFriend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const result = await getMutualFriends(userId);
      setMutuals(result);
      setIsLoading(false);
    };
    load();
  }, [userId, getMutualFriends]);

  if (isLoading || mutuals.length === 0) return null;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
              <Users className="h-3 w-3" />
              <span>{mutuals.length} mutual</span>
              <div className="flex -space-x-2">
                {mutuals.slice(0, 3).map((friend) => (
                  <Avatar key={friend.id} className="h-5 w-5 border border-background">
                    <AvatarImage src={friend.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                      {friend.display_name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-popover border-border">
            <p className="text-xs font-medium mb-1">Mutual Friends</p>
            <p className="text-xs text-muted-foreground">
              {mutuals.map(f => f.display_name || 'Unknown').join(', ')}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-medium text-sm">
          {mutuals.length} Mutual Friend{mutuals.length > 1 ? 's' : ''}
        </h4>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {mutuals.map((friend) => (
          <TooltipProvider key={friend.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate(`/user/${friend.id}`)}
                  className="group"
                >
                  <Avatar className="h-10 w-10 border-2 border-border/50 group-hover:border-primary/50 transition-colors">
                    <AvatarImage src={friend.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {friend.display_name?.[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-popover border-border">
                <p className="font-medium text-sm">{friend.display_name || 'Unknown'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </motion.div>
  );
});

MutualFriends.displayName = 'MutualFriends';

export default MutualFriends;
