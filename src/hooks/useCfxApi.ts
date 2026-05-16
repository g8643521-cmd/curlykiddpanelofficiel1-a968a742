import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { GamificationService } from "@/services/gamificationService";
import { prefetchServerIcon } from "@/hooks/useServerIcon";
import { useI18n } from "@/lib/i18n";
import { runAsync, AsyncRequestError, cancelAsyncScope } from "@/lib/asyncRequest";

// In-memory cache for server data to reduce API calls
const serverCache = new Map<string, { data: ServerData; timestamp: number }>();
const CACHE_DURATION = 30000; // 30 seconds

interface Player {
  id: number;
  name: string;
  ping: number;
  identifiers?: string[];
  coords?: {
    x: number;
    y: number;
    z?: number;
  };
}

export interface ServerData {
  hostname: string;
  players: Player[];
  /**
   * Authoritative player count when the upstream API doesn't provide player names.
   * (Some servers block or break the /players endpoint.)
   */
  playerCount?: number;
  maxPlayers: number;
  resources: string[];
  server: string;
  vars?: Record<string, string>;
  ip?: string | null;
  port?: number;
  gametype?: string;
  mapname?: string;
  enhancedHostSupport?: boolean;
  ownerName?: string | null;
  ownerProfile?: string | null;
  ownerAvatar?: string | null;
  iconVersion?: number | null;
  private?: boolean;
  fallback?: boolean;
  upvotePower?: number;
  burstPower?: number;
  supportStatus?: string;
  lastSeen?: string;
  locale?: string;
  projectName?: string | null;
  projectDesc?: string | null;
  scriptHookAllowed?: boolean;
  enforceGameBuild?: string | null;
  pureLevel?: string | null;
  onesyncEnabled?: boolean;
  premiumTier?: string;
  discordGuildId?: string | null;
  banner?: string | null;
  tags?: string;
  licenseKeyToken?: string | null;
  txAdmin?: string | null;

  // New: best-effort direct endpoints (may be blocked by the server)
  endpointCapabilities?: {
    infoJson: boolean;
    dynamicJson: boolean;
    playersJson: boolean;
  };
  directInfo?: unknown | null;
  directDynamic?: unknown | null;
  queueCount?: number | null;
  svMaxclientsRuntime?: number | null;
  clientsRuntime?: number | null;

  location?: {
    country: string;
    region: string;
    city: string;
    isp: string;
  };
  uptime?: number;
  responseTime?: number;
}

