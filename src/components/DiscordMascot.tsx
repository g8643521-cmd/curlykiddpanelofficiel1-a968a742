import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const MascotIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]">
    {/* Antenna */}
    <line x1="16" y1="2" x2="16" y2="7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="2" r="2" fill="currentColor" className="animate-pulse" />
    {/* Head */}
    <rect x="6" y="7" width="20" height="14" rx="4" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="2" />
    {/* Eyes */}
    <circle cx="12" cy="14" r="2.5" fill="currentColor" />
    <circle cx="20" cy="14" r="2.5" fill="currentColor" />
    {/* Mouth */}
    <path d="M12 18C12 18 14 20 16 20C18 20 20 18 20 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    {/* Body */}
    <rect x="9" y="22" width="14" height="6" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
    {/* Arms */}
    <line x1="6" y1="24" x2="9" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="23" y1="24" x2="26" y2="24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function DiscordMascot() {
  const [visible, setVisible] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [discordLink, setDiscordLink] = useState('https://discord.gg/CqX8YVFrCP');
  const { t } = useI18n();

  useEffect(() => {
    // Fetch dynamic discord link
    supabase
      .from('admin_settings')
      .select('value')
      .eq('key', 'social_discord')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setDiscordLink(data.value);
      });

    // Only show ~30% of the time
    const shouldShow = Math.random() < 0.3;
    if (shouldShow) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="absolute left-6 top-full mt-1 z-50">
      <AnimatePresence>
        {!showBubble ? (
          <motion.button
            key="mascot"
            initial={{ y: -10, opacity: 0, scale: 0.5 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={() => setShowBubble(true)}
            className="text-primary hover:scale-110 transition-transform cursor-pointer"
            aria-label="Discord reminder"
          >
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
              <MascotIcon size={28} />
            </motion.div>
          </motion.button>
        ) : (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, scale: 0.8, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-start gap-2 rounded-xl border border-border/30 bg-card/90 backdrop-blur-xl p-3 shadow-xl max-w-[240px]"
          >
            <MascotIcon size={24} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground font-medium leading-snug">
                {t('mascot.message')}
              </p>
              <a
                href={discordLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline font-semibold mt-1 inline-block"
              >
                {discordLink.replace('https://', '')}
              </a>
            </div>
            <button
              onClick={() => setVisible(false)}
              className="text-muted-foreground/50 hover:text-foreground transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
