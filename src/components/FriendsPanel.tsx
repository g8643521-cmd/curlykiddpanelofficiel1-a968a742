import { useState, memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Check, X, UserMinus, Ban, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useFriendSystem, Friend, FriendRequest } from '@/hooks/useFriendSystem';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Memoized friend card matching User Management style
const FriendCard = memo(({ 
  friend, 
  onRemove, 
  onBlock,
  isFavorite,
  onToggleFavorite
}: { 
  friend: Friend; 
  onRemove: () => void; 
  onBlock: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) => {
  const navigate = useNavigate();
  
  const handleNavigate = useCallback(() => {
    navigate(`/user/${friend.id}`);
  }, [navigate, friend.id]);

  const lastSeenText = useMemo(() => {
    if (friend.is_online) return 'Online';
    if (friend.last_seen) {
      return `Last seen ${formatDistanceToNow(new Date(friend.last_seen), { addSuffix: true })}`;
    }
    return 'Offline';
  }, [friend.is_online, friend.last_seen]);
  
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          onClick={handleNavigate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleNavigate();
          }}
          className={`flex items-center justify-between p-4 rounded-lg bg-secondary/30 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer hover:bg-secondary/50 hover:translate-x-1 hover:shadow-lg hover:shadow-primary/5 ${
            isFavorite ? 'ring-1 ring-[hsl(var(--yellow))]/30 bg-[hsl(var(--yellow))]/5' : ''
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden">
                {friend.avatar_url ? (
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={friend.avatar_url} />
                    <AvatarFallback className="bg-primary/20 text-primary font-bold">
                      {(friend.display_name || 'U')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <span className="font-bold text-primary">{(friend.display_name || 'U')[0].toUpperCase()}</span>
                )}
              </div>
              <div 
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
                  friend.is_online 
                    ? 'bg-[hsl(var(--green))] shadow-[0_0_6px_hsl(var(--green)/0.5)]' 
                    : 'bg-muted-foreground/50'
                }`}
              />
            </div>
            <div>
              <p className="font-medium text-foreground">{friend.display_name || 'Unknown User'}</p>
            </div>
          </div>

          {friend.is_online && (
            <Badge className="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/50 text-xs">
              Online
            </Badge>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuLabel>{friend.display_name || 'Unknown User'}</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={handleNavigate}>
          View Profile
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onToggleFavorite?.()}>
          {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem 
          onSelect={onRemove}
          className="text-destructive focus:text-destructive"
        >
          <UserMinus className="h-4 w-4 mr-2" />
          Remove Friend
        </ContextMenuItem>
        <ContextMenuItem 
          onSelect={onBlock}
          className="text-destructive focus:text-destructive"
        >
          <Ban className="h-4 w-4 mr-2" />
          Block User
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

FriendCard.displayName = 'FriendCard';

// Memoized request card
const RequestCard = memo(({
  request,
  type,
  onAccept,
  onDecline,
}: {
  request: FriendRequest;
  type: 'incoming' | 'outgoing';
  onAccept?: () => void;
  onDecline: () => void;
}) => {
  const navigate = useNavigate();
  
  const handleNavigate = useCallback(() => {
    navigate(`/user/${request.requester.id}`);
  }, [navigate, request.requester.id]);

  const timeAgo = useMemo(() => 
    formatDistanceToNow(new Date(request.created_at), { addSuffix: true }),
    [request.created_at]
  );
  
  return (
    <div
      className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
    >
      <div 
        className="flex items-center gap-4 flex-1 cursor-pointer min-w-0"
        onClick={handleNavigate}
      >
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden">
          {request.requester.avatar_url ? (
            <Avatar className="h-10 w-10">
              <AvatarImage src={request.requester.avatar_url} />
              <AvatarFallback className="bg-primary/20 text-primary font-bold">
                {(request.requester.display_name || 'U')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className="font-bold text-primary">{(request.requester.display_name || 'U')[0].toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {request.requester.display_name || 'Unknown User'}
          </p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
      </div>
      
      <div className="flex gap-2 shrink-0">
        {type === 'incoming' && onAccept && (
          <Button size="sm" onClick={onAccept} className="h-8 gap-1">
            <Check className="h-3 w-3" />
            Accept
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onDecline} className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10">
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
});

RequestCard.displayName = 'RequestCard';

// Add friend dialog
const AddFriendDialog = memo(({ onSendRequest }: { onSendRequest: (userId: string) => Promise<boolean> }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; display_name: string | null; avatar_url: string | null }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${searchQuery}%`)
      .limit(10);

    if (error) {
      toast.error('Search failed');
    } else {
      setSearchResults(data || []);
    }
    setIsSearching(false);
  }, [searchQuery]);

  const handleSendRequest = useCallback(async (userId: string) => {
    const success = await onSendRequest(userId);
    if (success) {
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    }
  }, [onSendRequest]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Friend
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
          <DialogDescription>Search for users by their display name</DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-2">
          <Input
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isSearching} size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {searchResults.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                  <span className="font-bold text-primary text-sm">
                    {(user.display_name || 'U')[0].toUpperCase()}
                  </span>
                </div>
                <span className="font-medium truncate">{user.display_name || 'Unknown'}</span>
              </div>
              <Button size="sm" onClick={() => handleSendRequest(user.id)}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          {searchResults.length === 0 && searchQuery && !isSearching && (
            <p className="text-center text-muted-foreground py-6">No users found</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});

AddFriendDialog.displayName = 'AddFriendDialog';

const FriendsPanel = () => {
  const {
    friends,
    pendingRequests,
    sentRequests,
    isLoading,
    onlineFriendsCount,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
  } = useFriendSystem();

  const [searchQuery, setSearchQuery] = useState('');

  // Memoize filtered lists
  const onlineFriends = useMemo(() => friends.filter(f => f.is_online), [friends]);
  const filteredFriends = useMemo(() => 
    friends.filter(f => 
      f.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    ), 
    [friends, searchQuery]
  );

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">Friends</h3>
          <Badge variant="secondary">{friends.length}</Badge>
          {onlineFriendsCount > 0 && (
            <Badge className="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/50">
              {onlineFriendsCount} online
            </Badge>
          )}
        </div>
        <AddFriendDialog onSendRequest={sendFriendRequest} />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search friends..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs Content */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all" className="gap-1.5">
            <Users className="w-4 h-4" />
            All
          </TabsTrigger>
          <TabsTrigger value="online" className="gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--green))]" />
            Online
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            <UserPlus className="w-4 h-4" />
            Pending
            {pendingRequests.length > 0 && (
              <Badge className="ml-1 h-5 min-w-[20px] px-1.5 bg-primary text-primary-foreground text-[10px]">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* All Friends */}
        <TabsContent value="all" className="space-y-3">
          <div className="space-y-2 max-h-[400px] overflow-y-auto overflow-x-hidden">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">No friends found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Add friends to see them here</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredFriends.map((friend) => (
                  <motion.div
                    key={friend.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <FriendCard
                      friend={friend}
                      onRemove={() => removeFriend(friend.friendship_id)}
                      onBlock={() => blockUser(friend.id, friend.friendship_id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </TabsContent>

        {/* Online Friends */}
        <TabsContent value="online" className="space-y-3">
          <div className="space-y-2 max-h-[400px] overflow-y-auto overflow-x-hidden">
            {onlineFriends.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">No friends online</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {onlineFriends.map((friend) => (
                  <motion.div
                    key={friend.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <FriendCard
                      friend={friend}
                      onRemove={() => removeFriend(friend.friendship_id)}
                      onBlock={() => blockUser(friend.id, friend.friendship_id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </TabsContent>

        {/* Pending Requests */}
        <TabsContent value="pending" className="space-y-4">
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {pendingRequests.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <UserPlus className="w-3 h-3" />
                  Incoming Requests
                </h4>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      type="incoming"
                      onAccept={() => acceptFriendRequest(request.id)}
                      onDecline={() => declineFriendRequest(request.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {sentRequests.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Sent Requests
                </h4>
                <div className="space-y-2">
                  {sentRequests.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      type="outgoing"
                      onDecline={() => declineFriendRequest(request.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {pendingRequests.length === 0 && sentRequests.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                  <UserPlus className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">No pending requests</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FriendsPanel;
