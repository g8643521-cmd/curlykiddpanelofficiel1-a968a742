import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronDown, Shield, Gavel, Bell, ScrollText, Webhook,
  Info, AlertTriangle, Check, Eye, EyeOff,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { WizardRole } from './AddServerWizard';

export interface WizardChannel {
  id: string;
  name: string;
}

export interface AdvancedSettings {
  // Cheater role
  auto_assign_cheater_role: boolean;
  cheater_role_id: string | null;
  // Auto-mod (mutually exclusive)
  auto_kick_cheaters: boolean;
  auto_ban_cheaters: boolean;
  // Alerts
  min_bans_for_alert: number;
  alert_mention_role_id: string | null;
  notify_on_clean_joins: boolean;
  // Logging & scanning
  log_all_joins: boolean;
  auto_scan_interval_minutes: number;
  info_channel_id: string | null;
  // Webhook overrides
  use_custom_webhooks: boolean;
  custom_auto_webhook: string;
  custom_full_webhook: string;
}

export const defaultAdvancedSettings: AdvancedSettings = {
  auto_assign_cheater_role: false,
  cheater_role_id: null,
  auto_kick_cheaters: false,
  auto_ban_cheaters: false,
  min_bans_for_alert: 1,
  alert_mention_role_id: null,
  notify_on_clean_joins: false,
  log_all_joins: false,
  auto_scan_interval_minutes: 1,
  info_channel_id: null,
  use_custom_webhooks: false,
  custom_auto_webhook: '',
  custom_full_webhook: '',
};

interface Props {
  value: AdvancedSettings;
  onChange: (next: AdvancedSettings) => void;
  roles: WizardRole[];
  isLoadingRoles: boolean;
  channels: WizardChannel[];
  isLoadingChannels: boolean;
}

const NONE = '__none__';

function Section({
  icon: Icon,
  title,
  desc,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: typeof Shield;
  title: string;
  desc: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {badge && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-primary/20 text-primary ring-1 ring-primary/30">
                {badge}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">{desc}</p>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.18 }}
          className="border-t border-border/30 bg-secondary/10"
        >
          <div className="px-4 py-4 space-y-4">{children}</div>
        </motion.div>
      )}
    </div>
  );
}

