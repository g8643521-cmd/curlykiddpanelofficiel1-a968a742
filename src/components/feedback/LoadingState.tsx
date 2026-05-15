import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Optional label shown below spinner. */
  label?: string;
  /** Variant: 'inline' fits inside small areas, 'block' fills its parent. */
  variant?: "inline" | "block";
  className?: string;
  /** Ms before showing the "still loading…" warning. Default 5000. */
  slowAfterMs?: number;
  /** Optional message when slow. */
  slowMessage?: string;
}

/**
 * Standardized loading indicator with a "taking longer than expected"
 * follow-up message so the user is never left guessing.
 */
export function LoadingState({
  label = "Loading…",
  variant = "block",
  className,
  slowAfterMs = 5000,
  slowMessage = "Still working… this is taking longer than expected.",
}: LoadingStateProps) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), slowAfterMs);
    return () => clearTimeout(t);
  }, [slowAfterMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        variant === "block" ? "min-h-[120px] p-6" : "py-2",
        className,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <p className="text-sm">{label}</p>
      {slow ? (
        <p className="text-xs text-muted-foreground/70 max-w-xs text-center">
          {slowMessage}
        </p>
      ) : null}
    </div>
  );
}
