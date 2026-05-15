export interface ParsedCoordinate {
  x: number;
  y: number;
  z?: number;
}

export interface QuickLocation extends ParsedCoordinate {
  label: string;
}

export type SketchfabScenePosition = [number, number, number];
export type SketchfabWorldPosition = [number, number, number];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const interpolate = (value: number, inMin: number, inMax: number, outMin: number, outMax: number) => {
  const progress = (value - inMin) / (inMax - inMin);
  return outMin + progress * (outMax - outMin);
};

const GTA_MAP_REFERENCE = {
  centerX: 117.3,
  centerY: 172.8,
  scaleX: 0.02072,
  scaleY: 0.0205,
  tileSize: 256,
};

const SKETCHFAB_MAP_REFERENCE = {
  // Model X at px=0% (west edge) and px=100% (east edge)
  westX: 10,
  eastX: -10,
  // Model Z at py=0% (north edge) and py=100% (south edge)
  northZ: 12.5,
  southZ: -3,
  baseY: 0.18,
  heightScale: 0.0008,
  maxSourceHeight: 1000,
};

export const worldToMapPercent = (x: number, y: number) => {
  const tileX = GTA_MAP_REFERENCE.scaleX * x + GTA_MAP_REFERENCE.centerX;
  const tileY = GTA_MAP_REFERENCE.centerY - GTA_MAP_REFERENCE.scaleY * y;

  return {
    px: clamp((tileX / GTA_MAP_REFERENCE.tileSize) * 100, 0, 100),
    py: clamp((tileY / GTA_MAP_REFERENCE.tileSize) * 100, 0, 100),
  };
};

export const mapPercentToWorld = (px: number, py: number) => {
  const tileX = (clamp(px, 0, 100) / 100) * GTA_MAP_REFERENCE.tileSize;
  const tileY = (clamp(py, 0, 100) / 100) * GTA_MAP_REFERENCE.tileSize;

  return {
    x: Math.round((tileX - GTA_MAP_REFERENCE.centerX) / GTA_MAP_REFERENCE.scaleX),
    y: Math.round((GTA_MAP_REFERENCE.centerY - tileY) / GTA_MAP_REFERENCE.scaleY),
  };
};

export const worldToSketchfabScenePosition = (x: number, y: number, z = 0): SketchfabScenePosition => {
  const { px, py } = worldToMapPercent(x, y);
  const clampedHeight = clamp(Math.abs(z), 0, SKETCHFAB_MAP_REFERENCE.maxSourceHeight);

  return [
    interpolate(px, 0, 100, SKETCHFAB_MAP_REFERENCE.westX, SKETCHFAB_MAP_REFERENCE.eastX),
    SKETCHFAB_MAP_REFERENCE.baseY + clampedHeight * SKETCHFAB_MAP_REFERENCE.heightScale,
    interpolate(py, 0, 100, SKETCHFAB_MAP_REFERENCE.northZ, SKETCHFAB_MAP_REFERENCE.southZ),
  ];
};

export const sceneToSketchfabWorldPosition = ([x, y, z]: SketchfabScenePosition): SketchfabWorldPosition => [x, -y, -z];

export const worldToSketchfabWorldPosition = (x: number, y: number, z = 0): SketchfabWorldPosition =>
  sceneToSketchfabWorldPosition(worldToSketchfabScenePosition(x, y, z));

export const parseCoordinateString = (input: string): ParsedCoordinate | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const vectorMatch = trimmed.match(/vector[34]?\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*(?:,\s*([-\d.]+))?\s*\)/i);
  if (vectorMatch) {
    const x = parseFloat(vectorMatch[1]);
    const y = parseFloat(vectorMatch[2]);
    const z = vectorMatch[3] ? parseFloat(vectorMatch[3]) : undefined;

    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      return { x, y, z };
    }
  }

  const labeledMatch = trimmed.match(/x\s*[:=]\s*([-\d.]+)\s*[,\s]+y\s*[:=]\s*([-\d.]+)(?:\s*[,\s]+z\s*[:=]\s*([-\d.]+))?/i);
  if (labeledMatch) {
    const x = parseFloat(labeledMatch[1]);
    const y = parseFloat(labeledMatch[2]);
    const z = labeledMatch[3] ? parseFloat(labeledMatch[3]) : undefined;

    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      return { x, y, z };
    }
  }

  const numbers = trimmed
    .split(/[,\s/;]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(Number);

  if (numbers.length >= 2 && !Number.isNaN(numbers[0]) && !Number.isNaN(numbers[1])) {
    return {
      x: numbers[0],
      y: numbers[1],
      z: numbers.length >= 3 && !Number.isNaN(numbers[2]) ? numbers[2] : undefined,
    };
  }

  return null;
};

export const QUICK_LOCATIONS: QuickLocation[] = [
  { label: "LS Airport", x: -1037, y: -2737, z: 20 },
  { label: "Sandy Shores", x: 1839, y: 3672, z: 34 },
  { label: "Paleto Bay", x: -226, y: 6327, z: 32 },
  { label: "Vinewood Sign", x: 687, y: 1191, z: 345 },
  { label: "Legion Square", x: 195, y: -934, z: 30 },
  { label: "Maze Bank Tower", x: -75, y: -818, z: 326 },
  { label: "Fort Zancudo", x: -2047, y: 3132, z: 32 },
  { label: "Mount Chiliad", x: 501, y: 5604, z: 796 },
];
