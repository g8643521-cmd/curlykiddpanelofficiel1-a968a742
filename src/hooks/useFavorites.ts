import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { GamificationService } from "@/services/gamificationService";

export interface Favorite {
  id: string;
  server_code: string;
  server_name: string | null;
  created_at: string;
}



export const useFavorites = () => {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        setFavorites([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('server_favorites')
        .select('*')
        .eq('user_id', session.session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (err) {
      console.error("Error fetching favorites:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

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
