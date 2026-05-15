import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface Friend {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
  friendship_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  is_requester: boolean;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  requester: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Cache user ID to avoid repeated auth calls
let cachedUserId: string | null = null;

export const useFriendSystem = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Debounce refs
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();
  const lastFetchRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  const fetchFriends = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isMountedRef.current) return;
    
    cachedUserId = user.id;
    setCurrentUserId(user.id);

    // Fetch accepted friendships with optimized query
    const { data: friendships, error } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (error || !isMountedRef.current) {
      if (error) console.error('Error fetching friends:', error);
      return;
    }

    const friendIds = friendships?.map(f => 
      f.requester_id === user.id ? f.addressee_id : f.requester_id
    ) || [];

    if (friendIds.length === 0) {
      setFriends([]);
      return;
    }

    // Batch fetch profiles and presence
    const [{ data: profiles }, { data: presenceData }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url').in('id', friendIds),
      supabase.from('user_presence').select('user_id, is_online, last_seen').in('user_id', friendIds),
    ]);

    if (!isMountedRef.current) return;

    const presenceMap = new Map(presenceData?.map(p => [p.user_id, p]));
    const friendshipMap = new Map(friendships?.map(f => [
      f.requester_id === user.id ? f.addressee_id : f.requester_id,
      f
    ]));

    const friendsList: Friend[] = (profiles || []).map(profile => {
      const friendship = friendshipMap.get(profile.id);
      const presence = presenceMap.get(profile.id) as any;
      
      // Consider user online only if is_online is true AND last_seen is within 5 minutes
      const isRecentlyActive = presence?.last_seen 
        ? (Date.now() - new Date(presence.last_seen).getTime()) < 5 * 60 * 1000
        : false;
      const isActuallyOnline = (presence?.is_online || false) && isRecentlyActive;
      
      return {
        id: profile.id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        is_online: isActuallyOnline,
        last_seen: presence?.last_seen || null,
        friendship_id: (friendship as any)?.id || '',
        status: 'accepted' as const,
        is_requester: (friendship as any)?.requester_id === user.id
      };
    });

    // Sort: online first, then by name
    friendsList.sort((a, b) => {
      if (a.is_online !== b.is_online) return b.is_online ? 1 : -1;
      return (a.display_name || '').localeCompare(b.display_name || '');
    });

    setFriends(friendsList);
  }, []);

  const fetchPendingRequests = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isMountedRef.current) return;

    // Fetch both incoming and sent in parallel
    const [{ data: incoming }, { data: sent }] = await Promise.all([
      supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at')
        .eq('addressee_id', user.id)
        .eq('status', 'pending'),
      supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at')
        .eq('requester_id', user.id)
        .eq('status', 'pending'),
    ]);

    if (!isMountedRef.current) return;

    // Get all user IDs needed for profiles
    const incomingIds = incoming?.map(r => r.requester_id) || [];
    const sentIds = sent?.map(r => r.addressee_id) || [];
    const allIds = [...new Set([...incomingIds, ...sentIds])];

    if (allIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', allIds);

      if (!isMountedRef.current) return;

      const profileMap = new Map(profiles?.map(p => [p.id, p]));

      if (incoming) {
        const requests: FriendRequest[] = incoming.map(req => ({
          ...req,
          requester: profileMap.get(req.requester_id) || {
            id: req.requester_id,
            display_name: null,
            avatar_url: null
          }
        }));
        setPendingRequests(requests);
      }

      if (sent) {
        const requests: FriendRequest[] = sent.map(req => ({
          ...req,
          requester: profileMap.get(req.addressee_id) || {
            id: req.addressee_id,
            display_name: null,
            avatar_url: null
          }
        }));
        setSentRequests(requests);
      }
    } else {
      setPendingRequests([]);
      setSentRequests([]);
    }
  }, []);

  const sendFriendRequest = useCallback(async (targetUserId: string) => {
    const userId = cachedUserId || (await supabase.auth.getUser()).data.user?.id;
    if (!userId) {
      toast.error('You must be logged in');
      return false;
    }

    if (targetUserId === userId) {
      toast.error("You can't add yourself as a friend");
      return false;
    }

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('friendships')
      .select('id, status')
      .or(`and(requester_id.eq.${userId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${userId})`)
      .maybeSingle();

    if (existing) {
      toast.info(existing.status === 'accepted' ? 'You are already friends' : 'Friend request already pending');
      return false;
    }

    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: userId, addressee_id: targetUserId, status: 'pending' });

    if (error) {
      toast.error('Failed to send friend request');
      return false;
    }

    toast.success('Friend request sent!');
    fetchPendingRequests();
    return true;
  }, [fetchPendingRequests]);

  const acceptFriendRequest = useCallback(async (friendshipId: string) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);

    if (error) {
      toast.error('Failed to accept request');
      return false;
    }

    toast.success('Friend request accepted!');
    Promise.all([fetchFriends(), fetchPendingRequests()]);
    return true;
  }, [fetchFriends, fetchPendingRequests]);

  const declineFriendRequest = useCallback(async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);

    if (error) {
      toast.error('Failed to decline request');
      return false;
    }

    toast.success('Friend request declined');
    fetchPendingRequests();
    return true;
  }, [fetchPendingRequests]);

  const removeFriend = useCallback(async (friendshipId: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);

    if (error) {
      toast.error('Failed to remove friend');
      return false;
    }

    toast.success('Friend removed');
    fetchFriends();
    return true;
  }, [fetchFriends]);

  const blockUser = useCallback(async (targetUserId: string, friendshipId?: string) => {
    const userId = cachedUserId || (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return false;

    const { error } = friendshipId
      ? await supabase.from('friendships').update({ status: 'blocked' }).eq('id', friendshipId)
      : await supabase.from('friendships').insert({ requester_id: userId, addressee_id: targetUserId, status: 'blocked' });

    if (error) {
      toast.error('Failed to block user');
      return false;
    }

    toast.success('User blocked');
    Promise.all([fetchFriends(), fetchPendingRequests()]);
    return true;
  }, [fetchFriends, fetchPendingRequests]);

  // Debounced refresh function for realtime updates
  const debouncedRefresh = useCallback(() => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    
    const now = Date.now();
    if (now - lastFetchRef.current < 1000) {
      fetchTimeoutRef.current = setTimeout(() => {
        lastFetchRef.current = Date.now();
        Promise.all([fetchFriends(), fetchPendingRequests()]);
      }, 1000);
    } else {
      lastFetchRef.current = now;
      Promise.all([fetchFriends(), fetchPendingRequests()]);
    }
  }, [fetchFriends, fetchPendingRequests]);

  useEffect(() => {
    isMountedRef.current = true;
    
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchFriends(), fetchPendingRequests()]);
      if (isMountedRef.current) setIsLoading(false);
    };

    init();

    // Single optimized channel for all updates
    const channelId = `friend_system_${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, debouncedRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, debouncedRefresh)
      .subscribe();

    return () => {
      isMountedRef.current = false;
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchFriends, fetchPendingRequests, debouncedRefresh]);

  // Memoize online friends count for header display
  const onlineFriendsCount = useMemo(() => friends.filter(f => f.is_online).length, [friends]);

  return {
    friends,
    pendingRequests,
    sentRequests,
    isLoading,
    currentUserId,
    onlineFriendsCount,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    blockUser,
    refresh: () => Promise.all([fetchFriends(), fetchPendingRequests()])
  };
};
