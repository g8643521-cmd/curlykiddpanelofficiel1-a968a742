import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorCardProps {
  title?: string;
  /** User-facing description. */
  message?: string;
  /** Optional technical details, hidden by default. */
  details?: string | null;
  /** Retry handler. If omitted, no retry button is shown. */
  onRetry?: () => void;
  /** Whether a retry is currently running (disables the button). */
  isRetrying?: boolean;
  className?: string;
  /** Compact layout for small areas. */
  compact?: boolean;
}

/**
 * Inline error card with an optional Retry action. Used everywhere data
 * fails to load — never replace this with a blank component or an
 * infinite spinner.
 */
export function ErrorCard({
  title = "Something went wrong",
  message = "We couldn't load this data. Please try again.",
  details,
  onRetry,
  isRetrying = false,
  className,
  compact = false,
}: ErrorCardProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/30 bg-destructive/5 text-destructive-foreground",
        compact ? "p-3" : "p-5",
        "flex flex-col gap-3",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm">{title}</p>
          <p className="text-sm text-muted-foreground mt-1 break-words">{message}</p>
          {details ? (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground/70 cursor-pointer hover:text-muted-foreground">
                Technical details
              </summary>
              <pre className="mt-2 text-xs whitespace-pre-wrap break-words text-muted-foreground/80 max-h-32 overflow-auto">
                {details}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isRetrying && "animate-spin")} aria-hidden />
            {isRetrying ? "Retrying…" : "Try again"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
