import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthReady } from "@/hooks/useAuthReady";
import { runAsync } from "@/lib/asyncRequest";

export interface SearchHistoryItem {
  id: string;
  query: string;
  search_type: string | null;
  created_at: string;
}

export const useSearchHistory = () => {
  const { user, isReady, isAuthenticated } = useAuthReady();
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const fetchHistory = useCallback(async () => {
    if (!isReady) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestSeqRef.current;
    try {
      if (!isAuthenticated || !user) {
        setHistory([]);
        setIsLoading(false);
        return;
      }

      const outcome = await runAsync(async (signal) => {
        const { data, error } = await supabase
          .from('search_history')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
          .abortSignal(signal);
        if (error) throw error;
        return data || [];
      }, { timeoutMs: 7000, retries: 0, signal: controller.signal, label: 'search-history' });

      if (requestSeqRef.current !== requestId || controller.signal.aborted) return;
      if (!outcome.ok) throw outcome.error;
      setHistory(outcome.data);
    } catch (err) {
      console.error("Error fetching search history:", err);
    } finally {
      if (requestSeqRef.current === requestId) setIsLoading(false);
    }
  }, [isAuthenticated, isReady, user]);

  useEffect(() => {
    if (isReady) fetchHistory();
    return () => abortRef.current?.abort();
  }, [fetchHistory, isReady]);

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
