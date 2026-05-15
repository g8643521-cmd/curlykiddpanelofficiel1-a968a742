import { useState, useMemo } from "react";
import { Shield, AlertTriangle, Package, Search, ChevronDown, ChevronUp, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface ResourceInfo {
  name: string;
  category: string;
  description: string;
  risk: "safe" | "warning" | "danger" | "unknown";
  version?: string;
}

const KNOWN_RESOURCES: Record<string, Omit<ResourceInfo, "name">> = {
  "es_extended": { category: "Framework", description: "ESX Framework — popular RP framework", risk: "safe" },
  "esx_identity": { category: "Framework", description: "ESX Identity module", risk: "safe" },
  "esx_skin": { category: "Framework", description: "ESX Skin selector", risk: "safe" },
  "esx_society": { category: "Framework", description: "ESX Society/jobs system", risk: "safe" },
  "esx_addonaccount": { category: "Framework", description: "ESX addon accounts", risk: "safe" },
  "esx_billing": { category: "Framework", description: "ESX billing system", risk: "safe" },
  "esx_policejob": { category: "Framework", description: "ESX police job", risk: "safe" },
  "esx_ambulancejob": { category: "Framework", description: "ESX ambulance job", risk: "safe" },
  "qb-core": { category: "Framework", description: "QBCore Framework — modern RP framework", risk: "safe" },
  "qb-multicharacter": { category: "Framework", description: "QBCore multi-character selector", risk: "safe" },
  "qb-inventory": { category: "Framework", description: "QBCore inventory system", risk: "safe" },
  "qb-policejob": { category: "Framework", description: "QBCore police job", risk: "safe" },
  "qb-ambulancejob": { category: "Framework", description: "QBCore ambulance job", risk: "safe" },
  "ox_lib": { category: "Library", description: "Overextended library — modern utility lib", risk: "safe" },
  "ox_inventory": { category: "Inventory", description: "Overextended inventory system", risk: "safe" },
  "ox_target": { category: "Interaction", description: "Overextended targeting system", risk: "safe" },
  "ox_doorlock": { category: "Utility", description: "Overextended door lock system", risk: "safe" },
  "mysql-async": { category: "Database", description: "MySQL async driver", risk: "safe" },
  "oxmysql": { category: "Database", description: "Overextended MySQL driver", risk: "safe" },
  "ghmattimysql": { category: "Database", description: "GHMattiMySQL driver", risk: "safe" },
  "txAdmin": { category: "Admin", description: "txAdmin server management panel", risk: "safe" },
  "monitor": { category: "Admin", description: "txAdmin monitor resource", risk: "safe" },
  "screenshot-basic": { category: "Utility", description: "Screenshot capture resource", risk: "safe" },
  "pma-voice": { category: "Voice", description: "pma-voice — VOIP system", risk: "safe" },
  "tokovoip_script": { category: "Voice", description: "TokoVOIP voice chat", risk: "safe" },
  "mumble-voip": { category: "Voice", description: "Mumble-based VOIP", risk: "safe" },
  "vMenu": { category: "Menu", description: "vMenu — server-side trainer/menu", risk: "warning" },
  "lambda-menu": { category: "Menu", description: "Lambda Menu — trainer menu", risk: "danger" },
  "mellotrainer": { category: "Menu", description: "Mello Trainer — cheat-capable menu", risk: "danger" },
  "badger_anticheat": { category: "Anti-Cheat", description: "Badger Anti-Cheat", risk: "safe" },
  "qs-anticheat": { category: "Anti-Cheat", description: "Quasar Anti-Cheat", risk: "safe" },
  "wraithac": { category: "Anti-Cheat", description: "Wraith Anti-Cheat", risk: "safe" },
  "fiveguard": { category: "Anti-Cheat", description: "FiveGuard Anti-Cheat", risk: "safe" },
  "esx_kashacter": { category: "Identity", description: "ESX character selection (legacy)", risk: "warning" },
  "esx_menu_default": { category: "UI", description: "ESX default menu (outdated)", risk: "warning" },
  "skinchanger": { category: "Character", description: "Skinchanger resource", risk: "safe" },
  "esx_vehicleshop": { category: "Economy", description: "ESX vehicle shop", risk: "safe" },
  "esx_jobs": { category: "Economy", description: "ESX jobs system", risk: "safe" },
  "dpemotes": { category: "Emotes", description: "DP Emotes — animation menu", risk: "safe" },
  "rpemotes": { category: "Emotes", description: "RP Emotes — animation menu", risk: "safe" },
  "interact-sound": { category: "Audio", description: "Interactive sound player", risk: "safe" },
  "bob74_ipl": { category: "Maps", description: "Bob74 IPL loader — interior props", risk: "safe" },
  "spawnmanager": { category: "Core", description: "FiveM spawn manager (default)", risk: "safe" },
  "sessionmanager": { category: "Core", description: "FiveM session manager (default)", risk: "safe" },
  "mapmanager": { category: "Core", description: "FiveM map manager (default)", risk: "safe" },
  "chat": { category: "Core", description: "FiveM default chat", risk: "safe" },
  "hardcap": { category: "Core", description: "Player hardcap limiter", risk: "safe" },
  "baseevents": { category: "Core", description: "Base game events", risk: "safe" },
};

const SECURITY_PATTERNS: { pattern: RegExp; label: string; risk: "warning" | "danger" }[] = [
  { pattern: /executor|inject|bypass|exploit/i, label: "Potential exploit tool", risk: "danger" },
  { pattern: /godmode|noclip|teleport/i, label: "Cheat-capable resource", risk: "danger" },
  { pattern: /trainer|cheat|hack/i, label: "Trainer/cheat resource", risk: "danger" },
  { pattern: /skid|leaked|crack/i, label: "Potentially leaked/cracked", risk: "danger" },
  { pattern: /webhook/i, label: "Contains webhook functionality", risk: "warning" },
  { pattern: /debug|dev_/i, label: "Debug/development resource", risk: "warning" },
];

interface Props {
  resources: string[];
}

const ResourceInspector = ({ resources }: Props) => {
  const { t } = useI18n();
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(false);

  const analyzed = useMemo(() => {
    return resources.map((name): ResourceInfo => {
      const lower = name.toLowerCase();
      const known = KNOWN_RESOURCES[lower] || KNOWN_RESOURCES[name];
      if (known) return { name, ...known };

      for (const { pattern, label, risk } of SECURITY_PATTERNS) {
        if (pattern.test(name)) return { name, category: "Flagged", description: label, risk };
      }

      if (lower.includes("anticheat") || lower.includes("anti-cheat")) {
        return { name, category: "Anti-Cheat", description: "Anti-cheat resource", risk: "safe" };
      }

      return { name, category: "Unknown", description: "Unrecognized resource", risk: "unknown" };
    });
  }, [resources]);

  const filtered = useMemo(() => {
    if (!filter) return analyzed;
    const q = filter.toLowerCase();
    return analyzed.filter(r => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [analyzed, filter]);

  const stats = useMemo(() => ({
    total: analyzed.length,
    safe: analyzed.filter(r => r.risk === "safe").length,
    warning: analyzed.filter(r => r.risk === "warning").length,
    danger: analyzed.filter(r => r.risk === "danger").length,
    unknown: analyzed.filter(r => r.risk === "unknown").length,
    known: analyzed.filter(r => r.risk !== "unknown").length,
  }), [analyzed]);

  const displayList = expanded ? filtered : filtered.slice(0, 20);

  const riskIcon = (risk: string) => {
    switch (risk) {
      case "safe": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "danger": return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Package className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const riskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      safe: "bg-green-500/20 text-green-400 border-green-500/30",
      warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      danger: "bg-red-500/20 text-red-400 border-red-500/30",
      unknown: "bg-muted text-muted-foreground border-border",
    };
    return <Badge variant="outline" className={colors[risk] || colors.unknown}>{risk}</Badge>;
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Resource Inspector
        </h3>
        <Badge variant="outline" className="text-muted-foreground">{stats.total} resources</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
          <div className="text-lg font-bold text-green-400">{stats.safe}</div>
          <div className="text-xs text-green-400/70">Safe</div>
        </div>
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 text-center">
          <div className="text-lg font-bold text-yellow-400">{stats.warning}</div>
          <div className="text-xs text-yellow-400/70">Warning</div>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
          <div className="text-lg font-bold text-red-400">{stats.danger}</div>
          <div className="text-xs text-red-400/70">Danger</div>
        </div>
        <div className="rounded-lg bg-muted/30 border border-border p-3 text-center">
          <div className="text-lg font-bold text-muted-foreground">{stats.unknown}</div>
          <div className="text-xs text-muted-foreground/70">Unknown</div>
        </div>
      </div>

      {/* Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Filter resources..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9 bg-background/50"
        />
      </div>

      {/* Resource list */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {displayList.map((res) => (
          <div key={res.name} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
            {riskIcon(res.risk)}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{res.name}</div>
              <div className="text-xs text-muted-foreground truncate">{res.description}</div>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">{res.category}</Badge>
            {riskBadge(res.risk)}
          </div>
        ))}
      </div>

      {filtered.length > 20 && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="w-full gap-2">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? "Show less" : `Show all ${filtered.length} resources`}
        </Button>
      )}
    </div>
  );
};

export default ResourceInspector;
