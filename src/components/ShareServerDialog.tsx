import { useState, memo, useCallback } from 'react';
import { Share2, Send, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useFriendSystem, Friend } from '@/hooks/useFriendSystem';
import { useSocialFeatures } from '@/hooks/useSocialFeatures';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareServerDialogProps {
  serverCode: string;
  serverName?: string;
  trigger?: React.ReactNode;
}

const FriendItem = memo(({ 
  friend, 
  isSelected, 
  onToggle 
}: { 
  friend: Friend; 
  isSelected: boolean; 
  onToggle: () => void;
}) => (
  <motion.button
    layout
    onClick={onToggle}
    className={`flex items-center gap-3 p-3 rounded-xl w-full text-left transition-all ${
      isSelected 
        ? 'bg-primary/20 border border-primary/30' 
        : 'bg-secondary/10 border border-transparent hover:border-border/50'
    }`}
  >
    <div className="relative shrink-0">
      <Avatar className="h-10 w-10 border-2 border-border/50">
        <AvatarImage src={friend.avatar_url || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
          {friend.display_name?.[0]?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      {friend.is_online && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[hsl(var(--green))] border-2 border-background" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-foreground truncate">{friend.display_name || 'Unknown'}</p>
      <p className="text-xs text-muted-foreground">{friend.is_online ? 'Online' : 'Offline'}</p>
    </div>
    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
      isSelected 
        ? 'bg-primary border-primary' 
        : 'border-muted-foreground/30'
    }`}>
      {isSelected && (
        <motion.div 
          initial={{ scale: 0 }} 
          animate={{ scale: 1 }}
          className="w-2 h-2 bg-primary-foreground rounded-full"
        />
      )}
    </div>
  </motion.button>
));

FriendItem.displayName = 'FriendItem';

const ShareServerDialog = ({ serverCode, serverName, trigger }: ShareServerDialogProps) => {
  const { friends } = useFriendSystem();
  const { shareServer } = useSocialFeatures();
  const [open, setOpen] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSending, setIsSending] = useState(false);

  const filteredFriends = friends.filter(f => 
    f.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleFriend = useCallback((friendId: string) => {
    setSelectedFriends(prev => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  }, []);

  const handleShare = async () => {
    if (selectedFriends.size === 0) return;
    
    setIsSending(true);
    
    const promises = Array.from(selectedFriends).map(friendId => 
      shareServer(friendId, serverCode, serverName, message.trim() || undefined)
    );
    
    await Promise.all(promises);
    
    setIsSending(false);
    setSelectedFriends(new Set());
    setMessage('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Share Server
          </DialogTitle>
          <DialogDescription>
            Share <span className="font-medium text-foreground">{serverName || serverCode}</span> with your friends
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Friends List */}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {filteredFriends.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                {friends.length === 0 ? 'Add friends to share servers' : 'No friends found'}
              </p>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredFriends.map((friend) => (
                  <FriendItem
                    key={friend.id}
                    friend={friend}
                    isSelected={selectedFriends.has(friend.id)}
                    onToggle={() => toggleFriend(friend.id)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Message */}
          <Textarea
            placeholder="Add a message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="resize-none"
            rows={2}
          />

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleShare} 
              disabled={selectedFriends.size === 0 || isSending}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Share with {selectedFriends.size || ''} friend{selectedFriends.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareServerDialog;
