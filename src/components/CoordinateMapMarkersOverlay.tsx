import { MapPin } from "lucide-react";

import { cn } from "@/lib/utils";

interface CoordinateMapMarkersOverlayProps {
  markers: Array<{
    id: string;
    label: string;
    tone: number;
    details: string;
    screenX: number;
    screenY: number;
    visible: boolean;
  }>;
}

const OVERLAY_TONES = [
  {
    pinClass: "text-primary",
    dotClass: "bg-primary border-primary/40",
    labelClass: "border-primary/30 bg-background/90 text-foreground",
  },
  {
    pinClass: "text-accent",
    dotClass: "bg-accent border-accent/40",
    labelClass: "border-accent/30 bg-background/90 text-foreground",
  },
  {
    pinClass: "text-foreground",
    dotClass: "bg-secondary border-secondary/50",
    labelClass: "border-secondary/50 bg-secondary/90 text-secondary-foreground",
  },
] as const;

const CoordinateMapMarkersOverlay = ({ markers }: CoordinateMapMarkersOverlayProps) => {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {markers.filter((marker) => marker.visible).map((marker) => {
        const tone = OVERLAY_TONES[marker.tone % OVERLAY_TONES.length];

        return (
          <div
            key={marker.id}
            className="absolute -translate-x-[18px] -translate-y-[calc(100%+4px)]"
            style={{ left: marker.screenX, top: marker.screenY }}
          >
            <div className="flex items-start gap-2">
              <div className="relative mt-0.5 drop-shadow-[0_8px_18px_hsl(var(--background)/0.45)]">
                <MapPin className={cn("h-8 w-8", tone.pinClass)} fill="currentColor" />
                <span
                  className={cn(
                    "absolute left-1/2 top-[42%] h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background",
                    tone.dotClass,
                  )}
                />
              </div>

              <div className={cn("max-w-[220px] rounded-xl border px-3 py-2 shadow-xl backdrop-blur-md", tone.labelClass)}>
                <p className="truncate text-xs font-semibold text-foreground">{marker.label}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">{marker.details}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CoordinateMapMarkersOverlay;