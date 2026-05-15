import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Eye, EyeOff, Copy, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const EMBED_COLORS = [
  { name: 'Red', value: '#DC2626' },
  { name: 'Orange', value: '#EA580C' },
  { name: 'Yellow', value: '#CA8A04' },
  { name: 'Green', value: '#16A34A' },
  { name: 'Blue', value: '#2563EB' },
  { name: 'Purple', value: '#9333EA' },
  { name: 'Pink', value: '#DB2777' },
  { name: 'Cyan', value: '#0891B2' },
  { name: 'White', value: '#FFFFFF' },
];

export interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedConfig {
  title: string;
  description: string;
  color: string;
  footer: string;
  thumbnail_url: string;
  author_name: string;
  author_icon_url: string;
  image_url: string;
  content: string;
  fields: EmbedField[];
}

export const defaultEmbedConfig: EmbedConfig = {
  title: '',
  description: '',
  color: '#2563EB',
  footer: '',
  thumbnail_url: '',
  author_name: '',
  author_icon_url: '',
  image_url: '',
  content: '',
  fields: [],
};

interface Props {
  channelId: string;
  channelLabel: string;
  config: EmbedConfig;
  onChange: (config: EmbedConfig) => void;
  availableVariables: string[];
}

const DiscordEmbedBuilder = ({ channelId, channelLabel, config, onChange, availableVariables }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const update = (partial: Partial<EmbedConfig>) => {
    onChange({ ...config, ...partial });
  };

  const addField = () => {
    update({ fields: [...config.fields, { name: '', value: '', inline: false }] });
  };

  const updateField = (index: number, partial: Partial<EmbedField>) => {
    const fields = [...config.fields];
    fields[index] = { ...fields[index], ...partial };
    update({ fields });
  };

  const removeField = (index: number) => {
    update({ fields: config.fields.filter((_, i) => i !== index) });
  };

  const replaceVarsForPreview = (text: string) => {
    if (!text) return text;
    return text
      .replace(/\{search_query\}/g, 'TestPlayer123')
      .replace(/\{searched_by\}/g, 'admin@example.com')
      .replace(/\{results_count\}/g, '2')
      .replace(/\{player_name\}/g, 'TestPlayer123')
      .replace(/\{server_name\}/g, 'My FiveM Server')
      .replace(/\{server_code\}/g, 'abc123')
      .replace(/\{players\}/g, '42')
      .replace(/\{max_players\}/g, '64')
      .replace(/\{status\}/g, 'confirmed')
      .replace(/\{reason\}/g, 'Aimbot detected')
      .replace(/\{user_email\}/g, 'newuser@example.com')
      .replace(/\{display_name\}/g, '8700')
      .replace(/\{auth_provider\}/g, 'Google')
      .replace(/\{sx_username\}/g, 'CurlyKidd')
      .replace(/\{sx_tickets\}/g, '3')
      .replace(/\{sx_guilds\}/g, '5')
      .replace(/\{discord_id\}/g, '123456789012345678')
      .replace(/\{discord_avatar_url\}/g, 'https://cdn.discordapp.com/embed/avatars/0.png')
      .replace(/\{discord_profile_url\}/g, 'https://discord.com/users/123456789012345678')
      .replace(/\{timestamp\}/g, new Date().toLocaleString());
  };

  const exportConfig = () => {
    const json = JSON.stringify(config, null, 2);
    navigator.clipboard.writeText(json);
    toast.success('Embed config copied to clipboard!');
  };

  const importConfig = () => {
    const input = prompt('Paste embed config JSON:');
    if (!input) return;
    try {
      const parsed = JSON.parse(input);
      onChange({ ...defaultEmbedConfig, ...parsed });
      toast.success('Embed config imported!');
    } catch {
      toast.error('Invalid JSON');
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-secondary/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-secondary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">Embed</Badge>
          <span className="text-sm font-medium text-foreground">{channelLabel} Embed Config</span>
          {(config.title || config.description) && (
            <Badge variant="secondary" className="text-[10px]">Configured</Badge>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border/30 p-4 space-y-4">
          {/* Variables Info */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs font-medium text-primary mb-1.5">Available variables:</p>
            <div className="flex flex-wrap gap-1.5">
              {availableVariables.map(v => (
                <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono cursor-pointer hover:bg-primary/20 transition-colors" onClick={() => { navigator.clipboard.writeText(`{${v}}`); toast.success(`{${v}} copied`); }}>{`{${v}}`}</code>
              ))}
            </div>
          </div>

          {/* Content (outside embed) */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Content (outside embed)</Label>
            <Textarea
              value={config.content}
              onChange={(e) => update({ content: e.target.value })}
              placeholder="E.g. @everyone or a message outside the embed"
              className="min-h-[50px] text-sm bg-background/50 border-border/30 resize-none"
              maxLength={2000}
            />
          </div>

          {/* Author */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Author Name</Label>
              <Input value={config.author_name} onChange={(e) => update({ author_name: e.target.value })} placeholder="CurlyKiddPanel" className="h-8 text-sm bg-background/50 border-border/30" maxLength={256} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Author Icon URL</Label>
              <Input value={config.author_icon_url} onChange={(e) => update({ author_icon_url: e.target.value })} placeholder="https://example.com/icon.png" className="h-8 text-sm bg-background/50 border-border/30" />
            </div>
          </div>

          {/* Title & Color */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs text-muted-foreground">Title</Label>
              <Input value={config.title} onChange={(e) => update({ title: e.target.value })} placeholder="🔍 Player Search" className="h-8 text-sm bg-background/50 border-border/30" maxLength={256} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Color</Label>
              <div className="flex gap-2">
                <Select value={config.color} onValueChange={(v) => update({ color: v })}>
                  <SelectTrigger className="flex-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMBED_COLORS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full border border-border/50" style={{ backgroundColor: c.value }} />
                          {c.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="w-8 h-8 rounded-md border border-border/30 flex-shrink-0" style={{ backgroundColor: config.color }} />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
             <Label className="text-xs text-muted-foreground">Description</Label>
            <Textarea value={config.description} onChange={(e) => update({ description: e.target.value })} placeholder="A player has been searched in the database." className="min-h-[60px] text-sm bg-background/50 border-border/30 resize-none" maxLength={4096} />
          </div>

          {/* Thumbnail & Image */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Thumbnail URL</Label>
              <Input value={config.thumbnail_url} onChange={(e) => update({ thumbnail_url: e.target.value })} placeholder="https://example.com/thumb.png" className="h-8 text-sm bg-background/50 border-border/30" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Image URL</Label>
              <Input value={config.image_url} onChange={(e) => update({ image_url: e.target.value })} placeholder="https://example.com/image.png" className="h-8 text-sm bg-background/50 border-border/30" />
            </div>
          </div>

          {/* Custom Fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Custom Fields</Label>
              <Button variant="ghost" size="sm" onClick={addField} className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" /> Add field
              </Button>
            </div>
            {config.fields.map((field, i) => (
              <div key={i} className="flex gap-2 items-start p-2 rounded-lg bg-background/30 border border-border/20">
                <div className="flex-1 grid grid-cols-2 gap-2">
                   <Input value={field.name} onChange={(e) => updateField(i, { name: e.target.value })} placeholder="Field name" className="h-7 text-xs bg-background/50 border-border/30" maxLength={256} />
                  <Input value={field.value} onChange={(e) => updateField(i, { value: e.target.value })} placeholder="Field value (use {variables})" className="h-7 text-xs bg-background/50 border-border/30" maxLength={1024} />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                    <Switch checked={field.inline} onCheckedChange={(v) => updateField(i, { inline: v })} className="scale-75" />
                    Inline
                  </label>
                  <Button variant="ghost" size="sm" onClick={() => removeField(i)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Footer</Label>
            <Input value={config.footer} onChange={(e) => update({ footer: e.target.value })} placeholder="CurlyKiddPanel • Cheater Search" className="h-8 text-sm bg-background/50 border-border/30" maxLength={2048} />
          </div>

          {/* Actions: Preview + Export/Import */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-1.5 text-xs h-7">
              {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showPreview ? 'Skjul Preview' : 'Vis Preview'}
            </Button>
            <Button variant="outline" size="sm" onClick={exportConfig} className="gap-1.5 text-xs h-7">
              <Copy className="w-3 h-3" /> Export / Kopier
            </Button>
            <Button variant="outline" size="sm" onClick={importConfig} className="gap-1.5 text-xs h-7">
              <Download className="w-3 h-3" /> Import
            </Button>
          </div>

          {/* Discord Preview */}
          {showPreview && (
            <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: '#313338' }}>
              {config.content && (
                <p className="text-sm" style={{ color: '#dbdee1' }}>{replaceVarsForPreview(config.content)}</p>
              )}
              <div className="flex rounded overflow-hidden" style={{ borderLeft: `4px solid ${config.color || '#2563EB'}` }}>
                <div className="flex-1 p-3 space-y-2 min-w-0" style={{ backgroundColor: '#2b2d31' }}>
                  {config.author_name && (
                    <div className="flex items-center gap-1.5">
                      {config.author_icon_url && (
                        <img src={config.author_icon_url} alt="" className="w-5 h-5 rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      )}
                      <span className="text-xs font-medium" style={{ color: '#dbdee1' }}>{replaceVarsForPreview(config.author_name)}</span>
                    </div>
                  )}
                  {(config.title || !config.description) && (
                    <p className="text-sm font-semibold" style={{ color: '#00a8fc' }}>{replaceVarsForPreview(config.title) || 'Embed Title'}</p>
                  )}
                  {config.description && (
                    <p className="text-sm whitespace-pre-wrap" style={{ color: '#dbdee1' }}>{replaceVarsForPreview(config.description)}</p>
                  )}
                  {config.fields.length > 0 && (
                    <div className="grid gap-y-2 gap-x-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                      {config.fields.map((f, i) => (
                        <div key={i} className={f.inline ? '' : 'col-span-3'}>
                          <p className="text-xs font-semibold" style={{ color: '#dbdee1' }}>{replaceVarsForPreview(f.name) || 'Field'}</p>
                          <p className="text-xs" style={{ color: '#b5bac1' }}>{replaceVarsForPreview(f.value) || 'Value'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {config.image_url && (
                    <img src={config.image_url} alt="" className="max-w-[300px] rounded mt-2" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  {config.footer && (
                    <p className="mt-2" style={{ color: '#72767d', fontSize: '10px' }}>{replaceVarsForPreview(config.footer)} • {new Date().toLocaleString()}</p>
                  )}
                </div>
                {config.thumbnail_url && (
                  <div className="p-3" style={{ backgroundColor: '#2b2d31' }}>
                    <img src={config.thumbnail_url} alt="" className="w-16 h-16 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscordEmbedBuilder;
