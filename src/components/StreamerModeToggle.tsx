import { Video, VideoOff } from "lucide-react";
import { useStreamerMode } from "@/hooks/useStreamerMode";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StreamerModeToggleProps {
  /** Compact mode for navbar/header */
  compact?: boolean;
  className?: string;
}

const StreamerModeToggle = ({ compact = false, className }: StreamerModeToggleProps) => {
  const { isEnabled, toggle } = useStreamerMode();

  const handleToggle = () => {
    toggle();
    toast.success(
      isEnabled 
        ? "Streamer Mode disabled - Sensitive info visible" 
        : "Streamer Mode enabled - Sensitive info hidden"
    );
  };

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        className={cn(
          "flex items-center justify-center p-2 rounded-lg transition-colors",
          isEnabled 
            ? "bg-destructive/20 text-destructive hover:bg-destructive/30" 
            : "bg-muted text-muted-foreground hover:bg-muted/80",
          className
        )}
        aria-label={isEnabled ? "Disable Streamer Mode" : "Enable Streamer Mode"}
        title={isEnabled ? "Streamer Mode ON - Click to disable" : "Streamer Mode OFF - Click to enable"}
      >
        {isEnabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <div className={cn("flex items-center justify-between gap-4 p-4 rounded-xl bg-secondary/50", className)}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          isEnabled ? "bg-destructive/20" : "bg-muted"
        )}>
          {isEnabled ? (
            <VideoOff className="w-5 h-5 text-destructive" />
          ) : (
            <Video className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div>
          <Label htmlFor="streamer-mode" className="text-sm font-medium cursor-pointer">
            Streamer Mode
          </Label>
          <p className="text-xs text-muted-foreground">
            {isEnabled 
              ? "Sensitive information is blurred" 
              : "Hide IPs, player IDs, and other sensitive data"}
          </p>
        </div>
      </div>
      <Switch
        id="streamer-mode"
        checked={isEnabled}
        onCheckedChange={handleToggle}
      />
    </div>
  );
};

export default StreamerModeToggle;
