import { useEffect, useState } from "react";

const ICON_CACHE_TTL = 1000 * 60 * 60;

type IconCacheEntry = {
  url: string | null;
  expiresAt: number;
};

const iconCache = new Map<string, IconCacheEntry>();
const inFlightRequests = new Map<string, Promise<string | null>>();

const getCacheKey = (serverCode: string) => serverCode.trim().toLowerCase();

const getCachedIcon = (serverCode: string) => {
  const key = getCacheKey(serverCode);
  const cached = iconCache.get(key);

  if (!cached) return undefined;

  if (cached.expiresAt <= Date.now()) {
    if (cached.url) URL.revokeObjectURL(cached.url);
    iconCache.delete(key);
    return undefined;
  }

  return cached.url;
};

const setCachedIcon = (serverCode: string, url: string | null) => {
  iconCache.set(getCacheKey(serverCode), {
    url,
    expiresAt: Date.now() + ICON_CACHE_TTL,
  });
};

const fetchServerIcon = async (serverCode: string, version?: number | null) => {
  const cached = getCachedIcon(serverCode);
  if (cached !== undefined) return cached;

  const key = getCacheKey(serverCode);
  const existingRequest = inFlightRequests.get(key);
  if (existingRequest) return existingRequest;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const request = fetch(`${supabaseUrl}/functions/v1/cfx-icon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      serverCode,
      ...(version !== undefined && version !== null ? { v: version } : {}),
    }),
  })
    .then(async (resp) => {
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("image")) {
        setCachedIcon(serverCode, null);
        return null;
      }

      const blob = await resp.blob();
      if (blob.size < 100) {
        setCachedIcon(serverCode, null);
        return null;
      }

      const url = URL.createObjectURL(blob);
      setCachedIcon(serverCode, url);
      return url;
    })
    .catch(() => {
      setCachedIcon(serverCode, null);
      return null;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, request);
  return request;
};

export const prefetchServerIcon = (serverCode?: string | null, version?: number | null) => {
  if (!serverCode) return Promise.resolve(null);
  return fetchServerIcon(serverCode, version);
};

export const useServerIcon = (serverCode?: string | null, version?: number | null) => {
  const [iconUrl, setIconUrl] = useState<string | null>(() => {
    if (!serverCode) return null;
    return getCachedIcon(serverCode) ?? null;
  });
  const [iconLoading, setIconLoading] = useState(() => {
    if (!serverCode) return false;
    return getCachedIcon(serverCode) === undefined;
  });
  const [iconError, setIconError] = useState(false);

  useEffect(() => {
    if (!serverCode) {
      setIconUrl(null);
      setIconLoading(false);
      setIconError(false);
      return;
    }

    const cached = getCachedIcon(serverCode);
    if (cached !== undefined) {
      setIconUrl(cached);
      setIconLoading(false);
      setIconError(cached === null);
      return;
    }

    let isCancelled = false;

    setIconLoading(true);
    setIconError(false);

    fetchServerIcon(serverCode, version)
      .then((url) => {
        if (isCancelled) return;
        setIconUrl(url);
        setIconError(!url);
      })
      .finally(() => {
        if (isCancelled) return;
        setIconLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [serverCode, version]);

  return {
    iconUrl,
    iconLoading,
    iconError,
  };
};