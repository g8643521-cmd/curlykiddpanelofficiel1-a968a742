import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Plus, Trash2, Search, Shield, User, Server,
  CheckCircle, HelpCircle, XCircle, RefreshCw, ExternalLink, Copy, Loader2,
  Download, FileJson, FileText, Upload, Edit, Eye, Info, Calendar, Clock, FileWarning
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { z } from 'zod';

interface PlayerIdentifiers {
  steam?: string;
  discord?: string;
  discord_avatar?: string;
  discord_username?: string;
  fivem?: string;
  license?: string;
}

interface CheaterReport {
  id: string;
  player_name: string;
  player_identifiers: PlayerIdentifiers | null;
  server_code: string | null;
  server_name: string | null;
  reason: string;
  evidence_url: string | null;
  reported_by: string;
  status: string;
  created_at: string;
}

const cheaterSchema = z.object({
  player_name: z.string().trim().min(1, 'Player name is required').max(100),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
  discord_id: z.string().optional(),
  discord_avatar: z.string().optional(),
  server_code: z.string().max(50).optional(),
  server_name: z.string().max(200).optional(),
  evidence_url: z.string().url().optional().or(z.literal('')),
  status: z.enum(['confirmed', 'suspected', 'cleared']),
});

// Helper to get Discord avatar URL
const getDiscordAvatarUrl = (discordId: string, avatarHash?: string) => {
  if (avatarHash) {
    // Use actual avatar if hash provided
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=128`;
  }
  // Default avatar based on user ID
  const defaultIndex = Number(BigInt(discordId) % BigInt(5));
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
};

const CheaterManagement = () => {
  const [cheaters, setCheaters] = useState<CheaterReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isImporting, setIsImporting] = useState(false);
  
  // Form state
  const [playerName, setPlayerName] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [discordAvatar, setDiscordAvatar] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [steamId, setSteamId] = useState('');
  const [fivemLicense, setFivemLicense] = useState('');
  const [reason, setReason] = useState('');
  const [serverCode, setServerCode] = useState('');
  const [serverName, setServerName] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [status, setStatus] = useState<'confirmed' | 'suspected'>('confirmed');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingDiscord, setIsFetchingDiscord] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cheaterToDelete, setCheaterToDelete] = useState<CheaterReport | null>(null);
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [cheaterToEdit, setCheaterToEdit] = useState<CheaterReport | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editDiscordId, setEditDiscordId] = useState('');
  const [editDiscordAvatar, setEditDiscordAvatar] = useState('');
  const [editDiscordUsername, setEditDiscordUsername] = useState('');
  const [editSteamId, setEditSteamId] = useState('');
  const [editFivemLicense, setEditFivemLicense] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editServerCode, setEditServerCode] = useState('');
  const [editServerName, setEditServerName] = useState('');
  const [editEvidenceUrl, setEditEvidenceUrl] = useState('');
  const [editStatus, setEditStatus] = useState<'confirmed' | 'suspected' | 'cleared'>('confirmed');
  const [isEditFetchingDiscord, setIsEditFetchingDiscord] = useState(false);
  
  // Selection state for keyboard shortcuts
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  // Details dialog state
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [cheaterToView, setCheaterToView] = useState<CheaterReport | null>(null);
  
  // Open details dialog
  const openDetailsDialog = (cheater: CheaterReport) => {
    setCheaterToView(cheater);
    setDetailsDialogOpen(true);
  };

  useEffect(() => {
    fetchCheaters();
  }, []);

  // Debounced Discord user fetch for ADD form
  const fetchDiscordUser = useCallback(async (id: string) => {
    if (!id || !/^\d{17,19}$/.test(id)) {
      return;
    }

    setIsFetchingDiscord(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-user', {
        body: { discord_id: id },
      });

      if (error) {
        console.error('Error fetching Discord user:', error);
        toast.error('Failed to fetch Discord user');
        return;
      }

      if (data && !data.error) {
        setDiscordAvatar(data.avatar || '');
        setDiscordUsername(data.username || '');
        toast.success(`Found Discord user: ${data.username}`);
      } else if (data?.error === 'User not found') {
        toast.error('Discord user not found');
      }
    } catch (err) {
      console.error('Error fetching Discord user:', err);
    } finally {
      setIsFetchingDiscord(false);
    }
  }, []);

  // Debounced Discord user fetch for EDIT form
  const fetchEditDiscordUser = useCallback(async (id: string) => {
    if (!id || !/^\d{17,19}$/.test(id)) {
      return;
    }

    setIsEditFetchingDiscord(true);
    try {
      const { data, error } = await supabase.functions.invoke('discord-user', {
        body: { discord_id: id },
      });

      if (error) {
        console.error('Error fetching Discord user:', error);
        toast.error('Failed to fetch Discord user');
        return;
      }

      if (data && !data.error) {
        setEditDiscordAvatar(data.avatar || '');
        setEditDiscordUsername(data.username || '');
        toast.success(`Found Discord user: ${data.username}`);
      } else if (data?.error === 'User not found') {
        toast.error('Discord user not found');
      }
    } catch (err) {
      console.error('Error fetching Discord user:', err);
    } finally {
      setIsEditFetchingDiscord(false);
    }
  }, []);

  // Auto-fetch Discord user when ID changes (add form)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (discordId && /^\d{17,19}$/.test(discordId)) {
        fetchDiscordUser(discordId);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [discordId, fetchDiscordUser]);

  // Auto-fetch Discord user when ID changes (edit form)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editDiscordId && /^\d{17,19}$/.test(editDiscordId) && editDialogOpen) {
        // Only fetch if it changed from the original
        const originalDiscord = cheaterToEdit?.player_identifiers?.discord;
        if (editDiscordId !== originalDiscord) {
          fetchEditDiscordUser(editDiscordId);
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editDiscordId, editDialogOpen, cheaterToEdit, fetchEditDiscordUser]);

  // Open edit dialog with cheater data
  const openEditDialog = (cheater: CheaterReport) => {
    setCheaterToEdit(cheater);
    setEditPlayerName(cheater.player_name);
    setEditDiscordId(cheater.player_identifiers?.discord || '');
    setEditDiscordAvatar(cheater.player_identifiers?.discord_avatar || '');
    setEditDiscordUsername(cheater.player_identifiers?.discord_username || '');
    setEditSteamId(cheater.player_identifiers?.steam || '');
    setEditFivemLicense(cheater.player_identifiers?.license || '');
    setEditReason(cheater.reason);
    setEditServerCode(cheater.server_code || '');
    setEditServerName(cheater.server_name || '');
    setEditEvidenceUrl(cheater.evidence_url || '');
    setEditStatus(cheater.status as 'confirmed' | 'suspected' | 'cleared');
    setEditDialogOpen(true);
  };

  // Handle edit submission
  const handleEditCheater = async () => {
    if (!cheaterToEdit) return;

    try {
      const validated = cheaterSchema.parse({
        player_name: editPlayerName,
        reason: editReason,
        discord_id: editDiscordId || undefined,
        server_code: editServerCode || undefined,
        server_name: editServerName || undefined,
        evidence_url: editEvidenceUrl || undefined,
        status: editStatus,
      });

      setIsSubmitting(true);

      const identifiers: Record<string, string> = {};
      if (editDiscordId) identifiers.discord = editDiscordId;
      if (editDiscordAvatar) identifiers.discord_avatar = editDiscordAvatar;
      if (editDiscordUsername) identifiers.discord_username = editDiscordUsername;
      if (editSteamId) identifiers.steam = editSteamId;
      if (editFivemLicense) identifiers.license = editFivemLicense;

      const { error } = await supabase
        .from('cheater_reports')
        .update({
          player_name: validated.player_name,
          reason: validated.reason,
          player_identifiers: Object.keys(identifiers).length > 0 ? identifiers : null,
          server_code: validated.server_code || null,
          server_name: validated.server_name || null,
          evidence_url: validated.evidence_url || null,
          status: validated.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cheaterToEdit.id);

      if (error) {
        console.error('Error updating cheater:', error);
        toast.error('Failed to update cheater report');
      } else {
        toast.success(`${validated.player_name} updated successfully`);
        await logActivity('cheater_edit', { 
          player_name: validated.player_name, 
          cheater_id: cheaterToEdit.id,
          changes: 'Updated report details'
        });
        
        setEditDialogOpen(false);
        fetchCheaters();
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchCheaters = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cheater_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cheaters:', error);
    } else {
      // Cast the data to handle the Json type from Supabase
      const typedData = (data || []).map(item => ({
        ...item,
        player_identifiers: item.player_identifiers as PlayerIdentifiers | null,
      }));
      setCheaters(typedData);
    }
    setIsLoading(false);
  };

  const logActivity = async (actionType: string, details: Record<string, unknown>) => {
    const { logActivity: logAct } = await import('@/lib/activityLog');
    await logAct({
      category: 'cheater',
      action: actionType,
      severity: actionType.includes('remove') ? 'warning' : 'info',
      metadata: details,
    });
  };

  const handleAddCheater = async () => {
    try {
      const validated = cheaterSchema.parse({
        player_name: playerName,
        reason,
        discord_id: discordId || undefined,
        server_code: serverCode || undefined,
        server_name: serverName || undefined,
        evidence_url: evidenceUrl || undefined,
        status,
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('You must be logged in');
        return;
      }

      setIsSubmitting(true);

      const identifiers: Record<string, string> = {};
      if (discordId) identifiers.discord = discordId;
      if (discordAvatar) identifiers.discord_avatar = discordAvatar;
      if (discordUsername) identifiers.discord_username = discordUsername;
      if (steamId) identifiers.steam = steamId;
      if (fivemLicense) identifiers.license = fivemLicense;

      const { error } = await supabase
        .from('cheater_reports')
        .insert([{
          player_name: validated.player_name,
          reason: validated.reason,
          player_identifiers: Object.keys(identifiers).length > 0 ? identifiers : null,
          server_code: validated.server_code || null,
          server_name: validated.server_name || null,
          evidence_url: validated.evidence_url || null,
          status: validated.status,
          reported_by: session.user.id,
        }]);

      if (error) {
        console.error('Error adding cheater:', error);
        toast.error('Failed to add cheater report');
      } else {
        toast.success(`${validated.player_name} added to cheater list`);
        await logActivity('cheater_add', { player_name: validated.player_name, status: validated.status });
        
        // Get reporter name for webhook
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .single();
        
        // Send to Discord webhook (non-blocking)
        supabase.functions.invoke('discord-webhook', {
          body: {
            player_name: validated.player_name,
            reason: validated.reason,
            status: validated.status,
            server_code: validated.server_code,
            server_name: validated.server_name,
            evidence_url: validated.evidence_url,
            discord_id: discordId,
            discord_username: discordUsername,
            reported_by_name: profile?.display_name || 'Unknown',
          },
        }).catch(err => console.error('Webhook error:', err));

        // Automation webhooks (Zapier / Generic) (non-blocking)
        supabase.functions.invoke('bot-events', {
          body: {
            event_type: 'new_report',
            payload: {
              player_name: validated.player_name,
              reason: validated.reason,
              status: validated.status,
              server_code: validated.server_code,
              server_name: validated.server_name,
              evidence_url: validated.evidence_url,
              discord_id: discordId,
              discord_username: discordUsername,
              reported_by_name: profile?.display_name || 'Unknown',
            },
          },
        }).catch(err => console.error('bot-events error:', err));
        
        resetForm();
        setDialogOpen(false);
        fetchCheaters();
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.errors[0].message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveCheater = async (id: string, playerName: string) => {
    const cheater = cheaters.find(c => c.id === id);
    
    const { error } = await supabase
      .from('cheater_reports')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to remove cheater');
      console.error(error);
    } else {
      toast.success(`${playerName} removed from cheater list`);
      await logActivity('cheater_remove', { player_name: playerName });
      
      // Get remover name for webhook
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .single();
        
        // Send removal notification to Discord (non-blocking)
        const ids = cheater?.player_identifiers as PlayerIdentifiers | null;
        supabase.functions.invoke('discord-webhook', {
          body: {
            event_type: 'removal',
            player_name: playerName,
            reason: cheater?.reason || '',
            status: cheater?.status || 'removed',
            server_name: cheater?.server_name,
            discord_id: ids?.discord,
            discord_username: ids?.discord_username,
            reported_by_name: profile?.display_name || 'Unknown',
          },
        }).catch(err => console.error('Webhook error:', err));

        // Automation webhooks (Zapier / Generic) (non-blocking)
        supabase.functions.invoke('bot-events', {
          body: {
            event_type: 'removal',
            payload: {
              player_name: playerName,
              reason: cheater?.reason || '',
              status: cheater?.status || 'removed',
              server_name: cheater?.server_name,
              discord_id: ids?.discord,
              discord_username: ids?.discord_username,
              reported_by_name: profile?.display_name || 'Unknown',
            },
          },
        }).catch(err => console.error('bot-events error:', err));
      }
      
      fetchCheaters();
    }
  };

  const handleUpdateStatus = async (id: string, playerName: string, newStatus: 'confirmed' | 'suspected' | 'cleared') => {
    const cheater = cheaters.find(c => c.id === id);
    const oldStatus = cheater?.status;
    
    const { error } = await supabase
      .from('cheater_reports')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update status');
      console.error(error);
    } else {
      toast.success(`${playerName} status updated to ${newStatus}`);
      await logActivity('cheater_status_update', { player_name: playerName, new_status: newStatus });
      
      // Get updater name for webhook
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', session.user.id)
          .single();
        
        // Send status change notification to Discord (non-blocking)
        const ids = cheater?.player_identifiers as PlayerIdentifiers | null;
        supabase.functions.invoke('discord-webhook', {
          body: {
            event_type: 'status_change',
            player_name: playerName,
            reason: cheater?.reason || '',
            status: newStatus,
            old_status: oldStatus,
            server_name: cheater?.server_name,
            discord_id: ids?.discord,
            discord_username: ids?.discord_username,
            reported_by_name: profile?.display_name || 'Unknown',
          },
        }).catch(err => console.error('Webhook error:', err));

        // Automation webhooks (Zapier / Generic) (non-blocking)
        supabase.functions.invoke('bot-events', {
          body: {
            event_type: 'status_change',
            payload: {
              player_name: playerName,
              reason: cheater?.reason || '',
              status: newStatus,
              old_status: oldStatus,
              server_name: cheater?.server_name,
              discord_id: ids?.discord,
              discord_username: ids?.discord_username,
              reported_by_name: profile?.display_name || 'Unknown',
            },
          },
        }).catch(err => console.error('bot-events error:', err));
      }
      
      fetchCheaters();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const resetForm = () => {
    setPlayerName('');
    setDiscordId('');
    setDiscordAvatar('');
    setDiscordUsername('');
    setSteamId('');
    setFivemLicense('');
    setReason('');
    setServerCode('');
    setServerName('');
    setEvidenceUrl('');
    setStatus('confirmed');
  };

  const filteredCheaters = cheaters.filter(c => {
    const matchesSearch = c.player_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.server_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.server_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.player_identifiers as PlayerIdentifiers | null)?.discord?.includes(searchQuery);
    
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in input/textarea or dialog is open
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        dialogOpen || 
        editDialogOpen || 
        deleteDialogOpen ||
        importDialogOpen
      ) {
        return;
      }

      const selected = selectedIndex !== null ? filteredCheaters[selectedIndex] : null;

      switch (e.key.toLowerCase()) {
        case 'j':
        case 'arrowdown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev === null ? 0 : Math.min(prev + 1, filteredCheaters.length - 1)
          );
          break;
        case 'k':
        case 'arrowup':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev === null ? 0 : Math.max(prev - 1, 0)
          );
          break;
        case 'escape':
          setSelectedIndex(null);
          break;
        case 'c':
          if (selected) {
            copyToClipboard(selected.player_name);
          }
          break;
        case 'd':
          if (selected) {
            const ids = selected.player_identifiers;
            if (ids?.discord) {
              copyToClipboard(ids.discord);
            } else {
              toast.error('No Discord ID available');
            }
          }
          break;
        case 's':
          if (selected && !e.metaKey && !e.ctrlKey) {
            const ids = selected.player_identifiers;
            if (ids?.steam) {
              copyToClipboard(ids.steam);
            } else {
              toast.error('No Steam ID available');
            }
          }
          break;
        case 'l':
          if (selected) {
            const ids = selected.player_identifiers;
            if (ids?.license) {
              copyToClipboard(ids.license);
            } else {
              toast.error('No FiveM License available');
            }
          }
          break;
        case 'e':
          if (selected) {
            openEditDialog(selected);
          }
          break;
        case 'delete':
        case 'backspace':
          if (selected && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            setCheaterToDelete(selected);
            setDeleteDialogOpen(true);
          }
          break;
        case '1':
          if (selected && selected.status !== 'confirmed') {
            handleUpdateStatus(selected.id, selected.player_name, 'confirmed');
          }
          break;
        case '2':
          if (selected && selected.status !== 'suspected') {
            handleUpdateStatus(selected.id, selected.player_name, 'suspected');
          }
          break;
        case '3':
          if (selected && selected.status !== 'cleared') {
            handleUpdateStatus(selected.id, selected.player_name, 'cleared');
          }
          break;
        case 'n':
          if (!e.metaKey && !e.ctrlKey) {
            setDialogOpen(true);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, filteredCheaters, dialogOpen, editDialogOpen, deleteDialogOpen, importDialogOpen, copyToClipboard, openEditDialog, handleUpdateStatus]);

  const exportToJSON = () => {
    const exportData = filteredCheaters.map(c => ({
      player_name: c.player_name,
      status: c.status,
      reason: c.reason,
      server_code: c.server_code,
      server_name: c.server_name,
      evidence_url: c.evidence_url,
      identifiers: c.player_identifiers,
      reported_at: c.created_at,
    }));
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cheater-database-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${exportData.length} records as JSON`);
  };

  const exportToCSV = () => {
    const headers = ['Player Name', 'Status', 'Reason', 'Server Code', 'Server Name', 'Discord ID', 'Discord Username', 'Evidence URL', 'Reported At'];
    const rows = filteredCheaters.map(c => {
      const ids = c.player_identifiers as PlayerIdentifiers | null;
      return [
        `"${(c.player_name || '').replace(/"/g, '""')}"`,
        c.status,
        `"${(c.reason || '').replace(/"/g, '""')}"`,
        c.server_code || '',
        `"${(c.server_name || '').replace(/"/g, '""')}"`,
        ids?.discord || '',
        ids?.discord_username || '',
        c.evidence_url || '',
        c.created_at,
      ].join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cheater-database-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredCheaters.length} records as CSV`);
  };

  const handleBulkImport = async (file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('You must be logged in');
      return;
    }

    setIsImporting(true);
    
    try {
      const text = await file.text();
      let records: Array<{
        player_name: string;
        reason: string;
        status?: string;
        server_code?: string;
        server_name?: string;
        evidence_url?: string;
        identifiers?: Record<string, string>;
      }> = [];

      if (file.name.endsWith('.json')) {
        const parsed = JSON.parse(text);
        records = Array.isArray(parsed) ? parsed : [parsed];
      } else if (file.name.endsWith('.csv')) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('CSV file must have a header row and at least one data row');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
          const cleanValues = values.map(v => v.replace(/^"|"$/g, '').trim());
          
          const row: Record<string, string> = {};
          headers.forEach((header, idx) => {
            row[header] = cleanValues[idx] || '';
          });
          
          if (row['player name'] || row['player_name']) {
            records.push({
              player_name: row['player name'] || row['player_name'],
              reason: row['reason'] || 'Imported from CSV',
              status: row['status'] || 'suspected',
              server_code: row['server code'] || row['server_code'],
              server_name: row['server name'] || row['server_name'],
              evidence_url: row['evidence url'] || row['evidence_url'],
              identifiers: row['discord id'] || row['discord_id'] ? {
                discord: row['discord id'] || row['discord_id'],
                discord_username: row['discord username'] || row['discord_username'],
              } : undefined,
            });
          }
        }
      } else {
        throw new Error('Unsupported file format. Please use JSON or CSV.');
      }

      if (records.length === 0) {
        throw new Error('No valid records found in file');
      }

      const insertData = records.map(r => ({
        player_name: r.player_name,
        reason: r.reason,
        status: (r.status || 'suspected') as 'suspected' | 'confirmed' | 'cleared',
        server_code: r.server_code || null,
        server_name: r.server_name || null,
        evidence_url: r.evidence_url || null,
        player_identifiers: r.identifiers || null,
        reported_by: session.user.id,
      }));

      const { error } = await supabase
        .from('cheater_reports')
        .insert(insertData);

      if (error) {
        throw error;
      }

      toast.success(`Successfully imported ${records.length} cheater records`);
      await logActivity('cheater_bulk_import', { count: records.length });
      setImportDialogOpen(false);
      fetchCheaters();
    } catch (err) {
      console.error('Import error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to import file');
    } finally {
      setIsImporting(false);
    }
  };

  const stats = {
    total: cheaters.length,
    confirmed: cheaters.filter(c => c.status === 'confirmed').length,
    suspected: cheaters.filter(c => c.status === 'suspected').length,
    cleared: cheaters.filter(c => c.status === 'cleared').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/50 font-medium">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Confirmed
          </Badge>
        );
      case 'suspected':
        return (
          <Badge className="bg-[hsl(var(--yellow))]/20 text-[hsl(var(--yellow))] border-[hsl(var(--yellow))]/50 font-medium">
            <HelpCircle className="w-3 h-3 mr-1" />
            Suspected
          </Badge>
        );
      case 'cleared':
        return (
          <Badge className="bg-[hsl(var(--green))]/20 text-[hsl(var(--green))] border-[hsl(var(--green))]/50 font-medium">
            <CheckCircle className="w-3 h-3 mr-1" />
            Cleared
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Cheater Database</h2>
              <p className="text-sm text-muted-foreground">Track and manage reported cheaters across servers</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={exportToJSON} disabled={filteredCheaters.length === 0}>
                    <FileJson className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export as JSON</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={exportToCSV} disabled={filteredCheaters.length === 0}>
                    <FileText className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export as CSV</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={() => setImportDialogOpen(true)}>
                    <Upload className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Import from CSV/JSON</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-destructive hover:bg-destructive/90 gap-2">
                  <Plus className="w-4 h-4" />
                  Report Cheater
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Report Cheater/Modder
                </DialogTitle>
                <DialogDescription>
                  Add a player to the cheater database. This will be visible to all users.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="player-name">Player Name *</Label>
                    <Input
                      id="player-name"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="Enter player name"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as 'confirmed' | 'suspected')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                            Confirmed Cheater
                          </div>
                        </SelectItem>
                        <SelectItem value="suspected">
                          <div className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-[hsl(var(--yellow))]" />
                            Suspected
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discord-id" className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Discord ID
                    {isFetchingDiscord && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="discord-id"
                      value={discordId}
                      onChange={(e) => setDiscordId(e.target.value)}
                      placeholder="User ID (e.g., 123456789)"
                      maxLength={20}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fetchDiscordUser(discordId)}
                      disabled={!discordId || !/^\d{17,19}$/.test(discordId) || isFetchingDiscord}
                    >
                      {isFetchingDiscord ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  
                  {/* Discord user preview */}
                  {(discordUsername || discordAvatar) && (
                    <div className="flex items-center gap-3 p-2 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={getDiscordAvatarUrl(discordId, discordAvatar)} />
                        <AvatarFallback className="bg-[#5865F2] text-white text-xs">
                          {discordUsername?.[0]?.toUpperCase() || 'D'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {discordUsername || 'Unknown User'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{discordId}</p>
                      </div>
                      <CheckCircle className="w-4 h-4 text-[hsl(var(--green))]" />
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Enter Discord user ID - username and avatar will be fetched automatically
                  </p>
                </div>

                {/* Steam ID and FiveM License */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="steam-id" className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#1b2838]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>
                      </svg>
                      Steam ID
                    </Label>
                    <Input
                      id="steam-id"
                      value={steamId}
                      onChange={(e) => setSteamId(e.target.value)}
                      placeholder="steam:110000xxxxxxxxx"
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fivem-license" className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#f40552]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4a9.6 9.6 0 110 19.2 9.6 9.6 0 010-19.2zm0 2.4a7.2 7.2 0 100 14.4 7.2 7.2 0 000-14.4zm0 2.4a4.8 4.8 0 110 9.6 4.8 4.8 0 010-9.6z"/>
                      </svg>
                      FiveM License
                    </Label>
                    <Input
                      id="fivem-license"
                      value={fivemLicense}
                      onChange={(e) => setFivemLicense(e.target.value)}
                      placeholder="license:xxxxxxxxxxxxxxx"
                      maxLength={60}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="server-code">Server Code</Label>
                    <Input
                      id="server-code"
                      value={serverCode}
                      onChange={(e) => setServerCode(e.target.value)}
                      placeholder="e.g., abc123"
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="server-name">Server Name</Label>
                    <Input
                      id="server-name"
                      value={serverName}
                      onChange={(e) => setServerName(e.target.value)}
                      placeholder="Server name"
                      maxLength={200}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason/Description *</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe the cheating behavior..."
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
                    placeholder="https://..."
                    type="url"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddCheater}
                  disabled={isSubmitting || !playerName || !reason}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {isSubmitting ? 'Adding...' : 'Add to Database'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Import Dialog */}
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  Bulk Import Cheaters
                </DialogTitle>
                <DialogDescription>
                  Import multiple cheater records from a CSV or JSON file.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".json,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleBulkImport(file);
                    }}
                    className="hidden"
                    id="import-file"
                    disabled={isImporting}
                  />
                  <label
                    htmlFor="import-file"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {isImporting ? (
                      <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
                    ) : (
                      <Upload className="w-10 h-10 text-muted-foreground" />
                    )}
                    <p className="text-sm text-foreground font-medium">
                      {isImporting ? 'Importing...' : 'Click to upload file'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports JSON and CSV files
                    </p>
                  </label>
                </div>

                <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                  <h4 className="font-medium text-foreground text-sm mb-2">Expected Format</h4>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>JSON:</strong> Array of objects with player_name, reason, status</p>
                    <p><strong>CSV:</strong> Headers: Player Name, Reason, Status, Server Code, Discord ID</p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Reports</p>
          </div>
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-2xl font-bold text-destructive">{stats.confirmed}</p>
            <p className="text-sm text-muted-foreground">Confirmed</p>
          </div>
          <div className="p-4 rounded-lg bg-[hsl(var(--yellow))]/10 border border-[hsl(var(--yellow))]/20">
            <p className="text-2xl font-bold text-[hsl(var(--yellow))]">{stats.suspected}</p>
            <p className="text-sm text-muted-foreground">Suspected</p>
          </div>
          <div className="p-4 rounded-lg bg-[hsl(var(--green))]/10 border border-[hsl(var(--green))]/20">
            <p className="text-2xl font-bold text-[hsl(var(--green))]">{stats.cleared}</p>
            <p className="text-sm text-muted-foreground">Cleared</p>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="glass-card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, Discord ID, or server..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="suspected">Suspected</SelectItem>
              <SelectItem value="cleared">Cleared</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchCheaters} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Cheater List */}
      <div className="glass-card p-6">
        {filteredCheaters.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Shield className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">{searchQuery ? 'No matching players found' : 'No cheaters reported yet'}</p>
            <p className="text-sm">Reports will appear here when added</p>
          </div>
        ) : (
          <div className="space-y-3">
            <TooltipProvider>
              {filteredCheaters.map((cheater, index) => {
                const identifiers = cheater.player_identifiers as PlayerIdentifiers | null;
                const discordId = identifiers?.discord;
                
                return (
                  <ContextMenu key={cheater.id}>
                    <ContextMenuTrigger asChild>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => setSelectedIndex(index)}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-context-menu ${
                          selectedIndex === index 
                            ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/30' 
                            : 'bg-secondary/20 hover:bg-secondary/40 border-border/30 hover:border-border/50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar with Discord picture or fallback */}
                          <Avatar className="w-12 h-12 border-2 border-border">
                            {discordId ? (
                              <AvatarImage 
                                src={getDiscordAvatarUrl(discordId, identifiers?.discord_avatar)} 
                                alt={cheater.player_name} 
                              />
                            ) : null}
                            <AvatarFallback className="bg-destructive/20 text-destructive font-bold">
                              {cheater.player_name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground">{cheater.player_name}</p>
                              {getStatusBadge(cheater.status)}
                            </div>
                            
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{cheater.reason}</p>
                            
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              {/* Discord Link */}
                              {discordId && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a
                                      href={`https://discord.com/users/${discordId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#5865F2]/20 text-[#5865F2] hover:bg-[#5865F2]/30 transition-colors text-xs font-medium"
                                    >
                                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                                      </svg>
                                      Discord
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Open Discord Profile</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              
                              {/* Copy Discord ID */}
                              {discordId && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => copyToClipboard(discordId)}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs"
                                    >
                                      <Copy className="w-3 h-3" />
                                      {discordId.slice(0, 8)}...
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Copy Discord ID</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              
                              {/* Steam ID Badge */}
                              {cheater.player_identifiers?.steam && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => copyToClipboard(cheater.player_identifiers!.steam!)}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#1b2838]/20 text-[#66c0f4] hover:bg-[#1b2838]/40 transition-colors text-xs font-medium"
                                    >
                                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>
                                      </svg>
                                      <Copy className="w-3 h-3" />
                                      Steam
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Copy Steam ID: {cheater.player_identifiers.steam}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              
                              {/* FiveM License Badge */}
                              {cheater.player_identifiers?.license && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => copyToClipboard(cheater.player_identifiers!.license!)}
                                      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#f40552]/20 text-[#f40552] hover:bg-[#f40552]/30 transition-colors text-xs font-medium"
                                    >
                                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4a9.6 9.6 0 110 19.2 9.6 9.6 0 010-19.2zm0 2.4a7.2 7.2 0 100 14.4 7.2 7.2 0 000-14.4zm0 2.4a4.8 4.8 0 110 9.6 4.8 4.8 0 010-9.6z"/>
                                      </svg>
                                      <Copy className="w-3 h-3" />
                                      FiveM
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Copy FiveM License: {cheater.player_identifiers.license}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              
                              {/* Server info */}
                              {cheater.server_code && (
                                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Server className="w-3 h-3" />
                                  {cheater.server_name || cheater.server_code}
                                </span>
                              )}
                              
                              {/* Evidence link */}
                              {cheater.evidence_url && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a
                                      href={cheater.evidence_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Evidence
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>View Evidence</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(cheater.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          <Select
                            value={cheater.status}
                            onValueChange={(v) => handleUpdateStatus(cheater.id, cheater.player_name, v as 'confirmed' | 'suspected' | 'cleared')}
                          >
                            <SelectTrigger className="w-32 h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="confirmed">Confirmed</SelectItem>
                              <SelectItem value="suspected">Suspected</SelectItem>
                              <SelectItem value="cleared">Cleared</SelectItem>
                            </SelectContent>
                          </Select>
                          
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => {
                              setCheaterToDelete(cheater);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    </ContextMenuTrigger>
                    
                    <ContextMenuContent className="w-56">
                      <ContextMenuItem
                        onClick={() => copyToClipboard(cheater.player_name)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Player Name
                        <span className="ml-auto text-xs text-muted-foreground">C</span>
                      </ContextMenuItem>
                      
                      {discordId && (
                        <>
                          <ContextMenuItem
                            onClick={() => copyToClipboard(discordId)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Discord ID
                            <span className="ml-auto text-xs text-muted-foreground">D</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => window.open(`https://discord.com/users/${discordId}`, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Open Discord Profile
                          </ContextMenuItem>
                        </>
                      )}
                      
                      {cheater.player_identifiers?.steam && (
                        <ContextMenuItem
                          onClick={() => copyToClipboard(cheater.player_identifiers!.steam!)}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Steam ID
                          <span className="ml-auto text-xs text-muted-foreground">S</span>
                        </ContextMenuItem>
                      )}
                      
                      {cheater.player_identifiers?.license && (
                        <ContextMenuItem
                          onClick={() => copyToClipboard(cheater.player_identifiers!.license!)}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy FiveM License
                          <span className="ml-auto text-xs text-muted-foreground">L</span>
                        </ContextMenuItem>
                      )}
                      
                      {cheater.evidence_url && (
                        <ContextMenuItem
                          onClick={() => window.open(cheater.evidence_url!, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Evidence
                        </ContextMenuItem>
                      )}
                      
                      <ContextMenuSeparator />
                      
                      <ContextMenuItem
                        onClick={() => openDetailsDialog(cheater)}
                      >
                        <Info className="w-4 h-4 mr-2" />
                        View Details
                        <span className="ml-auto text-xs text-muted-foreground">V</span>
                      </ContextMenuItem>
                      
                      <ContextMenuItem
                        onClick={() => openEditDialog(cheater)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Report
                        <span className="ml-auto text-xs text-muted-foreground">E</span>
                      </ContextMenuItem>
                      
                      <ContextMenuSub>
                        <ContextMenuSubTrigger>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Change Status
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                          <ContextMenuItem
                            onClick={() => handleUpdateStatus(cheater.id, cheater.player_name, 'confirmed')}
                            disabled={cheater.status === 'confirmed'}
                          >
                            <AlertTriangle className="w-4 h-4 mr-2 text-destructive" />
                            Confirmed
                            <span className="ml-auto text-xs text-muted-foreground">1</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleUpdateStatus(cheater.id, cheater.player_name, 'suspected')}
                            disabled={cheater.status === 'suspected'}
                          >
                            <HelpCircle className="w-4 h-4 mr-2 text-[hsl(var(--yellow))]" />
                            Suspected
                            <span className="ml-auto text-xs text-muted-foreground">2</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleUpdateStatus(cheater.id, cheater.player_name, 'cleared')}
                            disabled={cheater.status === 'cleared'}
                          >
                            <CheckCircle className="w-4 h-4 mr-2 text-[hsl(var(--green))]" />
                            Cleared
                            <span className="ml-auto text-xs text-muted-foreground">3</span>
                          </ContextMenuItem>
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                      
                      <ContextMenuSeparator />
                      
                      <ContextMenuItem
                        onClick={() => {
                          setCheaterToDelete(cheater);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Report
                        <span className="ml-auto text-xs text-muted-foreground">Del</span>
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              })}
            </TooltipProvider>
          </div>
        )}
        
        {/* Keyboard Shortcuts Help */}
        {selectedIndex !== null && (
          <div className="mt-4 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Keyboard shortcuts:</span>{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">↑/↓</kbd> Navigate{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">C</kbd> Copy name{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">D</kbd> Discord{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">S</kbd> Steam{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">L</kbd> License{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">E</kbd> Edit{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">1-3</kbd> Status{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Del</kbd> Delete{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Esc</kbd> Deselect
            </p>
          </div>
        )}
        
        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from Database?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove <strong>{cheaterToDelete?.player_name}</strong> from the cheater database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (cheaterToDelete) {
                    handleRemoveCheater(cheaterToDelete.id, cheaterToDelete.player_name);
                  }
                  setDeleteDialogOpen(false);
                }}
                className="bg-destructive text-destructive-foreground"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-primary" />
                Edit Cheater Report
              </DialogTitle>
              <DialogDescription>
                Update the details for this cheater report.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-player-name">Player Name *</Label>
                  <Input
                    id="edit-player-name"
                    value={editPlayerName}
                    onChange={(e) => setEditPlayerName(e.target.value)}
                    placeholder="Enter player name"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status *</Label>
                  <Select value={editStatus} onValueChange={(v) => setEditStatus(v as 'confirmed' | 'suspected' | 'cleared')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                          Confirmed
                        </div>
                      </SelectItem>
                      <SelectItem value="suspected">
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-[hsl(var(--yellow))]" />
                          Suspected
                        </div>
                      </SelectItem>
                      <SelectItem value="cleared">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-[hsl(var(--green))]" />
                          Cleared
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-discord-id" className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  Discord ID
                  {isEditFetchingDiscord && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-discord-id"
                    value={editDiscordId}
                    onChange={(e) => setEditDiscordId(e.target.value)}
                    placeholder="User ID (e.g., 123456789)"
                    maxLength={20}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fetchEditDiscordUser(editDiscordId)}
                    disabled={!editDiscordId || !/^\d{17,19}$/.test(editDiscordId) || isEditFetchingDiscord}
                  >
                    {isEditFetchingDiscord ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                {/* Discord user preview */}
                {(editDiscordUsername || editDiscordAvatar) && (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={getDiscordAvatarUrl(editDiscordId, editDiscordAvatar)} />
                      <AvatarFallback className="bg-[#5865F2] text-white text-xs">
                        {editDiscordUsername?.[0]?.toUpperCase() || 'D'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {editDiscordUsername || 'Unknown User'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{editDiscordId}</p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-[hsl(var(--green))]" />
                  </div>
                )}
              </div>

              {/* Steam ID and FiveM License */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-steam-id" className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#1b2838]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/>
                    </svg>
                    Steam ID
                  </Label>
                  <Input
                    id="edit-steam-id"
                    value={editSteamId}
                    onChange={(e) => setEditSteamId(e.target.value)}
                    placeholder="steam:110000xxxxxxxxx"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-fivem-license" className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#f40552]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4a9.6 9.6 0 110 19.2 9.6 9.6 0 010-19.2zm0 2.4a7.2 7.2 0 100 14.4 7.2 7.2 0 000-14.4zm0 2.4a4.8 4.8 0 110 9.6 4.8 4.8 0 010-9.6z"/>
                    </svg>
                    FiveM License
                  </Label>
                  <Input
                    id="edit-fivem-license"
                    value={editFivemLicense}
                    onChange={(e) => setEditFivemLicense(e.target.value)}
                    placeholder="license:xxxxxxxxxxxxxxx"
                    maxLength={60}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-server-code">Server Code</Label>
                  <Input
                    id="edit-server-code"
                    value={editServerCode}
                    onChange={(e) => setEditServerCode(e.target.value)}
                    placeholder="e.g., abc123"
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-server-name">Server Name</Label>
                  <Input
                    id="edit-server-name"
                    value={editServerName}
                    onChange={(e) => setEditServerName(e.target.value)}
                    placeholder="Server name"
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-reason">Reason/Description *</Label>
                <Textarea
                  id="edit-reason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Describe the cheating behavior..."
                  maxLength={500}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">{editReason.length}/500</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-evidence">Evidence URL (Optional)</Label>
                <Input
                  id="edit-evidence"
                  value={editEvidenceUrl}
                  onChange={(e) => setEditEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEditCheater}
                disabled={isSubmitting || !editPlayerName || !editReason}
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                Cheater Details
              </DialogTitle>
              <DialogDescription>
                Full information about this cheater report
              </DialogDescription>
            </DialogHeader>
            
            {cheaterToView && (() => {
              const ids = cheaterToView.player_identifiers as PlayerIdentifiers | null;
              return (
                <div className="space-y-6 py-4">
                  {/* Header with avatar and name */}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
                    <Avatar className="w-16 h-16 border-2 border-border">
                      {ids?.discord ? (
                        <AvatarImage 
                          src={getDiscordAvatarUrl(ids.discord, ids.discord_avatar)} 
                          alt={cheaterToView.player_name} 
                        />
                      ) : null}
                      <AvatarFallback className="bg-destructive/20 text-destructive font-bold text-xl">
                        {cheaterToView.player_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-foreground">{cheaterToView.player_name}</h3>
                      {ids?.discord_username && (
                        <p className="text-sm text-muted-foreground">@{ids.discord_username}</p>
                      )}
                      <div className="mt-2">
                        {getStatusBadge(cheaterToView.status)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Reason/Description */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-muted-foreground">
                      <FileWarning className="w-4 h-4" />
                      Reason
                    </Label>
                    <div className="p-3 rounded-lg bg-secondary/20 border border-border/30">
                      <p className="text-foreground whitespace-pre-wrap">{cheaterToView.reason}</p>
                    </div>
                  </div>
                  
                  {/* Identifiers */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4" />
                      Player Identifiers
                    </Label>
                    <div className="grid gap-2">
                      {ids?.discord && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                            </svg>
                            <span className="text-sm font-medium text-[#5865F2]">Discord ID</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-background/50 px-2 py-1 rounded">{ids.discord}</code>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(ids.discord!)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`https://discord.com/users/${ids.discord}`, '_blank')}>
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {ids?.steam && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#1b2838]/20 border border-[#66c0f4]/20">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#66c0f4]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0z"/>
                            </svg>
                            <span className="text-sm font-medium text-[#66c0f4]">Steam ID</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-background/50 px-2 py-1 rounded">{ids.steam}</code>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(ids.steam!)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {ids?.license && (
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#f40552]/10 border border-[#f40552]/20">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-[#f40552]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4a9.6 9.6 0 110 19.2 9.6 9.6 0 010-19.2zm0 2.4a7.2 7.2 0 100 14.4 7.2 7.2 0 000-14.4zm0 2.4a4.8 4.8 0 110 9.6 4.8 4.8 0 010-9.6z"/>
                            </svg>
                            <span className="text-sm font-medium text-[#f40552]">FiveM License</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-background/50 px-2 py-1 rounded truncate max-w-[120px]">{ids.license}</code>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(ids.license!)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {!ids?.discord && !ids?.steam && !ids?.license && (
                        <p className="text-sm text-muted-foreground italic">No identifiers recorded</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Server Info */}
                  {(cheaterToView.server_code || cheaterToView.server_name) && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-muted-foreground">
                        <Server className="w-4 h-4" />
                        Server Information
                      </Label>
                      <div className="p-3 rounded-lg bg-secondary/20 border border-border/30">
                        {cheaterToView.server_name && (
                          <p className="text-foreground font-medium">{cheaterToView.server_name}</p>
                        )}
                        {cheaterToView.server_code && (
                          <p className="text-sm text-muted-foreground">Code: {cheaterToView.server_code}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Evidence */}
                  {cheaterToView.evidence_url && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-muted-foreground">
                        <Eye className="w-4 h-4" />
                        Evidence
                      </Label>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-2"
                        onClick={() => window.open(cheaterToView.evidence_url!, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Evidence
                      </Button>
                    </div>
                  )}
                  
                  {/* Timestamps */}
                  <div className="flex items-center gap-4 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Reported {formatDistanceToNow(new Date(cheaterToView.created_at), { addSuffix: true })}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(cheaterToView.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={() => {
                setDetailsDialogOpen(false);
                if (cheaterToView) openEditDialog(cheaterToView);
              }}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default CheaterManagement;
