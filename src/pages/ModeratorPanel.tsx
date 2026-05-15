import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheck, ArrowLeft, Server, Users, Trophy, Ban, UserX, UserCheck,
  Activity, BarChart3, RefreshCw, Search, Clock, FileText, Flag
} from 'lucide-react';
import UserReportsManagement from '@/components/UserReportsManagement';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/components/ui/alert-dialog';
import ParticleBackground from '@/components/ParticleBackground';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface UserData {
  id: string;
  display_name: string | null;
  email: string | null;
  level: number;
  xp: number;
  total_searches: number;
  servers_tracked: number;
  created_at: string | null;
}

interface LeaderboardBan {
  id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
}

interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  details: unknown;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  bannedUsers: number;
}

const ModeratorPanel = () => {
  const navigate = useNavigate();
  const { isModerator, isAdmin, isLoading: roleLoading } = useAdminStatus();
  const [users, setUsers] = useState<UserData[]>([]);
  const [bans, setBans] = useState<LeaderboardBan[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    if (!roleLoading && !isModerator) {
      toast.error('Access denied. Moderator privileges required.');
      navigate('/dashboard');
    }
  }, [roleLoading, isModerator, navigate]);

  useEffect(() => {
    if (isModerator) {
      fetchData();
    }
  }, [isModerator]);

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchUsers(), fetchBans(), fetchActivityLogs(), fetchStats()]);
    setIsLoading(false);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, email, level, xp, total_searches, servers_tracked, created_at')
      .order('level', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setUsers(data || []);
    }
  };

  const fetchBans = async () => {
    const { data, error } = await supabase
      .from('leaderboard_bans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bans:', error);
    } else {
      setBans(data || []);
    }
  };

  const fetchActivityLogs = async () => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching activity logs:', error);
    } else {
      setActivityLogs(data || []);
    }
  };

  const fetchStats = async () => {
    const [usersCount, bansCount] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('leaderboard_bans').select('id', { count: 'exact', head: true }),
    ]);

    setStats({
      totalUsers: usersCount.count || 0,
      bannedUsers: bansCount.count || 0,
    });
  };

  const logActivity = async (actionType: string, details: Record<string, unknown>) => {
    const { logActivity: logAct } = await import('@/lib/activityLog');
    await logAct({
      category: 'admin',
      action: actionType,
      severity: actionType.includes('ban') && !actionType.includes('unban') ? 'warning' : 'info',
      metadata: details,
    });
  };

  const handleBanFromLeaderboard = async (userId: string, userName: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
      .from('leaderboard_bans')
      .insert({
        user_id: userId,
        banned_by: session.user.id,
        reason: 'Removed from leaderboard by moderator',
      });

    if (error) {
      toast.error('Failed to ban user from leaderboard');
      console.error(error);
    } else {
      toast.success(`${userName || 'User'} removed from leaderboard`);
      await logActivity('leaderboard_ban', { user_id: userId, user_name: userName, by: 'moderator' });
      fetchBans();
      fetchStats();
      fetchActivityLogs();
    }
  };

  const handleUnban = async (banId: string, userId: string) => {
    const { error } = await supabase
      .from('leaderboard_bans')
      .delete()
      .eq('id', banId);

    if (error) {
      toast.error('Failed to unban user');
      console.error(error);
    } else {
      toast.success('User unbanned from leaderboard');
      await logActivity('leaderboard_unban', { user_id: userId, by: 'moderator' });
      fetchBans();
      fetchStats();
      fetchActivityLogs();
    }
  };

  const filteredUsers = users.filter(user =>
    (user.display_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const bannedUserIds = new Set(bans.map(b => b.user_id));

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'leaderboard_ban':
      case 'leaderboard_unban':
        return <Trophy className="w-4 h-4" />;
      case 'server_blacklist':
      case 'server_unblacklist':
        return <Server className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    if (actionType.includes('ban') || actionType.includes('blacklist')) {
      return 'text-destructive';
    }
    if (actionType.includes('unban') || actionType.includes('unblacklist')) {
      return 'text-[hsl(var(--green))]';
    }
    return 'text-primary';
  };

  if (roleLoading || !isModerator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <MaintenanceBanner />
      <ParticleBackground />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 bg-background/50 backdrop-blur-xl">
        <div className="w-full px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[hsl(var(--cyan))]/20 to-primary/20 flex items-center justify-center border border-[hsl(var(--cyan))]/30">
                <ShieldCheck className="w-5 h-5 text-[hsl(var(--cyan))]" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold text-foreground">Moderator Panel</h1>
                <p className="text-xs text-muted-foreground">Limited Access Dashboard</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[hsl(var(--cyan))]/20 text-[hsl(var(--cyan))] border-[hsl(var(--cyan))]/50">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Moderator
            </Badge>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin')}
                className="border-[hsl(var(--magenta))]/50 text-[hsl(var(--magenta))]"
              >
                Full Admin Panel
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 max-w-2xl mx-auto">
              <TabsTrigger value="overview" className="gap-1">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden md:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-1">
                <Flag className="w-4 h-4" />
                <span className="hidden md:inline">Reports</span>
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="gap-1">
                <Trophy className="w-4 h-4" />
                <span className="hidden md:inline">Leaderboard</span>
              </TabsTrigger>
              <TabsTrigger value="bans" className="gap-1">
                <Ban className="w-4 h-4" />
                <span className="hidden md:inline">Bans</span>
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1">
                <FileText className="w-4 h-4" />
                <span className="hidden md:inline">Logs</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/20">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-display font-bold text-foreground">
                        {stats?.totalUsers || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Users</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-card p-6"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-destructive/20">
                      <Ban className="w-6 h-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-2xl font-display font-bold text-foreground">
                        {stats?.bannedUsers || 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Banned from Leaderboard</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      Quick Actions
                    </h3>
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
                      <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col gap-2"
                      onClick={() => setSelectedTab('leaderboard')}
                    >
                      <Trophy className="w-6 h-6" />
                      <span>Manage Leaderboard</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-auto py-4 flex flex-col gap-2"
                      onClick={() => setSelectedTab('logs')}
                    >
                      <FileText className="w-6 h-6" />
                      <span>View Logs</span>
                    </Button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="glass-card p-6">
                  <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-primary" />
                    Recent Activity
                  </h3>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {activityLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                        <div className={getActionColor(log.action_type)}>
                          {getActionIcon(log.action_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">
                            {log.action_type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {activityLogs.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No recent activity</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Permissions Info */}
              <div className="mt-6 glass-card p-6 border-[hsl(var(--cyan))]/30">
                <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-5 h-5 text-[hsl(var(--cyan))]" />
                  Your Permissions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--green))]/10 border border-[hsl(var(--green))]/30">
                    <Trophy className="w-5 h-5 text-[hsl(var(--green))]" />
                    <div>
                      <p className="font-medium text-foreground">Leaderboard Management</p>
                      <p className="text-xs text-muted-foreground">Ban/unban users from leaderboard</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--green))]/10 border border-[hsl(var(--green))]/30">
                    <FileText className="w-5 h-5 text-[hsl(var(--green))]" />
                    <div>
                      <p className="font-medium text-foreground">Activity Logs</p>
                      <p className="text-xs text-muted-foreground">View all admin activity</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <Server className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-muted-foreground">Server Blacklist</p>
                      <p className="text-xs text-muted-foreground">Admin only</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-muted-foreground">XP Management</p>
                      <p className="text-xs text-muted-foreground">Admin only</p>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* User Reports Tab */}
            <TabsContent value="reports">
              <UserReportsManagement />
            </TabsContent>

            {/* Leaderboard Management Tab */}
            <TabsContent value="leaderboard">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[hsl(var(--yellow))]" />
                    Leaderboard Management
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {bans.length} banned
                    </p>
                  </div>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredUsers.map((user, index) => {
                    const isBanned = bannedUserIds.has(user.id);
                    return (
                      <div
                        key={user.id}
                        className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                          isBanned
                            ? 'bg-destructive/10 border border-destructive/30'
                            : 'bg-secondary/30 hover:bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 text-center font-bold text-muted-foreground">
                            #{index + 1}
                          </div>
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <span className="font-bold text-primary">
                              {(user.display_name || 'U')[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className={`font-medium ${isBanned ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                              {user.display_name || 'Anonymous'}
                            </p>
                            <p className="text-xs text-muted-foreground">Level {user.level} • {user.xp} XP</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isBanned ? (
                            <Badge variant="destructive" className="text-xs">
                              <Ban className="w-3 h-3 mr-1" />
                              Hidden
                            </Badge>
                          ) : (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-destructive border-destructive/50">
                                  <UserX className="w-4 h-4 mr-1" />
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove from Leaderboard?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will hide {user.display_name || 'this user'} from the public leaderboard.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleBanFromLeaderboard(user.id, user.display_name || 'User')}
                                    className="bg-destructive text-destructive-foreground"
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Bans Tab */}
            <TabsContent value="bans">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                    <Ban className="w-5 h-5 text-destructive" />
                    Leaderboard Bans ({bans.length})
                  </h3>
                </div>

                {bans.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Ban className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No users have been banned from the leaderboard</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {bans.map((ban) => {
                      const user = users.find(u => u.id === ban.user_id);
                      return (
                        <div
                          key={ban.id}
                          className="flex items-center justify-between p-4 rounded-lg bg-destructive/10 border border-destructive/30"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                              <UserX className="w-5 h-5 text-destructive" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">
                                {user?.display_name || 'Unknown User'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Banned {formatDistanceToNow(new Date(ban.created_at), { addSuffix: true })}
                              </p>
                              {ban.reason && (
                                <p className="text-xs text-muted-foreground mt-1">{ban.reason}</p>
                              )}
                            </div>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-[hsl(var(--green))] border-[hsl(var(--green))]/50">
                                <UserCheck className="w-4 h-4 mr-1" />
                                Unban
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Unban User?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will restore {user?.display_name || 'this user'} to the public leaderboard.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleUnban(ban.id, ban.user_id)}
                                  className="bg-[hsl(var(--green))] text-white"
                                >
                                  Unban
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Activity Logs Tab */}
            <TabsContent value="logs">
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Activity Logs
                  </h3>
                  <Button variant="outline" size="sm" onClick={fetchActivityLogs}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                {activityLogs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No activity logs yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {activityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30"
                      >
                        <div className={`p-2 rounded-lg bg-secondary ${getActionColor(log.action_type)}`}>
                          {getActionIcon(log.action_type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground capitalize">
                            {log.action_type.replace(/_/g, ' ')}
                          </p>
                          {log.details != null && (
                            <div className="text-xs text-muted-foreground mt-1 font-mono bg-secondary/50 p-2 rounded">
                              {JSON.stringify(log.details, null, 2)}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          © 2026 CurlyKiddPanel
        </div>
      </footer>
    </div>
  );
};

export default ModeratorPanel;
