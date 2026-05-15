import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface NotificationSetting {
  id: string;
  server_code: string;
  server_name: string | null;
  notify_online: boolean;
  notify_player_threshold: boolean;
  player_threshold: number;
}

export const useNotifications = () => {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    // Check notification permission
    if ('Notification' in window) {
      setPermissionGranted(Notification.permission === 'granted');
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      toast.error("Your browser doesn't support notifications");
      return false;
    }

    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setPermissionGranted(granted);
    
    if (granted) {
      toast.success("Notifications enabled!");
    }
    return granted;
  };

  const fetchSettings = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        setSettings([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSettings(data || []);
    } catch (err) {
      console.error("Error fetching notification settings:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const addNotification = async (
    serverCode: string, 
    serverName: string | null,
    options?: { notifyOnline?: boolean; notifyThreshold?: boolean; threshold?: number }
  ) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast.error("Please log in to set notifications");
        return false;
      }

      const { error } = await supabase.from('notification_settings').upsert({
        user_id: session.session.user.id,
        server_code: serverCode,
        server_name: serverName,
        notify_online: options?.notifyOnline ?? true,
        notify_player_threshold: options?.notifyThreshold ?? false,
        player_threshold: options?.threshold ?? 50,
      }, { onConflict: 'user_id,server_code' });

      if (error) throw error;

      toast.success("Notification settings saved");
      await fetchSettings();
      return true;
    } catch (err) {
      console.error("Error saving notification:", err);
      toast.error("Failed to save notification settings");
      return false;
    }
  };

  const removeNotification = async (serverCode: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return false;

      const { error } = await supabase
        .from('notification_settings')
        .delete()
        .eq('server_code', serverCode)
        .eq('user_id', session.session.user.id);

      if (error) throw error;

      toast.success("Notification removed");
      await fetchSettings();
      return true;
    } catch (err) {
      console.error("Error removing notification:", err);
      toast.error("Failed to remove notification");
      return false;
    }
  };

  const hasNotification = (serverCode: string) => {
    return settings.some(s => s.server_code === serverCode);
  };

  const getNotificationSettings = (serverCode: string) => {
    return settings.find(s => s.server_code === serverCode);
  };

  const showNotification = useCallback((title: string, body: string, icon?: string) => {
    if (permissionGranted && 'Notification' in window) {
      new Notification(title, { body, icon });
    }
  }, [permissionGranted]);

  return {
    settings,
    isLoading,
    permissionGranted,
    requestPermission,
    addNotification,
    removeNotification,
    hasNotification,
    getNotificationSettings,
    showNotification,
    refetch: fetchSettings,
  };
};
