import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface UptimeDataPoint {
  checked_at: string;
  is_online: boolean;
  player_count: number;
  max_players: number;
}

export const useUptimeHistory = (serverCode: string | null) => {
  const [history, setHistory] = useState<UptimeDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!serverCode) {
      setHistory([]);
      return;
    }

    setIsLoading(true);
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("server_uptime_history")
        .select("checked_at, is_online, player_count, max_players")
        .eq("server_code", serverCode)
        .gte("checked_at", twentyFourHoursAgo)
        .order("checked_at", { ascending: true });

      if (error) {
        console.error("Error fetching uptime history:", error);
        setHistory([]);
      } else {
        setHistory(data || []);
      }
    } catch (err) {
      console.error("Error fetching uptime history:", err);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [serverCode]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    isLoading,
    refetch: fetchHistory,
  };
};
