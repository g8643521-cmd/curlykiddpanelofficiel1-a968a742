import { useState } from "react";
import { 
  GitCompare, 
  Plus, 
  X, 
  Users, 
  Server, 
  Shield, 
  Settings,
  Globe,
  Gamepad2,
  Crown,
  Search,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ServerData } from "@/hooks/useCfxApi";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface ServerComparisonProps {
  onClose: () => void;
}

const ServerComparison = ({ onClose }: ServerComparisonProps) => {
  const [servers, setServers] = useState<(ServerData | null)[]>([null, null]);
  const [searchInputs, setSearchInputs] = useState<string[]>(["", ""]);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  const extractServerCode = (input: string): string => {
    const fullUrlMatch = input.match(/cfx\.re\/join\/([a-zA-Z0-9]+)/);
    if (fullUrlMatch) return fullUrlMatch[1];
    const shortUrlMatch = input.match(/join\/([a-zA-Z0-9]+)/);
    if (shortUrlMatch) return shortUrlMatch[1];
    return input.replace(/[^a-zA-Z0-9]/g, '');
  };

  const fetchServer = async (index: number) => {
    const query = searchInputs[index];
    if (!query) return;

    const serverCode = extractServerCode(query);
    if (!serverCode || serverCode.length < 2) {
      toast.error("Invalid server code");
      return;
    }

    setLoadingIndex(index);
    try {
      const { data, error } = await supabase.functions.invoke('cfx-lookup', {
        body: { serverCode, skipWebhook: true }
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      const newServers = [...servers];
      newServers[index] = data;
      setServers(newServers);
      toast.success(`Loaded ${stripColorCodes(data.hostname)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch server");
    } finally {
      setLoadingIndex(null);
    }
  };

  const removeServer = (index: number) => {
    const newServers = [...servers];
    newServers[index] = null;
    setServers(newServers);
    const newInputs = [...searchInputs];
    newInputs[index] = "";
    setSearchInputs(newInputs);
  };

  const addSlot = () => {
    if (servers.length < 4) {
      setServers([...servers, null]);
      setSearchInputs([...searchInputs, ""]);
    }
  };

  const stripColorCodes = (str: string) => {
    return str.replace(/\^[0-9]/g, '').replace(/~[a-zA-Z]~/g, '').replace(/\[.*?\]/g, '');
  };

  const loadedServers = servers.filter(s => s !== null) as ServerData[];
  const maxPlayers = loadedServers.length > 0 ? Math.max(...loadedServers.map(s => s.players.length)) : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full max-w-7xl mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div 
        className="glass-card p-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              className="icon-badge-purple"
              animate={{ 
                rotate: [0, 5, -5, 0],
                boxShadow: [
                  "0 0 0px hsl(var(--purple) / 0)",
                  "0 0 15px hsl(var(--purple) / 0.3)",
                  "0 0 0px hsl(var(--purple) / 0)",
                ]
              }}
              transition={{ 
                rotate: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                boxShadow: { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }}
            >
              <GitCompare className="w-6 h-6" />
            </motion.div>
            <div>
              <motion.h2 
                className="font-display text-xl md:text-2xl font-bold text-foreground"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                Server Comparison
              </motion.h2>
              <motion.p 
                className="text-muted-foreground text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Compare up to 4 servers side by side
              </motion.p>
            </div>
          </div>
          <motion.div
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Server Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {servers.map((server, index) => (
            <motion.div 
              key={index} 
              className="glass-card p-4"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ delay: index * 0.1, type: "spring", stiffness: 150 }}
              whileHover={{ boxShadow: "0 0 20px hsl(var(--primary) / 0.1)" }}
            >
              {server ? (
                <motion.div 
                  className="space-y-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <motion.p 
                        className="font-medium text-foreground truncate text-sm"
                        initial={{ x: -10 }}
                        animate={{ x: 0 }}
                      >
                        {stripColorCodes(server.hostname)}
                      </motion.p>
                      <motion.p 
                        className="text-xs text-muted-foreground font-mono"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        {server.ip}:{server.port}
                      </motion.p>
                    </div>
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 90 }}
                      whileTap={{ scale: 0.8 }}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => removeServer(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Server {index + 1}</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code..."
                      value={searchInputs[index]}
                      onChange={(e) => {
                        const newInputs = [...searchInputs];
                        newInputs[index] = e.target.value;
                        setSearchInputs(newInputs);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && fetchServer(index)}
                      className="text-sm"
                    />
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        size="icon"
                        onClick={() => fetchServer(index)}
                        disabled={loadingIndex === index}
                      >
                        {loadingIndex === index ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <Loader2 className="w-4 h-4" />
                          </motion.div>
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                      </Button>
                    </motion.div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {servers.length < 4 && (
          <motion.button
            onClick={addSlot}
            className="glass-card p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors min-h-[88px]"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02, boxShadow: "0 0 20px hsl(var(--primary) / 0.1)" }}
            whileTap={{ scale: 0.98 }}
          >
            <motion.div
              animate={{ rotate: [0, 90, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Plus className="w-5 h-5" />
            </motion.div>
            <span>Add Server</span>
          </motion.button>
        )}
      </div>

      {/* Comparison Table */}
      <AnimatePresence>
        {loadedServers.length >= 2 && (
          <motion.div 
            className="glass-card p-6 overflow-x-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 100 }}
          >
            <motion.h3 
              className="font-display text-lg font-semibold text-foreground mb-6"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
            >
              Comparison Results
            </motion.h3>
            
            <div className="min-w-[600px]">
              {/* Server Names */}
              <motion.div 
                className="grid gap-4 mb-6" 
                style={{ gridTemplateColumns: `200px repeat(${loadedServers.length}, 1fr)` }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="text-muted-foreground text-sm font-medium">Server</div>
                {loadedServers.map((server, idx) => (
                  <motion.div 
                    key={idx} 
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1 }}
                  >
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    >
                      <Server className="w-4 h-4 text-primary shrink-0" />
                    </motion.div>
                    <span className="font-medium text-foreground truncate text-sm">
                      {stripColorCodes(server.hostname)}
                    </span>
                  </motion.div>
                ))}
              </motion.div>

              {/* Players */}
              <motion.div 
                className="grid gap-4 mb-4 items-center" 
                style={{ gridTemplateColumns: `200px repeat(${loadedServers.length}, 1fr)` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="w-4 h-4" />
                  Players Online
                </div>
                {loadedServers.map((server, idx) => (
                  <motion.div 
                    key={idx} 
                    className="space-y-1"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4 + idx * 0.1 }}
                  >
                    <div className="flex items-center gap-2">
                      <motion.span 
                        className={`font-semibold ${server.players.length === maxPlayers && maxPlayers > 0 ? 'text-green' : 'text-foreground'}`}
                        animate={server.players.length === maxPlayers && maxPlayers > 0 ? {
                          textShadow: [
                            "0 0 0px hsl(var(--green) / 0)",
                            "0 0 10px hsl(var(--green) / 0.5)",
                            "0 0 0px hsl(var(--green) / 0)",
                          ]
                        } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        {server.players.length}
                      </motion.span>
                      <span className="text-muted-foreground text-sm">/ {server.maxPlayers}</span>
                    </div>
                    <Progress value={(server.players.length / server.maxPlayers) * 100} className="h-1.5" />
                  </motion.div>
                ))}
              </motion.div>

              {/* Max Players */}
              <motion.div 
                className="grid gap-4 mb-4 items-center" 
                style={{ gridTemplateColumns: `200px repeat(${loadedServers.length}, 1fr)` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Users className="w-4 h-4" />
                  Max Capacity
                </div>
                {loadedServers.map((server, idx) => (
                  <motion.span 
                    key={idx} 
                    className="font-medium text-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + idx * 0.05 }}
                  >
                    {server.maxPlayers}
                  </motion.span>
                ))}
              </motion.div>

              {/* OneSync */}
              <motion.div 
                className="grid gap-4 mb-4 items-center" 
                style={{ gridTemplateColumns: `200px repeat(${loadedServers.length}, 1fr)` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Shield className="w-4 h-4" />
                  OneSync
                </div>
                {loadedServers.map((server, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ delay: 0.6 + idx * 0.05 }}
                  >
                    <Badge variant={server.onesyncEnabled ? "default" : "secondary"} className="w-fit">
                      {server.onesyncEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </motion.div>
                ))}
              </motion.div>

              {/* Game Build */}
              <motion.div 
                className="grid gap-4 mb-4 items-center" 
                style={{ gridTemplateColumns: `200px repeat(${loadedServers.length}, 1fr)` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Settings className="w-4 h-4" />
                  Game Build
                </div>
                {loadedServers.map((server, idx) => (
                  <motion.span 
                    key={idx} 
                    className="font-medium text-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 + idx * 0.05 }}
                  >
                    {server.enforceGameBuild || "Default"}
                  </motion.span>
                ))}
              </motion.div>

              {/* Locale */}
              <motion.div 
                className="grid gap-4 mb-4 items-center" 
                style={{ gridTemplateColumns: `200px repeat(${loadedServers.length}, 1fr)` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Globe className="w-4 h-4" />
                  Locale
                </div>
                {loadedServers.map((server, idx) => (
                  <motion.span 
                    key={idx} 
                    className="font-medium text-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 + idx * 0.05 }}
                  >
                    {server.locale || "en"}
                  </motion.span>
                ))}
              </motion.div>

              {/* Game Type */}
              <motion.div 
                className="grid gap-4 mb-4 items-center" 
                style={{ gridTemplateColumns: `200px repeat(${loadedServers.length}, 1fr)` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Gamepad2 className="w-4 h-4" />
                  Game Type
                </div>
                {loadedServers.map((server, idx) => (
                  <motion.span 
                    key={idx} 
                    className="font-medium text-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 + idx * 0.05 }}
                  >
                    {server.gametype || "FiveM"}
                  </motion.span>
                ))}
              </motion.div>

              {/* Premium */}
              <motion.div 
                className="grid gap-4 mb-4 items-center" 
                style={{ gridTemplateColumns: `200px repeat(${loadedServers.length}, 1fr)` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Crown className="w-4 h-4" />
                  Premium Tier
                </div>
                {loadedServers.map((server, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ delay: 1.0 + idx * 0.05 }}
                  >
                    <Badge variant="secondary" className="w-fit capitalize">
                      {server.premiumTier || "None"}
                    </Badge>
                  </motion.div>
                ))}
              </motion.div>

              {/* Resources */}
              <motion.div 
                className="grid gap-4 mb-4 items-center" 
                style={{ gridTemplateColumns: `200px repeat(${loadedServers.length}, 1fr)` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Server className="w-4 h-4" />
                  Resources
                </div>
                {loadedServers.map((server, idx) => (
                  <motion.span 
                    key={idx} 
                    className="font-medium text-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.1 + idx * 0.05 }}
                  >
                    {server.resources.length}
                  </motion.span>
                ))}
              </motion.div>

              {/* ScriptHook */}
              <motion.div 
                className="grid gap-4 items-center" 
                style={{ gridTemplateColumns: `200px repeat(${loadedServers.length}, 1fr)` }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
              >
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Shield className="w-4 h-4" />
                  ScriptHook
                </div>
                {loadedServers.map((server, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ delay: 1.2 + idx * 0.05 }}
                  >
                    <Badge variant={server.scriptHookAllowed ? "destructive" : "default"} className="w-fit">
                      {server.scriptHookAllowed ? "Allowed" : "Blocked"}
                    </Badge>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {loadedServers.length < 2 && (
          <motion.div 
            className="glass-card p-12 text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <motion.div
              animate={{ 
                rotate: [0, 5, -5, 0],
                y: [0, -5, 0]
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <GitCompare className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            </motion.div>
            <motion.p 
              className="text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Add at least 2 servers to compare
            </motion.p>
            <motion.p 
              className="text-sm text-muted-foreground mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Enter server codes above to get started
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ServerComparison;
