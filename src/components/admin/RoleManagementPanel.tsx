import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Crown,
  ShieldCheck,
  Trash2,
  Loader2,
  RefreshCw,
  Shield,
  Users,
  MoreHorizontal,
  UserCog,
  Search,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface RoleEntry {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

type RoleMeta = {
  icon: typeof Crown;
  label: string;
  description: string;
  badgeClass: string;
  iconClass: string;
  accentClass: string;
  order: number;
};

const ROLE_META: Record<string, RoleMeta> = {
  owner: {
    icon: Crown,
    label: 'Owner',
    description: 'Full control over the workspace',
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    iconClass: 'text-amber-300',
    accentClass: 'from-amber-500/15 to-amber-500/0',
    order: 0,
  },
  admin: {
    icon: Shield,
    label: 'Admin',
    description: 'Manage settings, users and content',
    badgeClass: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    iconClass: 'text-sky-300',
    accentClass: 'from-sky-500/15 to-sky-500/0',
    order: 1,
  },
  moderator: {
    icon: ShieldCheck,
    label: 'Moderator',
    description: 'Review reports and moderate community',
    badgeClass: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    iconClass: 'text-violet-300',
    accentClass: 'from-violet-500/15 to-violet-500/0',
    order: 2,
  },
  mod_creator: {
    icon: Sparkles,
    label: 'Mod Creator',
    description: 'Upload and manage mods',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    iconClass: 'text-emerald-300',
    accentClass: 'from-emerald-500/15 to-emerald-500/0',
    order: 3,
  },
  integrations_manager: {
    icon: Shield,
    label: 'Integrations',
    description: 'Manage integrations and webhooks',
    badgeClass: 'bg-slate-400/10 text-slate-300 border-slate-400/20',
    iconClass: 'text-slate-300',
    accentClass: 'from-slate-400/15 to-slate-400/0',
    order: 4,
  },
  server_owner: {
    icon: Crown,
    label: 'Server Owner',
    description: 'Can register and manage their own Discord bot servers',
    badgeClass: 'bg-teal-500/10 text-teal-300 border-teal-500/20',
    iconClass: 'text-teal-300',
    accentClass: 'from-teal-500/15 to-teal-500/0',
    order: 5,
  },
};

const STAFF_ROLES = ['owner', 'admin', 'moderator', 'mod_creator', 'integrations_manager', 'server_owner'];
const ASSIGNABLE_ROLES = ['admin', 'moderator', 'mod_creator', 'integrations_manager', 'server_owner', 'user'];

const formatRelative = (date: Date | null): string => {
  if (!date) return '';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
};

const RoleManagementPanel = () => {
  const [entries, setEntries] = useState<RoleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<RoleEntry | null>(null);
  const [, setTick] = useState(0);

  // Re-render every 30s so "Updated Xm ago" stays fresh
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('id, user_id, role, created_at')
        .in('role', STAFF_ROLES as any)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to load roles');
        setIsLoading(false);
        return;
      }

      const userIds = [...new Set((roles ?? []).map((r: any) => r.user_id))];
      let profileMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, email, avatar_url')
          .in('user_id', userIds);
        profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      }

      setEntries(
        (roles ?? []).map((r: any) => ({ ...r, profile: profileMap.get(r.user_id) || null })),
      );
      setLastUpdated(new Date());
    } catch {
      toast.error('Failed to load roles');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const requestRemove = (entry: RoleEntry) => {
    if (entry.role === 'owner') {
      toast.error('You can’t remove the owner role');
      return;
    }
    setConfirmRemove(entry);
  };

  const handleRemoveConfirmed = async () => {
    const entry = confirmRemove;
    if (!entry) return;
    setConfirmRemove(null);
    setActionId(entry.id);
    const snapshot = entries;
    // Optimistic update
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    try {
      const { error } = await supabase.from('user_roles').delete().eq('id', entry.id);
      if (error) {
        setEntries(snapshot);
        toast.error('Couldn’t remove that role. Please try again.');
      } else {
        toast.success('Role removed', {
          description: `${displayName(entry)} no longer has ${ROLE_META[entry.role]?.label || entry.role} access.`,
        });
      }
    } catch {
      setEntries(snapshot);
      toast.error('Couldn’t remove that role. Please try again.');
    }
    setActionId(null);
  };

  const handleChangeRole = async (entry: RoleEntry, newRole: string) => {
    if (entry.role === 'owner') {
      toast.error('Cannot change owner role');
      return;
    }
    setActionId(entry.id);
    try {
      if (newRole === 'user') {
        const { error } = await supabase.from('user_roles').delete().eq('id', entry.id);
        if (error) {
          toast.error('Failed to change role');
        } else {
          setEntries((prev) => prev.filter((e) => e.id !== entry.id));
          toast.success(`${displayName(entry)} is now a regular user`);
        }
      } else {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole as any })
          .eq('id', entry.id);
        if (error) {
          toast.error('Failed to change role');
        } else {
          setEntries((prev) =>
            prev.map((e) => (e.id === entry.id ? { ...e, role: newRole } : e)),
          );
          toast.success(
            `Changed ${displayName(entry)} to ${ROLE_META[newRole]?.label || newRole}`,
          );
        }
      }
    } catch {
      toast.error('Failed to change role');
    }
    setActionId(null);
  };

  // Deduplicate by (user_id, role) and group by role
  const grouped = useMemo(() => {
    const seen = new Set<string>();
    const unique: RoleEntry[] = [];
    for (const e of entries) {
      const key = `${e.user_id}:${e.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(e);
    }

    const q = search.trim().toLowerCase();
    const filtered = q
      ? unique.filter((e) => {
          const name = (e.profile?.display_name || '').toLowerCase();
          const email = (e.profile?.email || '').toLowerCase();
          return name.includes(q) || email.includes(q);
        })
      : unique;

    return filtered.reduce<Record<string, RoleEntry[]>>((acc, entry) => {
      (acc[entry.role] ||= []).push(entry);
      return acc;
    }, {});
  }, [entries, search]);

  const sortedGroups = useMemo(
    () =>
      Object.keys(grouped)
        .filter((r) => grouped[r]?.length)
        .sort((a, b) => (ROLE_META[a]?.order ?? 99) - (ROLE_META[b]?.order ?? 99)),
    [grouped],
  );

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    const seen = new Set<string>();
    for (const e of entries) {
      const key = `${e.user_id}:${e.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
      counts[e.role] = (counts[e.role] || 0) + 1;
    }
    return {
      total: seen.size,
      owners: counts.owner || 0,
      admins: counts.admin || 0,
      moderators: counts.moderator || 0,
    };
  }, [entries]);

  const totalFiltered = sortedGroups.reduce((sum, k) => sum + grouped[k].length, 0);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total staff" value={stats.total} icon={Users} tone="text-foreground" />
        <StatCard label="Owners" value={stats.owners} icon={Crown} tone="text-amber-300" />
        <StatCard label="Admins" value={stats.admins} icon={Shield} tone="text-sky-300" />
        <StatCard
          label="Moderators"
          value={stats.moderators}
          icon={ShieldCheck}
          tone="text-violet-300"
        />
      </div>

      {/* Main panel */}
      <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Crown className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                Staff Overview
              </h3>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                Manage members with elevated access
                {lastUpdated && (
                  <>
                    <span className="mx-1.5 text-muted-foreground/30">·</span>
                    <span className="text-muted-foreground/50">
                      Updated {formatRelative(lastUpdated)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff…"
                className="h-8 pl-8 pr-3 w-full sm:w-56 text-xs bg-background/50 border-border/40"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchRoles}
              disabled={isLoading}
              className="h-8 w-8 text-muted-foreground/60 hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 px-6">
            <div className="w-12 h-12 rounded-xl bg-secondary/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/80">
                {search ? 'No matches found' : 'No staff roles assigned yet'}
              </p>
              <p className="text-xs text-muted-foreground/50 mt-1">
                {search
                  ? 'Try a different name or email'
                  : 'Assign a role from the panel above to get started'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {sortedGroups.map((roleKey) => {
              const meta = ROLE_META[roleKey];
              const members = grouped[roleKey];
              const Icon = meta.icon;

              return (
                <section key={roleKey}>
                  {/* Role group header */}
                  <div className="px-5 py-2.5 flex items-center gap-2.5 bg-secondary/10">
                    <Icon className={`w-3.5 h-3.5 ${meta.iconClass}`} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                      {meta.label}
                      {members.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground/50 px-1.5 py-0.5 rounded bg-secondary/40">
                      {members.length}
                    </span>
                    <span className="text-[11px] text-muted-foreground/40 ml-1 hidden sm:inline truncate">
                      · {meta.description}
                    </span>
                  </div>

                  {/* Members */}
                  <div className="divide-y divide-border/10">
                    {members.map((entry) => (
                      <StaffRow
                        key={entry.id}
                        entry={entry}
                        meta={meta}
                        roleKey={roleKey}
                        isActioning={actionId === entry.id}
                        onRemove={() => requestRemove(entry)}
                        onChangeRole={(newRole) => handleChangeRole(entry, newRole)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {!isLoading && sortedGroups.length > 0 && (
          <div className="px-5 py-2.5 border-t border-border/30 bg-secondary/5 text-[11px] text-muted-foreground/60 flex items-center justify-between">
            <span>
              Showing <span className="text-foreground/80 font-medium">{totalFiltered}</span>{' '}
              of <span className="text-foreground/80 font-medium">{stats.total}</span> staff
              {search && ' (filtered)'}
            </span>
            <span className="hidden sm:inline">
              Hover a row for actions
            </span>
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this role?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove && (
                <>
                  <strong className="text-foreground">{displayName(confirmRemove)}</strong> will lose{' '}
                  <strong className="text-foreground">
                    {ROLE_META[confirmRemove.role]?.label || confirmRemove.role}
                  </strong>{' '}
                  access immediately. You can re-assign the role later if needed.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep role</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Crown;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur-sm p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-md bg-secondary/40 flex items-center justify-center">
        <Icon className={`w-4 h-4 ${tone}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
          {label}
        </p>
        <p className="text-lg font-semibold text-foreground leading-none mt-1">{value}</p>
      </div>
    </div>
  );
}

function displayName(entry: RoleEntry): string {
  if (entry.profile?.display_name) return entry.profile.display_name;
  if (entry.profile?.email) return entry.profile.email;
  return 'Pending user';
}

function StaffRow({
  entry,
  meta,
  roleKey,
  isActioning,
  onRemove,
  onChangeRole,
}: {
  entry: RoleEntry;
  meta: RoleMeta;
  roleKey: string;
  isActioning: boolean;
  onRemove: () => void;
  onChangeRole: (role: string) => void;
}) {
  const name = displayName(entry);
  const isPending = !entry.profile?.display_name && !entry.profile?.email;
  const initials = isPending ? '?' : name[0].toUpperCase();

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/10 transition-colors group">
      <Avatar className="h-9 w-9 ring-1 ring-border/20">
        <AvatarImage src={entry.profile?.avatar_url || undefined} />
        <AvatarFallback className="bg-secondary/40 text-[11px] font-medium text-muted-foreground/80">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-medium truncate leading-tight ${
              isPending ? 'text-muted-foreground/60 italic' : 'text-foreground'
            }`}
          >
            {name}
          </p>
          {isPending && (
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50 px-1.5 py-0.5 rounded bg-secondary/40 border border-border/30">
              Pending
            </span>
          )}
        </div>
        {entry.profile?.email && entry.profile?.display_name && (
          <p className="text-[11px] text-muted-foreground/50 truncate leading-tight mt-0.5">
            {entry.profile.email}
          </p>
        )}
      </div>

      <Badge
        variant="outline"
        className={`hidden sm:inline-flex text-[10px] font-medium tracking-wide px-2 py-0.5 border ${meta.badgeClass}`}
      >
        {meta.label}
      </Badge>

      {roleKey !== 'owner' ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 transition-opacity text-muted-foreground/60 hover:text-foreground"
              disabled={isActioning}
            >
              {isActioning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MoreHorizontal className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
              {name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs gap-2">
                <UserCog className="h-3.5 w-3.5" />
                Change role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {ASSIGNABLE_ROLES.filter((r) => r !== roleKey).map((r) => (
                  <DropdownMenuItem
                    key={r}
                    className="text-xs"
                    onClick={() => onChangeRole(r)}
                  >
                    {ROLE_META[r]?.label || (r === 'user' ? 'Regular user' : r)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs text-destructive focus:text-destructive gap-2"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove role
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="w-7" />
      )}
    </div>
  );
}

export default RoleManagementPanel;
