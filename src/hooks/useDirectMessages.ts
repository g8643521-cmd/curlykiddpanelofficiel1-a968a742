import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  friend_id: string;
  friend_name: string | null;
  friend_avatar: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  is_online: boolean;
}

// Cache for user session to avoid repeated auth calls
let cachedUserId: string | null = null;
let sessionPromise: Promise<string | null> | null = null;

const getUserId = async (): Promise<string | null> => {
  if (cachedUserId) return cachedUserId;
  
  if (!sessionPromise) {
    sessionPromise = supabase.auth.getSession().then(({ data }) => {
      cachedUserId = data.session?.user.id || null;
      sessionPromise = null;
      return cachedUserId;
    });
  }
  
  return sessionPromise;
};

// Clear cache on auth state change
supabase.auth.onAuthStateChange(() => {
  cachedUserId = null;
});

export function useDirectMessages(friendId?: string) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  // Refs for debouncing and preventing stale closures
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFetchRef = useRef<number>(0);
  const friendIdRef = useRef(friendId);
  friendIdRef.current = friendId;

  const fetchConversations = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) {
      setIsLoading(false);
      return;
    }

    // Debounce: skip if fetched within last 500ms
    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    lastFetchRef.current = now;

    const { data: messagesData, error } = await supabase
      .from('direct_messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(200); // Limit for performance

    if (error) {
      console.error('Failed to fetch conversations:', error);
      setIsLoading(false);
      return;
    }

    // Group by conversation partner efficiently
    const conversationMap = new Map<string, { lastMsg: Message; unread: number }>();

    for (const msg of messagesData || []) {
      const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
      
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, { 
          lastMsg: msg, 
          unread: msg.receiver_id === userId && !msg.is_read ? 1 : 0 
        });
      } else if (msg.receiver_id === userId && !msg.is_read) {
        conversationMap.get(partnerId)!.unread++;
      }
    }

    const partnerIds = Array.from(conversationMap.keys());
    if (partnerIds.length === 0) {
      setConversations([]);
      setIsLoading(false);
      return;
    }

    // Batch fetch profiles and presence
    const [{ data: profiles }, { data: presenceData }] = await Promise.all([
      supabase.from('profiles_public').select('id, display_name, avatar_url').in('id', partnerIds),
      supabase.from('user_presence').select('user_id, is_online, last_seen').in('user_id', partnerIds),
    ]);

    const profileMap = new Map(profiles?.map(p => [p.id, p]));
    
    // Build presence map with 5-minute activity check
    const presenceMap = new Map<string, boolean>();
    for (const p of presenceData || []) {
      const isRecentlyActive = p.last_seen 
        ? (Date.now() - new Date(p.last_seen).getTime()) < 5 * 60 * 1000
        : false;
      presenceMap.set(p.user_id, (p.is_online || false) && isRecentlyActive);
    }

    const conversationList: Conversation[] = partnerIds.map(partnerId => {
      const { lastMsg, unread } = conversationMap.get(partnerId)!;
      const profile = profileMap.get(partnerId);
      
      return {
        friend_id: partnerId,
        friend_name: (profile as any)?.display_name || null,
        friend_avatar: (profile as any)?.avatar_url || null,
        last_message: lastMsg.content,
        last_message_at: lastMsg.created_at,
        unread_count: unread,
        is_online: presenceMap.get(partnerId) || false,
      };
    });

    // Sort by last message time
    conversationList.sort((a, b) => 
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    );

    setConversations(conversationList);
    setIsLoading(false);
  }, []);

  const fetchMessages = useCallback(async (targetFriendId: string) => {
    const userId = await getUserId();
    if (!userId) return;

    const { data, error } = await supabase
      .from('direct_messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${targetFriendId}),and(sender_id.eq.${targetFriendId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Failed to fetch messages:', error);
      return;
    }

    setMessages(data || []);

    // Mark as read in background (don't await)
    supabase
      .from('direct_messages')
      .update({ is_read: true })
      .eq('sender_id', targetFriendId)
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .then(() => {
        // Refresh conversation list to update unread count
        fetchConversations();
      });
  }, [fetchConversations]);

  const sendMessage = useCallback(async (receiverId: string, content: string) => {
    if (!content.trim()) return false;

    const userId = await getUserId();
    if (!userId) {
      toast.error('You must be logged in to send messages');
      return false;
    }

    setIsSending(true);

    const { error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: userId,
        receiver_id: receiverId,
        content: content.trim(),
      });

    setIsSending(false);

    if (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      return false;
    }

    return true;
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages for specific friend
  useEffect(() => {
    if (friendId) {
      fetchMessages(friendId);
    } else {
      setMessages([]);
    }
  }, [friendId, fetchMessages]);

  // Optimized real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('dm_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        (payload) => {
          const newMessage = payload.new as Message;
          const currentFriendId = friendIdRef.current;
          
          // Add to current conversation if relevant
          if (currentFriendId && (newMessage.sender_id === currentFriendId || newMessage.receiver_id === currentFriendId)) {
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });
          }
          
          // Debounced refresh of conversations
          if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
          fetchTimeoutRef.current = setTimeout(fetchConversations, 300);
        }
      )
      .subscribe();

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

  const totalUnread = useMemo(() => 
    conversations.reduce((sum, c) => sum + c.unread_count, 0),
    [conversations]
  );

  return {
    conversations,
    messages,
    isLoading,
    isSending,
    totalUnread,
    sendMessage,
    fetchMessages,
    refetch: fetchConversations,
  };
}
