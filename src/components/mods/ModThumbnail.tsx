import { useMemo, useState } from 'react';
import { Package } from 'lucide-react';

function buildPlaceholder(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const hue2 = (hue + 40) % 360;
  const initials = name
    .replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '').join('') || 'M';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue}, 60%, 18%)"/>
        <stop offset="100%" stop-color="hsl(${hue2}, 55%, 9%)"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="hsl(${hue}, 80%, 55%)" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="hsl(${hue}, 80%, 55%)" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(${hue}, 30%, 70%)" stroke-opacity="0.05" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="640" height="400" fill="url(#g)"/>
    <rect width="640" height="400" fill="url(#grid)"/>
    <rect width="640" height="400" fill="url(#glow)"/>
    <text x="320" y="215" text-anchor="middle"
      font-family="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
      font-weight="700" font-size="140" letter-spacing="-4"
      fill="hsl(${hue}, 35%, 92%)" fill-opacity="0.95">${initials}</text>
    <text x="320" y="295" text-anchor="middle"
      font-family="ui-monospace, SFMono-Regular, Menlo, monospace"
      font-size="13" letter-spacing="6"
      fill="hsl(${hue}, 25%, 80%)" fill-opacity="0.55">PREVIEW UNAVAILABLE</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface Props {
  src?: string | null;
  name: string;
  className?: string;
  iconFallback?: boolean;
}

export function ModThumbnail({ src, name, className, iconFallback = false }: Props) {
  const [errored, setErrored] = useState(false);
  const placeholder = useMemo(() => buildPlaceholder(name || 'Mod'), [name]);
  const showFallback = !src || errored;

  if (showFallback && iconFallback) {
    return (
      <div className={`bg-muted flex items-center justify-center ${className ?? ''}`}>
        <Package className="w-6 h-6 text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <img
      src={showFallback ? placeholder : src!}
      alt={name}
      onError={() => setErrored(true)}
      loading="lazy"
      className={className}
    />
  );
}

export { buildPlaceholder as buildModPlaceholder };
