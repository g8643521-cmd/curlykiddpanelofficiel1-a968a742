// @ts-nocheck
import { useMemo, useState } from "react";
import {
  Award,
  Ban,
  Clock,
  Crown,
  Gift,
  Key,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Trophy,
  Trash2,
  UserCheck,
  UserCog,
  UserX,
  Users,
  X,
  Zap,
  PauseCircle,
  ShieldOff,
  PlayCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import StatusReasonDialog, { type StatusVariant } from "@/components/admin/StatusReasonDialog";

import UserAuditPanel, { type ActivityLogRow } from "@/components/admin/UserAuditPanel";

export interface AdminUserData {
  id: string;
  display_name: string | null;
  email: string | null;
  level: number;
  xp: number;
  total_searches: number;
  servers_tracked: number;
  created_at: string | null;
}

export interface AdminLeaderboardBan {
  id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
}

export interface AdminUserRole {
  id: string;
  user_id: string;
  role: "admin" | "moderator" | "user" | "owner" | "integrations_manager" | "mod_creator";
  created_at: string;
}

export interface AdminBadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  color: string;
  xp_reward: number;
}

export interface AdminUserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

export interface AdminStats {
  totalUsers: number;
  totalSearches: number;
  totalBadges: number;
  totalFavorites: number;
  totalModerators: number;
  totalAdmins: number;
}

