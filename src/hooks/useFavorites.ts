import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { GamificationService } from "@/services/gamificationService";
import { useAuthReady } from "@/hooks/useAuthReady";
import { runAsync } from "@/lib/asyncRequest";

export interface Favorite {
  id: string;
  server_code: string;
  server_name: string | null;
  created_at: string;
}



export const useFavorites = () => {
  const { user, isReady, isAuthenticated } = useAuthReady();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const fetchFavorites = useCallback(async () => {
    if (!isReady) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestSeqRef.current;
    try {
      if (!isAuthenticated || !user) {
        setFavorites([]);
        setIsLoading(false);
        return;
      }

      const outcome = await runAsync(async (signal) => {
        const { data, error } = await supabase
          .from('server_favorites')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .abortSignal(signal);
        if (error) throw error;
        return data || [];
      }, { timeoutMs: 7000, retries: 0, signal: controller.signal, label: 'favorites' });

      if (requestSeqRef.current !== requestId || controller.signal.aborted) return;
      if (!outcome.ok) throw outcome.error;
      setFavorites(outcome.data);
    } catch (err) {
      console.error("Error fetching favorites:", err);
    } finally {
      if (requestSeqRef.current === requestId) setIsLoading(false);
    }
  }, [isAuthenticated, isReady, user]);

  useEffect(() => {
    if (isReady) fetchFavorites();
    return () => abortRef.current?.abort();
  }, [fetchFavorites, isReady]);

  const addFavorite = async (serverCode: string, serverName: string | null) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast.error("Please log in to save favorites");
        return false;
      }

      const { error } = await supabase.from('server_favorites').insert({
        user_id: session.session.user.id,
        server_code: serverCode,
        server_name: serverName,
      });

      if (error) {
        if (error.code === '23505') {
          toast.info("Server already in favorites");
          return false;
        }
        throw error;
      }

      toast.success("Added to favorites");
      await fetchFavorites();
      
      // Trigger gamification
      GamificationService.onFavorite();
      
      return true;
    } catch (err) {
      console.error("Error adding favorite:", err);
      toast.error("Failed to add favorite");
      return false;
    }
  };

  const removeFavorite = async (serverCode: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return false;

      // Optimistically remove from UI immediately
      setFavorites(prev => prev.filter(f => f.server_code !== serverCode));

      const { error } = await supabase
        .from('server_favorites')
        .delete()
        .eq('server_code', serverCode)
        .eq('user_id', session.session.user.id);

      if (error) {
        // Restore on error
        await fetchFavorites();
        throw error;
      }

      toast.success("Removed from favorites");
      return true;
    } catch (err) {
      console.error("Error removing favorite:", err);
      toast.error("Failed to remove favorite");
      return false;
    }
  };

  const isFavorite = (serverCode: string) => {
    return favorites.some(f => f.server_code === serverCode);
  };

  return {
    favorites,
    isLoading,
    addFavorite,
    removeFavorite,
    isFavorite,
    refetch: fetchFavorites,
  };
};
