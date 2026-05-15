import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { 
  Users, 
  Globe, 
  MapPin, 
  Wifi, 
  Clock, 
  Server, 
  Search,
  Copy,
  X,
  Shield,
  Tag,
  Eye,
  EyeOff,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Star,
  RefreshCw,
  Download,
  AlertTriangle,
  Image,
  Info,
  ShieldCheck
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ServerData } from "@/hooks/useCfxApi";
import NotificationSettingsDialog from "@/components/NotificationSettingsDialog";

import PlayerCard from "@/components/PlayerCard";
import PingDistributionChart from "@/components/PingDistributionChart";
import AdminResourceControl from "@/components/AdminResourceControl";
import CheaterWarningBanner from "@/components/CheaterWarningBanner";
import SensitiveText from "@/components/SensitiveText";



import ResourceCategories from "@/components/ResourceCategories";
import ServerOwnerCard from "@/components/ServerOwnerCard";

import ResourceInspector from "@/components/ResourceInspector";
import PlayerReputation from "@/components/PlayerReputation";
import EmbedCodeGenerator from "@/components/EmbedCodeGenerator";

import { useAdminStatus } from "@/hooks/useAdminStatus";
import { useCheaterDatabase } from "@/hooks/useCheaterDatabase";
import { useServerIcon } from "@/hooks/useServerIcon";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useStreamerMode } from "@/hooks/useStreamerMode";
import { detectAllAntiCheats } from "@/utils/antiCheatDetection";
import { formatDistanceToNow } from "date-fns";
import { GamificationService } from "@/services/gamificationService";


interface ServerDetailsProps {
  data: ServerData;
  serverCode?: string | null;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  notificationProps?: {
    hasNotification: boolean;
    currentSettings?: {
      notify_online: boolean;
      notify_player_threshold: boolean;
      player_threshold: number;
    };
    permissionGranted: boolean;
    onRequestPermission: () => Promise<boolean>;
    onSave: (options: { notifyOnline: boolean; notifyThreshold: boolean; threshold: number }) => Promise<boolean>;
    onRemove: () => Promise<boolean>;
  };
  lastUpdate?: Date | null;
  isPolling?: boolean;
  onRefresh?: () => void;
}

