import { useState, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hand, X, ChevronDown, ChevronUp, ExternalLink, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSocialFeatures, Poke, SharedServer } from '@/hooks/useSocialFeatures';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Memoized poke item
const PokeItem = memo(({ 
  poke, 
  onPokeBack, 
  onDismiss,
  onNavigate 
}: { 
  poke: Poke; 
  onPokeBack: () => void;
  onDismiss: () => void;
  onNavigate: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--yellow))]/5 border border-[hsl(var(--yellow))]/20"
  >
    <button onClick={onNavigate} className="shrink-0">
      <Avatar className="h-10 w-10 border-2 border-[hsl(var(--yellow))]/30">
        <AvatarImage src={poke.sender?.avatar_url || undefined} />
        <AvatarFallback className="bg-[hsl(var(--yellow))]/10 text-[hsl(var(--yellow))]">
          {poke.sender?.display_name?.[0]?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
    </button>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-foreground">
        <button onClick={onNavigate} className="hover:text-primary transition-colors">
          {poke.sender?.display_name || 'Someone'}
        </button>
        {' '}poked you! 👉
      </p>
      <p className="text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(poke.created_at), { addSuffix: true })}
      </p>
    </div>
    <div className="flex gap-2 shrink-0">
      <Button 
        size="sm" 
        variant="outline"
        onClick={onPokeBack}
        className="h-8 text-xs border-[hsl(var(--yellow))]/30 text-[hsl(var(--yellow))] hover:bg-[hsl(var(--yellow))]/10"
      >
        <Hand className="h-3.5 w-3.5 mr-1" />
        Poke Back
      </Button>
      <Button 
        size="icon" 
        variant="ghost"
        onClick={onDismiss}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  </motion.div>
));
PokeItem.displayName = 'PokeItem';

// Memoized shared server item
const SharedServerItem = memo(({ 
  share, 
  onView, 
  onDismiss,
  onNavigate 
}: { 
  share: SharedServer; 
  onView: () => void;
  onDismiss: () => void;
  onNavigate: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    className="flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--cyan))]/5 border border-[hsl(var(--cyan))]/20"
  >
    <button onClick={onNavigate} className="shrink-0">
      <Avatar className="h-10 w-10 border-2 border-[hsl(var(--cyan))]/30">
        <AvatarImage src={share.sender?.avatar_url || undefined} />
        <AvatarFallback className="bg-[hsl(var(--cyan))]/10 text-[hsl(var(--cyan))]">
          {share.sender?.display_name?.[0]?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
    </button>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-foreground">
        <button onClick={onNavigate} className="hover:text-primary transition-colors">
          {share.sender?.display_name || 'Someone'}
        </button>
        {' '}shared a server
      </p>
      <p className="text-sm text-[hsl(var(--cyan))] font-medium truncate">
        {share.server_name || share.server_code}
      </p>
      {share.message && (
        <p className="text-xs text-muted-foreground truncate">"{share.message}"</p>
      )}
    </div>
    <div className="flex gap-2 shrink-0">
      <Button 
        size="sm" 
        onClick={onView}
        className="h-8 text-xs bg-[hsl(var(--cyan))]/20 text-[hsl(var(--cyan))] hover:bg-[hsl(var(--cyan))]/30 border border-[hsl(var(--cyan))]/30"
      >
        <ExternalLink className="h-3.5 w-3.5 mr-1" />
        View
      </Button>
      <Button 
        size="icon" 
        variant="ghost"
        onClick={onDismiss}
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  </motion.div>
));
SharedServerItem.displayName = 'SharedServerItem';

const SocialNotifications = memo(() => {
  const navigate = useNavigate();
  const { pokes, sharedServers, dismissPoke, dismissSharedServer, sendPoke } = useSocialFeatures();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const totalNotifications = pokes.length + sharedServers.length;
  
  const handlePokeBack = useCallback((senderId: string) => {
    sendPoke(senderId);
  }, [sendPoke]);

  const handleViewShare = useCallback((serverCode: string, shareId: string) => {
    navigate(`/dashboard?lookup=${serverCode}`);
    dismissSharedServer(shareId);
  }, [navigate, dismissSharedServer]);
  
  if (totalNotifications === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/10 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--yellow))]/20 to-[hsl(var(--primary))]/20 flex items-center justify-center border border-[hsl(var(--yellow))]/30">
              <Bell className="h-5 w-5 text-[hsl(var(--yellow))]" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-[hsl(var(--yellow))] rounded-full flex items-center justify-center animate-pulse shadow-[0_0_10px_hsl(var(--yellow)/0.5)]">
              <span className="text-[10px] font-bold text-background">{totalNotifications}</span>
            </div>
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Social Activity</h3>
            <p className="text-xs text-muted-foreground">
              {pokes.length > 0 && `${pokes.length} poke${pokes.length > 1 ? 's' : ''}`}
              {pokes.length > 0 && sharedServers.length > 0 && ' · '}
              {sharedServers.length > 0 && `${sharedServers.length} shared server${sharedServers.length > 1 ? 's' : ''}`}
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
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {pokes.map((poke) => (
                  <PokeItem
                    key={poke.id}
                    poke={poke}
                    onPokeBack={() => handlePokeBack(poke.sender_id)}
                    onDismiss={() => dismissPoke(poke.id)}
                    onNavigate={() => navigate(`/user/${poke.sender_id}`)}
                  />
                ))}
              </AnimatePresence>
              <AnimatePresence mode="popLayout">
                {sharedServers.map((share) => (
                  <SharedServerItem
                    key={share.id}
                    share={share}
                    onView={() => handleViewShare(share.server_code, share.id)}
                    onDismiss={() => dismissSharedServer(share.id)}
                    onNavigate={() => navigate(`/user/${share.sender_id}`)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

SocialNotifications.displayName = 'SocialNotifications';

export default SocialNotifications;
