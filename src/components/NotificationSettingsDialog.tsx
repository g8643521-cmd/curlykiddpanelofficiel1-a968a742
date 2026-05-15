import { useState } from "react";
import { Bell, BellOff, Users, Power, Settings2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface NotificationSettingsDialogProps {
  serverCode: string;
  serverName: string;
  hasNotification: boolean;
  currentSettings?: {
    notify_online: boolean;
    notify_player_threshold: boolean;
    player_threshold: number;
  };
  permissionGranted: boolean;
  onRequestPermission: () => Promise<boolean>;
  onSave: (options: { notifyOnline: boolean; notifyThreshold: boolean; threshold: number }) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}

const NotificationSettingsDialog = ({
  serverCode,
  serverName,
  hasNotification,
  currentSettings,
  permissionGranted,
  onRequestPermission,
  onSave,
  onRemove,
}: NotificationSettingsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [notifyOnline, setNotifyOnline] = useState(currentSettings?.notify_online ?? true);
  const [notifyThreshold, setNotifyThreshold] = useState(currentSettings?.notify_player_threshold ?? false);
  const [threshold, setThreshold] = useState(currentSettings?.player_threshold ?? 50);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!permissionGranted) {
      const granted = await onRequestPermission();
      if (!granted) return;
    }

    setIsSaving(true);
    const success = await onSave({ notifyOnline, notifyThreshold, threshold });
    setIsSaving(false);
    if (success) setOpen(false);
  };

  const handleRemove = async () => {
    setIsSaving(true);
    const success = await onRemove();
    setIsSaving(false);
    if (success) setOpen(false);
  };

  const stripColorCodes = (str: string) => {
    return str.replace(/\^[0-9]/g, '').replace(/~[a-zA-Z]~/g, '').replace(/\[.*?\]/g, '');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={hasNotification ? "text-primary hover:text-primary" : "text-muted-foreground hover:text-primary"}
        >
          {hasNotification ? (
            <Bell className="w-5 h-5 fill-primary" />
          ) : (
            <BellOff className="w-5 h-5" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Notification Settings
          </DialogTitle>
          <DialogDescription>
            Get notified about {stripColorCodes(serverName)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!permissionGranted && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
            >
              <p className="text-sm text-yellow-500 mb-3">
                Enable browser notifications to receive alerts
              </p>
              <Button size="sm" onClick={onRequestPermission}>
                Enable Notifications
              </Button>
            </motion.div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green/20 flex items-center justify-center">
                <Power className="w-5 h-5 text-green" />
              </div>
              <div>
                <Label htmlFor="notify-online" className="text-foreground font-medium">
                  Server Online
                </Label>
                <p className="text-sm text-muted-foreground">
                  Notify when server comes online
                </p>
              </div>
            </div>
            <Switch
              id="notify-online"
              checked={notifyOnline}
              onCheckedChange={setNotifyOnline}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="notify-threshold" className="text-foreground font-medium">
                    Player Threshold
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when player count is reached
                  </p>
                </div>
              </div>
              <Switch
                id="notify-threshold"
                checked={notifyThreshold}
                onCheckedChange={setNotifyThreshold}
              />
            </div>

            {notifyThreshold && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="ml-13 pl-4 border-l-2 border-border"
              >
                <Label htmlFor="threshold" className="text-sm text-muted-foreground">
                  Notify when players reach:
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    id="threshold"
                    type="number"
                    min={1}
                    max={1000}
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value) || 50)}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">players</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          {hasNotification && (
            <Button variant="outline" onClick={handleRemove} disabled={isSaving}>
              Remove
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;