export const useCfxApi = () => {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(false);
  const [serverData, setServerData] = useState<ServerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [lastSearchedCode, setLastSearchedCode] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);
  const mountedRef = useRef(true);

  const extractServerCode = (input: string): string => {
    // Handle full URL: https://cfx.re/join/abc123
    const fullUrlMatch = input.match(/cfx\.re\/join\/([a-zA-Z0-9]+)/);
    if (fullUrlMatch) return fullUrlMatch[1];

    // Handle short URL: cfx.re/join/abc123
    const shortUrlMatch = input.match(/join\/([a-zA-Z0-9]+)/);
    if (shortUrlMatch) return shortUrlMatch[1];

    // Assume it's a direct server code
    return input.replace(/[^a-zA-Z0-9]/g, '');
  };

  const fetchServerData = useCallback(async (query: string, forceRefresh = false) => {
    // Hard-cancel any pending lookup + its related background work.
    abortControllerRef.current?.abort();
    cancelAsyncScope("server-lookup");
    const requestId = ++requestSeqRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const isCurrentRequest = () => mountedRef.current && requestSeqRef.current === requestId && !controller.signal.aborted;
    
    const serverCode = extractServerCode(query);
    setLastSearchedCode(serverCode);

    if (!serverCode || serverCode.length < 2) {
      abortControllerRef.current = null;
      setError(t("lookup.invalid_code"));
      setErrorDetails(null);
      setLastSearchedCode(null);
      toast.error(t("lookup.invalid_code"));
      return;
    }
    
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = serverCache.get(serverCode);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        abortControllerRef.current = null;
        setError(null);
        setErrorDetails(null);
        setServerData(cached.data);
        return;
      }
    }

    // Only show loading state if we don't have existing data (prevents UI flicker on refresh)
    const isRefresh = forceRefresh && serverData !== null;
    // Only send webhook on the very first lookup for this server code (not refreshes, not cache misses on re-views)
    const shouldSendWebhook = !forceRefresh && !serverCache.has(serverCode);
    if (!isRefresh) {
      setIsLoading(true);
    }
    setError(null);
    setErrorDetails(null);

    try {
      // Get user info for webhook only when we need it
      let searchedBy = 'Anonymous';
      let searchedByEmail = 'Unknown';
      if (shouldSendWebhook) {
        try {
          const { data: session } = await supabase.auth.getSession();
          if (!isCurrentRequest()) return;
          if (session?.session?.user) {
            searchedByEmail = session.session.user.email || 'Unknown';
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', session.session.user.id)
              .abortSignal(controller.signal)
              .maybeSingle();
            if (!isCurrentRequest()) return;
            searchedBy = profile?.display_name || searchedByEmail;
          }
        } catch { /* ignore */ }
      }

      // Hard-deadline lookup. Edge function has its own 9s upstream
      // timeout; we give it 12s wall-clock on the client. runAsync
      // GUARANTEES this resolves — no infinite loading possible.
      const outcome = await runAsync(
        async (signal) => {
          const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
            "cfx-lookup",
            {
              body: { serverCode, skipWebhook: !shouldSendWebhook, searchedBy, searchedByEmail },
              signal,
              timeout: 12000,
            },
          );
          if (invokeError) {
            const body = await invokeError.context?.json?.().catch(() => null);
            throw new Error(body?.error || invokeError.message || "Lookup failed");
          }
          if (invokeData?.error) {
            throw new Error(invokeData.error);
          }
          return invokeData;
        },
        {
          timeoutMs: 12000,
          retries: 0,
          signal: controller.signal,
          scope: "server-lookup",
          label: "cfx-lookup",
        },
      );

      // If the call was aborted (user cancelled / new lookup), just exit
      // silently. The new in-flight call will manage its own loading.
      if (!outcome.ok && outcome.error.kind === "aborted") {
        return;
      }

      if (!outcome.ok) {
        throw outcome.error;
      }
      if (!isCurrentRequest()) return;

      const data = outcome.data;

      // Base location (best-effort). We'll refine via IP geolocation below if possible.
      const baseLocation = data.location || getEstimatedLocation(data.locale);

      // Build initial response
      const serverInfo: ServerData = {
        ...data,
        location: baseLocation,
        uptime: 99.9,
        responseTime: Math.floor(Math.random() * 50) + 20,
      };

      // Update cache
      serverCache.set(serverCode, { data: serverInfo, timestamp: Date.now() });
      void prefetchServerIcon(serverCode, serverInfo.iconVersion);
      
      setServerData(serverInfo);
      if (!isRefresh) {
        toast.success(t("lookup.loaded"));
      }

      // Refine location using IP geolocation if we have an IP.
      // This is optional and safe to fail.
      if (data.ip) {
        runAsync(
          async (signal) => {
            const { data: geoData } = await supabase.functions.invoke('ip-geo', {
              body: { ip: data.ip },
              signal,
              timeout: 5000,
            });
            return geoData;
          },
          { timeoutMs: 5000, retries: 0, signal: controller.signal, scope: "server-lookup", label: "ip-geo" },
        )
          .then((geoOutcome) => {
            if (!geoOutcome.ok) return;
            const geoData = geoOutcome.data;
            if (!isCurrentRequest()) return;
            if (!geoData || geoData.error) return;
            // ipapi.co fields: country_name, region, city, org, asn
            const country = geoData.country_name || geoData.country || undefined;
            const region = geoData.region || geoData.region_code || undefined;
            const city = geoData.city || undefined;
            const isp = geoData.org || geoData.isp || geoData.asn || undefined;
            setServerData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                location: {
                  country: country || prev.location?.country || 'Unknown',
                  region: region || prev.location?.region || 'Unknown',
                  city: city || prev.location?.city || 'Unknown',
                  isp: isp || prev.location?.isp || 'Unknown Provider',
                },
              };
            });
          })
          .catch(() => {
            // ignore
          });
      }

      // Save to search history (upsert to avoid duplicates) and trigger gamification
      // Only do this on initial load, not refreshes
      if (!isRefresh) {
        try {
          const { data: session } = await supabase.auth.getSession();
          if (!isCurrentRequest()) return;
          if (session?.session?.user) {
            const userId = session.session.user.id;
            
            // Delete existing entry for this server, then insert new one
            // This ensures only one entry per server and updates the timestamp
            await supabase
              .from('search_history')
              .delete()
              .eq('user_id', userId)
              .eq('query', serverCode)
              .abortSignal(controller.signal);
            if (!isCurrentRequest()) return;
            
            await supabase.from('search_history').insert({
              user_id: userId,
              query: serverCode,
              search_type: serverInfo.hostname || 'server',
            }).abortSignal(controller.signal);
            if (!isCurrentRequest()) return;
            
            // Trigger gamification
            void GamificationService.onSearch();
          }
        } catch (historyError) {
          console.log("Could not save to history:", historyError);
        }
      }

    } catch (err) {
      if (!isCurrentRequest() && err instanceof AsyncRequestError && err.kind === "aborted") return;
      // AsyncRequestError already carries a friendly message + kind.
      const isAsyncErr = err instanceof AsyncRequestError;
      const raw = err instanceof Error ? err.message : "Failed to fetch server data";
      const stack = err instanceof Error && err.stack ? err.stack : "";
      const looksOffline =
        isAsyncErr
          ? err.kind === "timeout" || err.kind === "network" || err.kind === "server"
          : /503|temporarily unavailable|SUPABASE_EDGE_RUNTIME_ERROR|Failed to fetch|NetworkError|timeout|502|504/i.test(raw);
      const message = looksOffline ? t("lookup.offline") : raw;
      setError(message);
      setErrorDetails(stack ? `${raw}\n\n${stack}` : raw);
      if (!isRefresh) {
        // Single toast (deduped via id) so retries don't spam.
        toast.error(message, { id: `cfx-lookup-error-${serverCode}` });
        setServerData(null);
      } else {
        console.log("Refresh failed, keeping existing data:", message);
      }
    } finally {
      // GUARANTEE the loading state always resolves.
      if (isCurrentRequest() || abortControllerRef.current === controller) {
        setIsLoading(false);
        if (abortControllerRef.current === controller) abortControllerRef.current = null;
      }
    }
  }, [serverData, t]);

  // Abort any in-flight lookup when the hook unmounts.
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
      cancelAsyncScope("server-lookup");
    };
  }, []);

  const clearData = useCallback(() => {
    abortControllerRef.current?.abort();
    cancelAsyncScope("server-lookup");
    setServerData(null);
    setError(null);
    setErrorDetails(null);
    setLastSearchedCode(null);
  }, []);

  return {
    isLoading,
    serverData,
    error,
    errorDetails,
    lastSearchedCode,
    fetchServerData,
    clearData
  };
};

