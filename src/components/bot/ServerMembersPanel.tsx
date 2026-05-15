import { useEffect, useState, useCallback } from 'react';
import { Users, UserPlus, Trash2, Loader2, Mail, Crown, Eye, Pencil, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type MemberRole = 'viewer' | 'editor' | 'admin';

type Member = {
  id: string;
  user_id: string;
  role: MemberRole;
  invited_at: string;
  profile?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
};

interface ServerMembersPanelProps {
  serverId: string;
  isOwner: boolean;
}

const roleMeta: Record<MemberRole, { label: string; icon: any; tone: string }> = {
  viewer: { label: 'Viewer', icon: Eye, tone: 'text-muted-foreground' },
  editor: { label: 'Editor', icon: Pencil, tone: 'text-cyan-400' },
  admin:  { label: 'Admin',  icon: Shield, tone: 'text-amber-400' },
};

const ServerMembersPanel = ({ serverId, isOwner }: ServerMembersPanelProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('viewer');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('server_members')
      .select('id, user_id, role, invited_at')
      .eq('server_id', serverId)
      .order('invited_at', { ascending: true });

    if (error) {
      console.error('fetchMembers', error);
      setLoading(false);
      return;
    }

    const userIds = (data || []).map((m: any) => m.user_id);
    let profilesById: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email, avatar_url')
        .in('user_id', userIds);
      (profiles || []).forEach((p: any) => { profilesById[p.user_id] = p; });
    }

    setMembers((data || []).map((m: any) => ({ ...m, profile: profilesById[m.user_id] || null })));
    setLoading(false);
  }, [serverId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error('Enter an email');
      return;
    }
    setInviting(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', trimmed)
        .maybeSingle();

      if (!profile?.user_id) {
        toast.error('No account with that email');
        return;
      }

      const { data: session } = await supabase.auth.getSession();
      const { error } = await supabase.from('server_members').insert({
        server_id: serverId,
        user_id: profile.user_id,
        role,
        invited_by: session?.session?.user?.id ?? null,
      });

      if (error) {
        if (error.code === '23505') toast.error('Already a member');
        else toast.error(error.message || 'Could not invite');
        return;
      }

      toast.success(`Invited as ${role}`);
      setEmail('');
      setRole('viewer');
      fetchMembers();
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (id: string, nextRole: MemberRole) => {
    const { error } = await supabase
      .from('server_members')
      .update({ role: nextRole })
      .eq('id', id);
    if (error) {
      toast.error('Could not update role');
      return;
    }
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: nextRole } : m)));
    toast.success('Role updated');
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('server_members').delete().eq('id', id);
    if (error) {
      toast.error('Could not remove');
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast.success('Member removed');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Server members</h3>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-secondary/30 border-border/40">
          {members.length}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground/70 -mt-2">
        Only invited members can see this server. The server owner is always included.
      </p>

      {/* Invite */}
      {isOwner && (
        <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Invite by email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-9 pl-9 text-sm bg-background/50 border-border/40"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Role</label>
              <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                <SelectTrigger className="h-9 text-sm bg-background/50 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleInvite} disabled={inviting} className="h-9 gap-1.5">
              {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Invite
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
        {loading ? (
          <div className="p-5 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading members…
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/60">No members invited yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {members.map((m) => {
              const meta = roleMeta[m.role];
              const Icon = meta.icon;
              return (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={m.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {(m.profile?.display_name || m.profile?.email || '?')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.profile?.display_name || m.profile?.email || m.user_id.slice(0, 8)}
                    </p>
                    {m.profile?.email && (
                      <p className="text-[10px] text-muted-foreground/60 truncate">{m.profile.email}</p>
                    )}
                  </div>
                  {isOwner ? (
                    <Select value={m.role} onValueChange={(v) => handleRoleChange(m.id, v as MemberRole)}>
                      <SelectTrigger className="h-7 w-[110px] text-xs bg-background/40 border-border/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className={`text-[10px] h-6 px-2 border-border/40 bg-secondary/30 ${meta.tone}`}>
                      <Icon className="w-3 h-3 mr-1" />
                      {meta.label}
                    </Badge>
                  )}
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(m.id)}
                      className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerMembersPanel;