const ServerDetails = ({ 
  data: rawData,
  serverCode: propServerCode,
  onClose, 
  isFavorite = false, 
  onToggleFavorite,
  notificationProps,
  lastUpdate,
  isPolling,
  onRefresh,
}: ServerDetailsProps) => {
  const [resourceSearch, setResourceSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerSort, setPlayerSort] = useState<"name" | "id" | "ping">("name");
  const [showAllResources, setShowAllResources] = useState(false);
  const autoTrackingDone = useRef(false);
  const data = useMemo(
    () => ({
      ...rawData,
      hostname: rawData?.hostname ?? "",
      players: Array.isArray(rawData?.players) ? rawData.players : [],
      resources: Array.isArray(rawData?.resources) ? rawData.resources : [],
      maxPlayers: typeof rawData?.maxPlayers === "number" ? rawData.maxPlayers : 0,
    }),
    [rawData]
  );
  const { isAdmin } = useAdminStatus();
  const { checkPlayersAgainstCheaters, isCheater, fetchCheaters } = useCheaterDatabase();
  const { getVisibility, isLoading: settingsLoading } = useSystemSettings();
  const { isEnabled: streamerMode } = useStreamerMode();
  
  // Check settings visibility - respect the setting for all users
  // While settings are loading, default to false to prevent flash
  // 'all' = visible to everyone, 'admin' = admin only, 'disabled' = hidden for everyone
  const showPingDistribution = !settingsLoading && (getVisibility('show_ping_distribution') === 'all' || (isAdmin && getVisibility('show_ping_distribution') === 'admin'));
  // Use the passed server code, or extract from license key token as fallback
  const serverCode = propServerCode || data.licenseKeyToken?.split("_")[0] || null;
  const { iconUrl, iconLoading, iconError } = useServerIcon(propServerCode, data.iconVersion);

  // Check for cheaters among current players - memoize to prevent disappearing on refresh
  const cheaterMatches = useMemo(() => {
    const matches = checkPlayersAgainstCheaters(data.players);
    return matches;
  }, [data.players, checkPlayersAgainstCheaters]);
  
  // Keep stable reference to cheater matches to prevent banner from disappearing during refreshes
  const [stableCheaterMatches, setStableCheaterMatches] = useState(cheaterMatches);
  
  useEffect(() => {
    // Only update stable matches if we have new matches or if matches were cleared intentionally
    if (cheaterMatches.length > 0) {
      setStableCheaterMatches(cheaterMatches);
    }
    // If cheaterMatches becomes empty but we had matches before, keep the old ones
    // This prevents the banner from disappearing during data refresh cycles
  }, [cheaterMatches]);
  
  const serverNameClean = (data.hostname || '').replace(/\^[0-9]/g, '').replace(/~[a-zA-Z]~/g, '');
  
  // Detect anti-cheats from resources (memoized for performance)
  const detectedAntiCheats = useMemo(() => detectAllAntiCheats(data.resources), [data.resources]);


  const filteredResources = data.resources.filter((r) =>
    r.toLowerCase().includes(resourceSearch.toLowerCase())
  );

  const displayedResources = showAllResources ? filteredResources : filteredResources.slice(0, 18);

  const sortedPlayers = [...data.players]
    .filter((p) => p.name.toLowerCase().includes(playerSearch.toLowerCase()))
    .sort((a, b) => {
      if (playerSort === "name") return a.name.localeCompare(b.name);
      if (playerSort === "id") return a.id - b.id;
      return a.ping - b.ping;
    });

  const effectivePlayerCount = data.players.length > 0 ? data.players.length : (data.playerCount ?? 0);

  const playerPercentage = data.maxPlayers > 0 ? (effectivePlayerCount / data.maxPlayers) * 100 : 0;
  const avgPing = data.players.length > 0
    ? Math.round(data.players.reduce((sum, p) => sum + p.ping, 0) / data.players.length)
    : 0;

  const copyToClipboard = (text: string, label: string) => {
    if (streamerMode) {
      toast.error("Copying disabled in Streamer Mode");
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const stripColorCodes = (str: string) => {
    return str.replace(/\^[0-9]/g, '').replace(/~[a-zA-Z]~/g, '').replace(/\[.*?\]/g, '');
  };

  const parseTags = (tags: string) => {
    return tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
  };

  const getConnectionString = () => {
    if (data.ip && data.port) {
      return `connect ${data.ip}:${data.port}`;
    }
    return null;
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Cheater Warning Banner - use stableCheaterMatches to prevent disappearing during refresh */}
      {stableCheaterMatches.length > 0 && (
        <div>
          <CheaterWarningBanner matches={stableCheaterMatches} />
        </div>
      )}
      {/* Header Card */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 flex-1">
            {/* Server Icon with Player Count Badge */}
            <div className="relative shrink-0">
              <div className={`w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-[hsl(var(--cyan))]/20 flex items-center justify-center ${iconLoading && !iconUrl ? 'animate-pulse' : ''}`}>
                {iconUrl && !iconError ? (
                  <img src={iconUrl} alt="Server icon" className="w-full h-full object-cover" />
                ) : (
                  <Server className="w-7 h-7 text-primary" />
                )}
              </div>
              {/* Player Count Badge */}
              <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold shadow-lg border border-background animate-pulse">
                {effectivePlayerCount}/{data.maxPlayers}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-xl md:text-2xl font-bold text-foreground break-words">
                  {stripColorCodes(data.hostname)}
                </h2>
                {/* Anti-Cheat Badges */}
                {detectedAntiCheats.length > 0 && detectedAntiCheats.map((ac) => (
                  <Tooltip key={ac.name}>
                    <TooltipTrigger asChild>
                      <Badge 
                        className="text-xs font-semibold bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border border-[hsl(var(--green))]/40 animate-fade-in gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {ac.name}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This server has <strong>{ac.name}</strong> protection enabled</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              {data.projectName && (
                <p className="text-muted-foreground text-sm mt-1">{data.projectName}</p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {data.ip && (
                  <button
                    onClick={() => copyToClipboard(`${data.ip}:${data.port}`, "IP Address")}
                    className="flex items-center gap-2 text-primary text-sm hover:underline"
                  >
                    <SensitiveText type="ip" as="span" className="font-mono">
                      {data.ip}:{data.port}
                    </SensitiveText>
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
                {getConnectionString() && (
                  <button
                    onClick={() => copyToClipboard(getConnectionString()!, "Connect Command")}
                    className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm hover:bg-primary/30 transition-colors"
                  >
                    <span className="font-mono text-xs">connect</span>
                    <Copy className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isPolling}
                className="text-muted-foreground hover:text-primary"
              >
                <RefreshCw className={`w-5 h-5 ${isPolling ? 'animate-spin' : ''}`} />
              </Button>
            )}
            {notificationProps && (
              <NotificationSettingsDialog
                serverCode={data.licenseKeyToken?.split('_')[0] || ''}
                serverName={data.hostname}
                hasNotification={notificationProps.hasNotification}
                currentSettings={notificationProps.currentSettings}
                permissionGranted={notificationProps.permissionGranted}
                onRequestPermission={notificationProps.onRequestPermission}
                onSave={notificationProps.onSave}
                onRemove={notificationProps.onRemove}
              />
            )}
            {onToggleFavorite && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onToggleFavorite}
                className={isFavorite ? "text-yellow hover:text-yellow" : "text-muted-foreground hover:text-yellow"}
              >
                <Star className={`w-5 h-5 ${isFavorite ? 'fill-yellow' : ''}`} />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Live Status */}
        {lastUpdate && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}</span>
            {isPolling && <span className="text-primary animate-pulse">(refreshing...)</span>}
          </div>
        )}

        {/* Tags */}
        {data.tags && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
            {parseTags(data.tags).map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs hover:scale-105 transition-transform">
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Banner Image */}
      {data.banner && (
        <div className="glass-card overflow-hidden">
          <img 
            src={data.banner} 
            alt="Server Banner" 
            className="w-full h-32 sm:h-48 object-cover"
            loading="lazy"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
        </div>
      )}

      {/* Project Description */}
      {data.projectDesc && (
        <div className="glass-card p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground mb-1">About This Server</p>
              <p className="text-sm text-foreground">{data.projectDesc}</p>
            </div>
          </div>
        </div>
      )}

      {/* Server Info Grid */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <Server className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">Server Information</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Game Type</p>
            <p className="text-sm font-medium text-foreground">{data.gametype || 'FiveM'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Map</p>
            <p className="text-sm font-medium text-foreground">{data.mapname || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Game Build</p>
            <p className="text-sm font-medium text-foreground">{data.enforceGameBuild || 'Default'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">OneSync</p>
            <p className={`text-sm font-medium ${data.onesyncEnabled ? 'text-[hsl(var(--green))]' : 'text-muted-foreground'}`}>
              {data.onesyncEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Premium</p>
            <p className="text-sm font-medium text-foreground capitalize">{data.premiumTier || 'None'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Locale</p>
            <p className="text-sm font-medium text-foreground">{data.locale || 'en'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Server Version</p>
            <p className="text-sm font-medium text-foreground truncate" title={data.server}>
              {data.server ? data.server.split(' ')[0] : 'Unknown'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Script Hook</p>
            <p className={`text-sm font-medium ${data.scriptHookAllowed ? 'text-[hsl(var(--orange))]' : 'text-[hsl(var(--green))]'}`}>
              {data.scriptHookAllowed ? 'Allowed' : 'Blocked'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Pure Level</p>
            <p className="text-sm font-medium text-foreground">{data.pureLevel || '0'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Access</p>
            <p className={`text-sm font-medium ${data.private ? 'text-[hsl(var(--red))]' : 'text-[hsl(var(--green))]'}`}>
              {data.private ? 'Private' : 'Public'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Enhanced Host</p>
            <p className={`text-sm font-medium ${data.enhancedHostSupport ? 'text-[hsl(var(--green))]' : 'text-muted-foreground'}`}>
              {data.enhancedHostSupport ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Support</p>
            <p className="text-sm font-medium text-foreground capitalize">{data.supportStatus || 'Unknown'}</p>
          </div>
          {data.txAdmin && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">txAdmin</p>
              <p className="text-sm font-medium text-foreground">{data.txAdmin}</p>
            </div>
          )}
          {(data.upvotePower !== undefined && data.upvotePower > 0) && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Upvote Power</p>
              <p className="text-sm font-medium text-[hsl(var(--yellow))]">{data.upvotePower.toLocaleString()}</p>
            </div>
          )}
          {(data.burstPower !== undefined && data.burstPower > 0) && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Burst Power</p>
              <p className="text-sm font-medium text-[hsl(var(--orange))]">{data.burstPower.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Discord link */}
        {data.discordGuildId && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <a 
              href={`https://discord.gg/${data.discordGuildId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <MessageCircle className="w-4 h-4" />
              Join Discord Server <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Resources */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-foreground">
            Server Resources ({data.resources.length})
          </h3>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search resources..."
            value={resourceSearch}
            onChange={(e) => setResourceSearch(e.target.value)}
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {displayedResources.map((resource) => (
            <button
              key={resource}
              onClick={() => copyToClipboard(resource, "Resource")}
              className="p-3 bg-secondary/50 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-left truncate"
            >
              {resource}
            </button>
          ))}
        </div>
        {filteredResources.length > 18 && (
          <button
            onClick={() => setShowAllResources(!showAllResources)}
            className="mt-4 flex items-center gap-2 text-primary text-sm hover:underline mx-auto"
          >
            {showAllResources ? (
              <>Show Less <ChevronUp className="w-4 h-4" /></>
            ) : (
              <>Show All ({filteredResources.length}) <ChevronDown className="w-4 h-4" /></>
            )}
          </button>
        )}
        {data.lastSeen && (
          <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-muted-foreground text-sm">
            <Clock className="w-4 h-4" />
            <span>Last seen: Just now</span>
          </div>
        )}
      </div>

      {/* Resource Categories */}
      <ResourceCategories resources={data.resources} />

      {/* Server Owner Card */}
      <ServerOwnerCard 
        ownerName={data.ownerName} 
        ownerProfile={data.ownerProfile} 
        ownerAvatar={data.ownerAvatar} 
      />



      {/* Player Distribution */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">
            Player Distribution
          </h3>
          <div className="ml-auto flex items-center gap-2">
            <div className="status-online" />
            <span className="text-[hsl(var(--green))] text-sm font-medium">Online</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <Progress value={playerPercentage} className="h-3" />
          </div>
          <div className="text-right shrink-0">
            <p className="text-primary font-bold text-lg">{effectivePlayerCount}/{data.maxPlayers}</p>
            <p className="text-muted-foreground text-xs">{playerPercentage.toFixed(1)}% Full</p>
          </div>
        </div>
      </div>

      {/* Location Details */}
      {data.location && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-primary" />
            <h3 className="font-display text-lg font-semibold text-foreground">
              Location Details
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-sm">Country</p>
                <p className="text-foreground font-medium">{data.location.country}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-sm">Region</p>
                <p className="text-foreground font-medium">{data.location.region}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-sm">City</p>
                <p className="text-foreground font-medium">{data.location.city}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Wifi className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground text-sm">ISP</p>
                <p className="text-foreground font-medium">{data.location.isp}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ping Distribution Chart */}
      {showPingDistribution && data.players.length > 0 && (
        <PingDistributionChart players={data.players} />
      )}


      {/* Online Players - Full Width */}
      <div className="glass-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="icon-badge-green shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <h3 className="font-display text-lg font-semibold text-foreground whitespace-nowrap">
                    Online Players
                  </h3>
                  {data.players.length > 0 ? (
                    <Badge variant="secondary" className="text-xs bg-green/20 text-green border-green/30 w-fit">
                      <Eye className="w-3 h-3 mr-1" />
                      Names available
                    </Badge>
                  ) : effectivePlayerCount > 0 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="text-xs bg-yellow/20 text-yellow border-yellow/30 cursor-help w-fit whitespace-nowrap">
                          <EyeOff className="w-3 h-3 mr-1" />
                          Names hidden
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-center">
                        <p>This server does not expose player names via the public API. This is a server-side restriction set by the server owner for privacy reasons.</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-sm">
                  {effectivePlayerCount} players currently online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {data.players.length > 0 && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const names = data.players.map(p => p.name).join('\n');
                          navigator.clipboard.writeText(names);
                          toast.success(`Copied ${data.players.length} player names to clipboard`);
                        }}
                        className="text-xs"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copy All
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy all player names to clipboard</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Build CSV content
                          const headers = ['Index', 'Name', 'ID', 'Ping', 'Steam', 'Discord', 'FiveM', 'License'];
                          const rows = data.players.map((p, idx) => {
                            const ids = p.identifiers || [];
                            const steam = ids.find(i => i.startsWith('steam:'))?.replace('steam:', '') || '';
                            const discord = ids.find(i => i.startsWith('discord:'))?.replace('discord:', '') || '';
                            const fivem = ids.find(i => i.startsWith('fivem:'))?.replace('fivem:', '') || '';
                            const license = ids.find(i => i.startsWith('license:'))?.replace('license:', '') || '';
                            // Escape quotes in name
                            const escapedName = p.name.replace(/"/g, '""');
                            return `${idx + 1},"${escapedName}",${p.id},${p.ping},"${steam}","${discord}","${fivem}","${license}"`;
                          });
                          const csv = [headers.join(','), ...rows].join('\n');
                          
                          // Download file
                          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `players_${serverCode || 'export'}_${new Date().toISOString().split('T')[0]}.csv`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                          
                          toast.success(`Exported ${data.players.length} players to CSV`);
                          
                          // Trigger gamification
                          GamificationService.onExport();
                        }}
                        className="text-xs"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Export CSV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export player list as CSV file</p>
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
              <div className="text-right">
                <p className="text-muted-foreground text-sm">Avg. Ping</p>
                <p className="text-primary font-semibold">{avgPing}ms</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search players..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="pl-10 bg-secondary/50 border-border/50"
              />
            </div>
            <div className="flex gap-2">
              {(["name", "id", "ping"] as const).map((sort) => (
                <Button
                  key={sort}
                  variant={playerSort === sort ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setPlayerSort(sort)}
                  className={playerSort === sort ? "bg-primary text-primary-foreground" : ""}
                >
                  {sort.charAt(0).toUpperCase() + sort.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/50 sticky top-0 bg-card z-10">
              <span className="col-span-1">#</span>
              <span className="col-span-5">Player Name</span>
              <span className="col-span-2">ID</span>
              <span className="col-span-2">Ping</span>
              <span className="col-span-2 text-right flex items-center justify-end gap-1">
                Identifiers
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Shield className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs text-left">
                    <p className="font-medium mb-1">Privacy Protected</p>
                    <p className="text-xs text-muted-foreground">
                      Since August 2024, FiveM deprecated public access to player identifiers for security reasons. Most servers now hide this data by default.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </span>
            </div>
             {sortedPlayers.length > 0 ? sortedPlayers.map((player, index) => (
               <PlayerCard 
                 key={`${player.id}-${player.name}`} 
                 player={player} 
                 index={index}
                 cheaterReport={isCheater(player)}
                 serverCode={serverCode || undefined}
                 serverName={serverNameClean}
                 onCheaterAdded={fetchCheaters}
               />
             )) : (
               <div className="text-center py-8 text-muted-foreground">
                 {effectivePlayerCount > 0
                   ? "Player list not available for this server"
                   : "No players online"}
               </div>
             )}
           </div>
        </div>


      {/* Resource Inspector */}
      {data.resources && data.resources.length > 0 && (
        <ResourceInspector resources={data.resources} />
      )}


      {/* Embed Widget */}
      <EmbedCodeGenerator serverCode={serverCode} />

    </div>
  );
};

export default ServerDetails;
