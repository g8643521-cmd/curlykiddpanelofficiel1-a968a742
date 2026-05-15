import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Permission = {
  key: string;
  description: string | null;
};

type PermissionSet = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type PermissionSetPermission = {
  id: string;
  permission_set_id: string;
  permission_key: string;
};

type UserPermissionSet = {
  id: string;
  user_id: string;
  permission_set_id: string;
};

type ProfileLite = {
  id: string;
  display_name: string | null;
  email: string | null;
};

export default function RoleSetsPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const confirm = useConfirm();

  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [sets, setSets] = useState<PermissionSet[]>([]);
  const [setPerms, setSetPerms] = useState<PermissionSetPermission[]>([]);
  const [userSets, setUserSets] = useState<UserPermissionSet[]>([]);

  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<ProfileLite[]>([]);

  const load = async () => {
    setIsLoading(true);
    try {
      const [permRes, setRes] = await Promise.all([
        supabase.from("permissions").select("key, description").order("key"),
        supabase.from("permission_sets").select("id, name, description, created_at").order("created_at", { ascending: false }),
      ]);

      if (permRes.error) throw permRes.error;
      if (setRes.error) throw setRes.error;

      setPermissions((permRes.data ?? []) as Permission[]);
      setSets((setRes.data ?? []) as PermissionSet[]);

      if (!selectedSetId && (setRes.data?.length ?? 0) > 0) {
        setSelectedSetId(setRes.data![0].id);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load role sets");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSelected = async (setId: string) => {
    setIsLoading(true);
    try {
      const [sp, us, prof] = await Promise.all([
        supabase.from("permission_set_permissions").select("id, permission_set_id, permission_key").eq("permission_set_id", setId),
        supabase.from("user_permission_sets").select("id, user_id, permission_set_id").eq("permission_set_id", setId),
        supabase
          .from("profiles")
          .select("id, display_name, email")
          .order("display_name", { ascending: true })
          .limit(200),
      ]);

      if (sp.error) throw sp.error;
      if (us.error) throw us.error;
      if (prof.error) throw prof.error;

      setSetPerms((sp.data ?? []) as PermissionSetPermission[]);
      setUserSets((us.data ?? []) as UserPermissionSet[]);
      setUsers((prof.data ?? []) as ProfileLite[]);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load selected set");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSetId) loadSelected(selectedSetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSetId]);

  const selectedSet = useMemo(
    () => sets.find((s) => s.id === selectedSetId) ?? null,
    [sets, selectedSetId],
  );

  const enabledKeys = useMemo(() => new Set(setPerms.map((p) => p.permission_key)), [setPerms]);
  const assignedUserIds = useMemo(() => new Set(userSets.map((u) => u.user_id)), [userSets]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        (u.display_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [userSearch, users]);

  const logActivity = async (actionType: string, details: Record<string, unknown>) => {
    const { logActivity: logAct } = await import('@/lib/activityLog');
    await logAct({ category: 'admin', action: actionType, severity: 'warning', metadata: details });
  };

  const createSet = async () => {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsSaving(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const session = sessionRes.session;
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("permission_sets")
        .insert([
          {
            name: newName.trim(),
            description: newDesc.trim() || null,
            created_by: session.user.id,
          },
        ])
        .select("id")
        .single();

      if (error) throw error;

      await logActivity('permission_set_create', {
        permission_set_id: data?.id,
        name: newName.trim(),
        description: newDesc.trim() || null,
      });

      toast.success("Role created");
      setCreateOpen(false);
      setNewName("");
      setNewDesc("");
      await load();
      if (data?.id) setSelectedSetId(data.id);
    } catch (e) {
      console.error(e);
      toast.error("Failed to create role");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePermission = async (permissionKey: string, enabled: boolean) => {
    if (!selectedSetId) return;
    setIsSaving(true);
    try {
      if (enabled) {
        const { error } = await supabase.from("permission_set_permissions").insert([
          { permission_set_id: selectedSetId, permission_key: permissionKey },
        ]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("permission_set_permissions")
          .delete()
          .eq("permission_set_id", selectedSetId)
          .eq("permission_key", permissionKey);
        if (error) throw error;
      }

      await logActivity('permission_set_permission_toggle', {
        permission_set_id: selectedSetId,
        permission_key: permissionKey,
        enabled,
      });

      await loadSelected(selectedSetId);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update permissions");
    } finally {
      setIsSaving(false);
    }
  };

  const assignToUser = async (userId: string) => {
    if (!selectedSetId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("user_permission_sets").insert([
        { user_id: userId, permission_set_id: selectedSetId },
      ]);
      if (error) throw error;

      await logActivity('permission_set_assign', {
        user_id: userId,
        permission_set_id: selectedSetId,
      });

      toast.success("Assigned");
      await loadSelected(selectedSetId);
    } catch (e) {
      console.error(e);
      toast.error("Failed to assign");
    } finally {
      setIsSaving(false);
    }
  };

  const unassignFromUser = async (userId: string) => {
    if (!selectedSetId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("user_permission_sets")
        .delete()
        .eq("permission_set_id", selectedSetId)
        .eq("user_id", userId);
      if (error) throw error;

      await logActivity('permission_set_unassign', {
        user_id: userId,
        permission_set_id: selectedSetId,
      });

      toast.success("Removed");
      await loadSelected(selectedSetId);
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSet = async () => {
    if (!selectedSetId) return;
    const name = selectedSet?.name ?? "this role";
    const ok = await confirm({
      title: `Delete "${name}"?`,
      description: 'Rollen fjernes fra alle brugere der har den. Dette kan ikke fortrydes.',
      confirmText: 'Delete role',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!ok) return;

    setIsSaving(true);
    try {
      const { error } = await supabase.from("permission_sets").delete().eq("id", selectedSetId);
      if (error) throw error;

      await logActivity('permission_set_delete', {
        permission_set_id: selectedSetId,
        name,
      });

      toast.success("Role deleted");
      setSelectedSetId(null);
      await load();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete role");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <p className="text-sm text-muted-foreground">Loading roles & permissions…</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Custom Roles</h3>
            <p className="text-xs text-muted-foreground">Permission bundles you can create and assign.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create role</DialogTitle>
                <DialogDescription>Create a new custom role (permission bundle).</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Name</Label>
                  <Input id="role-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Bot Manager" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-desc">Description</Label>
                  <Input id="role-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What can this role do?" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createSet} disabled={isSaving}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {sets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom roles yet.</p>
        ) : (
          <div className="space-y-2">
            {sets.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedSetId(s.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  s.id === selectedSetId ? "bg-secondary/30 border-border" : "bg-secondary/10 border-border/30 hover:bg-secondary/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  {s.id === selectedSetId && (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="w-3 h-3" />
                      Selected
                    </Badge>
                  )}
                </div>
                {s.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="glass-card p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                {selectedSet ? selectedSet.name : "Select a role"}
              </h3>
              <p className="text-sm text-muted-foreground">Toggle permissions and assign to users.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={deleteSet} disabled={!selectedSetId || isSaving} className="gap-2">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>

          <Separator className="my-4" />

          {!selectedSetId ? (
            <p className="text-sm text-muted-foreground">Pick a role from the left to edit it.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {permissions.map((p) => (
                <div key={p.key} className="p-4 rounded-lg bg-secondary/20 border border-border/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.key}</p>
                      {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                    </div>
                    <Switch
                      checked={enabledKeys.has(p.key)}
                      onCheckedChange={(v) => togglePermission(p.key, v)}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h4 className="font-display font-semibold text-foreground">Assign to users</h4>
            </div>
            <Badge variant="secondary">{assignedUserIds.size} assigned</Badge>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="user-search">Search users</Label>
              <Input id="user-search" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by name or email…" />
            </div>

            {!selectedSetId ? (
              <p className="text-sm text-muted-foreground">Select a role first.</p>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {filteredUsers.slice(0, 200).map((u) => {
                  const isAssigned = assignedUserIds.has(u.id);
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{u.display_name || "Anonymous"}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      {isAssigned ? (
                        <Button variant="outline" size="sm" onClick={() => unassignFromUser(u.id)} disabled={isSaving}>
                          Remove
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => assignToUser(u.id)} disabled={isSaving}>
                          Assign
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Note: these are custom roles (permission bundles). System roles like <span className="font-mono">owner</span> still exist separately.
        </p>
      </div>
    </div>
  );
}
