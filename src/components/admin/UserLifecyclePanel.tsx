// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Users, Search, Shield, AlertTriangle, Ban, UserCheck, UserX,
  Clock, ChevronRight, Flag, Eye, MoreHorizontal, X,
  Activity, TrendingUp, Filter, RefreshCw, FileText, CheckCircle,
  XCircle, AlertCircle, Gauge, History, MessageSquare, Link2,
  Crown, ShieldCheck, Sparkles, UserPlus, Loader2, Mail, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent, ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { handleSupabaseError } from '@/lib/authRecovery';
import { getSessionWithTimeout } from '@/lib/authSession';
import { getProfileAvatarUrl } from '@/lib/avatar';

// ── Types ──────────────────────────────────────────────

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  status: string;
  risk_score: number;
  created_at: string;
  updated_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
  flagged_at: string | null;
  flagged_reason: string | null;
  discord_username: string | null;
  discord_user_id: string | null;
  discord_avatar: string | null;
}

interface UserFlag {
  id: string;
  user_id: string;
  flagged_by: string;
  flag_type: string;
  reason: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
}

type StatusFilter = 'all' | 'active' | 'suspended' | 'flagged' | 'deleted';

// ── Status Config ──────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof UserCheck }> = {
  active: { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: UserCheck },
  suspended: { label: 'Suspended', color: 'text-destructive', bg: 'bg-destructive/10', icon: Ban },
  flagged: { label: 'Flagged', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle },
  deleted: { label: 'Deleted', color: 'text-muted-foreground', bg: 'bg-muted/20', icon: UserX },
};

// ── Role Config ────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; badge: string; iconClass: string; order: number }> = {
  owner:                { label: 'Owner',        icon: Crown,        badge: 'bg-amber-500/10 text-amber-300 border-amber-500/20',   iconClass: 'text-amber-300',   order: 0 },
  admin:                { label: 'Admin',        icon: Shield,       badge: 'bg-sky-500/10 text-sky-300 border-sky-500/20',         iconClass: 'text-sky-300',     order: 1 },
  moderator:            { label: 'Moderator',    icon: ShieldCheck,  badge: 'bg-violet-500/10 text-violet-300 border-violet-500/20',iconClass: 'text-violet-300',  order: 2 },
  mod_creator:          { label: 'Mod Creator',  icon: Sparkles,     badge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', iconClass: 'text-emerald-300', order: 3 },
  integrations_manager: { label: 'Integrations', icon: Shield,       badge: 'bg-slate-400/10 text-slate-300 border-slate-400/20',    iconClass: 'text-slate-300',   order: 4 },
  server_owner:         { label: 'Server Owner', icon: Crown,        badge: 'bg-teal-500/10 text-teal-300 border-teal-500/20',       iconClass: 'text-teal-300',    order: 5 },
};

const STAFF_ROLE_KEYS = ['owner', 'admin', 'moderator', 'mod_creator', 'integrations_manager', 'server_owner'];
const ASSIGNABLE_ROLES = ['admin', 'moderator', 'mod_creator', 'integrations_manager', 'server_owner', 'user'];

const pickHighestRole = (roles: string[]): string | null => {
  if (!roles?.length) return null;
  return [...roles].sort(
    (a, b) => (ROLE_CONFIG[a]?.order ?? 99) - (ROLE_CONFIG[b]?.order ?? 99),
  )[0];
};

const FLAG_TYPES = [
  { value: 'warning', label: 'Warning', color: 'text-amber-400' },
  { value: 'suspension', label: 'Suspension', color: 'text-destructive' },
  { value: 'note', label: 'Note', color: 'text-primary' },
  { value: 'alt_account', label: 'Alt Account', color: 'text-purple-400' },
];

// ── Risk Score Bar ─────────────────────────────────────

function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-destructive' : score >= 40 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-muted/20 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 0.6 }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
      <span className={cn('text-[10px] font-bold tabular-nums', score >= 70 ? 'text-destructive' : score >= 40 ? 'text-amber-400' : 'text-emerald-400')}>
        {score}
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────

