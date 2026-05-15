import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, Plus, Send, ArrowLeft, UserPlus, 
  Crown, LogOut, MessageSquare, Search, Settings
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface GroupChatData {
  id: string;
  name: string;
  created_by: string;
  member_count?: number;
  last_message?: string;
}

interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  profile: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface GroupMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

// Group card matching User Management style
const GroupCard = ({
  group,
  onSelect,
}: {
  group: GroupChatData;
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
      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-xl">
        {'💬'}
      </div>
      <div>
        <p className="font-medium text-foreground">{group.name}</p>
        <p className="text-xs text-muted-foreground">
          {group.member_count || 0} members
        </p>
      </div>
    </div>
    <Badge variant="secondary" className="text-xs">
      <Users className="w-3 h-3 mr-1" />
      {group.member_count || 0}
    </Badge>
  </div>
);

// Chat view for group
const GroupChatView = ({
  group,
  members,
  messages,
  currentUserId,
  isAdmin,
  onBack,
  onSendMessage,
  onLeaveGroup,
  onAddMember,
  availableFriends,
}: {
  group: GroupChatData;
  members: GroupMember[];
  messages: GroupMessage[];
  currentUserId: string | null;
  isAdmin: boolean;
  onBack: () => void;
  onSendMessage: (content: string) => void;
  onLeaveGroup: () => void;
  onAddMember: (friendId: string) => void;
  availableFriends: any[];
}) => {
  const [input, setInput] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-[520px]">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-xl">
            {'💬'}
          </div>
          <div>
            <p className="font-medium text-foreground">{group.name}</p>
            <p className="text-xs text-muted-foreground">{members.length} members</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search friends..."
                      value={friendSearch}
                      onChange={(e) => setFriendSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableFriends
                      .filter(f => f?.display_name?.toLowerCase().includes(friendSearch.toLowerCase()))
                      .map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-secondary/30"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                              <span className="font-bold text-primary text-sm">
                                {(friend.display_name || 'U')[0].toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-medium">{friend.display_name || 'Unknown'}</span>
                          </div>
                          <Button size="sm" onClick={() => onAddMember(friend.id)}>
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </div>
                      ))}
                    {availableFriends.length === 0 && (
                      <p className="text-center text-muted-foreground text-sm py-4">
                        No friends to add
                      </p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onLeaveGroup}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Members Bar */}
      <div className="px-4 py-2 border-b border-border/50 flex gap-2 overflow-x-auto">
        {members.slice(0, 8).map((member) => (
          <div key={member.id} className="relative shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden">
              {member.profile?.avatar_url ? (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.profile.avatar_url} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {(member.profile?.display_name || 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <span className="font-bold text-primary text-xs">
                  {(member.profile?.display_name || 'U')[0].toUpperCase()}
                </span>
              )}
            </div>
            {member.role === 'admin' && (
              <Crown className="absolute -top-1 -right-1 h-3 w-3 text-[hsl(var(--yellow))]" />
            )}
          </div>
        ))}
        {members.length > 8 && (
          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-xs text-muted-foreground shrink-0">
            +{members.length - 8}
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 text-2xl">
              {'💬'}
            </div>
            <p className="text-muted-foreground font-medium">No messages yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Be the first to say hello!</p>
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
                  <div className={`flex items-end gap-2 max-w-[80%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                    {!isOwn && (
                      <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <span className="font-bold text-primary text-xs">
                          {(msg.sender?.display_name || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div
                      className={`px-4 py-2.5 text-sm ${
                        isOwn
                          ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                          : 'bg-secondary/50 text-foreground border border-border/30 rounded-2xl rounded-bl-md'
                      }`}
                    >
                      {!isOwn && (
                        <p className="text-xs font-medium text-primary mb-1">
                          {msg.sender?.display_name || 'Unknown'}
                        </p>
                      )}
                      <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                      {isLastInGroup && (
                        <p className={`text-[10px] mt-1.5 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
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
          />
          <Button onClick={handleSend} disabled={!input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export const GroupChat = () => {
  const [groups, setGroups] = useState<GroupChatData[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupChatData | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('👥');
  const [availableFriends, setAvailableFriends] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchGroups = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setCurrentUserId(session.user.id);

      const { data: memberData } = await supabase
        .from('group_chat_members')
        .select('group_id')
        .eq('user_id', session.user.id);

      const groupIds = memberData?.map(m => m.group_id) || [];

      if (groupIds.length === 0) {
        setGroups([]);
        setIsLoading(false);
        return;
      }

      const { data: groupsData } = await supabase
        .from('group_chats')
        .select('*')
        .in('id', groupIds);

      const groupsWithCounts = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count } = await supabase
            .from('group_chat_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

          return { ...group, member_count: count || 0 };
        })
      );

      setGroups(groupsWithCounts);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchGroupDetails = useCallback(async (groupId: string) => {
    try {
      const { data: membersData } = await supabase
        .from('group_chat_members')
        .select('id, user_id, role')
        .eq('group_id', groupId);

      const membersWithProfiles = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles_public')
            .select('display_name, avatar_url')
            .eq('id', member.user_id)
            .single();
          return { ...member, profile };
        })
      );

      setMembers(membersWithProfiles);

      const { data: messagesData } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(100);

      const messagesWithSenders = await Promise.all(
        (messagesData || []).map(async (msg) => {
          const { data: sender } = await supabase
            .from('profiles_public')
            .select('display_name, avatar_url')
            .eq('id', msg.sender_id)
            .single();
          return { ...msg, sender };
        })
      );

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Error fetching group details:', error);
    }
  }, []);

  const createGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Enter a group name');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data: group, error: groupError } = await supabase
        .from('group_chats')
        .insert({
          name: newGroupName.trim(),
          icon: newGroupIcon,
          created_by: session.user.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      await supabase.from('group_chat_members').insert({
        group_id: group.id,
        user_id: session.user.id,
        role: 'admin'
      });

      toast.success('Group created!');
      setShowCreateDialog(false);
      setNewGroupName('');
      setNewGroupIcon('👥');
      fetchGroups();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Could not create group');
    }
  };

  const sendMessage = async (content: string) => {
    if (!selectedGroup || !currentUserId) return;

    try {
      await supabase.from('group_messages').insert({
        group_id: selectedGroup.id,
        sender_id: currentUserId,
        content
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Could not send message');
    }
  };

  const fetchAvailableFriends = async () => {
    if (!currentUserId || !selectedGroup) return;

    try {
      const currentMemberIds = members.map(m => m.user_id);

      const { data: friendships } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);

      const friendIds = (friendships || [])
        .map(f => f.requester_id === currentUserId ? f.addressee_id : f.requester_id)
        .filter(id => !currentMemberIds.includes(id));

      const friendsWithProfiles = await Promise.all(
        friendIds.map(async (id) => {
          const { data: profile } = await supabase
            .from('profiles_public')
            .select('id, display_name, avatar_url')
            .eq('id', id)
            .single();
          return profile;
        })
      );

      setAvailableFriends(friendsWithProfiles.filter(Boolean));
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const addMemberToGroup = async (friendId: string) => {
    if (!selectedGroup) return;

    try {
      await supabase.from('group_chat_members').insert({
        group_id: selectedGroup.id,
        user_id: friendId,
        role: 'member'
      });

      toast.success('Member added!');
      fetchGroupDetails(selectedGroup.id);
      fetchAvailableFriends();
    } catch (error) {
      console.error('Error adding member:', error);
      toast.error('Could not add member');
    }
  };

  const leaveGroup = async () => {
    if (!selectedGroup || !currentUserId) return;

    try {
      await supabase
        .from('group_chat_members')
        .delete()
        .eq('group_id', selectedGroup.id)
        .eq('user_id', currentUserId);

      toast.success('You left the group');
      setSelectedGroup(null);
      fetchGroups();
    } catch (error) {
      console.error('Error leaving group:', error);
      toast.error('Could not leave group');
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    if (selectedGroup) {
      fetchGroupDetails(selectedGroup.id);
      fetchAvailableFriends();

      const channel = supabase
        .channel(`group-${selectedGroup.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'group_messages',
            filter: `group_id=eq.${selectedGroup.id}`
          },
          async (payload) => {
            const newMsg = payload.new as GroupMessage;
            const { data: sender } = await supabase
              .from('profiles_public')
              .select('display_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .single();

            setMessages(prev => [...prev, { ...newMsg, sender }]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedGroup, fetchGroupDetails]);

  const isAdmin = members.find(m => m.user_id === currentUserId)?.role === 'admin';

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const EMOJI_OPTIONS = ['👥', '🎮', '💬', '🔥', '⚡', '🎯', '🏆', '💎', '🌟', '🚀'];

  // If group is selected, show chat view
  if (selectedGroup) {
    return (
      <div className="glass-card p-6">
        <GroupChatView
          group={selectedGroup}
          members={members}
          messages={messages}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onBack={() => setSelectedGroup(null)}
          onSendMessage={sendMessage}
          onLeaveGroup={leaveGroup}
          onAddMember={addMemberToGroup}
          availableFriends={availableFriends}
        />
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      {/* Header - matches User Management */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">Group Chats</h3>
          <Badge variant="secondary">{groups.length}</Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Group Chat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Icon</label>
                  <div className="flex gap-2 flex-wrap">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setNewGroupIcon(emoji)}
                        className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors ${
                          newGroupIcon === emoji
                            ? 'bg-primary/20 ring-2 ring-primary'
                            : 'bg-secondary/30 hover:bg-secondary/50'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">Group Name</label>
                  <Input
                    placeholder="Enter group name..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                  />
                </div>
                <Button onClick={createGroup} className="w-full">
                  Create Group
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-2">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">No group chats yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Create a group to get started</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onSelect={() => setSelectedGroup(group)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default GroupChat;
