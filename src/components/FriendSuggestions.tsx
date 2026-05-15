import { memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSocialFeatures, FriendSuggestion } from '@/hooks/useSocialFeatures';
import { useFriendSystem } from '@/hooks/useFriendSystem';
import { useNavigate } from 'react-router-dom';

const SuggestionCard = memo(({ 
  suggestion, 
  onAddFriend 
}: { 
  suggestion: FriendSuggestion; 
  onAddFriend: (userId: string) => Promise<boolean>;
}) => {
  const navigate = useNavigate();

  const handleAdd = useCallback(async () => {
    await onAddFriend(suggestion.id);
  }, [onAddFriend, suggestion.id]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center p-4 rounded-xl bg-secondary/10 border border-border/30 hover:border-primary/30 transition-all group"
    >
      <button
        onClick={() => navigate(`/user/${suggestion.id}`)}
        className="mb-3"
      >
        <Avatar className="h-16 w-16 border-2 border-border/50 group-hover:border-primary/50 transition-colors">
          <AvatarImage src={suggestion.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
            {suggestion.display_name?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
      </button>
      
      <button 
        onClick={() => navigate(`/user/${suggestion.id}`)}
        className="font-semibold text-foreground hover:text-primary transition-colors text-center truncate max-w-full mb-1"
      >
        {suggestion.display_name || 'Unknown'}
      </button>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3 cursor-help">
              <Users className="h-3 w-3" />
              {suggestion.mutual_friends_count} mutual friend{suggestion.mutual_friends_count > 1 ? 's' : ''}
            </p>
          </TooltipTrigger>
          <TooltipContent className="bg-popover border-border max-w-xs">
            <p className="text-xs">
              {suggestion.mutual_friends.slice(0, 3).map(f => f.display_name || 'Unknown').join(', ')}
              {suggestion.mutual_friends.length > 3 && ` +${suggestion.mutual_friends.length - 3} more`}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button 
        size="sm" 
        onClick={handleAdd}
        className="w-full gap-1.5"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Add Friend
      </Button>
    </motion.div>
  );
});

SuggestionCard.displayName = 'SuggestionCard';

const FriendSuggestions = () => {
  const { suggestions, isLoading } = useSocialFeatures();
  const { sendFriendRequest } = useFriendSystem();

  if (isLoading || suggestions.length === 0) return null;

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--purple))]/20 to-[hsl(var(--magenta))]/20 flex items-center justify-center border border-[hsl(var(--purple))]/30">
          <Sparkles className="h-5 w-5 text-[hsl(var(--purple))]" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground">People You May Know</h3>
          <p className="text-xs text-muted-foreground">Based on mutual friends</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <AnimatePresence mode="popLayout">
          {suggestions.map((suggestion) => (
            <SuggestionCard 
              key={suggestion.id} 
              suggestion={suggestion} 
              onAddFriend={sendFriendRequest}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FriendSuggestions;
