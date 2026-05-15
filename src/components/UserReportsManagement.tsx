import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Flag, CheckCircle, XCircle, Clock, Eye, RefreshCw, User, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface UserReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  description: string | null;
  status: string;
  review_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
}

const UserReportsManagement = () => {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [users, setUsers] = useState<Map<string, UserProfile>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<UserReport | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [newStatus, setNewStatus] = useState<'reviewed' | 'resolved' | 'dismissed'>('reviewed');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('user_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      setReports(data || []);
      
      // Fetch user profiles for reporters and reported users
      const userIds = new Set<string>();
      data?.forEach(r => {
        userIds.add(r.reporter_id);
        userIds.add(r.reported_user_id);
      });

      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', Array.from(userIds));

        const userMap = new Map<string, UserProfile>();
        profiles?.forEach(p => userMap.set(p.id, p));
        setUsers(userMap);
      }
    }
    setIsLoading(false);
  };

  const logActivity = async (actionType: string, details: Record<string, unknown>) => {
    const { logActivity: logAct } = await import('@/lib/activityLog');
    await logAct({ category: 'admin', action: actionType, severity: 'info', metadata: details });
  };

  const handleReviewReport = async () => {
    if (!selectedReport) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setIsSubmitting(true);

    const { error } = await supabase
      .from('user_reports')
      .update({
        status: newStatus as any,
        reviewed_by: session.user.id,
        review_notes: reviewNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedReport.id);

    if (error) {
      toast.error('Failed to update report');
      console.error(error);
    } else {
      toast.success(`Report ${newStatus}`);
      await logActivity('report_review', { 
        report_id: selectedReport.id,
        reported_user: users.get(selectedReport.reported_user_id)?.display_name,
        new_status: newStatus
      });
      setReviewDialogOpen(false);
      setSelectedReport(null);
      setReviewNotes('');
      fetchReports();
    }
    setIsSubmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))] border-[hsl(var(--yellow))]/50">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'reviewed':
        return (
          <Badge className="bg-primary/20 text-primary border-primary/50">
            <Eye className="w-3 h-3 mr-1" />
            Reviewed
          </Badge>
        );
      case 'resolved':
        return (
          <Badge className="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/50">
            <CheckCircle className="w-3 h-3 mr-1" />
            Resolved
          </Badge>
        );
      case 'dismissed':
        return (
          <Badge className="bg-muted text-muted-foreground border-border">
            <XCircle className="w-3 h-3 mr-1" />
            Dismissed
          </Badge>
        );
      default:
        return null;
    }
  };

  const getReasonLabel = (reason: string) => {
    const reasons: Record<string, string> = {
      spam: 'Spamming',
      cheating: 'Cheating/Exploiting',
      harassment: 'Harassment',
      inappropriate: 'Inappropriate Behavior',
      impersonation: 'Impersonation',
      other: 'Other',
    };
    return reasons[reason] || reason;
  };

  const pendingCount = reports.filter(r => r.status === 'pending').length;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
          <Flag className="w-5 h-5 text-[hsl(var(--yellow))]" />
          User Reports
          {pendingCount > 0 && (
            <Badge className="bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))]">
              {pendingCount} pending
            </Badge>
          )}
        </h3>
        <Button variant="outline" size="sm" onClick={fetchReports} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Flag className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No user reports yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {reports.map((report) => {
            const reporter = users.get(report.reporter_id);
            const reported = users.get(report.reported_user_id);
            
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg transition-colors ${
                  report.status === 'pending'
                    ? 'bg-[hsl(var(--yellow))]/10 border border-[hsl(var(--yellow))]/30'
                    : 'bg-secondary/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(report.status)}
                      <Badge variant="outline" className="text-xs">
                        {getReasonLabel(report.reason)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm mb-2">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Reporter:</span>
                        <span className="text-foreground">{reporter?.display_name || 'Unknown'}</span>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex items-center gap-1">
                        <Flag className="w-4 h-4 text-destructive" />
                        <span className="text-muted-foreground">Reported:</span>
                        <span className="text-foreground font-medium">{reported?.display_name || 'Unknown'}</span>
                      </div>
                    </div>

                    {report.description && (
                      <div className="flex items-start gap-2 mt-2 p-2 rounded bg-secondary/50">
                        <MessageSquare className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground mt-2">
                      Reported {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  {report.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedReport(report);
                        setReviewDialogOpen(true);
                      }}
                      className="border-primary/50 text-primary"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Review
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Review Report
            </DialogTitle>
            <DialogDescription>
              Review this report and take appropriate action
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Update Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as 'reviewed' | 'resolved' | 'dismissed')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reviewed">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-primary" />
                      Mark as Reviewed
                    </div>
                  </SelectItem>
                  <SelectItem value="resolved">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-[hsl(var(--green))]" />
                      Resolved (Action Taken)
                    </div>
                  </SelectItem>
                  <SelectItem value="dismissed">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                      Dismiss Report
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-notes">Review Notes (Optional)</Label>
              <Textarea
                id="review-notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about your review decision..."
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReviewReport} disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserReportsManagement;
