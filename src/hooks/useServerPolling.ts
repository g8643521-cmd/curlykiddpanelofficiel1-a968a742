import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ServerData } from "@/hooks/useCfxApi";
import { runAsync, cancelAsyncScope } from "@/lib/asyncRequest";

interface ServerStatus {
  serverCode: string;
  serverName: string;
  playerCount: number;
  maxPlayers: number;
  isOnline: boolean;
  lastChecked: Date;
}

interface NotificationSetting {
  server_code: string;
  server_name: string | null;
  notify_online: boolean;
  notify_player_threshold: boolean;
  player_threshold: number;
}

interface UseServerPollingOptions {
  enabled?: boolean;
  interval?: number; // in ms
  serverCodes: string[];
  notificationSettings: NotificationSetting[];
  onNotification?: (title: string, body: string) => void;
}

export const useServerPolling = ({
  enabled = true,
  interval = 30000,
  serverCodes,
  notificationSettings,
  onNotification,
}: UseServerPollingOptions) => {
  const [serverStatuses, setServerStatuses] = useState<Map<string, ServerStatus>>(new Map());
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const previousStatuses = useRef<Map<string, ServerStatus>>(new Map());
  const pollingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  
  // Stabilize references to avoid infinite loops
  const serverCodesRef = useRef<string[]>(serverCodes);
  const notificationSettingsRef = useRef<NotificationSetting[]>(notificationSettings);
  const onNotificationRef = useRef(onNotification);
  
  // Update refs when values change
  useEffect(() => {
    serverCodesRef.current = serverCodes;
  }, [serverCodes]);
  
  useEffect(() => {
    notificationSettingsRef.current = notificationSettings;
  }, [notificationSettings]);
  
  useEffect(() => {
    onNotificationRef.current = onNotification;
  }, [onNotification]);

  const fetchServerStatus = useCallback(async (serverCode: string): Promise<ServerStatus | null> => {
    const outcome = await runAsync(
      async (signal) => {
        const { data, error } = await supabase.functions.invoke('cfx-lookup', {
          body: { serverCode, skipWebhook: true },
          signal,
          timeout: 8000,
        });
        if (error) throw error;
        return data;
      },
      { timeoutMs: 8000, retries: 0, signal: abortRef.current?.signal, scope: "server-polling", label: "server-polling" },
    );

    try {
      const data = outcome.ok ? outcome.data : null;
      if (!data || data.error) {
        return {
          serverCode,
          serverName: 'Unknown',
          playerCount: 0,
          maxPlayers: 0,
          isOnline: false,
          lastChecked: new Date(),
        };
      }

      return {
        serverCode,
        serverName: data.hostname || serverCode,
        playerCount: data.playerCount ?? data.players?.length ?? 0,
        maxPlayers: data.maxPlayers || 0,
        isOnline: true,
        lastChecked: new Date(),
      };
    } catch {
      return null;
    }
  }, []);

  const checkAndNotify = useCallback((newStatus: ServerStatus, oldStatus: ServerStatus | undefined) => {
    const settings = notificationSettingsRef.current;
    const notify = onNotificationRef.current;
    const setting = settings.find(s => s.server_code === newStatus.serverCode);
    if (!setting || !notify) return;

    // Strip color codes for display
    const serverName = newStatus.serverName.replace(/\^[0-9]/g, '').replace(/~[a-zA-Z]~/g, '');

    // Notify when server comes online
    if (setting.notify_online && newStatus.isOnline && oldStatus && !oldStatus.isOnline) {
      notify(
        `${serverName} is Online!`,
        `The server is now online with ${newStatus.playerCount} players.`
      );
    }

    // Notify when player threshold is reached
    if (setting.notify_player_threshold && setting.player_threshold) {
      const wasBelow = !oldStatus || oldStatus.playerCount < setting.player_threshold;
      const isAbove = newStatus.playerCount >= setting.player_threshold;
      
      if (wasBelow && isAbove) {
        notify(
          `${serverName} reached ${setting.player_threshold} players!`,
          `Current player count: ${newStatus.playerCount}/${newStatus.maxPlayers}`
        );
      }
    }
  }, []);

  const pollServers = useCallback(async () => {
    if (pollingRef.current) return;
    const codes = serverCodesRef.current;
    if (codes.length === 0) return;

    pollingRef.current = true;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsPolling(true);
    const newStatuses = new Map<string, ServerStatus>();

    // Fetch all servers in parallel (max 5 at a time)
    const chunks: string[][] = [];
    for (let i = 0; i < codes.length; i += 5) {
      chunks.push(codes.slice(i, i + 5));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(chunk.map(fetchServerStatus));
      if (!mountedRef.current || abortRef.current?.signal.aborted) break;
      results.forEach((status) => {
        if (status) {
          const oldStatus = previousStatuses.current.get(status.serverCode);
          checkAndNotify(status, oldStatus);
          newStatuses.set(status.serverCode, status);
        }
      });
    }

    if (mountedRef.current && !abortRef.current?.signal.aborted) {
      previousStatuses.current = newStatuses;
      setServerStatuses(newStatuses);
      setLastUpdate(new Date());
    }
    if (mountedRef.current) setIsPolling(false);
    pollingRef.current = false;
  }, [fetchServerStatus, checkAndNotify]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || serverCodesRef.current.length === 0) return;

    // Initial poll
    pollServers();

    // Set up interval
    const intervalId = setInterval(pollServers, interval);

    return () => {
      clearInterval(intervalId);
      abortRef.current?.abort();
      cancelAsyncScope("server-polling");
      pollingRef.current = false;
    };
  }, [enabled, interval, pollServers]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      cancelAsyncScope("server-polling");
    };
  }, []);

  const manualRefresh = () => {
    pollServers();
  };

  return {
    serverStatuses,
    isPolling,
    lastUpdate,
    manualRefresh,
  };
};
