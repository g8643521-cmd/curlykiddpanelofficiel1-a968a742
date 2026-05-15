import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useStreamerMode } from "@/hooks/useStreamerMode";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SensitiveTextProps {
  children: React.ReactNode;
  /** Type of sensitive data - affects blur intensity */
  type?: "ip" | "identifier" | "email" | "webhook";
  /** Allow user to temporarily reveal (default: true) */
  allowReveal?: boolean;
  /** Custom class name */
  className?: string;
  /** As what element to render */
  as?: "span" | "code" | "p" | "div";
}

const SensitiveText = ({
  children,
  type = "identifier",
  allowReveal = true,
  className,
  as: Component = "span",
}: SensitiveTextProps) => {
  const { isEnabled } = useStreamerMode();
  const [isRevealed, setIsRevealed] = useState(false);

  // If streamer mode is off, render children normally
  if (!isEnabled) {
    return <Component className={className}>{children}</Component>;
  }

  // If temporarily revealed
  if (isRevealed) {
    return (
      <Component className={cn("relative group inline-flex items-center gap-1", className)}>
        {children}
        {allowReveal && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsRevealed(false);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
            aria-label="Hide sensitive information"
          >
            <EyeOff className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </Component>
    );
  }

  // Blurred state
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Component
          className={cn(
            "relative inline-flex items-center gap-1 cursor-pointer group select-none",
            className
          )}
          onClick={allowReveal ? (e) => {
            e.stopPropagation();
            setIsRevealed(true);
          } : undefined}
        >
          <span 
            className={cn(
              "blur-[6px] hover:blur-[4px] transition-all duration-200",
              type === "ip" && "blur-[8px]",
              type === "webhook" && "blur-[10px]"
            )}
            aria-hidden="true"
          >
            {children}
          </span>
          {allowReveal && (
            <Eye className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </Component>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {allowReveal ? "Click to reveal (Streamer Mode)" : "Hidden (Streamer Mode)"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

export default SensitiveText;
