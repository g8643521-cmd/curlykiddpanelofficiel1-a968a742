import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Loader2, Shield, Eye, Mail, Crown, UserCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';

interface ServerShare {
  id: string;
  server_id: string;
  shared_with: string;
  shared_by: string;
  permission: string;
  created_at: string;
  profile?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

interface ShareServerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  serverName: string;
  isOwner: boolean;
}

const ShareServerDialog = ({ open, onOpenChange, serverId, serverName, isOwner }: ShareServerDialogProps) => {
  const { t } = useI18n();
  const [shares, setShares] = useState<ServerShare[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'manage'>('view');
  const [isAdding, setIsAdding] = useState(false);

  const fetchShares = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('server_shares')
      .select('id, server_id, shared_with, shared_by, permission, created_at')
      .eq('server_id', serverId);

    if (!error && data) {
      const userIds = data.map((s: any) => s.shared_with);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, email, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(
          (profiles || []).map((p: any) => [p.user_id, p])
        );

        setShares(data.map((s: any) => ({
          ...s,
          profile: profileMap.get(s.shared_with) || null,
        })));
      } else {
        setShares([]);
      }
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (open) fetchShares();
  }, [open, serverId]);

  const handleAdd = async () => {
    if (!email.trim()) {
      toast.error(t('share.enter_email'));
      return;
    }

    setIsAdding(true);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, display_name, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (profileError || !profile) {
      toast.error(t('share.user_not_found'));
      setIsAdding(false);
      return;
    }

    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) {
      toast.error(t('share.must_login'));
      setIsAdding(false);
      return;
    }

    if (profile.user_id === session.session.user.id) {
      toast.error(t('share.cannot_self'));
      setIsAdding(false);
      return;
    }

    const { error } = await supabase.from('server_shares').insert({
      server_id: serverId,
      shared_with: profile.user_id,
      shared_by: session.session.user.id,
      permission,
    });

    if (error) {
      if (error.code === '23505') {
        toast.error(t('share.already_shared'));
      } else {
        toast.error(t('share.share_failed'));
        console.error(error);
      }
    } else {
      toast.success(`${t('share.shared_success')} ${profile.display_name || profile.email}!`);
      setEmail('');
      fetchShares();
    }
    setIsAdding(false);
  };

  const handleRemove = async (shareId: string) => {
    const { error } = await supabase
      .from('server_shares')
      .delete()
      .eq('id', shareId);

    if (!error) {
      setShares(prev => prev.filter(s => s.id !== shareId));
      toast.success(t('share.access_removed'));
    } else {
      toast.error(t('share.remove_failed'));
    }
  };

  const handleUpdatePermission = async (shareId: string, newPermission: string) => {
    const { error } = await supabase
      .from('server_shares')
      .update({ permission: newPermission })
      .eq('id', shareId);

    if (!error) {
      setShares(prev => prev.map(s => s.id === shareId ? { ...s, permission: newPermission } : s));
      toast.success(t('share.permission_updated'));
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-border/50 bg-card">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {t('share.title')}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  <span className="font-medium text-foreground/80">{serverName}</span>
                  {' — '}{t('share.with_admins')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Invite Section */}
        {isOwner && (
          <>
            <Separator className="bg-border/30" />
            <div className="px-6 py-4 space-y-3">
              <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Invite
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input
                    placeholder="admin@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    className="pl-9 h-9 text-sm bg-background/50 border-border/40 focus-visible:border-primary/50"
                  />
                </div>
                <Select value={permission} onValueChange={(v: 'view' | 'manage') => setPermission(v)}>
                  <SelectTrigger className="w-[130px] h-9 text-xs bg-background/50 border-border/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" /> {t('share.can_view')}
                      </span>
                    </SelectItem>
                    <SelectItem value="manage">
                      <span className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-primary" /> {t('share.can_manage')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAdd}
                  disabled={isAdding || !email.trim()}
                  size="sm"
                  className="h-9 px-4 gap-1.5 shadow-[0_0_12px_-4px_hsl(var(--primary)/0.3)]"
                >
                  {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {t('share.desc')}
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Members List */}
        <Separator className="bg-border/30" />
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {t('share.shared_with')}
            </Label>
            <Badge variant="outline" className="text-[10px] h-5 px-2 border-border/40 bg-background/50 text-muted-foreground font-mono">
              {shares.length}
            </Badge>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
              <span className="text-xs text-muted-foreground/60">Loading...</span>
            </div>
          ) : shares.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="w-10 h-10 rounded-full bg-muted/30 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-muted-foreground/40" />
              </div>
              <p className="text-xs text-muted-foreground/60 text-center max-w-[200px]">
                {t('share.not_shared')}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto -mx-1 px-1">
              {shares.map(share => (
                <div
                  key={share.id}
                  className="group flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-border/30 hover:bg-muted/10 transition-all duration-150"
                >
                  <Avatar className="h-8 w-8 border border-border/30 shrink-0">
                    <AvatarImage src={share.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/5 text-primary text-[11px] font-semibold">
                      {getInitials(share.profile?.display_name || share.profile?.email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate leading-tight">
                      {share.profile?.display_name || share.profile?.email || 'Unknown'}
                    </p>
                    {share.profile?.email && share.profile?.display_name && (
                      <p className="text-[11px] text-muted-foreground/60 truncate leading-tight mt-0.5">
                        {share.profile.email}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isOwner ? (
                      <>
                        <Select
                          value={share.permission}
                          onValueChange={(v) => handleUpdatePermission(share.id, v)}
                        >
                          <SelectTrigger className="h-7 text-[11px] w-[100px] border-border/30 bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">{t('share.can_view')}</SelectItem>
                            <SelectItem value="manage">{t('share.manage')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(share.id)}
                          className="h-7 w-7 p-0 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 px-2 font-medium ${
                          share.permission === 'manage'
                            ? 'border-primary/30 text-primary bg-primary/5'
                            : 'border-border/40 text-muted-foreground bg-muted/10'
                        }`}
                      >
                        {share.permission === 'manage' ? (
                          <><Crown className="w-3 h-3 mr-1" />{t('share.admin_role')}</>
                        ) : (
                          <><Eye className="w-3 h-3 mr-1" />{t('share.viewer_role')}</>
                        )}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareServerDialog;
