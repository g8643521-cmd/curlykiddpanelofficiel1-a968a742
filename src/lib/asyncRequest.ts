/**
 * Global async request runner.
 *
 * Guarantees:
 *  - Always resolves (success | error | timeout) — never hangs forever.
 *  - Timeout via AbortController; signal is forwarded so downstream callers
 *    can react. Promise.race ensures we win the deadline even if a non-
 *    cancelable promise ignores the signal.
 *  - Optional retry (default 1) for transient failures (timeout / 5xx /
 *    network). 4xx are never retried.
 *  - Caller can pass an external AbortSignal that aborts the whole thing.
 */

export type AsyncOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; error: AsyncRequestError };

export class AsyncRequestError extends Error {
  readonly kind: "timeout" | "aborted" | "network" | "server" | "client" | "unknown";
  readonly status?: number;
  readonly cause?: unknown;
  constructor(
    kind: AsyncRequestError["kind"],
    message: string,
    opts: { status?: number; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "AsyncRequestError";
    this.kind = kind;
    this.status = opts.status;
    this.cause = opts.cause;
  }
}

export interface RunOptions {
  timeoutMs?: number; // default 5000
  retries?: number; // default 1 (transient only)
  signal?: AbortSignal; // external abort
  retryDelayMs?: number; // default 400
  /** Optional label for diagnostic logging. */
  label?: string;
  /** Optional cancellation scope used to abort related background work. */
  scope?: string;
}

const activeScopes = new Map<string, Set<AbortController>>();

export function cancelAsyncScope(scope: string) {
  const controllers = activeScopes.get(scope);
  if (!controllers) return;
  controllers.forEach((controller) => controller.abort());
  controllers.clear();
  activeScopes.delete(scope);
}

export function cancelAllAsyncRequests() {
  Array.from(activeScopes.keys()).forEach(cancelAsyncScope);
}

function registerScopedController(scope: string | undefined, controller: AbortController) {
  if (!scope) return () => {};
  const controllers = activeScopes.get(scope) ?? new Set<AbortController>();
  controllers.add(controller);
  activeScopes.set(scope, controllers);
  return () => {
    controllers.delete(controller);
    if (controllers.size === 0) activeScopes.delete(scope);
  };
}

const TRANSIENT_PATTERN =
  /timeout|aborted|failed to fetch|networkerror|load failed|503|502|504|temporarily unavailable|edge_runtime/i;

const isTransient = (err: unknown): boolean => {
  if (err instanceof AsyncRequestError) {
    return err.kind === "timeout" || err.kind === "network" || (err.status !== undefined && err.status >= 500);
  }
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT_PATTERN.test(msg);
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new AsyncRequestError("aborted", "Aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new AsyncRequestError("aborted", "Aborted"));
    });
  });

/**
 * Runs an async task with hard timeout + abort + transient retry.
 * The task receives an AbortSignal it MUST forward to its downstream
 * (fetch / supabase / etc) so cancellation actually propagates.
 */
export async function runAsync<T>(
  task: (signal: AbortSignal) => Promise<T>,
  options: RunOptions = {},
): Promise<AsyncOutcome<T>> {
  const {
    timeoutMs = 5000,
    retries = 1,
    signal: externalSignal,
    retryDelayMs = 400,
    label,
    scope,
  } = options;

  let attempt = 0;
  let lastError: AsyncRequestError | null = null;

  while (attempt <= retries) {
    if (externalSignal?.aborted) {
      return { ok: false, error: new AsyncRequestError("aborted", "Aborted by caller") };
    }

    const controller = new AbortController();
    const unregisterScope = registerScopedController(scope, controller);
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onExternalAbort);

    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const taskPromise = task(controller.signal);
      // Hard wall-clock race: even if the task ignores the signal we still
      // resolve the outer promise on time.
      const result = await Promise.race<T>([
        taskPromise,
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => {
            const reason = (externalSignal?.aborted ?? false)
              ? new AsyncRequestError("aborted", "Aborted by caller")
              : new AsyncRequestError("timeout", `Request timed out after ${timeoutMs}ms`);
            reject(reason);
          });
        }),
      ]);
      return { ok: true, data: result };
    } catch (rawErr) {
      const err = normalizeError(rawErr, label);
      lastError = err;

      // Aborted by external caller — never retry.
      if (err.kind === "aborted" && externalSignal?.aborted) {
        return { ok: false, error: err };
      }

      // 4xx — never retry.
      if (err.kind === "client") {
        return { ok: false, error: err };
      }

      attempt++;
      if (attempt > retries || !isTransient(err)) {
        return { ok: false, error: err };
      }

      // Brief backoff before next attempt; respect external aborts.
      try {
        await sleep(retryDelayMs * attempt, externalSignal);
      } catch {
        return {
          ok: false,
          error: lastError ?? new AsyncRequestError("aborted", "Aborted"),
        };
      }
    } finally {
      clearTimeout(timeoutHandle);
      externalSignal?.removeEventListener("abort", onExternalAbort);
      unregisterScope();
    }
  }

  return { ok: false, error: lastError ?? new AsyncRequestError("unknown", "Request failed") };
}

function normalizeError(err: unknown, label?: string): AsyncRequestError {
  if (err instanceof AsyncRequestError) return err;

  if (err && typeof err === "object" && "name" in err && (err as { name?: string }).name === "AbortError") {
    return new AsyncRequestError("aborted", "Request aborted", { cause: err });
  }

  const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const status =
    err && typeof err === "object" && "status" in err && typeof (err as { status?: number }).status === "number"
      ? (err as { status: number }).status
      : undefined;

  let kind: AsyncRequestError["kind"] = "unknown";
  if (status !== undefined) {
    if (status >= 500) kind = "server";
    else if (status >= 400) kind = "client";
  } else if (/timeout/i.test(message)) {
    kind = "timeout";
  } else if (/failed to fetch|networkerror|load failed/i.test(message)) {
    kind = "network";
  }

  if (label && typeof console !== "undefined") {
    console.warn(`[asyncRequest:${label}] ${kind}: ${message}`);
  }

  return new AsyncRequestError(kind, friendlyMessage(kind, message), { status, cause: err });
}

function friendlyMessage(kind: AsyncRequestError["kind"], raw: string): string {
  switch (kind) {
    case "timeout":
      return "The request took too long to respond. Please try again.";
    case "network":
      return "Network connection failed. Check your internet and try again.";
    case "server":
      return "The server is having trouble responding. Please try again in a moment.";
    case "aborted":
      return raw || "Request was cancelled.";
    case "client":
      return raw || "Request was rejected.";
    default:
      return raw || "Something went wrong.";
  }
}