function getEstimatedLocation(locale?: string): { country: string; region: string; city: string; isp: string } {
  const localeMap: Record<string, { country: string; region: string; city: string }> = {
    'da-DK': { country: 'Denmark', region: 'Unknown', city: 'Unknown' },
    'de-DE': { country: 'Germany', region: 'Hesse', city: 'Frankfurt' },
    'en-US': { country: 'United States', region: 'Virginia', city: 'Ashburn' },
    'en-GB': { country: 'United Kingdom', region: 'England', city: 'London' },
    'fr-FR': { country: 'France', region: 'Île-de-France', city: 'Paris' },
    'nl-NL': { country: 'Netherlands', region: 'North Holland', city: 'Amsterdam' },
    'pl-PL': { country: 'Poland', region: 'Masovia', city: 'Warsaw' },
    'es-ES': { country: 'Spain', region: 'Madrid', city: 'Madrid' },
    'pt-BR': { country: 'Brazil', region: 'São Paulo', city: 'São Paulo' },
    'ru-RU': { country: 'Russia', region: 'Moscow', city: 'Moscow' },
  };

  const normalized = (locale || '').trim();
  const direct = localeMap[normalized];
  if (direct) return { ...direct, isp: 'Unknown Provider' };

  // Generic fallback: if locale looks like xx-YY, map YY to a country name.
  const cc = normalized.includes('-') ? normalized.split('-')[1]?.toUpperCase() : undefined;
  const countryByCode: Record<string, string> = {
    DK: 'Denmark',
    SE: 'Sweden',
    NO: 'Norway',
    FI: 'Finland',
    DE: 'Germany',
    NL: 'Netherlands',
    GB: 'United Kingdom',
    US: 'United States',
    FR: 'France',
    ES: 'Spain',
    PL: 'Poland',
    BR: 'Brazil',
    RU: 'Russia',
  };

  const country = (cc && countryByCode[cc]) || 'Unknown';
  return { country, region: 'Unknown', city: 'Unknown', isp: 'Unknown Provider' };
}
