import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Send, ArrowLeft, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDirectMessages, Conversation, Message } from '@/hooks/useDirectMessages';
import { useFriendSystem } from '@/hooks/useFriendSystem';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { supabase } from '@/lib/supabase';

const formatMessageTime = (date: Date) => {
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d');
};

// Conversation card matching User Management style
const ConversationCard = memo(({
  conv,
  onSelect,
}: {
  conv: Conversation;
  onSelect: () => void;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onSelect();
    }}
    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
  >
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden">
          {conv.friend_avatar ? (
            <Avatar className="h-10 w-10">
              <AvatarImage src={conv.friend_avatar} />
              <AvatarFallback className="bg-primary/20 text-primary font-bold">
                {(conv.friend_name || 'U')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className="font-bold text-primary">{(conv.friend_name || 'U')[0].toUpperCase()}</span>
          )}
        </div>
        <div 
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
            conv.is_online 
              ? 'bg-[hsl(var(--green))] shadow-[0_0_6px_hsl(var(--green)/0.5)]' 
              : 'bg-muted-foreground/50'
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{conv.friend_name || 'Unknown'}</p>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground">
        {formatMessageTime(new Date(conv.last_message_at))}
      </span>
      {conv.unread_count > 0 && (
        <Badge className="bg-primary text-primary-foreground h-5 min-w-[20px] px-1.5 text-[10px] font-bold">
          {conv.unread_count}
        </Badge>
      )}
    </div>
  </div>
));

ConversationCard.displayName = 'ConversationCard';

// Friend card for starting new conversations
const StartChatCard = memo(({
  friend,
  onSelect,
}: {
  friend: { id: string; display_name: string | null; avatar_url: string | null; is_online: boolean };
  onSelect: () => void;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') onSelect();
    }}
    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer opacity-70 hover:opacity-100"
  >
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
          {friend.avatar_url ? (
            <Avatar className="h-10 w-10">
              <AvatarImage src={friend.avatar_url} />
              <AvatarFallback className="bg-muted/50 text-muted-foreground font-bold">
                {(friend.display_name || 'U')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className="font-bold text-muted-foreground">{(friend.display_name || 'U')[0].toUpperCase()}</span>
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
        <p className="font-medium text-foreground">{friend.display_name || 'Unknown'}</p>
        <p className="text-xs text-muted-foreground">
          {friend.is_online ? 'Online now' : 'Offline'}
        </p>
      </div>
    </div>

    <Button size="sm" variant="outline" className="gap-1">
      <MessageCircle className="h-3 w-3" />
      Chat
    </Button>
  </div>
));

StartChatCard.displayName = 'StartChatCard';

// Chat view component
const ChatView = ({
  friendId,
  friendName,
  friendAvatar,
  messages,
  onBack,
  onSend,
  isSending,
}: {
  friendId: string;
  friendName: string | null;
  friendAvatar: string | null;
  messages: Message[];
  onBack: () => void;
  onSend: (content: string) => Promise<boolean>;
  isSending: boolean;
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user.id || null);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    const content = input;
    setInput('');
    await onSend(content);
  };

  return (
    <div className="flex flex-col h-[520px]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack} 
          className="h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden">
          {friendAvatar ? (
            <Avatar className="h-9 w-9">
              <AvatarImage src={friendAvatar} />
              <AvatarFallback className="bg-primary/20 text-primary font-bold text-sm">
                {(friendName || 'U')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className="font-bold text-primary text-sm">{(friendName || 'U')[0].toUpperCase()}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{friendName || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground">Direct Message</p>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <MessageCircle className="h-7 w-7 text-primary/50" />
            </div>
            <p className="text-muted-foreground font-medium">Start the conversation</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Say hello to {friendName || 'your friend'}!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {messages.map((msg, index) => {
              const isOwn = msg.sender_id === currentUserId;
              const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.sender_id !== msg.sender_id;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2.5 text-sm ${
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                        : 'bg-secondary/50 text-foreground border border-border/30 rounded-2xl rounded-bl-md'
                    }`}
                  >
                    <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                    {isLastInGroup && (
                      <p className={`text-[10px] mt-1.5 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1"
            disabled={isSending}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isSending} 
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const DirectMessaging = memo(() => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const { friends } = useFriendSystem();
  const { conversations, messages, isLoading, isSending, totalUnread, sendMessage, fetchMessages } = useDirectMessages(selectedFriendId || undefined);

  const selectedConversation = conversations.find(c => c.friend_id === selectedFriendId);
  const selectedFriend = friends.find(f => f.id === selectedFriendId);

  const friendsWithoutConvo = friends.filter(
    f => !conversations.some(c => c.friend_id === f.id)
  );

  const filteredConversations = conversations.filter(c =>
    c.friend_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFriendsWithoutConvo = friendsWithoutConvo.filter(f =>
    f.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectConversation = (friendId: string) => {
    setSelectedFriendId(friendId);
    fetchMessages(friendId);
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedFriendId) return false;
    return sendMessage(selectedFriendId, content);
  };

  // If chat is open, show chat view
  if (selectedFriendId) {
    return (
      <div className="glass-card p-6">
        <ChatView
          friendId={selectedFriendId}
          friendName={selectedConversation?.friend_name || selectedFriend?.display_name || null}
          friendAvatar={selectedConversation?.friend_avatar || selectedFriend?.avatar_url || null}
          messages={messages}
          onBack={() => setSelectedFriendId(null)}
          onSend={handleSendMessage}
          isSending={isSending}
        />
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">Messages</h3>
          <Badge variant="secondary">{conversations.length}</Badge>
          {totalUnread > 0 && (
            <Badge className="bg-primary/20 text-primary border-primary/50">
              {totalUnread} unread
            </Badge>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="conversations" className="gap-1.5">
            <MessageCircle className="w-4 h-4" />
            Conversations
          </TabsTrigger>
          <TabsTrigger value="new" className="gap-1.5">
            <Users className="w-4 h-4" />
            Start New
          </TabsTrigger>
        </TabsList>

        {/* Active Conversations */}
        <TabsContent value="conversations" className="space-y-3">
          <div className="space-y-2 max-h-[400px] overflow-y-auto overflow-x-hidden">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                  <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">No conversations yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Start a chat with a friend</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <ConversationCard
                  key={conv.friend_id}
                  conv={conv}
                  onSelect={() => handleSelectConversation(conv.friend_id)}
                />
              ))
            )}
          </div>
        </TabsContent>

        {/* Start New Conversation */}
        <TabsContent value="new" className="space-y-3">
          <div className="space-y-2 max-h-[400px] overflow-y-auto overflow-x-hidden">
            {filteredFriendsWithoutConvo.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground text-sm">
                  {friends.length === 0 ? 'Add friends to chat' : 'All friends have conversations'}
                </p>
              </div>
            ) : (
              filteredFriendsWithoutConvo.map((friend) => (
                <StartChatCard
                  key={friend.id}
                  friend={friend}
                  onSelect={() => handleSelectConversation(friend.id)}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});

DirectMessaging.displayName = 'DirectMessaging';

export default DirectMessaging;
