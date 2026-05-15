// useSystemSettings is disabled — the system_settings table does not exist.
// Uses admin_settings as fallback or returns defaults.

import { useState, useCallback } from 'react';

export type VisibilityMode = 'all' | 'admin' | 'disabled';

export const useSystemSettings = () => {
  const [settings] = useState<Map<string, VisibilityMode>>(new Map());

  const getVisibility = (key: string): VisibilityMode => {
    return settings.get(key) ?? 'admin';
  };

  const getSetting = (key: string, defaultValue: boolean = false): boolean => {
    const visibility = settings.get(key);
    if (!visibility) return defaultValue;
    return visibility === 'all';
  };

  const updateSetting = async (_key: string, _value: VisibilityMode): Promise<boolean> => {
    return false;
  };

  return {
    settings,
    isLoading: false,
    getSetting,
    getVisibility,
    updateSetting,
    refetch: () => {},
  };
};
