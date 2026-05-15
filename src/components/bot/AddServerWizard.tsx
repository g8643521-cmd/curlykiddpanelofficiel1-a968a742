import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Check, ChevronRight, ChevronLeft, Loader2, Search,
  Server, Shield, ShieldCheck, Hash, Users, Lock, Globe,
  AlertTriangle, ExternalLink, Sparkles, Eye, MessageSquare,
  ScrollText, Webhook, Settings, Info, X, Key
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AdvancedSettingsStep, { isAdvancedSettingsValid, type AdvancedSettings, type WizardChannel } from './AdvancedSettingsStep';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type WizardGuild = { id: string; name: string; icon: string | null };
export type WizardRole = { id: string; name: string; color: number };

interface AddServerWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Data
  guilds: WizardGuild[];
  isLoadingGuilds: boolean;
  alreadyConnectedIds: Set<string>;
  isAdmin: boolean;
  // Selection
  selectedGuildId: string;
  selectedGuildName: string;
  onSelectGuild: (guild: WizardGuild | { id: string; name: string; icon: null }) => void;
  // Verification
  discordUserId: string;
  setDiscordUserId: (id: string) => void;
  ownershipVerifiedFor: string | null;
  ownershipVerifiedUsername: string | null;
  ownershipError: string | null;
  isVerifying: boolean;
  onVerify: () => void;
  // Roles & privacy
  availableRoles: WizardRole[];
  isLoadingRoles: boolean;
  availableChannels: WizardChannel[];
  isLoadingChannels: boolean;
  selectedRoleIds: string[];
  setSelectedRoleIds: (ids: string[]) => void;
  channelsPrivate: boolean;
  setChannelsPrivate: (v: boolean) => void;
  advancedSettings: AdvancedSettings;
  setAdvancedSettings: (settings: AdvancedSettings) => void;
  // Access key (required for non-admins)
  accessKey: string;
  setAccessKey: (v: string) => void;
  // Submit
  isSubmitting: boolean;
  onSubmit: () => void;
  onRefreshGuilds: () => void;
  onRefreshChannels: () => void;
  inviteUrl: string;
}

type Step = 0 | 1 | 2 | 3 | 4 | 5;
// Wizard step order shown to the user:
// 1. Server  →  2. Access key  →  3. Channels  →  4. Advanced  →  5. Confirm
// (the legacy "verify ownership" step is hidden entirely)
const STEP_KEYS = ['wizard.step.server', 'wizard.step.verify', 'wizard.step.channels', 'wizard.step.advanced', 'Access key', 'wizard.step.confirm'] as const;
// Display order maps to indexes in STEP_KEYS above.
const VISIBLE_STEP_ORDER: Step[] = [0, 4, 2, 3, 5];

