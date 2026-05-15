import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { playSound } from '@/services/soundEffects';

export interface Poke {
  id: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  is_read: boolean;
  sender?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface SharedServer {
  id: string;
  sender_id: string;
  receiver_id: string;
  server_code: string;
  server_name: string | null;
  message: string | null;
  created_at: string;
  is_read: boolean;
  sender?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface FriendSuggestion {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  mutual_friends_count: number;
  mutual_friends: Array<{ id: string; display_name: string | null }>;
}

let cachedUserId: string | null = null;

export const useSocialFeatures = () => {
  const [pokes, setPokes] = useState<Poke[]>([]);
  const [sharedServers, setSharedServers] = useState<SharedServer[]>([]);
  const [suggestions, setSuggestions] = useState<FriendSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  const getUserId = useCallback(async () => {
    if (cachedUserId) return cachedUserId;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) cachedUserId = user.id;
    return user?.id || null;
  }, []);

  const fetchPokes = useCallback(async () => {
    const userId = await getUserId();
    if (!userId || !isMountedRef.current) return;

    const { data, error } = await supabase
      .from('pokes')
      .select('*')
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to fetch pokes:', error);
      return;
    }

    if (!data?.length) {
      setPokes([]);
      return;
    }

    // Fetch sender profiles
    const senderIds = [...new Set(data.map(p => p.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles_public')
      .select('id, display_name, avatar_url')
      .in('id', senderIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]));

    const pokesWithSenders = data.map(poke => ({
      ...poke,
      sender: profileMap.get(poke.sender_id) || { display_name: null, avatar_url: null }
    }));

    setPokes(pokesWithSenders);
  }, [getUserId]);

  const fetchSharedServers = useCallback(async () => {
    const userId = await getUserId();
    if (!userId || !isMountedRef.current) return;

    const { data, error } = await supabase
      .from('shared_servers')
      .select('*')
      .eq('receiver_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Failed to fetch shared servers:', error);
      return;
    }

    if (!data?.length) {
      setSharedServers([]);
      return;
    }

    // Fetch sender profiles
    const senderIds = [...new Set(data.map(s => s.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles_public')
      .select('id, display_name, avatar_url')
      .in('id', senderIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]));

    const sharesWithSenders = data.map(share => ({
      ...share,
      sender: profileMap.get(share.sender_id) || { display_name: null, avatar_url: null }
    }));

    setSharedServers(sharesWithSenders);
  }, [getUserId]);

  const fetchSuggestions = useCallback(async () => {
    const userId = await getUserId();
    if (!userId || !isMountedRef.current) return;

    // Get current friends
    const { data: friendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (!friendships?.length) {
      setSuggestions([]);
      return;
    }

    const friendIds = friendships.map(f => 
      f.requester_id === userId ? f.addressee_id : f.requester_id
    );

    // Find friends of friends
    const { data: fofData } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(friendIds.map(id => `requester_id.eq.${id},addressee_id.eq.${id}`).join(','));

    if (!fofData?.length) {
      setSuggestions([]);
      return;
    }

    // Count potential suggestions (friends of friends that aren't already friends)
    const suggestionCounts = new Map<string, { count: number; mutuals: string[] }>();
    
    for (const f of fofData) {
      const friendId = friendIds.includes(f.requester_id) ? f.requester_id : f.addressee_id;
      const potentialFriendId = f.requester_id === friendId ? f.addressee_id : f.requester_id;
      
      // Skip self and existing friends
      if (potentialFriendId === userId || friendIds.includes(potentialFriendId)) continue;
      
      const existing = suggestionCounts.get(potentialFriendId) || { count: 0, mutuals: [] };
      existing.count++;
      if (!existing.mutuals.includes(friendId)) {
        existing.mutuals.push(friendId);
      }
      suggestionCounts.set(potentialFriendId, existing);
    }

    // Get top suggestions (most mutual friends)
    const topSuggestions = Array.from(suggestionCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    if (!topSuggestions.length) {
      setSuggestions([]);
      return;
    }

    const suggestionIds = topSuggestions.map(s => s[0]);
    const allMutualIds = [...new Set(topSuggestions.flatMap(s => s[1].mutuals))];

    // Fetch profiles for suggestions and mutuals
    const [{ data: suggestionProfiles }, { data: mutualProfiles }] = await Promise.all([
      supabase.from('profiles_public').select('id, display_name, avatar_url').in('id', suggestionIds),
      supabase.from('profiles_public').select('id, display_name').in('id', allMutualIds),
    ]);

    const suggestionMap = new Map(suggestionProfiles?.map(p => [p.id, p]));
    const mutualMap = new Map(mutualProfiles?.map(p => [p.id, p]));

    const suggestions: FriendSuggestion[] = topSuggestions
      .map(([id, data]) => {
        const profile = suggestionMap.get(id);
        if (!profile) return null;
        
        return {
          id: (profile as any).id,
          display_name: (profile as any).display_name,
          avatar_url: (profile as any).avatar_url,
          mutual_friends_count: data.count,
          mutual_friends: data.mutuals.map(mid => ({
            id: mid,
            display_name: (mutualMap.get(mid) as any)?.display_name || null
          }))
        };
      })
      .filter((s): s is FriendSuggestion => s !== null);

    setSuggestions(suggestions);
  }, [getUserId]);

  const sendPoke = useCallback(async (receiverId: string) => {
    const userId = await getUserId();
    if (!userId) {
      toast.error('You must be logged in');
      return false;
    }

    // Check rate limit (1 poke per hour to same person)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentPokes } = await supabase
      .from('pokes')
      .select('id')
      .eq('sender_id', userId)
      .eq('receiver_id', receiverId)
      .gte('created_at', oneHourAgo)
      .limit(1);

    if (recentPokes && recentPokes.length > 0) {
      toast.error('You can only poke this friend once per hour');
      return false;
    }

    const { error } = await supabase
      .from('pokes')
      .insert({ sender_id: userId, receiver_id: receiverId });

    if (error) {
      toast.error('Failed to send poke');
      return false;
    }

    playSound('notification');
    toast.success('Poke sent! 👉');
    return true;
  }, [getUserId]);

  const dismissPoke = useCallback(async (pokeId: string) => {
    const { error } = await supabase
      .from('pokes')
      .update({ is_read: true })
      .eq('id', pokeId);

    if (error) {
      console.error('Failed to dismiss poke:', error);
      return;
    }

    setPokes(prev => prev.filter(p => p.id !== pokeId));
  }, []);

  const shareServer = useCallback(async (receiverId: string, serverCode: string, serverName?: string, message?: string) => {
    const userId = await getUserId();
    if (!userId) {
      toast.error('You must be logged in');
      return false;
    }

    const { error } = await supabase
      .from('shared_servers')
      .insert({
        sender_id: userId,
        receiver_id: receiverId,
        server_code: serverCode,
        server_name: serverName || null,
        message: message || null
      });

    if (error) {
      toast.error('Failed to share server');
      return false;
    }

    playSound('success');
    toast.success('Server shared! 🎮');
    return true;
  }, [getUserId]);

  const dismissSharedServer = useCallback(async (shareId: string) => {
    const { error } = await supabase
      .from('shared_servers')
      .update({ is_read: true })
      .eq('id', shareId);

    if (error) {
      console.error('Failed to dismiss shared server:', error);
      return;
    }

    setSharedServers(prev => prev.filter(s => s.id !== shareId));
  }, []);

  const getMutualFriends = useCallback(async (targetUserId: string): Promise<Array<{ id: string; display_name: string | null; avatar_url: string | null }>> => {
    const userId = await getUserId();
    if (!userId || userId === targetUserId) return [];

    // Get my friends
    const { data: myFriendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (!myFriendships?.length) return [];

    const myFriendIds = myFriendships.map(f =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    );

    // Get their friends
    const { data: theirFriendships } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${targetUserId},addressee_id.eq.${targetUserId}`);

    if (!theirFriendships?.length) return [];

    const theirFriendIds = theirFriendships.map(f =>
      f.requester_id === targetUserId ? f.addressee_id : f.requester_id
    );

    // Find mutual
    const mutualIds = myFriendIds.filter(id => theirFriendIds.includes(id));
    
    if (!mutualIds.length) return [];

    const { data: profiles } = await supabase
      .from('profiles_public')
      .select('id, display_name, avatar_url')
      .in('id', mutualIds);

    return profiles || [];
  }, [getUserId]);

  useEffect(() => {
    isMountedRef.current = true;

    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchPokes(), fetchSharedServers(), fetchSuggestions()]);
      if (isMountedRef.current) setIsLoading(false);
    };

    init();

    // Listen for new pokes and shares
    const channel = supabase
      .channel(`social_features_${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pokes' }, async (payload) => {
        const userId = await getUserId();
        if (payload.new.receiver_id === userId) {
          playSound('notification');
          fetchPokes();
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shared_servers' }, async (payload) => {
        const userId = await getUserId();
        if (payload.new.receiver_id === userId) {
          playSound('notification');
          fetchSharedServers();
        }
      })
      .subscribe();

    return () => {
      isMountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchPokes, fetchSharedServers, fetchSuggestions, getUserId]);

  return {
    pokes,
    sharedServers,
    suggestions,
    isLoading,
    unreadPokesCount: pokes.length,
    unreadSharesCount: sharedServers.length,
    sendPoke,
    dismissPoke,
    shareServer,
    dismissSharedServer,
    getMutualFriends,
    refreshSuggestions: fetchSuggestions,
  };
};