function HelpIcon({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground/60 hover:text-foreground transition-colors">
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MaskedInput({
  value, onChange, placeholder, invalid,
}: { value: string; onChange: (v: string) => void; placeholder: string; invalid: boolean }) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="relative">
      <Input
        type={reveal ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-9 pr-10 text-xs font-mono bg-secondary/30 border-border/40',
          invalid && 'border-destructive/60 focus-visible:ring-destructive/40'
        )}
      />
      <button
        type="button"
        onClick={() => setReveal(!reveal)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {reveal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

const isValidWebhook = (s: string) =>
  s.trim() === '' || /^https:\/\/discord\.com\/api\/webhooks\//.test(s.trim());

export default function AdvancedSettingsStep({
  value, onChange, roles, channels, isLoadingChannels,
}: Props) {
  const { t } = useI18n();
  const set = <K extends keyof AdvancedSettings>(k: K, v: AdvancedSettings[K]) =>
    onChange({ ...value, [k]: v });

  // Mutual exclusion guard at UI layer
  useEffect(() => {
    if (value.auto_kick_cheaters && value.auto_ban_cheaters) {
      onChange({ ...value, auto_kick_cheaters: false });
    }
  }, [value.auto_kick_cheaters, value.auto_ban_cheaters]);

  const intervalOptions = [
    { v: 0, label: t('wizard.s5.scan_disabled') },
    { v: 1, label: t('wizard.s5.scan_min').replace('{n}', '1') },
    { v: 5, label: t('wizard.s5.scan_min').replace('{n}', '5') },
    { v: 15, label: t('wizard.s5.scan_min').replace('{n}', '15') },
    { v: 30, label: t('wizard.s5.scan_min').replace('{n}', '30') },
    { v: 60, label: t('wizard.s5.scan_min').replace('{n}', '60') },
  ];

  const minBansOptions = [1, 2, 3, 5, 10];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('wizard.s5.title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('wizard.s5.desc')}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-2 italic">{t('wizard.s5.skip_hint')}</p>
      </div>

      {/* ── Cheater role ── */}
      <Section
        icon={Shield}
        title={t('wizard.s5.role_title')}
        desc={t('wizard.s5.role_desc')}
        badge={value.auto_assign_cheater_role ? t('wizard.s5.enabled') : undefined}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Label className="text-xs font-semibold text-foreground">{t('wizard.s5.role_toggle')}</Label>
          </div>
          <Switch
            checked={value.auto_assign_cheater_role}
            onCheckedChange={(v) => set('auto_assign_cheater_role', v)}
          />
        </div>
        {value.auto_assign_cheater_role && (
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t('wizard.s5.role_picker_label')}
            </Label>
            <Select
              value={value.cheater_role_id ?? NONE}
              onValueChange={(v) => set('cheater_role_id', v === NONE ? null : v)}
            >
              <SelectTrigger className="h-9 text-xs bg-secondary/30 border-border/40">
                <SelectValue placeholder={t('wizard.s5.role_picker_placeholder')} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value={NONE}>{t('wizard.s5.role_picker_none')}</SelectItem>
                {roles.map(r => {
                  const colorHex = r.color === 0 ? null : `#${r.color.toString(16).padStart(6, '0')}`;
                  return (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorHex || 'hsl(var(--muted-foreground))' }} />
                        @{r.name}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-400/90 leading-relaxed">{t('wizard.s5.role_warn_above_bot')}</p>
            </div>
          </div>
        )}
      </Section>

      {/* ── Auto-moderation ── */}
      <Section
        icon={Gavel}
        title={t('wizard.s5.mod_title')}
        desc={t('wizard.s5.mod_desc')}
        badge={value.auto_ban_cheaters ? 'BAN' : value.auto_kick_cheaters ? 'KICK' : undefined}
      >
        <div className="space-y-2">
          {[
            { key: 'auto_kick_cheaters' as const, label: t('wizard.s5.mod_kick'), desc: t('wizard.s5.mod_kick_desc'), color: 'amber' },
            { key: 'auto_ban_cheaters' as const, label: t('wizard.s5.mod_ban'), desc: t('wizard.s5.mod_ban_desc'), color: 'destructive' },
          ].map(opt => (
            <div
              key={opt.key}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg ring-1 transition-all',
                value[opt.key]
                  ? opt.color === 'destructive'
                    ? 'ring-destructive/40 bg-destructive/10'
                    : 'ring-amber-500/40 bg-amber-500/10'
                  : 'ring-border/30 bg-secondary/20'
              )}
            >
              <Switch
                checked={value[opt.key]}
                onCheckedChange={(v) => {
                  // Mutual exclusion: turning one on turns the other off
                  const next = { ...value, [opt.key]: v };
                  if (v) {
                    if (opt.key === 'auto_kick_cheaters') next.auto_ban_cheaters = false;
                    if (opt.key === 'auto_ban_cheaters') next.auto_kick_cheaters = false;
                  }
                  onChange(next);
                }}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{opt.desc}</p>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground/70 italic">{t('wizard.s5.mod_conflict')}</p>
        </div>
      </Section>

      {/* ── Alerts & notifications ── */}
      <Section
        icon={Bell}
        title={t('wizard.s5.alerts_title')}
        desc={t('wizard.s5.alerts_desc')}
      >
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t('wizard.s5.alerts_min_bans')}
            </Label>
            <HelpIcon text={t('wizard.s5.alerts_min_bans_help')} />
          </div>
          <Select
            value={String(value.min_bans_for_alert)}
            onValueChange={(v) => set('min_bans_for_alert', Number(v))}
          >
            <SelectTrigger className="h-9 text-xs bg-secondary/30 border-border/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {minBansOptions.map(n => (
                <SelectItem key={n} value={String(n)}>{n}+ ban{n > 1 ? 's' : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t('wizard.s5.alerts_mention')}
            </Label>
            <HelpIcon text={t('wizard.s5.alerts_mention_help')} />
          </div>
          <Select
            value={value.alert_mention_role_id ?? NONE}
            onValueChange={(v) => set('alert_mention_role_id', v === NONE ? null : v)}
          >
            <SelectTrigger className="h-9 text-xs bg-secondary/30 border-border/40">
              <SelectValue placeholder={t('wizard.s5.role_picker_none')} />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value={NONE}>{t('wizard.s5.role_picker_none')}</SelectItem>
              {roles.map(r => {
                const colorHex = r.color === 0 ? null : `#${r.color.toString(16).padStart(6, '0')}`;
                return (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorHex || 'hsl(var(--muted-foreground))' }} />
                      @{r.name}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="min-w-0 flex-1">
            <Label className="text-xs font-semibold text-foreground">{t('wizard.s5.alerts_clean')}</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('wizard.s5.alerts_clean_desc')}</p>
          </div>
          <Switch
            checked={value.notify_on_clean_joins}
            onCheckedChange={(v) => set('notify_on_clean_joins', v)}
          />
        </div>
      </Section>

      {/* ── Logging & scanning ── */}
      <Section
        icon={ScrollText}
        title={t('wizard.s5.log_title')}
        desc={t('wizard.s5.log_desc')}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Label className="text-xs font-semibold text-foreground">{t('wizard.s5.log_all_joins')}</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('wizard.s5.log_all_joins_desc')}</p>
          </div>
          <Switch
            checked={value.log_all_joins}
            onCheckedChange={(v) => set('log_all_joins', v)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t('wizard.s5.scan_interval')}
            </Label>
            <HelpIcon text={t('wizard.s5.scan_interval_help')} />
          </div>
          <Select
            value={String(value.auto_scan_interval_minutes)}
            onValueChange={(v) => set('auto_scan_interval_minutes', Number(v))}
          >
            <SelectTrigger className="h-9 text-xs bg-secondary/30 border-border/40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intervalOptions.map(o => (
                <SelectItem key={o.v} value={String(o.v)}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t('wizard.s5.info_channel')}
            </Label>
            <HelpIcon text={t('wizard.s5.info_channel_help')} />
          </div>
          <Select
            value={value.info_channel_id ?? NONE}
            onValueChange={(v) => set('info_channel_id', v === NONE ? null : v)}
            disabled={isLoadingChannels}
          >
            <SelectTrigger className="h-9 text-xs bg-secondary/30 border-border/40">
              <SelectValue placeholder={t('wizard.s5.info_channel_placeholder')} />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value={NONE}>{t('wizard.s5.info_channel_placeholder')}</SelectItem>
              {channels.map(c => (
                <SelectItem key={c.id} value={c.id}>#{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* ── Webhook overrides ── */}
      <Section
        icon={Webhook}
        title={t('wizard.s5.webhooks_title')}
        desc={t('wizard.s5.webhooks_desc')}
      >
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs font-semibold text-foreground">{t('wizard.s5.webhooks_toggle')}</Label>
          <Switch
            checked={value.use_custom_webhooks}
            onCheckedChange={(v) => set('use_custom_webhooks', v)}
          />
        </div>
        {value.use_custom_webhooks && (
          <>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t('wizard.s5.webhooks_auto_label')}
              </Label>
              <MaskedInput
                value={value.custom_auto_webhook}
                onChange={(v) => set('custom_auto_webhook', v)}
                placeholder="https://discord.com/api/webhooks/…"
                invalid={!isValidWebhook(value.custom_auto_webhook)}
              />
              {!isValidWebhook(value.custom_auto_webhook) && (
                <p className="text-[10px] text-destructive">{t('wizard.s5.webhooks_invalid')}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t('wizard.s5.webhooks_full_label')}
              </Label>
              <MaskedInput
                value={value.custom_full_webhook}
                onChange={(v) => set('custom_full_webhook', v)}
                placeholder="https://discord.com/api/webhooks/…"
                invalid={!isValidWebhook(value.custom_full_webhook)}
              />
              {!isValidWebhook(value.custom_full_webhook) && (
                <p className="text-[10px] text-destructive">{t('wizard.s5.webhooks_invalid')}</p>
              )}
            </div>
          </>
        )}
      </Section>
    </div>
  );
}

export const isAdvancedSettingsValid = (s: AdvancedSettings): boolean => {
  if (s.auto_kick_cheaters && s.auto_ban_cheaters) return false;
  if (s.auto_assign_cheater_role && !s.cheater_role_id) return false;
  if (s.use_custom_webhooks) {
    if (!isValidWebhook(s.custom_auto_webhook)) return false;
    if (!isValidWebhook(s.custom_full_webhook)) return false;
  }
  return true;
};
