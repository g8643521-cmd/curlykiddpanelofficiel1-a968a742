// @ts-nocheck
import { useMemo } from "react";
import { Activity, Award, Ban, Clock, Eye, Trophy, UserCog, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { Badge } from "@/components/ui/badge";

export type ActivityLogRow = {
  id: string;
  user_id: string;
  action_type: string;
  details: unknown;
  created_at: string;
};

type Props = {
  selectedUser: { id: string; display_name: string | null; email: string | null } | null;
  logs: ActivityLogRow[];
};

function getLogIcon(actionType: string) {
  switch (true) {
    case actionType.includes("xp"):
      return <Zap className="w-4 h-4" />;
    case actionType.includes("role"):
      return <UserCog className="w-4 h-4" />;
    case actionType.includes("badge"):
      return <Award className="w-4 h-4" />;
    case actionType.includes("leaderboard"):
      return <Trophy className="w-4 h-4" />;
    case actionType.includes("visibility"):
      return <Eye className="w-4 h-4" />;
    case actionType.includes("ban"):
      return <Ban className="w-4 h-4" />;
    default:
      return <Activity className="w-4 h-4" />;
  }
}

function getAffectedUserId(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const d = details as Record<string, unknown>;
  return typeof d.user_id === "string" ? d.user_id : null;
}

export default function UserAuditPanel({ selectedUser, logs }: Props) {
  const filtered = useMemo(() => {
    if (!selectedUser) return [];
    return logs.filter((l) => getAffectedUserId(l.details) === selectedUser.id);
  }, [logs, selectedUser]);

  return (
    <aside className="glass-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h4 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Audit
          </h4>
          {selectedUser ? (
            <p className="text-xs text-muted-foreground truncate">
              {selectedUser.display_name || "Anonymous"}
              {selectedUser.email ? ` • ${selectedUser.email}` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Select a user to view actions.</p>
          )}
        </div>
        {selectedUser && <Badge variant="secondary">{filtered.length}</Badge>}
      </div>

      {selectedUser && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground py-3">No logged actions for this user yet.</p>
      )}

      {!selectedUser ? null : (
        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {filtered.map((log) => (
            <div key={log.id} className="flex items-start gap-2 p-2 rounded-md bg-secondary/30">
              <div className="mt-0.5 text-muted-foreground">{getLogIcon(log.action_type)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{log.action_type.replace(/_/g, " ")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
