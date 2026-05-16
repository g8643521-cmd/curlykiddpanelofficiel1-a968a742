/**
 * Thin wrapper around fetch() that participates in the global async system:
 *  - hard wall-clock timeout (default 8s, longer than RPC because of OAuth)
 *  - AbortSignal propagation
 *  - JSON parse + structured error
 *
 * Use for raw HTTP endpoints (Discord OAuth callbacks, /api/public/*, etc).
 * For supabase.functions.invoke prefer runAsync directly.
 */
import { runAsync, AsyncRequestError, type AsyncOutcome, type RunOptions } from "@/lib/asyncRequest";

export interface ApiFetchInit extends Omit<RequestInit, "signal"> {
  json?: unknown;
}

export async function apiFetch<T = unknown>(
  url: string,
  init: ApiFetchInit = {},
  runOpts: RunOptions = {},
): Promise<AsyncOutcome<T>> {
  const { json, headers, body, ...rest } = init;

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined),
  };
  let finalBody: BodyInit | null | undefined = body as BodyInit | null | undefined;

  if (json !== undefined) {
    finalHeaders["Content-Type"] = finalHeaders["Content-Type"] || "application/json";
    finalBody = JSON.stringify(json);
  }

  return runAsync<T>(
    async (signal) => {
      const res = await fetch(url, { ...rest, headers: finalHeaders, body: finalBody, signal });
      const text = await res.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
      }
      if (!res.ok) {
        const message =
          (parsed && typeof parsed === "object" && "error" in parsed && typeof (parsed as { error?: string }).error === "string"
            ? (parsed as { error: string }).error
            : null) || `Request failed (${res.status})`;
        throw new AsyncRequestError(res.status >= 500 ? "server" : "client", message, { status: res.status, cause: parsed });
      }
      return parsed as T;
    },
    { timeoutMs: 8000, retries: 1, ...runOpts, label: runOpts.label ?? url },
  );
}
