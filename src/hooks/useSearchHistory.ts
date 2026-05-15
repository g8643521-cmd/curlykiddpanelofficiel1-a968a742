import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface SearchHistoryItem {
  id: string;
  query: string;
  search_type: string | null;
  created_at: string;
}

export const useSearchHistory = () => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        setHistory([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', session.session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error("Error fetching search history:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const clearHistory = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { error } = await supabase
        .from('search_history')
        .delete()
        .eq('user_id', session.session.user.id);

      if (error) throw error;
      setHistory([]);
    } catch (err) {
      console.error("Error clearing history:", err);
    }
  };

  return {
    history,
    isLoading,
    refetch: fetchHistory,
    clearHistory,
  };
};
