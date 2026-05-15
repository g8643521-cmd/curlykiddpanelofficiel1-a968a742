import { useEffect } from 'react';
import { soundEffects } from '@/services/soundEffects';

/**
 * Plays the selected click sound whenever a button, link, or interactive element is clicked.
 */
export function useGlobalClickSound() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!soundEffects.isEnabled()) return;
      const target = e.target as HTMLElement;
      const interactive = target.closest('button, a, [role="button"], [role="tab"], [role="menuitem"], input[type="checkbox"], input[type="radio"], [data-click-sound]');
      if (interactive) {
        soundEffects.playClick();
      }
    };

    document.addEventListener('click', handler, { capture: true });
    return () => document.removeEventListener('click', handler, { capture: true });
  }, []);
}
