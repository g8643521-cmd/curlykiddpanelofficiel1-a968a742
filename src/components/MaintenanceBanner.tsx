import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const MaintenanceBanner = () => {
  const { getSetting, isLoading } = useSystemSettings();
  const { isOwner } = useAdminStatus();
  const [dismissed, setDismissed] = useState(false);

  const isMaintenanceMode = getSetting('maintenance_mode', false);

  // Don't show if loading, not in maintenance mode, or dismissed by owner
  if (isLoading || !isMaintenanceMode || (isOwner && dismissed)) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-0 left-0 right-0 z-50 bg-[hsl(var(--yellow))] text-background"
      >
        <div className="container mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium text-center">
            <strong>Maintenance Mode:</strong> The site is currently undergoing maintenance. Some features may be unavailable.
          </p>
          {isOwner && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-background hover:bg-background/20 ml-2"
              onClick={() => setDismissed(true)}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MaintenanceBanner;