type Props = {
  users: AdminUserData[];
  filteredUsers: AdminUserData[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;

  // XP
  xpDialogOpen: boolean;
  setXpDialogOpen: (v: boolean) => void;
  selectedUser: AdminUserData | null;
  setSelectedUser: (u: AdminUserData | null) => void;
  xpAmount: string;
  setXpAmount: (v: string) => void;
  handleModifyXP: (action: "add" | "remove" | "set") => void;

  // Roles
  stats: AdminStats | null;
  userRoles: AdminUserRole[];
  userRolesMap: Map<string, AdminUserRole>;
  roleDialogOpen: boolean;
  setRoleDialogOpen: (v: boolean) => void;
  selectedRoleUser: AdminUserData | null;
  setSelectedRoleUser: (u: AdminUserData | null) => void;
  newRole: "moderator" | "user" | "admin" | "integrations_manager" | "mod_creator";
  setNewRole: (v: "moderator" | "user" | "admin" | "integrations_manager" | "mod_creator") => void;
  handlePromoteUser: (userOverride?: AdminUserData, roleOverride?: "moderator" | "user" | "admin" | "integrations_manager" | "mod_creator") => void;
  handleRemoveRole: (roleId: string, userId: string, userName: string | null) => void;

  // Badges
  badges: AdminBadgeData[];
  userBadges: AdminUserBadge[];
  getUserBadges: (userId: string) => AdminUserBadge[];
  badgeDialogOpen: boolean;
  setBadgeDialogOpen: (v: boolean) => void;
  selectedBadgeUser: AdminUserData | null;
  setSelectedBadgeUser: (u: AdminUserData | null) => void;
  selectedBadge: string;
  setSelectedBadge: (v: string) => void;
  handleAwardBadge: () => void;

  // Leaderboard
  bans: AdminLeaderboardBan[];
  bannedUserIds: Set<string>;
  handleBanFromLeaderboard: (userId: string, userName: string) => void;
  handleUnban: (banId: string, userId: string) => void;

  // Audit
  activityLogs: ActivityLogRow[];
};

export default function UserManagementPanel(props: Props) {
  const [auditUser, setAuditUser] = useState<AdminUserData | null>(null);
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const [selectedUserForRole, setSelectedUserForRole] = useState<string | null>(null);
  const [userStatusDialog, setUserStatusDialog] = useState<{
    user: AdminUserData;
    nextStatus: "active" | "suspended" | "banned";
    variant: StatusVariant;
  } | null>(null);
  const [userStatusSubmitting, setUserStatusSubmitting] = useState(false);

  const openUserStatusDialog = (
    user: AdminUserData,
    nextStatus: "active" | "suspended" | "banned",
  ) => {
    const isOwnerRole = props.userRolesMap.get(user.id)?.role === "owner";
    if (isOwnerRole && nextStatus !== "active") {
      toast.error("Owners cannot be suspended or banned.");
      return;
    }
    const variant: StatusVariant =
      nextStatus === "suspended" ? "suspend" :
      nextStatus === "banned" ? "ban" : "reactivate";
    setUserStatusDialog({ user, nextStatus, variant });
  };

  const submitUserStatus = async (reason: string | null) => {
    if (!userStatusDialog) return;
    const { user, nextStatus } = userStatusDialog;
    setUserStatusSubmitting(true);
    const { error } = await supabase.rpc("set_user_status" as any, {
      _user_id: user.id,
      _status: nextStatus,
      _reason: reason,
    });
    setUserStatusSubmitting(false);
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    toast.success(
      nextStatus === "active" ? "Account reinstated" :
      nextStatus === "suspended" ? "Account suspended" : "Account banned",
    );
    setUserStatusDialog(null);
  };

  const staffUsers = useMemo(() => props.userRoles, [props.userRoles]);

  const promoteCandidates = useMemo(
    () => props.filteredUsers.filter((u) => !props.userRolesMap.has(u.id)).slice(0, 20),
    [props.filteredUsers, props.userRolesMap],
  );

  // Role logs filtered from activity logs
  const roleLogs = useMemo(() => 
    props.activityLogs.filter(log => 
      log.action_type.includes('role') || log.action_type.includes('xp') || log.action_type.includes('badge') || log.action_type.includes('ban')
    ).slice(0, 15),
    [props.activityLogs]
  );

  // Available roles for the popup
  const availableRoles = [
    { id: "admin", label: "Admin", icon: Crown, color: "hsl(var(--magenta))", description: "Full access" },
    { id: "moderator", label: "Moderator", icon: ShieldCheck, color: "hsl(var(--cyan))", description: "Limited access" },
    { id: "mod_creator", label: "Mod Creator", icon: Package, color: "hsl(var(--green))", description: "Upload mods" },
    { id: "integrations_manager", label: "Integrations", icon: Gift, color: "hsl(var(--primary))", description: "Bot & webhooks" },
    { id: "server_owner", label: "Server Owner", icon: UserCog, color: "hsl(var(--primary))", description: "Bot server access" },
  ];

  const filteredRoles = availableRoles.filter(role =>
    role.label.toLowerCase().includes(roleSearchQuery.toLowerCase())
  );

  const getRoleBadge = (role: AdminUserRole["role"]) => {
    switch (role) {
      case "owner":
        return (
          <Badge className="bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))] border-[hsl(var(--yellow))]/50">
            <Crown className="w-3 h-3 mr-1" />
            Owner
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-[hsl(var(--magenta))]/20 text-[hsl(var(--magenta))] border-[hsl(var(--magenta))]/50">
            <Crown className="w-3 h-3 mr-1" />
            Admin
          </Badge>
        );
      case "moderator":
        return (
          <Badge className="bg-[hsl(var(--cyan))]/20 text-[hsl(var(--cyan))] border-[hsl(var(--cyan))]/50">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Moderator
          </Badge>
        );
      case "integrations_manager":
        return (
          <Badge className="bg-primary/20 text-primary border-primary/50">
            <Gift className="w-3 h-3 mr-1" />
            Integrations
          </Badge>
        );
      case "mod_creator":
        return (
          <Badge className="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/50">
            <Package className="w-3 h-3 mr-1" />
            Mod Creator
          </Badge>
        );
      case "server_owner":
        return (
          <Badge className="bg-primary/20 text-primary border-primary/50">
            <UserCog className="w-3 h-3 mr-1" />
            Server Owner
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const getLogIcon = (actionType: string) => {
    if (actionType.includes('role')) return <Key className="w-4 h-4 text-[hsl(var(--cyan))]" />;
    if (actionType.includes('xp')) return <Zap className="w-4 h-4 text-[hsl(var(--yellow))]" />;
    if (actionType.includes('badge')) return <Award className="w-4 h-4 text-[hsl(var(--magenta))]" />;
    if (actionType.includes('ban') || actionType.includes('unban')) return <Ban className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  // Render context menu for any user card
  const renderUserContextMenu = (user: AdminUserData, role?: AdminUserRole) => {
    const isBanned = props.bannedUserIds.has(user.id);
    const ban = props.bans.find((b) => b.user_id === user.id) || null;
    const isOwner = role?.role === "owner";

    return (
      <ContextMenuContent className="w-64">
        <ContextMenuLabel className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="font-bold text-primary text-xs">{(user.display_name || "U")[0].toUpperCase()}</span>
          </div>
          {user.display_name || "Anonymous"}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        
        <ContextMenuItem
          onSelect={() => setAuditUser(user)}
          className="gap-2"
        >
          <Clock className="w-4 h-4" />
          View Audit
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem
          onSelect={() => {
            props.setSelectedUser(user);
            props.setXpDialogOpen(true);
          }}
          className="gap-2"
        >
          <Zap className="w-4 h-4 text-[hsl(var(--yellow))]" />
          Modify XP…
        </ContextMenuItem>
        
        {!isOwner && (
          <ContextMenuItem
            onSelect={() => {
              props.setSelectedRoleUser(user);
              props.setRoleDialogOpen(true);
            }}
            className="gap-2"
          >
            <UserCog className="w-4 h-4 text-[hsl(var(--cyan))]" />
            Set Role…
          </ContextMenuItem>
        )}
        
        <ContextMenuItem
          onSelect={() => {
            props.setSelectedBadgeUser(user);
            props.setBadgeDialogOpen(true);
          }}
          className="gap-2"
        >
          <Award className="w-4 h-4 text-[hsl(var(--magenta))]" />
          Award Badge…
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        {isBanned ? (
          <ContextMenuItem
            onSelect={() => {
              if (ban) props.handleUnban(ban.id, user.id);
            }}
            className="gap-2 text-[hsl(var(--green))]"
          >
            <UserCheck className="w-4 h-4" />
            Unban from Leaderboard
          </ContextMenuItem>
        ) : (
          <ContextMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onSelect={() => {
              props.handleBanFromLeaderboard(user.id, user.display_name || "User");
            }}
          >
            <UserX className="w-4 h-4" />
            Ban from Leaderboard
          </ContextMenuItem>
        )}

        {!isOwner && (
          <>
            <ContextMenuSeparator />
            <ContextMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Account Status
            </ContextMenuLabel>
            <ContextMenuItem
              className="gap-2 text-amber-400 focus:text-amber-400"
              onSelect={() => openUserStatusDialog(user, "suspended")}
            >
              <PauseCircle className="w-4 h-4" />
              Suspend Account…
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              onSelect={() => openUserStatusDialog(user, "banned")}
            >
              <ShieldOff className="w-4 h-4" />
              Ban Account…
            </ContextMenuItem>
            <ContextMenuItem
              className="gap-2 text-[hsl(var(--green))] focus:text-[hsl(var(--green))]"
              onSelect={() => openUserStatusDialog(user, "active")}
            >
              <PlayCircle className="w-4 h-4" />
              Reinstate Account
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    );
  };

  return (
    <div className="glass-card p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-display text-lg font-semibold text-foreground">User Management</h3>
          <Badge variant="secondary">{props.users.length}</Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-[hsl(var(--magenta))]/20 text-[hsl(var(--magenta))]">
              {props.stats?.totalAdmins || 0} Admins
            </Badge>
            <Badge className="bg-[hsl(var(--cyan))]/20 text-[hsl(var(--cyan))]">
              {props.stats?.totalModerators || 0} Mods
            </Badge>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={props.searchQuery}
              onChange={(e) => props.setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main Content - Role Management */}
        <div className="flex gap-4 h-[650px]">
          {/* Left Panel - User Cards */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                <UserCog className="w-5 h-5 text-[hsl(var(--cyan))]" />
                Role Management
              </h4>
              <p className="text-xs text-muted-foreground">Right-click for actions</p>
            </div>

            {/* User Cards with Discord-style Role Management */}
            <div className="space-y-3 max-h-[590px] overflow-y-auto pr-2">
              {/* Staff Members */}
              {staffUsers.map((role) => {
                const user = props.users.find((u) => u.id === role.user_id);
                if (!user) return null;
                
                const isOwner = role.role === "owner";
                const isExpanded = selectedUserForRole === role.user_id;
                const isBanned = props.bannedUserIds.has(user.id);
                
                return (
                  <ContextMenu key={role.id}>
                    <ContextMenuTrigger asChild>
                      <div className="rounded-xl bg-secondary/30 overflow-hidden cursor-context-menu hover:bg-secondary/40 transition-colors">
                        {/* User Card Header */}
                        <div className="p-4 flex items-center gap-4">
                          <div className="relative">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-[hsl(var(--cyan))]/30 flex items-center justify-center border-4 border-background">
                              <span className="font-bold text-xl text-foreground">{(user.display_name || "U")[0].toUpperCase()}</span>
                            </div>
                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-4 border-background ${
                              role.role === 'owner' ? 'bg-[hsl(var(--yellow))]' : 
                              role.role === 'admin' ? 'bg-[hsl(var(--magenta))]' : 
                              role.role === 'mod_creator' ? 'bg-[hsl(var(--green))]' :
                              role.role === 'integrations_manager' ? 'bg-primary' :
                              'bg-[hsl(var(--cyan))]'
                            }`} />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground text-lg">{user.display_name || "Unknown"}</p>
                              {isBanned && (
                                <Badge variant="destructive" className="text-[10px] h-5">
                                  <Ban className="w-3 h-3 mr-1" />
                                  Hidden
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">Level {user.level} • {user.xp} XP</p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {getRoleBadge(role.role)}
                          </div>
                        </div>
                        
                        {/* Role Section */}
                        <div className="px-4 pb-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roles</span>
                            {!isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedUserForRole(isExpanded ? null : role.user_id);
                                }}
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                {isExpanded ? "Close" : "Edit"}
                              </Button>
                            )}
                          </div>
                          
                          {/* Current Role Badge - Clickable to remove */}
                          <div className="flex flex-wrap gap-2">
                            {!isOwner ? (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button className="group flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-destructive/20 transition-colors">
                                    {role.role === 'admin' && <Crown className="w-3.5 h-3.5 text-[hsl(var(--magenta))]" />}
                                    {role.role === 'moderator' && <ShieldCheck className="w-3.5 h-3.5 text-[hsl(var(--cyan))]" />}
                                    {role.role === 'integrations_manager' && <Gift className="w-3.5 h-3.5 text-primary" />}
                                     {role.role === 'mod_creator' && <Package className="w-3.5 h-3.5 text-[hsl(var(--green))]" />}
                                     {role.role === 'server_owner' && <UserCog className="w-3.5 h-3.5 text-primary" />}
                                     <span className="text-sm font-medium text-foreground">
                                       {role.role === 'mod_creator'
                                         ? 'Mod Creator'
                                         : role.role === 'integrations_manager'
                                           ? 'Integrations Manager'
                                            : role.role === 'server_owner'
                                              ? 'Server Owner'
                                              : role.role.charAt(0).toUpperCase() + role.role.slice(1)}
                                     </span>
                                    <X className="w-3 h-3 text-muted-foreground group-hover:text-destructive transition-colors" />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Role?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Remove the <strong>{role.role}</strong> role from {user.display_name || "this user"}?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => props.handleRemoveRole(role.id, role.user_id, user.display_name || null)}
                                      className="bg-destructive text-destructive-foreground"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            ) : (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[hsl(var(--yellow))]/20">
                                <Crown className="w-3.5 h-3.5 text-[hsl(var(--yellow))]" />
                                <span className="text-sm font-medium text-[hsl(var(--yellow))]">Owner</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Discord-style Role Picker Dropdown */}
                          {isExpanded && !isOwner && (
                            <div className="mt-3 p-3 rounded-lg bg-background border border-border animate-fade-in">
                              <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                  placeholder="Role"
                                  value={roleSearchQuery}
                                  onChange={(e) => setRoleSearchQuery(e.target.value)}
                                  className="pl-9 bg-secondary/50 border-0"
                                />
                              </div>
                              
                              <div className="space-y-1">
                                {filteredRoles.length === 0 ? (
                                  <p className="text-sm text-muted-foreground italic py-2 text-center">No matching roles</p>
                                ) : (
                                  filteredRoles.map((availRole) => {
                                    const isCurrentRole = role.role === availRole.id;
                                    return (
                                      <button
                                        key={availRole.id}
                                        onClick={() => {
                                          if (!isCurrentRole && user) {
                                            props.handlePromoteUser(user, availRole.id as "moderator" | "admin" | "integrations_manager" | "mod_creator" | "user");
                                            setSelectedUserForRole(null);
                                            setRoleSearchQuery("");
                                          }
                                        }}
                                        disabled={isCurrentRole}
                                        className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors ${
                                          isCurrentRole 
                                            ? 'opacity-50 cursor-not-allowed' 
                                            : 'hover:bg-secondary/80'
                                        }`}
                                      >
                                        <div 
                                          className="w-3 h-3 rounded-full" 
                                          style={{ backgroundColor: availRole.color }}
                                        />
                                        <span className="text-sm font-medium text-foreground">{availRole.label}</span>
                                        {isCurrentRole && (
                                          <span className="ml-auto text-xs text-muted-foreground">Current</span>
                                        )}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    {renderUserContextMenu(user, role)}
                  </ContextMenu>
                );
              })}
              
              {/* Add New Staff Section */}
              {promoteCandidates.length > 0 && (
                <div className="pt-4 border-t border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Add Staff Member
                  </p>
                  <div className="space-y-2">
                    {promoteCandidates.slice(0, 8).map((user) => {
                      const isExpanded = selectedUserForRole === `new-${user.id}`;
                      const isBanned = props.bannedUserIds.has(user.id);
                      
                      return (
                        <ContextMenu key={user.id}>
                          <ContextMenuTrigger asChild>
                            <div className="rounded-lg bg-secondary/20 overflow-hidden cursor-context-menu hover:bg-secondary/30 transition-colors">
                              <div className="p-3 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                  <span className="font-medium text-primary">{(user.display_name || "U")[0].toUpperCase()}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-foreground text-sm truncate">{user.display_name || "Anonymous"}</p>
                                    {isBanned && (
                                      <Badge variant="destructive" className="text-[10px] h-4 px-1">Hidden</Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">Level {user.level} • {user.xp} XP</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedUserForRole(isExpanded ? null : `new-${user.id}`);
                                  }}
                                  className="h-8 px-3 text-[hsl(var(--cyan))] hover:bg-[hsl(var(--cyan))]/10"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  Add Role
                                </Button>
                              </div>
                              
                              {/* Role Picker for new user */}
                              {isExpanded && (
                                <div className="px-3 pb-3">
                                  <div className="p-3 rounded-lg bg-background border border-border animate-fade-in">
                                    <div className="relative mb-3">
                                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                      <Input
                                        placeholder="Role"
                                        value={roleSearchQuery}
                                        onChange={(e) => setRoleSearchQuery(e.target.value)}
                                        className="pl-9 bg-secondary/50 border-0"
                                      />
                                    </div>
                                    
                                    <div className="space-y-1">
                                      {filteredRoles.map((availRole) => (
                                        <button
                                          key={availRole.id}
                                          onClick={() => {
                                            props.handlePromoteUser(user, availRole.id as "moderator" | "admin" | "integrations_manager" | "mod_creator" | "user");
                                            setSelectedUserForRole(null);
                                            setRoleSearchQuery("");
                                          }}
                                          className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-secondary/80 transition-colors"
                                        >
                                          <div 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: availRole.color }}
                                          />
                                          <span className="text-sm font-medium text-foreground">{availRole.label}</span>
                                          <span className="ml-auto text-xs text-muted-foreground">{availRole.description}</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </ContextMenuTrigger>
                          {renderUserContextMenu(user)}
                        </ContextMenu>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Panel - Audit Log Sidebar */}
          <div className="w-80 flex-shrink-0 rounded-xl bg-background/50 border border-border/50 p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-[hsl(var(--cyan))]" />
              <span className="font-semibold text-foreground text-sm">Activity Log</span>
              <Badge variant="secondary" className="ml-auto text-xs">{roleLogs.length}</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2">
              {roleLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              ) : (
                roleLogs.map((log) => {
                  const details = log.details as Record<string, unknown> | null;
                  const userName = details?.user_name as string || details?.userName as string || "Unknown";
                  
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                      {getLogIcon(log.action_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground capitalize">
                          {log.action_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {userName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatTimeAgo(log.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* User Audit Panel */}
        <div className="lg:sticky lg:top-6 h-fit">
          <UserAuditPanel selectedUser={auditUser} logs={props.activityLogs} />
        </div>
      </div>

      {/* Global Role Dialog */}
      <Dialog
        open={props.roleDialogOpen}
        onOpenChange={(open) => {
          props.setRoleDialogOpen(open);
          if (!open) {
            props.setSelectedRoleUser(null);
            props.setNewRole("moderator");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Set Role{props.selectedRoleUser?.display_name ? `: ${props.selectedRoleUser.display_name}` : ""}
            </DialogTitle>
            <DialogDescription>
              Assign a role to this user. Choose "User (Remove Role)" to clear staff access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="role-select-global">Select Role</Label>
              <Select
                value={props.newRole}
                onValueChange={(v) => props.setNewRole(v as "moderator" | "user" | "admin" | "integrations_manager" | "mod_creator" | "server_owner")}
              >
                <SelectTrigger id="role-select-global">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderator">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[hsl(var(--cyan))]" />
                      Moderator
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-[hsl(var(--magenta))]" />
                      Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="integrations_manager">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-primary" />
                      Integrations Manager
                    </div>
                  </SelectItem>
                  <SelectItem value="mod_creator">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-[hsl(var(--green))]" />
                      Mod Creator
                    </div>
                  </SelectItem>
                  <SelectItem value="server_owner">
                    <div className="flex items-center gap-2">
                      <UserCog className="w-4 h-4 text-primary" />
                      Server Owner
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      User (Remove Role)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => props.setRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => props.handlePromoteUser()}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global XP Dialog */}
      <Dialog
        open={props.xpDialogOpen}
        onOpenChange={(open) => {
          props.setXpDialogOpen(open);
          if (!open) {
            props.setSelectedUser(null);
            props.setXpAmount("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify XP{props.selectedUser?.display_name ? `: ${props.selectedUser.display_name}` : ""}</DialogTitle>
            <DialogDescription>
              Current: Level {props.selectedUser?.level || 0} • {props.selectedUser?.xp || 0} XP
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="xp-amount">XP Amount</Label>
              <Input
                id="xp-amount"
                type="number"
                min="0"
                value={props.xpAmount}
                onChange={(e) => props.setXpAmount(e.target.value)}
                placeholder="Enter XP amount"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => props.handleModifyXP("add")}
              className="text-[hsl(var(--green))]"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
            <Button
              variant="outline"
              onClick={() => props.handleModifyXP("remove")}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Remove
            </Button>
            <Button onClick={() => props.handleModifyXP("set")}>Set Exact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Badge Dialog */}
      <Dialog
        open={props.badgeDialogOpen}
        onOpenChange={(open) => {
          props.setBadgeDialogOpen(open);
          if (!open) {
            props.setSelectedBadgeUser(null);
            props.setSelectedBadge("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Award Badge{props.selectedBadgeUser?.display_name ? `: ${props.selectedBadgeUser.display_name}` : ""}
            </DialogTitle>
            <DialogDescription>Select a badge to award to this user.</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="badge-select-global">Select Badge</Label>
              <Select value={props.selectedBadge} onValueChange={props.setSelectedBadge}>
                <SelectTrigger id="badge-select-global">
                  <SelectValue placeholder="Choose a badge..." />
                </SelectTrigger>
                <SelectContent>
                  {props.badges.map((b) => {
                    const alreadyHas = props.selectedBadgeUser
                      ? props.getUserBadges(props.selectedBadgeUser.id).some((ub) => ub.badge_id === b.id)
                      : false;

                    return (
                      <SelectItem key={b.id} value={b.id} disabled={alreadyHas}>
                        <span className="flex items-center gap-2">
                          {b.name}
                          <span className="text-muted-foreground text-xs">({b.rarity})</span>
                          <span className="text-primary text-xs">+{b.xp_reward} XP</span>
                          {alreadyHas && <span className="text-destructive text-xs">(owned)</span>}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => props.setBadgeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={props.handleAwardBadge} disabled={!props.selectedBadge}>
              <Award className="w-4 h-4 mr-2" />
              Award Badge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {userStatusDialog && (
        <StatusReasonDialog
          open={!!userStatusDialog}
          variant={userStatusDialog.variant}
          targetName={userStatusDialog.user.display_name || userStatusDialog.user.email || "this user"}
          loading={userStatusSubmitting}
          onCancel={() => { if (!userStatusSubmitting) setUserStatusDialog(null); }}
          onConfirm={submitUserStatus}
        />
      )}
    </div>
  );
}
