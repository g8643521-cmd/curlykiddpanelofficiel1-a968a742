import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  Hash,
  Loader2,
  Lock,
  Search,
  Shield,
  Sparkles,
  Users,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface CategoryPreview {
  name: string;
  staffOnly?: boolean;
  channels: Array<{ name: string; type: number; topic: string }>;
}

interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
}

export interface CategoryPermission {
  private: boolean;
  allowed_role_ids: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guildId: string;
  guildName?: string;
  categories: CategoryPreview[];
  onConfirm: (permissions: Record<string, CategoryPermission>) => void;
}

type Step = "intro" | "configure" | "review";

const ROLE_COLOR = (color: number) =>
  color === 0 ? "hsl(var(--muted-foreground))" : `#${color.toString(16).padStart(6, "0")}`;

export default function DiscordSetupWizard({
  open,
  onOpenChange,
  guildId,
  guildName,
  categories,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, CategoryPermission>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState("");

  // Initialize defaults when opened
  useEffect(() => {
    if (!open) return;
    setStep("intro");
    setRoleSearch("");
    setActiveCategory(categories[0]?.name ?? null);
    const defaults: Record<string, CategoryPermission> = {};
    for (const c of categories) {
      defaults[c.name] = {
        private: !!c.staffOnly,
        allowed_role_ids: [],
      };
    }
    setPermissions(defaults);
  }, [open, categories]);

  // Fetch guild roles when entering configure step
  useEffect(() => {
    if (!open || step !== "configure" || !guildId || roles.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoadingRoles(true);
      try {
        const { data, error } = await supabase.functions.invoke("discord-setup", {
          body: { action: "get_guild_roles", guild_id: guildId },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.success) {
          setRoles(data.roles || []);
        } else {
          throw new Error(data?.error || "Failed to load roles");
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load Discord roles");
        }
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, guildId, roles.length]);

  const filteredRoles = useMemo(() => {
    const q = roleSearch.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, roleSearch]);

  const activePerm = activeCategory ? permissions[activeCategory] : null;
  const activeCat = categories.find((c) => c.name === activeCategory);

  const togglePrivate = (name: string, value: boolean) => {
    setPermissions((p) => ({
      ...p,
      [name]: { ...(p[name] ?? { private: false, allowed_role_ids: [] }), private: value },
    }));
  };

  const toggleRole = (catName: string, roleId: string) => {
    setPermissions((p) => {
      const cur = p[catName] ?? { private: true, allowed_role_ids: [] };
      const has = cur.allowed_role_ids.includes(roleId);
      return {
        ...p,
        [catName]: {
          ...cur,
          allowed_role_ids: has
            ? cur.allowed_role_ids.filter((id) => id !== roleId)
            : [...cur.allowed_role_ids, roleId],
        },
      };
    });
  };

  const applyPreset = (catName: string, preset: "public" | "staff" | "admin-only") => {
    if (preset === "public") {
      setPermissions((p) => ({ ...p, [catName]: { private: false, allowed_role_ids: [] } }));
      return;
    }
    const targetNames =
      preset === "admin-only"
        ? ["owner", "admin"]
        : ["owner", "admin", "moderator", "support", "staff", "mod"];
    const matched = roles
      .filter((r) => targetNames.some((n) => r.name.toLowerCase().includes(n)))
      .map((r) => r.id);
    setPermissions((p) => ({
      ...p,
      [catName]: { private: true, allowed_role_ids: matched },
    }));
  };

  const stats = useMemo(() => {
    const total = categories.length;
    const privateCount = categories.filter((c) => permissions[c.name]?.private).length;
    const issues = categories.filter(
      (c) => permissions[c.name]?.private && (permissions[c.name]?.allowed_role_ids?.length ?? 0) === 0,
    );
    return { total, privateCount, publicCount: total - privateCount, issues };
  }, [categories, permissions]);

  const canConfirm = stats.issues.length === 0;

  const handleConfirm = () => {
    onConfirm(permissions);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-border/60 bg-gradient-to-br from-[#5865F2]/10 via-background to-background">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#5865F2] to-[#4752C4] flex items-center justify-center shadow-lg shadow-[#5865F2]/30">
              <Wand2 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-display tracking-tight">
                Discord Server Setup
              </DialogTitle>
              <DialogDescription className="text-xs">
                {guildName ? (
                  <>
                    Configuring <span className="font-medium text-foreground">{guildName}</span>
                  </>
                ) : (
                  "Professional channel setup wizard"
                )}
              </DialogDescription>
            </div>
            {/* Stepper */}
            <div className="hidden md:flex items-center gap-1.5 text-xs">
              {(["intro", "configure", "review"] as Step[]).map((s, i) => {
                const isActive = step === s;
                const isDone = (["intro", "configure", "review"] as Step[]).indexOf(step) > i;
                return (
                  <div key={s} className="flex items-center gap-1.5">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center font-semibold transition-all",
                        isActive
                          ? "bg-[#5865F2] text-white shadow-md shadow-[#5865F2]/40 scale-110"
                          : isDone
                          ? "bg-[hsl(var(--green))]/20 text-[hsl(var(--green))]"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    {i < 2 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {step === "intro" && (
            <ScrollArea className="flex-1 px-6 py-6">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5865F2]/20 to-primary/10 mb-2">
                    <Sparkles className="w-7 h-7 text-[#5865F2]" />
                  </div>
                  <h3 className="text-2xl font-display font-bold">Privacy-first server setup</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose exactly which Discord roles can see each category. Channels inherit
                    category permissions automatically — no manual cleanup needed.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      icon: Lock,
                      title: "Private by default",
                      desc: "Lock categories down so only chosen roles can view them.",
                    },
                    {
                      icon: Shield,
                      title: "Granular control",
                      desc: "Pick from your existing Discord roles for each category.",
                    },
                    {
                      icon: Sparkles,
                      title: "Smart presets",
                      desc: "One-click presets for public, staff-only, or admin-only.",
                    },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div
                      key={title}
                      className="p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur"
                    >
                      <Icon className="w-5 h-5 text-primary mb-2" />
                      <p className="font-semibold text-sm">{title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    What will be created
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-2xl font-display font-bold text-foreground">
                        {categories.length}
                      </span>
                      <p className="text-xs text-muted-foreground">Categories</p>
                    </div>
                    <div>
                      <span className="text-2xl font-display font-bold text-foreground">
                        {categories.reduce((acc, c) => acc + c.channels.length, 0)}
                      </span>
                      <p className="text-xs text-muted-foreground">Channels</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          {step === "configure" && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] overflow-hidden">
              {/* Sidebar: category list */}
              <div className="border-r border-border/60 bg-secondary/20 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-border/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Categories
                  </p>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {categories.map((cat) => {
                      const perm = permissions[cat.name];
                      const isActive = activeCategory === cat.name;
                      const hasIssue =
                        perm?.private && (perm?.allowed_role_ids?.length ?? 0) === 0;
                      return (
                        <button
                          key={cat.name}
                          onClick={() => setActiveCategory(cat.name)}
                          className={cn(
                            "w-full text-left px-3 py-2.5 rounded-lg transition-all group",
                            isActive
                              ? "bg-[#5865F2]/15 border border-[#5865F2]/40 shadow-sm"
                              : "hover:bg-background/60 border border-transparent",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p
                              className={cn(
                                "text-sm font-medium truncate",
                                isActive ? "text-foreground" : "text-foreground/80",
                              )}
                            >
                              {cat.name}
                            </p>
                            {perm?.private ? (
                              <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <Globe className="w-3.5 h-3.5 text-[hsl(var(--green))] shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">
                              {cat.channels.length} channels
                            </span>
                            {perm?.private && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-4"
                              >
                                {perm.allowed_role_ids.length} roles
                              </Badge>
                            )}
                            {hasIssue && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] px-1.5 py-0 h-4"
                              >
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                no roles
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Main: configure active category */}
              <div className="overflow-hidden flex flex-col">
                {activeCat && activePerm && (
                  <>
                    <div className="px-6 py-4 border-b border-border/40 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-display font-bold text-lg truncate">
                            {activeCat.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {activeCat.channels.length} channels will inherit these permissions
                          </p>
                        </div>
                        <div
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border",
                            activePerm.private
                              ? "bg-amber-500/10 border-amber-500/30"
                              : "bg-[hsl(var(--green))]/10 border-[hsl(var(--green))]/30",
                          )}
                        >
                          {activePerm.private ? (
                            <Lock className="w-4 h-4 text-amber-500" />
                          ) : (
                            <Globe className="w-4 h-4 text-[hsl(var(--green))]" />
                          )}
                          <div className="text-xs">
                            <p className="font-semibold">
                              {activePerm.private ? "Private" : "Public"}
                            </p>
                          </div>
                          <Switch
                            checked={activePerm.private}
                            onCheckedChange={(v) => togglePrivate(activeCat.name, v)}
                          />
                        </div>
                      </div>

                      {/* Channels preview */}
                      <div className="flex flex-wrap gap-1.5">
                        {activeCat.channels.map((ch) => (
                          <div
                            key={ch.name}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/50 text-[11px] text-muted-foreground"
                          >
                            {ch.type === 2 ? (
                              <Volume2 className="w-3 h-3" />
                            ) : (
                              <Hash className="w-3 h-3" />
                            )}
                            {ch.name}
                          </div>
                        ))}
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Quick presets:
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => applyPreset(activeCat.name, "public")}
                        >
                          <Globe className="w-3 h-3 mr-1" />
                          Public
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => applyPreset(activeCat.name, "staff")}
                          disabled={!activePerm.private}
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          Staff only
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => applyPreset(activeCat.name, "admin-only")}
                          disabled={!activePerm.private}
                        >
                          <Lock className="w-3 h-3 mr-1" />
                          Admin only
                        </Button>
                      </div>
                    </div>

                    {/* Role picker */}
                    {activePerm.private ? (
                      <div className="flex-1 overflow-hidden flex flex-col">
                        <div className="px-6 pt-4 pb-2 flex items-center gap-2">
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={roleSearch}
                              onChange={(e) => setRoleSearch(e.target.value)}
                              placeholder="Search roles..."
                              className="pl-8 h-9 text-sm"
                            />
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {activePerm.allowed_role_ids.length} selected
                          </Badge>
                        </div>
                        <ScrollArea className="flex-1 px-3 pb-3">
                          {loadingRoles ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                          ) : filteredRoles.length === 0 ? (
                            <div className="text-center py-12 text-sm text-muted-foreground">
                              {roleSearch ? "No roles match your search" : "No roles found"}
                            </div>
                          ) : (
                            <div className="space-y-1 pt-1">
                              {filteredRoles.map((role) => {
                                const checked = activePerm.allowed_role_ids.includes(role.id);
                                return (
                                  <label
                                    key={role.id}
                                    className={cn(
                                      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors border",
                                      checked
                                        ? "bg-[#5865F2]/10 border-[#5865F2]/30"
                                        : "border-transparent hover:bg-secondary/40",
                                    )}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={() => toggleRole(activeCat.name, role.id)}
                                    />
                                    <div
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: ROLE_COLOR(role.color) }}
                                    />
                                    <span className="text-sm font-medium flex-1 truncate">
                                      @{role.name}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center p-8">
                        <div className="text-center max-w-sm space-y-2">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[hsl(var(--green))]/15 mb-1">
                            <Eye className="w-5 h-5 text-[hsl(var(--green))]" />
                          </div>
                          <p className="font-semibold text-sm">Visible to everyone</p>
                          <p className="text-xs text-muted-foreground">
                            Anyone in the server can see this category and its channels. Toggle
                            "Private" above to restrict access.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {step === "review" && (
            <ScrollArea className="flex-1 px-6 py-6">
              <div className="max-w-3xl mx-auto space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/50 bg-card/60 p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                      Total
                    </p>
                    <p className="text-2xl font-display font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">categories</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <p className="text-xs uppercase tracking-wider text-amber-500 font-semibold mb-1 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Private
                    </p>
                    <p className="text-2xl font-display font-bold">{stats.privateCount}</p>
                  </div>
                  <div className="rounded-xl border border-[hsl(var(--green))]/30 bg-[hsl(var(--green))]/5 p-4">
                    <p className="text-xs uppercase tracking-wider text-[hsl(var(--green))] font-semibold mb-1 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      Public
                    </p>
                    <p className="text-2xl font-display font-bold">{stats.publicCount}</p>
                  </div>
                </div>

                {stats.issues.length > 0 && (
                  <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-destructive mb-1">
                        {stats.issues.length} private{" "}
                        {stats.issues.length === 1 ? "category has" : "categories have"} no roles
                        selected
                      </p>
                      <p className="text-xs text-destructive/80">
                        Without allowed roles, only server admins will see:{" "}
                        {stats.issues.map((c) => c.name).join(", ")}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {categories.map((cat) => {
                    const perm = permissions[cat.name];
                    const allowedRoles = roles.filter((r) =>
                      perm?.allowed_role_ids.includes(r.id),
                    );
                    return (
                      <div
                        key={cat.name}
                        className="rounded-lg border border-border/50 bg-card/40 p-3"
                      >
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {perm?.private ? (
                              <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                            ) : (
                              <Globe className="w-4 h-4 text-[hsl(var(--green))] shrink-0" />
                            )}
                            <p className="font-medium text-sm truncate">{cat.name}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {cat.channels.length} channels
                          </span>
                        </div>
                        {perm?.private && (
                          <div className="flex flex-wrap gap-1 pl-6">
                            {allowedRoles.length === 0 ? (
                              <span className="text-xs text-destructive">No roles selected</span>
                            ) : (
                              allowedRoles.map((r) => (
                                <Badge
                                  key={r.id}
                                  variant="outline"
                                  className="text-[10px] h-5"
                                  style={{
                                    color: ROLE_COLOR(r.color),
                                    borderColor: `${ROLE_COLOR(r.color)}50`,
                                  }}
                                >
                                  @{r.name}
                                </Badge>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 bg-background/95 px-6 py-3 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (step === "configure") setStep("intro");
              else if (step === "review") setStep("configure");
              else onOpenChange(false);
            }}
          >
            {step === "intro" ? (
              <>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </>
            ) : (
              <>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </>
            )}
          </Button>

          <div className="text-xs text-muted-foreground hidden sm:block">
            {step === "configure" && (
              <>
                <span className="font-semibold text-foreground">{stats.privateCount}</span> private
                · <span className="font-semibold text-foreground">{stats.publicCount}</span> public
              </>
            )}
          </div>

          {step !== "review" ? (
            <Button
              size="sm"
              onClick={() => setStep(step === "intro" ? "configure" : "review")}
              disabled={categories.length === 0}
              className="bg-[#5865F2] hover:bg-[#4752C4]"
            >
              {step === "intro"
                ? categories.length === 0
                  ? "Loading structure..."
                  : "Configure permissions"
                : "Review setup"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="bg-gradient-to-r from-[#5865F2] to-[#4752C4] hover:from-[#4752C4] hover:to-[#3c46a8] shadow-md shadow-[#5865F2]/30"
            >
              <Wand2 className="w-4 h-4 mr-1.5" />
              Start setup
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
