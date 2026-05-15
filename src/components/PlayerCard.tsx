import { useState } from "react";
import { 
  Users, 
  ExternalLink, 
  Copy, 
  Gamepad2, 
  AlertTriangle, 
  Shield, 
  MoreVertical,
  UserPlus,
  Crown,
  Sword,
  Star,
  Wifi,
  ChevronDown,
  ChevronUp,
  StickyNote
} from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import AddCheaterDialog from "./AddCheaterDialog";
import PlayerNotesDialog from "./PlayerNotesDialog";
import SensitiveText from "./SensitiveText";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { useStreamerMode } from "@/hooks/useStreamerMode";

interface PlayerIdentifiers {
  steam?: string;
  steamHex?: string;
  discord?: string;
  fivem?: string;
  license?: string;
  license2?: string;
  xbl?: string;
  live?: string;
}

interface CheaterReport {
  id: string;
  player_name: string;
  reason: string;
  status: string;
}

interface PlayerCardProps {
  player: {
    id: number;
    name: string;
    ping: number;
    identifiers?: string[];
  };
  index: number;
  cheaterReport?: CheaterReport | null;
  serverCode?: string;
  serverName?: string;
  onCheaterAdded?: () => void;
}

// Parse identifiers array into structured object
const parseIdentifiers = (identifiers: string[] = []): PlayerIdentifiers => {
  const result: PlayerIdentifiers = {};
  
  for (const id of identifiers) {
    if (id.startsWith('steam:')) {
      result.steamHex = id.replace('steam:', '');
      const hex = result.steamHex;
      if (hex && /^[0-9a-fA-F]+$/.test(hex)) {
        try {
          const steamId64 = BigInt('0x' + hex);
          result.steam = steamId64.toString();
        } catch {
          // Keep hex if conversion fails
        }
      }
    } else if (id.startsWith('discord:')) {
      result.discord = id.replace('discord:', '');
    } else if (id.startsWith('fivem:')) {
      result.fivem = id.replace('fivem:', '');
    } else if (id.startsWith('license2:')) {
      result.license2 = id.replace('license2:', '');
    } else if (id.startsWith('license:')) {
      result.license = id.replace('license:', '');
    } else if (id.startsWith('xbl:')) {
      result.xbl = id.replace('xbl:', '');
    } else if (id.startsWith('live:')) {
      result.live = id.replace('live:', '');
    }
  }
  
  return result;
};

// Steam avatar URL from Steam64 ID
const getSteamAvatarUrl = (steamId: string) => {
  return `https://avatars.cloudflare.steamstatic.com/${steamId}_medium.jpg`;
};

// Get ping quality color
const getPingColor = (ping: number) => {
  if (ping < 50) return 'text-[hsl(var(--green))]';
  if (ping < 100) return 'text-[hsl(var(--yellow))]';
  if (ping < 150) return 'text-orange-400';
  return 'text-destructive';
};

// Get ping quality indicator
const getPingBars = (ping: number) => {
  if (ping < 50) return 4;
  if (ping < 100) return 3;
  if (ping < 150) return 2;
  return 1;
};

// Generate random gang/faction for demo (in real app this would come from server data)
const getPlayerRole = (name: string) => {
  const roles = [
    { name: 'Gang Member', icon: Sword, color: 'text-destructive', bg: 'bg-destructive/20' },
    { name: 'Police', icon: Shield, color: 'text-[hsl(var(--cyan))]', bg: 'bg-[hsl(var(--cyan))]/20' },
    { name: 'Medic', icon: UserPlus, color: 'text-[hsl(var(--green))]', bg: 'bg-[hsl(var(--green))]/20' },
    { name: 'Civilian', icon: Users, color: 'text-muted-foreground', bg: 'bg-muted/50' },
    { name: 'VIP', icon: Crown, color: 'text-[hsl(var(--yellow))]', bg: 'bg-[hsl(var(--yellow))]/20' },
  ];
  // Use name hash to consistently pick same role
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return roles[hash % roles.length];
};

