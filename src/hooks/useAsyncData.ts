import { useCallback, useEffect, useRef, useState } from "react";
import { runAsync, type AsyncRequestError, type RunOptions } from "@/lib/asyncRequest";

export interface UseAsyncDataState<T> {
  data: T | null;
  isLoading: boolean;
  error: AsyncRequestError | null;
  /** Re-runs the task with the same args used previously. */
  retry: () => void;
  /** Aborts any in-flight request. */
  cancel: () => void;
  /** Manually run with new args. */
  run: () => void;
}

interface UseAsyncDataOptions<T> extends RunOptions {
  /** If false, doesn't run on mount (manual trigger via run/retry). */
  enabled?: boolean;
  /** Called on success. */
  onSuccess?: (data: T) => void;
  /** Called on error (NOT on aborted-by-caller). */
  onError?: (error: AsyncRequestError) => void;
}

/**
 * Standardized async data hook.
 *
 * - 5s default timeout, retry-once for transient errors.
 * - Auto-cancels on unmount and on re-run.
 * - Never leaves the component in an infinite loading state — every run
 *   resolves to data or error within `timeoutMs`.
 */
export function useAsyncData<T>(
  task: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList,
  options: UseAsyncDataOptions<T> = {},
): UseAsyncDataState<T> {
  const { enabled = true, onSuccess, onError, ...runOpts } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AsyncRequestError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const taskRef = useRef(task);
  const optsRef = useRef({ onSuccess, onError, runOpts });
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Keep refs fresh without changing identities the consumer passes in deps.
  taskRef.current = task;
  optsRef.current = { onSuccess, onError, runOpts };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const run = useCallback(() => {
    // Cancel any previous request.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    runAsync((signal) => {
      // Combine internal controller with asyncRequest's own signal.
      const combined = new AbortController();
      const onAbort = () => combined.abort();
      controller.signal.addEventListener("abort", onAbort);
      signal.addEventListener("abort", onAbort);
      return taskRef.current(combined.signal);
    }, { ...optsRef.current.runOpts, signal: controller.signal })
      .then((outcome) => {
        if (!mountedRef.current) return;
        if (controller.signal.aborted && outcome.ok === false && outcome.error.kind === "aborted") {
          // Silent — caller-initiated cancel.
          if (controllerRef.current === controller) setIsLoading(false);
          return;
        }
        if (controllerRef.current !== controller) return;
        setIsLoading(false);
        if (outcome.ok) {
          setData(outcome.data);
          setError(null);
          optsRef.current.onSuccess?.(outcome.data);
        } else {
          setError(outcome.error);
          optsRef.current.onError?.(outcome.error);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run when enabled deps change.
  useEffect(() => {
    if (!enabled) return;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, isLoading, error, retry: run, cancel, run };
}
