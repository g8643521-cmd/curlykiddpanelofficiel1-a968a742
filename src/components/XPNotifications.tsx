import { AnimatePresence, motion } from 'framer-motion';
import { Zap, Award, Sparkles, Target, CheckCircle2 } from 'lucide-react';
import { useGamificationStore } from '@/services/gamificationService';
import { cn } from '@/lib/utils';

const rarityColors: Record<string, { bg: string; border: string; text: string }> = {
  common: { bg: 'bg-muted', border: 'border-muted-foreground/30', text: 'text-muted-foreground' },
  rare: { bg: 'bg-[hsl(var(--cyan))]/20', border: 'border-[hsl(var(--cyan))]', text: 'text-[hsl(var(--cyan))]' },
  epic: { bg: 'bg-[hsl(var(--purple))]/20', border: 'border-[hsl(var(--purple))]', text: 'text-[hsl(var(--purple))]' },
  legendary: { bg: 'bg-[hsl(var(--yellow))]/20', border: 'border-[hsl(var(--yellow))]', text: 'text-[hsl(var(--yellow))]' },
};

const XPNotifications = () => {
  const { xpNotifications, badgeNotifications, challengeNotifications } = useGamificationStore();

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {/* Challenge Notifications */}
        {challengeNotifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="relative overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[hsl(var(--green))]/20 to-[hsl(var(--green))]/5 border-2 border-[hsl(var(--green))]/50 backdrop-blur-xl shadow-lg">
              <motion.div
                className="w-10 h-10 rounded-lg bg-[hsl(var(--green))]/20 flex items-center justify-center"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.3 }}
              >
                <CheckCircle2 className="w-5 h-5 text-[hsl(var(--green))]" />
              </motion.div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Challenge Complete!</p>
                <p className="font-display font-bold text-[hsl(var(--green))]">
                  {notification.name}
                </p>
                <p className="text-xs text-[hsl(var(--yellow))]">+{notification.xpReward} XP</p>
              </div>
            </div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 0.8, delay: 0.2 }}
            />
          </motion.div>
        ))}

        {/* XP Notifications */}
        {xpNotifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="relative overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-[hsl(var(--yellow))]/20 to-[hsl(var(--yellow))]/5 border border-[hsl(var(--yellow))]/50 backdrop-blur-xl shadow-lg">
              <div className="w-10 h-10 rounded-lg bg-[hsl(var(--yellow))]/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-[hsl(var(--yellow))]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-lg text-[hsl(var(--yellow))]">
                    +{notification.amount} XP
                  </span>
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 0.5, repeat: 2 }}
                  >
                    <Sparkles className="w-4 h-4 text-[hsl(var(--yellow))]" />
                  </motion.div>
                </div>
                <p className="text-xs text-muted-foreground">{notification.reason}</p>
              </div>
            </div>
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 0.8, delay: 0.2 }}
            />
          </motion.div>
        ))}

        {/* Badge Notifications */}
        {badgeNotifications.map((notification) => {
          const colors = rarityColors[notification.rarity] || rarityColors.common;
          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="relative overflow-hidden"
            >
              <div className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-xl shadow-lg border-2',
                colors.bg,
                colors.border
              )}>
                <motion.div
                  className={cn('w-12 h-12 rounded-xl flex items-center justify-center', colors.bg)}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                >
                  <Award className={cn('w-6 h-6', colors.text)} />
                </motion.div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Badge Unlocked!</p>
                  <p className={cn('font-display font-bold text-lg', colors.text)}>
                    {notification.name}
                  </p>
                  <p className="text-xs text-[hsl(var(--yellow))]">+{notification.xpReward} XP</p>
                </div>
              </div>
              {/* Shimmer effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1, delay: 0.3, repeat: 2 }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default XPNotifications;