export default function AddServerWizard(props: AddServerWizardProps) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState<Step>(0);
  const [guildSearch, setGuildSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualId, setManualId] = useState('');
  const [manualName, setManualName] = useState('');

  // Reset to step 0 when reopened
  useEffect(() => {
    if (props.open) {
      setStep(0);
      setGuildSearch('');
      setRoleSearch('');
      setShowManual(false);
      setManualId('');
      setManualName('');
    }
  }, [props.open]);

  const filteredGuilds = useMemo(
    () => props.guilds.filter(g => !guildSearch.trim() || g.name.toLowerCase().includes(guildSearch.toLowerCase())),
    [props.guilds, guildSearch]
  );

  const filteredRoles = useMemo(
    () => props.availableRoles.filter(r => !roleSearch.trim() || r.name.toLowerCase().includes(roleSearch.toLowerCase())),
    [props.availableRoles, roleSearch]
  );

  // Step gating
  // Ownership verification has been removed entirely — users prove access via the access key issued by an admin.
  const isVerified = true;
  const canPassStep0 = !!props.selectedGuildId && !props.alreadyConnectedIds.has(props.selectedGuildId);
  const canPassStep1 = true;
  const canPassStep2 = !props.channelsPrivate || props.selectedRoleIds.length > 0;
  const canPassStep3 = isAdvancedSettingsValid(props.advancedSettings);
  // Access key step (step 4): always shown. Admins may leave blank, others must enter one.
  const accessKeyTrimmed = props.accessKey.trim();
  const canPassStep4 = props.isAdmin || /^CKP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(accessKeyTrimmed);
  const canFinish = canPassStep0 && canPassStep1 && canPassStep2 && canPassStep3 && canPassStep4;

  // Step 1 (verify ownership) is removed for everyone. Access key (step index 4) is shown 2nd.
  const visibleSteps: Step[] = VISIBLE_STEP_ORDER;
  const currentVisibleIndex = visibleSteps.indexOf(step);
  const handleNext = () => {
    const next = visibleSteps[currentVisibleIndex + 1];
    if (next !== undefined) setStep(next);
  };
  const handleBack = () => {
    const prev = visibleSteps[currentVisibleIndex - 1];
    if (prev !== undefined) setStep(prev);
  };

  const canProceed =
    step === 0 ? canPassStep0 :
    step === 1 ? canPassStep1 :
    step === 2 ? canPassStep2 :
    step === 3 ? canPassStep3 :
    step === 4 ? canPassStep4 :
    true;

  const fmt = (key: string, vars: Record<string, string | number> = {}) => {
    let s = t(key);
    Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, String(v)); });
    return s;
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-border/40 bg-card/95 backdrop-blur-xl gap-0 max-h-[90vh] flex flex-col">
        {/* ─── Premium gradient header with stepper ─── */}
        <div className="relative shrink-0 overflow-hidden border-b border-border/40">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent" />
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-primary/10 blur-3xl" />
          <button
            onClick={() => props.onOpenChange(false)}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="relative px-6 pt-5 pb-4">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 ring-1 ring-primary/30 flex items-center justify-center shadow-lg shadow-primary/10">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">{t('wizard.title')}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t('wizard.subtitle')}</p>
              </div>
            </div>

            {/* Named step indicator (uses the visible step order) */}
            <div className="flex items-center gap-1.5">
              {visibleSteps.map((stepIdx, displayIdx) => {
                const key = STEP_KEYS[stepIdx];
                const isActive = stepIdx === step;
                const isComplete = displayIdx < currentVisibleIndex;
                return (
                  <div key={key} className="flex items-center gap-1.5 flex-1">
                    <div className={cn(
                      'flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all flex-1 min-w-0',
                      isActive && 'bg-primary/15 ring-1 ring-primary/40',
                      isComplete && 'bg-primary/5',
                      !isActive && !isComplete && 'opacity-50'
                    )}>
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all',
                        isActive && 'bg-primary text-primary-foreground shadow-md shadow-primary/30',
                        isComplete && 'bg-primary/80 text-primary-foreground',
                        !isActive && !isComplete && 'bg-secondary text-muted-foreground ring-1 ring-border/40'
                      )}>
                        {isComplete ? <Check className="w-3 h-3" /> : displayIdx + 1}
                      </div>
                      <span className={cn(
                        'text-[11px] font-semibold tracking-tight truncate',
                        isActive && 'text-primary',
                        isComplete && 'text-foreground/80',
                        !isActive && !isComplete && 'text-muted-foreground'
                      )}>
                        {key.includes('.') ? t(key) : key}
                      </span>
                    </div>
                    {displayIdx < visibleSteps.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {/* ═══ STEP 1 — Server ═══ */}
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('wizard.s1.title')}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{t('wizard.s1.desc')}</p>
                  </div>

                  <a
                    href={props.inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('wizard.s1.invite_cta')}
                  </a>

                  {/* Search + count */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
                      <Input
                        value={guildSearch}
                        onChange={(e) => setGuildSearch(e.target.value)}
                        placeholder={t('wizard.s1.search')}
                        className="h-9 pl-9 text-sm bg-secondary/30 border-border/40"
                      />
                    </div>
                    {props.guilds.length > 0 && (
                      <Badge variant="outline" className="text-[10px] h-6 px-2 border-border/40 bg-secondary/30 font-mono">
                        {fmt('wizard.s1.found_count', { count: props.guilds.length })}
                      </Badge>
                    )}
                  </div>

                  {/* List */}
                  {props.isLoadingGuilds ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 animate-pulse">
                          <div className="w-10 h-10 rounded-xl bg-secondary/50" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-32 rounded bg-secondary/50" />
                            <div className="h-2 w-48 rounded bg-secondary/40" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : props.guilds.length === 0 ? (
                    <div className="text-center py-10 px-6 rounded-xl border border-dashed border-border/40 bg-secondary/10">
                      <div className="w-12 h-12 rounded-2xl bg-secondary/40 ring-1 ring-border/40 flex items-center justify-center mx-auto mb-3">
                        <Server className="w-5 h-5 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{t('wizard.s1.empty_title')}</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{t('wizard.s1.empty_desc')}</p>
                      <Button size="sm" variant="outline" className="mt-4" onClick={props.onRefreshGuilds}>
                        {t('wizard.s1.refresh')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-72 overflow-y-auto rounded-xl border border-border/40 bg-secondary/10 p-1.5">
                      {filteredGuilds.map(guild => {
                        const isAlreadyAdded = props.alreadyConnectedIds.has(guild.id);
                        const isSelected = props.selectedGuildId === guild.id;
                        return (
                          <button
                            key={guild.id}
                            disabled={isAlreadyAdded}
                            onClick={() => props.onSelectGuild(guild)}
                            className={cn(
                              'group w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left ring-1',
                              isSelected
                                ? 'ring-primary/50 bg-gradient-to-r from-primary/15 to-primary/5 shadow-md shadow-primary/10'
                                : isAlreadyAdded
                                  ? 'ring-border/20 bg-muted/10 opacity-60 cursor-not-allowed'
                                  : 'ring-transparent hover:ring-border/40 hover:bg-secondary/30 cursor-pointer'
                            )}
                          >
                            {guild.icon ? (
                              <img
                                src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=64`}
                                alt={guild.name}
                                className={cn(
                                  'w-10 h-10 rounded-xl ring-1 transition-all',
                                  isSelected ? 'ring-primary/40' : 'ring-border/30'
                                )}
                              />
                            ) : (
                              <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ring-1',
                                isSelected
                                  ? 'bg-gradient-to-br from-primary/30 to-primary/10 text-primary ring-primary/30'
                                  : 'bg-muted/40 text-muted-foreground ring-border/30'
                              )}>
                                {guild.name[0]?.toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-foreground truncate">{guild.name}</p>
                                {isAlreadyAdded && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border/40 bg-card/60 text-muted-foreground font-normal">
                                    {t('wizard.s1.already_added')}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground/60 font-mono truncate">{guild.id}</p>
                            </div>
                            <div className={cn(
                              'shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all',
                              isSelected ? 'bg-primary text-primary-foreground scale-100' : 'scale-0'
                            )}>
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Manual entry collapsible */}
                  <div className="pt-2">
                    <button
                      onClick={() => setShowManual(!showManual)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                    >
                      <Settings className="w-3 h-3" />
                      {t('wizard.s1.manual_toggle')}
                    </button>
                    <AnimatePresence>
                      {showManual && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 p-4 rounded-xl bg-secondary/15 border border-border/40 space-y-3">
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t('wizard.s1.manual_id')}</label>
                              <Input
                                value={manualId}
                                onChange={(e) => setManualId(e.target.value)}
                                placeholder="123456789012345678"
                                className="h-9 text-sm font-mono bg-secondary/40 border-border/40"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{t('wizard.s1.manual_name')}</label>
                              <Input
                                value={manualName}
                                onChange={(e) => setManualName(e.target.value)}
                                placeholder="My Discord Server"
                                className="h-9 text-sm bg-secondary/40 border-border/40"
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!/^\d{17,20}$/.test(manualId.trim()) || !manualName.trim()}
                              onClick={() => props.onSelectGuild({ id: manualId.trim(), name: manualName.trim(), icon: null })}
                              className="w-full"
                            >
                              <Check className="w-3.5 h-3.5 mr-1.5" />
                              Use this server
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* ═══ STEP 2 — Verify ═══ */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('wizard.s2.title')}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{t('wizard.s2.desc')}</p>
                  </div>

                  <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="discord-id" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('wizard.s2.id_label')}
                        </label>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" className="text-muted-foreground/60 hover:text-foreground transition-colors">
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs text-xs">
                              {t('wizard.s2.id_help')}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input
                        id="discord-id"
                        value={props.discordUserId}
                        onChange={(e) => props.setDiscordUserId(e.target.value)}
                        placeholder={t('wizard.s2.id_placeholder')}
                        className="h-10 text-sm font-mono bg-secondary/30 border-border/40 focus-visible:ring-primary/30"
                      />
                    </div>

                    <Button
                      onClick={props.onVerify}
                      disabled={props.isVerifying || !props.discordUserId.trim() || isVerified}
                      className="w-full gap-2 bg-gradient-to-b from-primary to-primary/85 hover:from-primary hover:to-primary text-primary-foreground shadow-md shadow-primary/15"
                    >
                      {props.isVerifying ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> {t('wizard.s2.verifying')}</>
                      ) : isVerified ? (
                        <><ShieldCheck className="w-4 h-4" /> {t('wizard.s2.verified_as')} {props.ownershipVerifiedUsername || props.discordUserId}</>
                      ) : (
                        <><Shield className="w-4 h-4" /> {t('wizard.s2.verify_btn')}</>
                      )}
                    </Button>

                    {props.ownershipError && (
                      <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                        <p className="text-xs text-destructive/90 leading-relaxed">{props.ownershipError}</p>
                      </div>
                    )}

                    {isVerified && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        <p className="text-xs text-emerald-400 font-medium">
                          {t('wizard.s2.verified_as')} <span className="font-mono">{props.ownershipVerifiedUsername || props.discordUserId}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ STEP 3 — Channels ═══ */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('wizard.s3.title')}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{t('wizard.s3.desc')}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={props.onRefreshChannels}
                      disabled={props.isLoadingChannels || props.isLoadingRoles}
                      className="shrink-0 gap-1.5 h-8 border-border/50"
                      title="Refresh channels & roles from Discord"
                    >
                      {(props.isLoadingChannels || props.isLoadingRoles) ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span className="text-xs font-semibold">Refresh</span>
                    </Button>
                  </div>

                  {/* Channel preview */}
                  <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border/30 bg-secondary/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('wizard.s3.preview_title')}</p>
                    </div>
                    <div className="divide-y divide-border/30">
                      {[
                        { name: 'auto-scan-alerts', icon: Sparkles, label: t('wizard.s3.ch_auto'), desc: t('wizard.s3.ch_auto_desc') },
                        { name: 'full-scan-alerts', icon: ScrollText, label: t('wizard.s3.ch_full'), desc: t('wizard.s3.ch_full_desc') },
                        { name: 'curlykidd-info', icon: Info, label: t('wizard.s3.ch_info'), desc: t('wizard.s3.ch_info_desc') },
                      ].map(ch => (
                        <div key={ch.name} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                            <ch.icon className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Hash className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs font-mono font-semibold text-foreground">{ch.name}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{ch.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Privacy toggle */}
                  <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/30 bg-secondary/20">
                      <p className="text-sm font-semibold text-foreground">{t('wizard.s3.privacy_title')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-3">
                      {[
                        { value: true, icon: Lock, title: t('wizard.s3.private'), desc: t('wizard.s3.private_desc'), color: 'amber' },
                        { value: false, icon: Globe, title: t('wizard.s3.public'), desc: t('wizard.s3.public_desc'), color: 'emerald' },
                      ].map(opt => {
                        const active = props.channelsPrivate === opt.value;
                        return (
                          <button
                            key={String(opt.value)}
                            onClick={() => props.setChannelsPrivate(opt.value)}
                            className={cn(
                              'group relative p-3 rounded-lg text-left transition-all ring-1',
                              active
                                ? opt.color === 'amber'
                                  ? 'ring-amber-500/40 bg-amber-500/10 shadow-md shadow-amber-500/5'
                                  : 'ring-emerald-500/40 bg-emerald-500/10 shadow-md shadow-emerald-500/5'
                                : 'ring-border/30 bg-secondary/20 hover:ring-border/60 hover:bg-secondary/40'
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className={cn(
                                'w-7 h-7 rounded-lg flex items-center justify-center ring-1',
                                active
                                  ? opt.color === 'amber' ? 'bg-amber-500/20 ring-amber-500/40 text-amber-500' : 'bg-emerald-500/20 ring-emerald-500/40 text-emerald-500'
                                  : 'bg-secondary/40 ring-border/30 text-muted-foreground'
                              )}>
                                <opt.icon className="w-3.5 h-3.5" />
                              </div>
                              <span className={cn('text-sm font-semibold', active ? 'text-foreground' : 'text-foreground/70')}>{opt.title}</span>
                              {active && <Check className="w-3.5 h-3.5 ml-auto text-foreground/80" />}
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{opt.desc}</p>
                          </button>
                        );
                      })}
                    </div>

                    {/* Role picker */}
                    {props.channelsPrivate && (
                      <div className="px-3 pb-3 space-y-2">
                        <div className="relative flex items-center gap-2">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
                          <Input
                            value={roleSearch}
                            onChange={(e) => setRoleSearch(e.target.value)}
                            placeholder={t('wizard.s3.role_search')}
                            className="h-9 pl-9 text-xs bg-secondary/30 border-border/40"
                          />
                          <Badge variant="outline" className="text-[10px] shrink-0 h-6 px-2 border-primary/30 bg-primary/10 text-primary font-semibold">
                            {fmt('wizard.s3.roles_selected', { count: props.selectedRoleIds.length })}
                          </Badge>
                        </div>

                        {props.isLoadingRoles ? (
                          <div className="flex flex-col items-center justify-center py-8 gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-primary/60" />
                          </div>
                        ) : props.availableRoles.length === 0 ? (
                          <div className="text-center py-5 px-4 rounded-lg bg-secondary/15 border border-dashed border-border/40">
                            <p className="text-[11px] text-muted-foreground">{t('wizard.s3.no_roles')}</p>
                          </div>
                        ) : (
                          <div className="max-h-44 overflow-y-auto rounded-lg border border-border/40 bg-secondary/15">
                            {filteredRoles.map(role => {
                              const checked = props.selectedRoleIds.includes(role.id);
                              const colorHex = role.color === 0 ? null : `#${role.color.toString(16).padStart(6, '0')}`;
                              return (
                                <button
                                  key={role.id}
                                  type="button"
                                  onClick={() => {
                                    props.setSelectedRoleIds(
                                      checked
                                        ? props.selectedRoleIds.filter(id => id !== role.id)
                                        : [...props.selectedRoleIds, role.id]
                                    );
                                  }}
                                  className={cn(
                                    'group w-full flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all text-xs border-l-2 text-left',
                                    checked ? 'bg-primary/10 border-l-primary' : 'border-l-transparent hover:bg-secondary/40'
                                  )}
                                >
                                  <div className={cn(
                                    'relative w-4 h-4 rounded shrink-0 transition-all flex items-center justify-center',
                                    checked ? 'bg-primary ring-1 ring-primary' : 'bg-secondary/50 ring-1 ring-border/50 group-hover:ring-border'
                                  )}>
                                    {checked && <Check className="w-3 h-3 text-primary-foreground" />}
                                  </div>
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-border/30"
                                    style={{ backgroundColor: colorHex || 'hsl(var(--muted-foreground))' }}
                                  />
                                  <span className={cn('font-medium truncate flex-1', checked ? 'text-foreground' : 'text-foreground/80')}>
                                    @{role.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {props.selectedRoleIds.length === 0 && !props.isLoadingRoles && props.availableRoles.length > 0 && (
                          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/25 px-3 py-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-amber-400/90 leading-relaxed">{t('wizard.s3.warn_no_role')}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ STEP 4 — Advanced ═══ */}
              {step === 3 && (
                <AdvancedSettingsStep
                  value={props.advancedSettings}
                  onChange={props.setAdvancedSettings}
                  roles={props.availableRoles}
                  isLoadingRoles={props.isLoadingRoles}
                  channels={props.availableChannels}
                  isLoadingChannels={props.isLoadingChannels}
                />
              )}

              {/* ═══ STEP 5 — Access Key ═══ */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">Access key</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Enter the personal one-time key issued to you by an administrator. Each key can only be used once.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/40 bg-card/40 p-4 space-y-3">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Key code
                    </label>
                    <div className="relative">
                      <Key className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                      <Input
                        value={props.accessKey}
                        onChange={(e) => props.setAccessKey(e.target.value.toUpperCase())}
                        placeholder="CKP-XXXX-XXXX-XXXX"
                        className="h-11 pl-10 text-sm font-mono tracking-wider bg-secondary/30 border-border/40"
                      />
                    </div>
                    {props.isAdmin && (
                      <p className="text-[11px] text-muted-foreground/70 inline-flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-primary" />
                        You're an admin — the key is optional but recommended.
                      </p>
                    )}
                    {!props.isAdmin && !canPassStep4 && accessKeyTrimmed.length > 0 && (
                      <p className="text-[11px] text-destructive/80 inline-flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3" />
                        Invalid key format — should look like CKP-XXXX-XXXX-XXXX.
                      </p>
                    )}
                    {!props.isAdmin && (
                      <p className="text-[11px] text-muted-foreground/70">
                        Don't have a key? Contact an administrator to issue one for your account.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ═══ STEP 6 — Confirm ═══ */}
              {step === 5 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">{t('wizard.s4.title')}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{t('wizard.s4.desc')}</p>
                  </div>

                  {/* Server summary */}
                  <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border/30 bg-secondary/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('wizard.s4.section_server')}</p>
                    </div>
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 flex items-center justify-center">
                        <Server className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{props.selectedGuildName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{props.selectedGuildId}</p>
                      </div>
                    </div>
                  </div>

                  {/* Access summary */}
                  <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border/30 bg-secondary/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('wizard.s4.section_access')}</p>
                    </div>
                    <div className="px-4 py-3">
                      {props.channelsPrivate ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-sm font-medium text-foreground">{t('wizard.s3.private')}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {props.selectedRoleIds.map(id => {
                              const role = props.availableRoles.find(r => r.id === id);
                              if (!role) return null;
                              const colorHex = role.color === 0 ? null : `#${role.color.toString(16).padStart(6, '0')}`;
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/40 ring-1 ring-border/40 text-[10px] font-medium text-foreground"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorHex || 'hsl(var(--muted-foreground))' }} />
                                  @{role.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-sm font-medium text-foreground">{t('wizard.s3.public')}</span>
                          <span className="text-xs text-muted-foreground">— {t('wizard.s3.public_summary')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Permissions */}
                  <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border/30 bg-secondary/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t('wizard.s4.section_perms')}</p>
                    </div>
                    <div className="px-4 py-3 space-y-1.5">
                      {[
                        { icon: Eye, key: 'wizard.s4.perm_view_channels' },
                        { icon: Hash, key: 'wizard.s4.perm_manage_channels' },
                        { icon: MessageSquare, key: 'wizard.s4.perm_send_messages' },
                        { icon: ScrollText, key: 'wizard.s4.perm_view_audit' },
                        { icon: Webhook, key: 'wizard.s4.perm_manage_webhooks' },
                      ].map(p => (
                        <div key={p.key} className="flex items-center gap-2 text-xs">
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                          <p.icon className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-foreground/80">{t(p.key)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* What happens next */}
                  <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary mb-2">
                      {t('wizard.s4.section_what')}
                    </p>
                    <ol className="space-y-1.5">
                      {['wizard.s4.what_1', 'wizard.s4.what_2', 'wizard.s4.what_3'].map((key, i) => (
                        <li key={key} className="flex items-start gap-2 text-xs text-foreground/85">
                          <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          <span className="leading-relaxed">{t(key)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ─── Footer ─── */}
        <div className="shrink-0 px-6 py-4 border-t border-border/40 bg-secondary/20 backdrop-blur flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={currentVisibleIndex === 0 ? () => props.onOpenChange(false) : handleBack}
            className="text-muted-foreground hover:text-foreground gap-1.5"
          >
            {currentVisibleIndex === 0 ? (
              t('wizard.cancel')
            ) : (
              <><ChevronLeft className="w-4 h-4" /> {t('wizard.back')}</>
            )}
          </Button>

          {step === 5 ? (
            <Button
              onClick={props.onSubmit}
              disabled={props.isSubmitting || !canFinish}
              className="gap-2 bg-gradient-to-b from-primary to-primary/85 hover:from-primary hover:to-primary text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-primary/40 min-w-[160px]"
            >
              {props.isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {t('wizard.finishing')}</>
              ) : (
                <><Sparkles className="w-4 h-4" /> {t('wizard.finish')}</>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              className="gap-1.5 bg-gradient-to-b from-primary to-primary/85 hover:from-primary hover:to-primary text-primary-foreground shadow-md shadow-primary/15 min-w-[120px]"
            >
              {t('wizard.next')} <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
