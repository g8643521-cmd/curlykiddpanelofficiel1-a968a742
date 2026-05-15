// Anti-cheat detection based on server resources
export interface AntiCheatInfo {
  name: string;
  color: string;
  icon: string;
}

const ANTI_CHEAT_PATTERNS: Record<string, AntiCheatInfo> = {
  // Major anti-cheats
  'waveshield': { name: 'WaveShield', color: 'cyan', icon: '🌊' },
  'electron': { name: 'Electron', color: 'blue', icon: '⚡' },
  'fiveguard': { name: 'FiveGuard', color: 'magenta', icon: '⚔️' },
  // Other popular anti-cheats
  'anticheese': { name: 'AntiCheese', color: 'yellow', icon: '🧀' },
  'anticheat': { name: 'Anti-Cheat', color: 'green', icon: '🛡️' },
  'badger_anticheat': { name: 'Badger AC', color: 'purple', icon: '🦡' },
  'bac': { name: 'Badger AC', color: 'purple', icon: '🦡' },
  'qs-anticheat': { name: 'QS Anti-Cheat', color: 'cyan', icon: '🔒' },
  'qb-anticheat': { name: 'QB Anti-Cheat', color: 'cyan', icon: '🔒' },
  'esx_anticheat': { name: 'ESX Anti-Cheat', color: 'orange', icon: '🛡️' },
  'wraithac': { name: 'Wraith AC', color: 'red', icon: '👻' },
  'wraith': { name: 'Wraith AC', color: 'red', icon: '👻' },
  'fd_anticheat': { name: 'FD Anti-Cheat', color: 'blue', icon: '🔐' },
  'nac': { name: 'NAC', color: 'green', icon: '🛡️' },
  'pma-anticheat': { name: 'PMA AC', color: 'purple', icon: '🔒' },
  'verus': { name: 'Verus AC', color: 'cyan', icon: '✓' },
  'lynx': { name: 'Lynx AC', color: 'orange', icon: '🐱' },
  'anticheats': { name: 'Anti-Cheat', color: 'green', icon: '🛡️' },
  'av_anticheat': { name: 'AV Anti-Cheat', color: 'blue', icon: '🔒' },
  'op-anticheat': { name: 'OP Anti-Cheat', color: 'red', icon: '⚡' },
  'legendary-anticheat': { name: 'Legendary AC', color: 'yellow', icon: '👑' },
  'infinity-anticheat': { name: 'Infinity AC', color: 'purple', icon: '∞' },
  'sn-anticheat': { name: 'SN Anti-Cheat', color: 'cyan', icon: '🔐' },
  // Framework-specific
  'esx_antiweaponspawn': { name: 'ESX Anti-Spawn', color: 'orange', icon: '🔫' },
  'anti-combatlog': { name: 'Anti Combat Log', color: 'red', icon: '🚪' },
  'anticombatlog': { name: 'Anti Combat Log', color: 'red', icon: '🚪' },
};

export function detectAntiCheat(resources: string[]): AntiCheatInfo | null {
  if (!Array.isArray(resources)) return null;
  const lowerResources = resources.map(r => r.toLowerCase());
  
  for (const resource of lowerResources) {
    if (ANTI_CHEAT_PATTERNS[resource]) {
      return ANTI_CHEAT_PATTERNS[resource];
    }
    
    for (const [pattern, info] of Object.entries(ANTI_CHEAT_PATTERNS)) {
      if (resource.includes(pattern) || resource.includes('anticheat') || resource.includes('anti-cheat')) {
        return info;
      }
    }
  }
  
  return null;
}

export function detectAllAntiCheats(resources: string[]): AntiCheatInfo[] {
  if (!Array.isArray(resources)) return [];
  const detected: AntiCheatInfo[] = [];
  const seenNames = new Set<string>();
  const lowerResources = resources.map(r => r.toLowerCase());
  
  for (const resource of lowerResources) {
    // Check exact matches
    if (ANTI_CHEAT_PATTERNS[resource]) {
      const info = ANTI_CHEAT_PATTERNS[resource];
      if (!seenNames.has(info.name)) {
        detected.push(info);
        seenNames.add(info.name);
      }
      continue;
    }
    
    // Check partial matches
    for (const [pattern, info] of Object.entries(ANTI_CHEAT_PATTERNS)) {
      if (resource.includes(pattern) && !seenNames.has(info.name)) {
        detected.push(info);
        seenNames.add(info.name);
        break;
      }
    }
    
    // Generic anticheat keyword match
    if ((resource.includes('anticheat') || resource.includes('anti-cheat') || resource.includes('anti_cheat')) && !seenNames.has('Anti-Cheat')) {
      detected.push({ name: 'Anti-Cheat', color: 'green', icon: '🛡️' });
      seenNames.add('Anti-Cheat');
    }
  }
  
  return detected;
}