export default function UserLifecyclePanel() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userFlags, setUserFlags] = useState<UserFlag[]>([]);
  const [userActivity, setUserActivity] = useState<AuditEntry[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Roles, keyed by user_id → array of role strings
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({});

  // Inline assign-role popover
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmail, setAssignEmail] = useState('');
  const [assignRoleValue, setAssignRoleValue] = useState<string>('admin');
  const [assignBusy, setAssignBusy] = useState(false);

  // Inline transfer-ownership popover + confirm
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferConfirm, setTransferConfirm] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);

  // Action dialogs
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('active');
  const [statusReason, setStatusReason] = useState('');
  const [newFlagType, setNewFlagType] = useState('note');
  const [flagReason, setFlagReason] = useState('');
  const [riskDialogOpen, setRiskDialogOpen] = useState(false);
  const [newRiskScore, setNewRiskScore] = useState('0');

  const assignRole = async (userId: string, email: string, role: string) => {
    // Snapshot for rollback
    let snapshot: string[] | undefined;
    setUserRoles((prev) => {
      snapshot = prev[userId] ? [...prev[userId]] : [];
      const next = { ...prev };
      if (role === 'user') {
        next[userId] = (next[userId] || []).filter((r) => !STAFF_ROLE_KEYS.includes(r));
      } else {
        const existing = (next[userId] || []).filter((r) => r !== role);
        next[userId] = [...existing, role];
      }
      return next;
    });

    const rollback = () => {
      setUserRoles((prev) => {
        const next = { ...prev };
        if (snapshot === undefined) {
          delete next[userId];
        } else {
          next[userId] = snapshot;
        }
        return next;
      });
    };

    try {
      const { data, error } = await supabase.functions.invoke('assign-role', {
        body: { email, role },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Failed to assign role');
        rollback();
        return false;
      } else {
        toast.success(`${role} assigned to ${email}`);
        return true;
      }
    } catch {
      toast.error('Failed to assign role');
      rollback();
      return false;
    }
  };

  const handleAssignByEmail = async () => {
    const email = assignEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("That email doesn't look right");
      return;
    }
    setAssignBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('assign-role', {
        body: { email, role: assignRoleValue },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Could not give access');
      } else {
        const label = ROLE_CONFIG[assignRoleValue]?.label || assignRoleValue;
        toast.success('Access granted', { description: `${email} is now a ${label}.` });
        setAssignEmail('');
        setAssignOpen(false);
        fetchUsers(); // refresh roles + profile list
      }
    } catch {
      toast.error('Something went wrong');
    }
    setAssignBusy(false);
  };

  const handleTransferOwnership = async () => {
    setTransferConfirm(false);
    setTransferBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('transfer-ownership', {
        body: { email: transferEmail.trim().toLowerCase() },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || 'Transfer failed');
      } else {
        toast.success(data?.message || 'Ownership transferred');
        setTransferEmail('');
        setTransferOpen(false);
        fetchUsers();
      }
    } catch {
      toast.error('Something went wrong');
    }
    setTransferBusy(false);
  };


  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Confirm we have a valid auth session before querying — this prevents
      // the cryptic "Failed to load users" caused by a stale/bad JWT where
      // RLS silently returns nothing.
      const { data: { session }, error: sessErr } = await getSessionWithTimeout();
      if (sessErr && handleSupabaseError(sessErr)) return;
      if (!session) {
        toast.error('You are not signed in. Please log in again.');
        setUsers([]);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        if (handleSupabaseError(error)) return;
        console.error('[UserLifecyclePanel] fetchUsers error', error);
        toast.error(`Failed to load users: ${error.message || 'unknown error'}`);
        setUsers([]);
      } else {
        setUsers(data || []);
        if (!data || data.length === 0) {
          toast.info('No user profiles returned. Confirm your admin role is active.');
        }

        // Fetch all roles in parallel — small table, RLS lets admins see all
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('user_id, role');
        const map: Record<string, string[]> = {};
        (roleRows || []).forEach((r: any) => {
          (map[r.user_id] ||= []).push(r.role);
        });
        setUserRoles(map);
      }
    } catch (err: any) {
      if (handleSupabaseError(err)) return;
      console.error('[UserLifecyclePanel] fetchUsers exception', err);
      toast.error(`Failed to load users: ${err?.message || 'unexpected error'}`);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Fetch User Detail ──────────────────────────────

  const fetchUserDetail = useCallback(async (user: UserProfile) => {
    setLoadingDetail(true);
    setSelectedUser(user);

    const [flagsRes, activityRes] = await Promise.all([
      supabase.from('user_flags').select('*').eq('user_id', user.user_id).order('created_at', { ascending: false }),
      supabase.from('audit_log').select('*').eq('user_id', user.user_id).order('created_at', { ascending: false }).limit(30),
    ]);

    setUserFlags(flagsRes.data || []);
    setUserActivity(activityRes.data || []);
    setLoadingDetail(false);
  }, []);

  // ── Actions ────────────────────────────────────────

  const handleUpdateStatus = async () => {
    if (!selectedUser) return;
    const updates: any = { status: newStatus };
    if (newStatus === 'suspended') {
      updates.suspended_at = new Date().toISOString();
      updates.suspended_reason = statusReason;
    } else if (newStatus === 'flagged') {
      updates.flagged_at = new Date().toISOString();
      updates.flagged_reason = statusReason;
    }

    const { error } = await supabase.from('profiles').update(updates).eq('user_id', selectedUser.user_id);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`User status updated to ${newStatus}`);
      // Log to audit
      await supabase.from('audit_log').insert({
        action: 'user_status_change',
        table_name: 'profiles',
        record_id: selectedUser.user_id,
        old_data: { status: selectedUser.status },
        new_data: { status: newStatus, reason: statusReason },
      });
      setSelectedUser({ ...selectedUser, ...updates });
      setUsers(prev => prev.map(u => u.user_id === selectedUser.user_id ? { ...u, ...updates } : u));
    }
    setStatusDialogOpen(false);
    setStatusReason('');
  };

  const handleAddFlag = async () => {
    if (!selectedUser || !flagReason.trim()) return;
    const { data: session } = await supabase.auth.getSession();
    const flaggedBy = session?.session?.user?.id;
    if (!flaggedBy) return;

    const { error } = await supabase.from('user_flags').insert({
      user_id: selectedUser.user_id,
      flagged_by: flaggedBy,
      flag_type: newFlagType,
      reason: flagReason.trim(),
    });
    if (error) {
      toast.error('Failed to add flag');
    } else {
      toast.success('Flag added');
      fetchUserDetail(selectedUser);
    }
    setFlagDialogOpen(false);
    setFlagReason('');
  };

  const handleResolveFlag = async (flagId: string) => {
    const { data: session } = await supabase.auth.getSession();
    const { error } = await supabase.from('user_flags').update({
      resolved: true,
      resolved_by: session?.session?.user?.id,
      resolved_at: new Date().toISOString(),
    }).eq('id', flagId);
    if (error) {
      toast.error('Failed to resolve flag');
    } else {
      toast.success('Flag resolved');
      setUserFlags(prev => prev.map(f => f.id === flagId ? { ...f, resolved: true } : f));
    }
  };

  const handleUpdateRiskScore = async () => {
    if (!selectedUser) return;
    const score = Math.max(0, Math.min(100, parseInt(newRiskScore) || 0));
    const { error } = await supabase.from('profiles').update({ risk_score: score }).eq('user_id', selectedUser.user_id);
    if (error) {
      toast.error('Failed to update risk score');
    } else {
      toast.success(`Risk score set to ${score}`);
      setSelectedUser({ ...selectedUser, risk_score: score });
      setUsers(prev => prev.map(u => u.user_id === selectedUser.user_id ? { ...u, risk_score: score } : u));
    }
    setRiskDialogOpen(false);
  };

  // ── Filter ─────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          u.display_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.discord_username?.toLowerCase().includes(q) ||
          u.user_id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: users.length, active: 0, suspended: 0, flagged: 0, deleted: 0 };
    users.forEach(u => { if (counts[u.status] !== undefined) counts[u.status]++; });
    return counts;
  }, [users]);

  const staffStats = useMemo(() => {
    const counts: Record<string, number> = { owner: 0, admin: 0, moderator: 0, mod_creator: 0, integrations_manager: 0 };
    let totalStaff = 0;
    Object.values(userRoles).forEach((roles) => {
      const top = pickHighestRole(roles.filter((r) => STAFF_ROLE_KEYS.includes(r)));
      if (top) {
        counts[top] = (counts[top] || 0) + 1;
        totalStaff += 1;
      }
    });
    return { ...counts, total: totalStaff };
  }, [userRoles]);

  // ── Loading State ──────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted/10 rounded-lg animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-card/40 border border-border/10 rounded-xl animate-pulse" />)}
        </div>
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-card/30 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: users.length, icon: Users, accent: 'primary' },
          { label: 'Active', value: statusCounts.active, icon: UserCheck, accent: 'emerald' },
          { label: 'Flagged', value: statusCounts.flagged, icon: AlertTriangle, accent: 'amber' },
          { label: 'Suspended', value: statusCounts.suspended, icon: Ban, accent: 'destructive' },
        ].map((card, i) => {
          const colors: Record<string, { bg: string; text: string }> = {
            primary: { bg: 'bg-primary/10', text: 'text-primary' },
            emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
            amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
            destructive: { bg: 'bg-destructive/10', text: 'text-destructive' },
          };
          const c = colors[card.accent];
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group flex flex-col items-center justify-center p-4 min-h-[88px] rounded-xl border border-border/20 bg-card/50 hover:border-border/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', c.bg)}>
                <card.icon className={cn('w-4 h-4', c.text)} />
              </div>
              <p className={cn('text-xl font-bold tabular-nums', c.text)}>{card.value}</p>
              <p className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-widest mt-1">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Filters & Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
          <Input
            placeholder="Search users by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-card/40 border-border/20"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'active', 'flagged', 'suspended', 'deleted'] as StatusFilter[]).map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all capitalize',
                statusFilter === status
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/20'
                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/20'
              )}
            >
              {status} {statusCounts[status] > 0 && <span className="ml-1 text-[10px] opacity-60">({statusCounts[status]})</span>}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchUsers} className="h-8 gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {/* Staff Access Rail — replaces the old separate "Roles" tab */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 pr-4 border-r border-border/20">
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
              Staff &amp; Access
            </span>
            <Badge variant="secondary" className="h-5 text-[10px] px-1.5 bg-secondary/40">
              {staffStats.total}
            </Badge>
          </div>
          {STAFF_ROLE_KEYS.map((key) => {
            const cfg = ROLE_CONFIG[key];
            const count = staffStats[key] || 0;
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <div key={key} className="flex items-center gap-1.5 text-[11px]">
                <Icon className={cn('w-3.5 h-3.5', cfg.iconClass)} />
                <span className="text-muted-foreground/70">{cfg.label}</span>
                <span className="font-semibold text-foreground tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Assign role popover */}
          <Popover open={assignOpen} onOpenChange={setAssignOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                <UserPlus className="w-3.5 h-3.5" /> Assign role
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Grant role by email</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  The account must already exist.
                </p>
              </div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  placeholder="user@example.com"
                  type="email"
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                  className="h-9 pl-9 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAssignByEmail()}
                />
              </div>
              <Select value={assignRoleValue} onValueChange={setAssignRoleValue}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_ROLES.filter((r) => r !== 'user').map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_CONFIG[r]?.label || r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAssignByEmail}
                disabled={assignBusy}
                className="w-full h-9 text-sm"
              >
                {assignBusy ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Granting…</>
                ) : (
                  <><Check className="w-3.5 h-3.5 mr-1.5" /> Give access</>
                )}
              </Button>
            </PopoverContent>
          </Popover>

          {/* Transfer ownership popover */}
          <Popover open={transferOpen} onOpenChange={setTransferOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Crown className="w-3.5 h-3.5" /> Transfer ownership
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4 space-y-3">
              <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                <p className="text-[11px] text-destructive/80 leading-snug">
                  You'll be downgraded to admin. Hard to undo.
                </p>
              </div>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  placeholder="newowner@example.com"
                  type="email"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  className="h-9 pl-9 text-sm"
                />
              </div>
              <Button
                variant="destructive"
                disabled={transferBusy || !/^\S+@\S+\.\S+$/.test(transferEmail.trim())}
                onClick={() => setTransferConfirm(true)}
                className="w-full h-9 text-sm"
              >
                {transferBusy ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Transferring…</>
                ) : (
                  <><Crown className="w-3.5 h-3.5 mr-1.5" /> Transfer ownership</>
                )}
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Confirm transfer dialog */}
      <AlertDialog open={transferConfirm} onOpenChange={setTransferConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make this user the new owner?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to hand over ownership to{' '}
              <strong className="text-foreground">{transferEmail.trim().toLowerCase()}</strong>.
              You'll be downgraded to admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep ownership</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTransferOwnership}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, transfer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* User Table */}
      <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_100px_80px_100px_60px] items-center px-5 py-2.5 border-b border-border/15 bg-card/80 backdrop-blur-md">
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest">User</span>
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest text-center">Role</span>
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest text-center">Status</span>
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest text-center">Risk</span>
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest text-right">Joined</span>
          <span className="text-[10px] font-semibold text-muted-foreground/40 uppercase tracking-widest text-center"></span>
        </div>

        {/* Rows */}
        {filteredUsers.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/50">No users found</p>
          </div>
        ) : (
          <div className="divide-y divide-border/5">
            {filteredUsers.map((user, idx) => {
              const statusConf = STATUS_CONFIG[user.status] || STATUS_CONFIG.active;
              const StatusIcon = statusConf.icon;
              const userRoleList = userRoles[user.user_id] || [];
              const topStaffRole = pickHighestRole(userRoleList.filter((r) => STAFF_ROLE_KEYS.includes(r)));
              const roleConf = topStaffRole ? ROLE_CONFIG[topStaffRole] : null;
              const RoleIcon = roleConf?.icon;
              const userDisplayName = user.display_name || user.discord_username || user.email?.split('@')[0] || 'Unnamed';
              const userAvatarUrl = getProfileAvatarUrl(user);
              return (
                <ContextMenu key={user.id}>
                  <ContextMenuTrigger asChild>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => fetchUserDetail(user)}
                      data-allow-context-menu
                      className="grid grid-cols-[1fr_120px_100px_80px_100px_60px] items-center px-5 py-3 hover:bg-muted/5 transition-colors cursor-pointer group"
                    >
                      {/* User info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-muted/20 flex items-center justify-center shrink-0 overflow-hidden">
                          {userAvatarUrl ? (
                            <img src={userAvatarUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <span className="text-[11px] font-bold text-muted-foreground/50">
                              {userDisplayName[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {userDisplayName}
                          </p>
                          <p className="text-[10px] text-muted-foreground/40 truncate">
                            {user.email || user.user_id.slice(0, 8)}
                          </p>
                        </div>
                      </div>

                      {/* Role */}
                      <div className="flex justify-center">
                        {roleConf && RoleIcon ? (
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                            roleConf.badge,
                          )}>
                            <RoleIcon className="w-3 h-3" />
                            {roleConf.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">—</span>
                        )}
                      </div>

                      {/* Status */}
                      <div className="flex justify-center">
                        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', statusConf.bg, statusConf.color)}>
                          <StatusIcon className="w-3 h-3" />
                          {statusConf.label}
                        </span>
                      </div>

                      {/* Risk */}
                      <div className="flex justify-center">
                        <RiskBar score={user.risk_score || 0} />
                      </div>

                      {/* Joined */}
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground/50">
                          {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-center">
                        <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors" />
                      </div>
                    </motion.div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuSub>
                      <ContextMenuSubTrigger className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5" />
                        Assign Role
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {ASSIGNABLE_ROLES.map((role) => {
                          const isCurrent = topStaffRole === role || (role === 'user' && !topStaffRole);
                          const cfg = ROLE_CONFIG[role];
                          return (
                            <ContextMenuItem
                              key={role}
                              onClick={() => user.email && assignRole(user.user_id, user.email, role)}
                              className="flex items-center gap-2"
                            >
                              {cfg ? (
                                <cfg.icon className={cn('w-3.5 h-3.5', cfg.iconClass)} />
                              ) : (
                                <Users className="w-3.5 h-3.5 text-muted-foreground/60" />
                              )}
                              <span className="flex-1">{cfg?.label || 'Regular user'}</span>
                              {isCurrent && <Check className="w-3 h-3 text-primary" />}
                            </ContextMenuItem>
                          );
                        })}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => fetchUserDetail(user)}>
                      <Eye className="w-3.5 h-3.5 mr-2" />
                      View Details
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════ USER DETAIL PANEL ═══════════ */}
      <AnimatePresence>
        {selectedUser && (
          <Dialog open={!!selectedUser} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0 bg-card border-border/30">
              {/* Header */}
              <div className="sticky top-0 z-10 px-6 py-4 border-b border-border/15 bg-card/95 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                    {getProfileAvatarUrl(selectedUser) ? (
                      <img src={getProfileAvatarUrl(selectedUser)!} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <span className="text-lg font-bold text-muted-foreground/50">
                        {(selectedUser.display_name || '?')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-foreground truncate">{selectedUser.display_name || 'Unnamed'}</h2>
                      {(() => {
                        const sc = STATUS_CONFIG[selectedUser.status] || STATUS_CONFIG.active;
                        return (
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold', sc.bg, sc.color)}>
                            {sc.label}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground/50 truncate">{selectedUser.email}</p>
                  </div>
                  <RiskBar score={selectedUser.risk_score || 0} />
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Quick Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'User ID', value: selectedUser.user_id.slice(0, 8) + '…', icon: Link2 },
                    { label: 'Joined', value: format(new Date(selectedUser.created_at), 'dd MMM yyyy'), icon: Clock },
                    { label: 'Discord', value: selectedUser.discord_username || '—', icon: MessageSquare },
                    { label: 'Risk Score', value: String(selectedUser.risk_score || 0), icon: Gauge },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-lg bg-muted/5 border border-border/10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <item.icon className="w-3 h-3 text-muted-foreground/40" />
                        <span className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">{item.label}</span>
                      </div>
                      <p className="text-xs font-semibold text-foreground truncate">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Suspension Info */}
                {selectedUser.status === 'suspended' && selectedUser.suspended_reason && (
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                    <div className="flex items-center gap-2 mb-1">
                      <Ban className="w-3.5 h-3.5 text-destructive" />
                      <span className="text-[11px] font-semibold text-destructive">Suspension Reason</span>
                    </div>
                    <p className="text-xs text-foreground/80">{selectedUser.suspended_reason}</p>
                    {selectedUser.suspended_at && (
                      <p className="text-[10px] text-muted-foreground/40 mt-1">
                        Suspended {formatDistanceToNow(new Date(selectedUser.suspended_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setNewStatus(selectedUser.status); setStatusDialogOpen(true); }}
                    className="h-8 gap-1.5 text-xs border-border/20"
                  >
                    <Shield className="w-3.5 h-3.5" /> Change Status
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFlagDialogOpen(true)}
                    className="h-8 gap-1.5 text-xs border-border/20"
                  >
                    <Flag className="w-3.5 h-3.5" /> Add Flag
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setNewRiskScore(String(selectedUser.risk_score || 0)); setRiskDialogOpen(true); }}
                    className="h-8 gap-1.5 text-xs border-border/20"
                  >
                    <Gauge className="w-3.5 h-3.5" /> Set Risk Score
                  </Button>
                </div>

                {/* Flags Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Flag className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Flags & Notes</h3>
                    <span className="text-[10px] text-muted-foreground/40 bg-muted/10 px-1.5 py-0.5 rounded">
                      {userFlags.filter(f => !f.resolved).length} active
                    </span>
                  </div>
                  {loadingDetail ? (
                    <div className="space-y-2">
                      {[1, 2].map(i => <div key={i} className="h-12 bg-muted/10 rounded-lg animate-pulse" />)}
                    </div>
                  ) : userFlags.length === 0 ? (
                    <p className="text-xs text-muted-foreground/40 py-4 text-center">No flags on this user</p>
                  ) : (
                    <div className="space-y-2">
                      {userFlags.map(flag => {
                        const typeConf = FLAG_TYPES.find(t => t.value === flag.flag_type) || FLAG_TYPES[2];
                        return (
                          <div key={flag.id} className={cn(
                            'p-3 rounded-lg border transition-all',
                            flag.resolved
                              ? 'bg-muted/5 border-border/10 opacity-60'
                              : 'bg-card/60 border-border/20'
                          )}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className={cn('text-[10px] py-0 capitalize', typeConf.color)}>
                                    {flag.flag_type.replace('_', ' ')}
                                  </Badge>
                                  {flag.resolved && (
                                    <Badge variant="outline" className="text-[10px] py-0 text-emerald-400">Resolved</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-foreground/80">{flag.reason}</p>
                                <p className="text-[10px] text-muted-foreground/40 mt-1">
                                  {formatDistanceToNow(new Date(flag.created_at), { addSuffix: true })}
                                </p>
                              </div>
                              {!flag.resolved && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleResolveFlag(flag.id)}
                                  className="h-7 text-[10px] text-emerald-400 hover:text-emerald-300"
                                >
                                  <CheckCircle className="w-3 h-3 mr-1" /> Resolve
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Activity Timeline */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Activity Timeline</h3>
                  </div>
                  {loadingDetail ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted/10 rounded-lg animate-pulse" />)}
                    </div>
                  ) : userActivity.length === 0 ? (
                    <p className="text-xs text-muted-foreground/40 py-4 text-center">No activity recorded</p>
                  ) : (
                    <div className="relative pl-4 border-l border-border/15 space-y-1">
                      {userActivity.slice(0, 20).map(entry => (
                        <div key={entry.id} className="relative py-2 group">
                          <div className="absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full bg-muted/30 border-2 border-card group-hover:bg-primary/50 transition-colors" />
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-medium text-foreground/80 capitalize">
                                {entry.action.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] text-muted-foreground/30 font-mono">{entry.table_name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/40">
                              {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* ═══════════ STATUS CHANGE DIALOG ═══════════ */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Change User Status</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/60">
              Update the lifecycle status for {selectedUser?.display_name || 'this user'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                  <SelectItem key={key} value={key} className="text-xs">{conf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(newStatus === 'suspended' || newStatus === 'flagged') && (
              <Textarea
                placeholder="Reason..."
                value={statusReason}
                onChange={e => setStatusReason(e.target.value)}
                className="text-xs min-h-[80px]"
              />
            )}
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleUpdateStatus} className="h-8 text-xs">
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ ADD FLAG DIALOG ═══════════ */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Flag</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/60">
              Add a flag or note to {selectedUser?.display_name || 'this user'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newFlagType} onValueChange={setNewFlagType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLAG_TYPES.map(ft => (
                  <SelectItem key={ft.value} value={ft.value} className="text-xs">{ft.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Describe the reason..."
              value={flagReason}
              onChange={e => setFlagReason(e.target.value)}
              className="text-xs min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleAddFlag} disabled={!flagReason.trim()} className="h-8 text-xs">
              Add Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ RISK SCORE DIALOG ═══════════ */}
      <Dialog open={riskDialogOpen} onOpenChange={setRiskDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Set Risk Score</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/60">
              Set a risk score (0-100) for {selectedUser?.display_name || 'this user'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              min={0}
              max={100}
              value={newRiskScore}
              onChange={e => setNewRiskScore(e.target.value)}
              className="h-9 text-xs"
            />
            <RiskBar score={parseInt(newRiskScore) || 0} />
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleUpdateRiskScore} className="h-8 text-xs">
              Update Score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
