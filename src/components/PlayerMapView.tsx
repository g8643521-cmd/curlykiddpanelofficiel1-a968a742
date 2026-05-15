import { useState, useMemo } from "react";
import { Map, MapPin, Users, AlertCircle, Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import gtaMapImage from "@/assets/gta-v-satellite-map.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PlayerWithCoords {
  id: number;
  name: string;
  ping: number;
  coords?: {
    x: number;
    y: number;
    z?: number;
  };
}

interface PlayerMapViewProps {
  players: PlayerWithCoords[];
  serverName?: string;
}

// GTA V map bounds (approximate world coordinates)
const MAP_BOUNDS = {
  minX: -4000,
  maxX: 4500,
  minY: -4000,
  maxY: 8000,
};

// Convert GTA world coordinates to map percentage position
const worldToMapPosition = (x: number, y: number) => {
  const mapX = ((x - MAP_BOUNDS.minX) / (MAP_BOUNDS.maxX - MAP_BOUNDS.minX)) * 100;
  // Y is inverted in GTA (north is positive)
  const mapY = 100 - ((y - MAP_BOUNDS.minY) / (MAP_BOUNDS.maxY - MAP_BOUNDS.minY)) * 100;
  return { x: Math.max(0, Math.min(100, mapX)), y: Math.max(0, Math.min(100, mapY)) };
};

// Get color based on player index for variety
const getPlayerColor = (index: number) => {
  const colors = [
    "bg-primary",
    "bg-cyan",
    "bg-magenta",
    "bg-yellow",
    "bg-green",
    "bg-purple",
    "bg-orange",
    "bg-pink",
  ];
  return colors[index % colors.length];
};

const PlayerMapView = ({ players, serverName }: PlayerMapViewProps) => {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Filter players with valid coordinates
  const playersWithCoords = useMemo(() => {
    return players.filter(
      (p) => p.coords && typeof p.coords.x === "number" && typeof p.coords.y === "number"
    );
  }, [players]);

  const hasCoordinates = playersWithCoords.length > 0;

  if (!hasCoordinates) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-muted">
            <Map className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Player Map</h3>
            <p className="text-sm text-muted-foreground">In-game positions</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-sm max-w-xs">
            This server does not expose player coordinates. Map view is only available for servers
            that share position data publicly.
          </p>
          <Badge variant="secondary" className="mt-4 text-xs">
            {players.length} players online (positions hidden)
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card p-6 ${isFullscreen ? "fixed inset-4 z-50" : ""}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Map className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Player Map</h3>
            <p className="text-sm text-muted-foreground">
              {playersWithCoords.length} of {players.length} players visible
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="h-8 w-8"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="h-8 w-8"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-8 w-8"
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <div
        className="relative w-full overflow-hidden rounded-lg border border-border/50"
        style={{ height: isFullscreen ? "calc(100% - 80px)" : "400px" }}
      >
        {/* Map Background - GTA V Satellite Map */}
        <div
          className="absolute inset-0"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            transition: "transform 0.2s ease-out",
          }}
        >
          {/* Satellite Map Image */}
          <img
            src={gtaMapImage}
            alt="GTA V Satellite Map"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
          
          {/* Subtle overlay for better marker visibility */}
          <div className="absolute inset-0 bg-black/20" />

          {/* Player markers */}
          {playersWithCoords.map((player, index) => {
            const pos = worldToMapPosition(player.coords!.x, player.coords!.y);
            return (
              <Tooltip key={player.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`absolute w-3 h-3 rounded-full ${getPlayerColor(index)} border-2 border-background shadow-lg cursor-pointer hover:scale-150 transition-transform z-10`}
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    {/* Pulse animation */}
                    <div
                      className={`absolute inset-0 rounded-full ${getPlayerColor(index)} animate-ping opacity-50`}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-semibold">{player.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>
                        X: {Math.round(player.coords!.x)}, Y: {Math.round(player.coords!.y)}
                        {player.coords!.z !== undefined && `, Z: ${Math.round(player.coords!.z)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Ping: {player.ping}ms</span>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-muted-foreground">Player Position</span>
          </div>
        </div>

        {/* Compass */}
        <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm rounded-lg p-2 text-xs font-bold text-muted-foreground">
          N
        </div>
      </div>

      {/* Player List with Coords */}
      <div className="mt-4 max-h-32 overflow-y-auto">
        <div className="flex flex-wrap gap-2">
          {playersWithCoords.slice(0, 12).map((player, index) => (
            <Badge
              key={player.id}
              variant="secondary"
              className="text-xs flex items-center gap-1"
            >
              <div className={`w-2 h-2 rounded-full ${getPlayerColor(index)}`} />
              {player.name}
            </Badge>
          ))}
          {playersWithCoords.length > 12 && (
            <Badge variant="outline" className="text-xs">
              +{playersWithCoords.length - 12} more
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerMapView;
