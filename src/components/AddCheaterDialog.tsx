import { useState } from 'react';
import { AlertTriangle, Plus, HelpCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { z } from 'zod';

interface PlayerIdentifiers {
  steam?: string;
  steamHex?: string;
  discord?: string;
  fivem?: string;
  license?: string;
  license2?: string;
}

interface AddCheaterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  playerIdentifiers?: PlayerIdentifiers;
  serverCode?: string;
  serverName?: string;
  onSuccess?: () => void;
}

const cheaterSchema = z.object({
  player_name: z.string().trim().min(1, 'Player name is required').max(100),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
  status: z.enum(['confirmed', 'suspected']),
});

const AddCheaterDialog = ({
  open,
  onOpenChange,
  playerName: initialPlayerName,
  playerIdentifiers,
  serverCode,
  serverName,
  onSuccess,
}: AddCheaterDialogProps) => {
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'confirmed' | 'suspected'>('suspected');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      const validated = cheaterSchema.parse({
        player_name: playerName,
        reason,
        status,
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in');
        return;
      }

      // Check if user is admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roles) {
        toast.error('Only admins can add cheaters');
        return;
      }

      setIsSubmitting(true);

      // Convert identifiers to storable format
      const identifiersToStore = playerIdentifiers ? {
        steam: playerIdentifiers.steamHex || playerIdentifiers.steam,
        discord: playerIdentifiers.discord,
        fivem: playerIdentifiers.fivem,
        license: playerIdentifiers.license,
      } : null;

      const { error } = await supabase
        .from('cheater_reports')
        .insert({
          player_name: validated.player_name,
          reason: validated.reason,
          player_identifiers: identifiersToStore,
          server_code: serverCode || null,
          server_name: serverName || null,
          evidence_url: evidenceUrl || null,
          status: validated.status,
          reported_by: session.user.id,
        });

      if (error) {
        console.error('Error adding cheater:', error);
        toast.error('Failed to add cheater report');
      } else {
        toast.success(`${validated.player_name} added to cheater database`);
        
        // Log activity
        await supabase.from('activity_logs').insert([{
          user_id: session.user.id,
          action_type: 'cheater_add',
          details: { player_name: validated.player_name, status: validated.status },
        }]);

        onOpenChange(false);
        onSuccess?.();
        
        // Reset form
        setReason('');
        setEvidenceUrl('');
        setStatus('suspected');
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-destructive" />
            Flag as Cheater/Modder
          </DialogTitle>
          <DialogDescription>
            Add this player to the cheater database. They will be flagged on all servers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="player-name">Player Name</Label>
              <Input
                id="player-name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Player name"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'confirmed' | 'suspected')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suspected">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[hsl(var(--yellow))]" />
                      Suspected
                    </div>
                  </SelectItem>
                  <SelectItem value="confirmed">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                      Confirmed
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {playerIdentifiers && Object.keys(playerIdentifiers).length > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="text-muted-foreground mb-2">Identifiers will be saved:</p>
              <div className="flex flex-wrap gap-2">
                {playerIdentifiers.steam && (
                  <span className="px-2 py-1 rounded bg-[#1b2838]/50 text-[#66c0f4] text-xs">
                    Steam
                  </span>
                )}
                {playerIdentifiers.discord && (
                  <span className="px-2 py-1 rounded bg-[#5865F2]/20 text-[#5865F2] text-xs">
                    Discord
                  </span>
                )}
                {playerIdentifiers.fivem && (
                  <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">
                    CFX.re
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the cheating behavior (e.g., aimbot, godmode, money drops)..."
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">{reason.length}/500</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence">Evidence URL (Optional)</Label>
            <Input
              id="evidence"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://youtube.com/... or clip URL"
              type="url"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !playerName || !reason}
            className="bg-destructive hover:bg-destructive/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isSubmitting ? 'Adding...' : 'Add to Database'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCheaterDialog;
