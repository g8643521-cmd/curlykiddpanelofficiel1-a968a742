import { useState, useEffect } from 'react';
import { StickyNote, Plus, Trash2, Edit2, Save, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface PlayerNote {
  id: string;
  player_name: string;
  note: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface PlayerNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName: string;
  playerIdentifiers?: {
    steam?: string;
    steamHex?: string;
    discord?: string;
    fivem?: string;
    license?: string;
    license2?: string;
  };
  serverCode?: string;
  serverName?: string;
}

const PlayerNotesDialog = ({
  open,
  onOpenChange,
  playerName,
  playerIdentifiers,
  serverCode,
  serverName,
}: PlayerNotesDialogProps) => {
  const [notes, setNotes] = useState<PlayerNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (open) {
      fetchNotes();
    }
  }, [open, playerName]);

  const fetchNotes = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('player_notes')
      .select('*')
      .ilike('player_name', playerName)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notes:', error);
    } else {
      setNotes(data || []);
    }
    setIsLoading(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('You must be logged in');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from('player_notes')
      .insert({
        player_name: playerName,
        note: newNote.trim(),
        user_id: session.user.id,
        server_code: serverCode || null,
      });

    if (error) {
      console.error('Error adding note:', error);
      toast.error('Failed to add note');
    } else {
      toast.success('Note added');
      setNewNote('');
      fetchNotes();
    }
    setIsSubmitting(false);
  };

  const handleUpdateNote = async (id: string) => {
    if (!editText.trim()) return;

    const { error } = await supabase
      .from('player_notes')
      .update({ note: editText.trim(), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    } else {
      toast.success('Note updated');
      setEditingId(null);
      fetchNotes();
    }
  };

  const handleDeleteNote = async (id: string) => {
    const { error } = await supabase
      .from('player_notes')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    } else {
      toast.success('Note deleted');
      fetchNotes();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-[hsl(var(--yellow))]" />
            Notes for {playerName}
          </DialogTitle>
          <DialogDescription>
            Private notes visible only to admins. Add observations or track player behavior.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Add new note */}
          <div className="space-y-2">
            <Textarea
              placeholder="Add a private note about this player..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              maxLength={1000}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{newNote.length}/1000</span>
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={isSubmitting || !newNote.trim()}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Note
              </Button>
            </div>
          </div>

          {/* Notes list */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading notes...</div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <StickyNote className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No notes for this player yet</p>
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="p-4 rounded-lg bg-secondary/30 border border-border/50"
                >
                  {editingId === note.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        maxLength={1000}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleUpdateNote(note.id)}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-foreground whitespace-pre-wrap">{note.note}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                          <span>{formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(note.id);
                              setEditText(note.note);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Note?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this note.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="bg-destructive text-destructive-foreground"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlayerNotesDialog;