const PlayerCard = ({ 
  player, 
  index, 
  cheaterReport, 
  serverCode, 
  serverName,
  onCheaterAdded 
}: PlayerCardProps) => {
  const [avatarError, setAvatarError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCheaterDialog, setShowCheaterDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const { isAdmin } = useAdminStatus();
  const { isEnabled: streamerMode } = useStreamerMode();
  
  const identifiers = parseIdentifiers(player.identifiers);
  const hasIdentifiers = Object.keys(identifiers).length > 0;
  const playerRole = getPlayerRole(player.name);
  const RoleIcon = playerRole.icon;
  const isCheater = !!cheaterReport;

  const copyToClipboard = (text: string, label: string) => {
    if (streamerMode) {
      toast.error("Copying disabled in Streamer Mode");
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const avatarUrl = identifiers.steam && !avatarError 
    ? getSteamAvatarUrl(identifiers.steam)
    : null;

  const pingBars = getPingBars(player.ping);

  // Helper to copy all identifiers
  const copyAllIdentifiers = () => {
    if (streamerMode) {
      toast.error("Copying disabled in Streamer Mode");
      return;
    }
    const parts: string[] = [];
    if (identifiers.steam) parts.push(`Steam: ${identifiers.steam}`);
    if (identifiers.discord) parts.push(`Discord: ${identifiers.discord}`);
    if (identifiers.fivem) parts.push(`FiveM: ${identifiers.fivem}`);
    if (identifiers.license) parts.push(`License: ${identifiers.license}`);
    if (identifiers.license2) parts.push(`License2: ${identifiers.license2}`);
    if (identifiers.xbl) parts.push(`Xbox: ${identifiers.xbl}`);
    if (identifiers.live) parts.push(`Live: ${identifiers.live}`);
    
    if (parts.length === 0) {
      toast.error("No identifiers available to copy");
      return;
    }
    navigator.clipboard.writeText(parts.join('\n'));
    toast.success("All identifiers copied to clipboard");
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={`
              relative rounded-xl overflow-hidden
              ${isCheater 
                ? cheaterReport.status === 'confirmed'
                  ? 'bg-destructive/10 border-2 border-destructive/50 ring-2 ring-destructive/20'
                  : 'bg-[hsl(var(--yellow))]/10 border-2 border-[hsl(var(--yellow))]/50 ring-2 ring-[hsl(var(--yellow))]/20'
                : 'bg-secondary/30 hover:bg-secondary/50 border border-transparent'
              }
            `}
          >
        {/* Cheater Warning Strip */}
        {isCheater && (
          <div
            className={`
              flex items-center gap-2 px-4 py-1.5 text-xs font-medium
              ${cheaterReport.status === 'confirmed' 
                ? 'bg-destructive/20 text-destructive' 
                : 'bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))]'
              }
            `}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {cheaterReport.status === 'confirmed' ? 'CONFIRMED CHEATER' : 'SUSPECTED CHEATER'} 
            <span className="opacity-70">— {cheaterReport.reason}</span>
          </div>
        )}

        {/* Main Card Content - Discord Style */}
        <div className="p-4">
          <div className="flex items-start gap-4">
            {/* Avatar with status ring */}
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img 
                  src={avatarUrl}
                  alt={player.name}
                  className={`
                    w-14 h-14 rounded-2xl object-cover 
                    ring-2 ring-offset-2 ring-offset-background
                    ${isCheater 
                      ? cheaterReport.status === 'confirmed' 
                        ? 'ring-destructive' 
                        : 'ring-[hsl(var(--yellow))]'
                      : 'ring-border'
                    }
                  `}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div 
                  className={`
                    w-14 h-14 rounded-2xl flex items-center justify-center
                    ring-2 ring-offset-2 ring-offset-background
                    ${isCheater 
                      ? cheaterReport.status === 'confirmed'
                        ? 'bg-destructive/20 ring-destructive'
                        : 'bg-[hsl(var(--yellow))]/20 ring-[hsl(var(--yellow))]'
                      : 'bg-primary/20 ring-border'
                    }
                  `}
                >
                  <Users className={`w-6 h-6 ${isCheater ? 'text-destructive' : 'text-primary'}`} />
                </div>
              )}
              {/* Online indicator */}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-background flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-[hsl(var(--green))]" />
              </div>
            </div>

            {/* Player Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-foreground truncate max-w-[200px]">
                  {player.name}
                </h4>
                <Badge variant="outline" className="text-xs font-normal">
                  #{player.id}
                </Badge>
                {isCheater && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge className={`
                        ${cheaterReport.status === 'confirmed' 
                          ? 'bg-destructive/20 text-destructive border-destructive/50' 
                          : 'bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))] border-[hsl(var(--yellow))]/50'
                        }
                      `}>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {cheaterReport.status === 'confirmed' ? 'Cheater' : 'Suspect'}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{cheaterReport.reason}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>


              {/* Connection Stats */}
              <div className="flex items-center gap-4 mt-3">
                {/* Ping bars */}
                <div className="flex items-center gap-2">
                  <div className="flex items-end gap-0.5 h-3">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className={`
                          w-1 rounded-sm
                          ${bar <= pingBars 
                            ? getPingColor(player.ping).replace('text-', 'bg-') 
                            : 'bg-muted-foreground/30'
                          }
                        `}
                        style={{ height: `${bar * 25}%` }}
                      />
                    ))}
                  </div>
                  <span className={`text-sm font-medium ${getPingColor(player.ping)}`}>
                    {player.ping}ms
                  </span>
                </div>

                <span className="text-xs text-muted-foreground">
                  Player #{index + 1}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Expand identifiers button */}
              {hasIdentifiers && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              )}

              {/* Quick actions dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => copyToClipboard(player.name, "Player name")}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Name
                  </DropdownMenuItem>
                  {identifiers.steam && (
                    <DropdownMenuItem asChild>
                      <a
                        href={`https://steamcommunity.com/profiles/${identifiers.steam}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Steam Profile
                      </a>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setShowNotesDialog(true)}>
                        <StickyNote className="w-4 h-4 mr-2" />
                        Player Notes
                      </DropdownMenuItem>
                      {!isCheater && (
                        <DropdownMenuItem 
                          onClick={() => setShowCheaterDialog(true)}
                          className="text-destructive focus:text-destructive"
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Flag as Cheater
                        </DropdownMenuItem>
                      )}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Expanded Identifiers Section */}
          {isExpanded && hasIdentifiers && (
            <div className="overflow-hidden">
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">Identifiers</p>
                <div className="flex flex-wrap gap-2">
                  {identifiers.steam && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`https://steamcommunity.com/profiles/${identifiers.steam}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1b2838]/50 hover:bg-[#1b2838] text-[#66c0f4] text-xs transition-colors"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.42 7.62 11.17L11.17 12 7.62 1.83C8.84.67 10.34 0 12 0zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-1.17 10l3.55 11.17C19.08 21.42 22.24 17.08 22.24 12c0-1.66-.67-3.16-1.83-4.38L12 11.17 10.83 12z"/>
                          </svg>
                          Steam Profile
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <SensitiveText type="identifier" as="code" className="font-mono text-xs">
                          {identifiers.steam}
                        </SensitiveText>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {identifiers.discord && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => copyToClipboard(identifiers.discord!, "Discord ID")}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#5865F2]/20 hover:bg-[#5865F2]/30 text-[#5865F2] text-xs transition-colors"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                          </svg>
                          <SensitiveText type="identifier">Discord ID</SensitiveText>
                          <Copy className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <SensitiveText type="identifier" as="code" className="font-mono text-xs">
                          {identifiers.discord}
                        </SensitiveText>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {identifiers.fivem && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={`https://forum.cfx.re/u/${identifiers.fivem}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-xs transition-colors"
                        >
                          <Gamepad2 className="w-4 h-4" />
                          CFX.re Profile
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <SensitiveText type="identifier" as="code" className="font-mono text-xs">
                          {identifiers.fivem}
                        </SensitiveText>
                      </TooltipContent>
                    </Tooltip>
                  )}
                  
                  {identifiers.license && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => copyToClipboard(identifiers.license!, "Rockstar License")}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground text-xs transition-colors"
                        >
                          <Star className="w-4 h-4" />
                          <SensitiveText type="identifier">R* License</SensitiveText>
                          <Copy className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <SensitiveText type="identifier" as="code" className="font-mono text-xs truncate max-w-[200px]">
                          {identifiers.license}
                        </SensitiveText>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* No identifiers message */}
          {!hasIdentifiers && !isExpanded && (
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-xs text-muted-foreground/50 italic">
                Identifiers hidden by server
              </p>
            </div>
          )}
        </div>
      </div>
        </ContextMenuTrigger>
        
        {/* Right-click Context Menu */}
        <ContextMenuContent className="w-56 bg-popover border border-border shadow-lg">
          <ContextMenuItem onClick={() => copyToClipboard(player.name, "Player name")}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Name
          </ContextMenuItem>
          
          {hasIdentifiers && (
            <>
              <ContextMenuItem onClick={copyAllIdentifiers}>
                <Copy className="w-4 h-4 mr-2" />
                Copy All Identifiers
              </ContextMenuItem>
              
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Profile
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48 bg-popover border border-border">
                  {identifiers.steam && (
                    <ContextMenuItem asChild>
                      <a
                        href={`https://steamcommunity.com/profiles/${identifiers.steam}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2 fill-current text-[#66c0f4]">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.42 7.62 11.17L11.17 12 7.62 1.83C8.84.67 10.34 0 12 0zm0 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-1.17 10l3.55 11.17C19.08 21.42 22.24 17.08 22.24 12c0-1.66-.67-3.16-1.83-4.38L12 11.17 10.83 12z"/>
                        </svg>
                        Steam Profile
                      </a>
                    </ContextMenuItem>
                  )}
                  {identifiers.discord && (
                    <ContextMenuItem asChild>
                      <a
                        href={`https://discord.com/users/${identifiers.discord}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2 fill-current text-[#5865F2]">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                        Discord Profile
                      </a>
                    </ContextMenuItem>
                  )}
                  {identifiers.fivem && (
                    <ContextMenuItem asChild>
                      <a
                        href={`https://forum.cfx.re/u/${identifiers.fivem}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Gamepad2 className="w-4 h-4 mr-2 text-[hsl(var(--primary))]" />
                        FiveM Profile
                      </a>
                    </ContextMenuItem>
                  )}
                </ContextMenuSubContent>
              </ContextMenuSub>
            </>
          )}
          
          {isAdmin && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => setShowNotesDialog(true)}>
                <StickyNote className="w-4 h-4 mr-2" />
                Player Notes
              </ContextMenuItem>
              {!isCheater && (
                <ContextMenuItem 
                  onClick={() => setShowCheaterDialog(true)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Flag as Cheater
                </ContextMenuItem>
              )}
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Add Cheater Dialog */}
      <AddCheaterDialog
        open={showCheaterDialog}
        onOpenChange={setShowCheaterDialog}
        playerName={player.name}
        playerIdentifiers={identifiers}
        serverCode={serverCode}
        serverName={serverName}
        onSuccess={onCheaterAdded}
      />

      {/* Player Notes Dialog */}
      <PlayerNotesDialog
        open={showNotesDialog}
        onOpenChange={setShowNotesDialog}
        playerName={player.name}
        playerIdentifiers={identifiers}
        serverCode={serverCode}
        serverName={serverName}
      />
    </>
  );
};

export default PlayerCard;
