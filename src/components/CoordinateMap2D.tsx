import { useRef, useCallback, useEffect, useState } from "react";
import satelliteMapImage from "@/assets/gta-v-satellite-map-v2.jpg";
import { mapPercentToWorld, worldToMapPercent } from "@/lib/gtaMap";

interface MapMarker {
  id: string;
  x: number;
  y: number;
  z?: number;
  label: string;
  tone: number;
}

interface CoordinateMap2DProps {
  markers: MapMarker[];
  selectedMarkerId?: string | null;
  onMapClick?: (x: number, y: number) => void;
  onMouseCoordsChange?: (coords: { x: number; y: number } | null) => void;
}

const TILE_SIZE = 256;
const MIN_TILE_ZOOM = 0;
const MAX_TILE_ZOOM = 5;
const TILE_BASE = "/map-tiles";

const TONE_COLORS = ["#2dd4bf", "#f59e0b", "#94a3b8"];

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

const CoordinateMap2D = ({ markers, selectedMarkerId, onMapClick, onMouseCoordsChange }: CoordinateMap2DProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseMapRef = useRef<HTMLImageElement | null>(null);
  const stateRef = useRef({ offsetX: 0, offsetY: 0, zoom: 1, dragging: false, startX: 0, startY: 0, movedPixels: 0 });
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const tilesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const tileSupportRef = useRef<"unknown" | "available" | "missing">("unknown");
  const rafRef = useRef<number | null>(null);
  const markerAnimRef = useRef<Map<string, number>>(new Map());
  const isHoveringRef = useRef(false);

  // Keep latest props in refs so draw never needs to be recreated
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const selectedMarkerIdRef = useRef(selectedMarkerId);
  selectedMarkerIdRef.current = selectedMarkerId;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onMouseCoordsChangeRef = useRef(onMouseCoordsChange);
  onMouseCoordsChangeRef.current = onMouseCoordsChange;

  const getBaseMap = useCallback((onLoad: () => void): HTMLImageElement => {
    let img = baseMapRef.current;
    if (!img) {
      img = new Image();
      img.src = satelliteMapImage;
      img.onload = onLoad;
      baseMapRef.current = img;
    }
    return img;
  }, []);

  const getTile = useCallback((key: string, url: string, onLoad: () => void): HTMLImageElement => {
    let img = tilesRef.current.get(key);
    if (!img) {
      img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => {
        tileSupportRef.current = "available";
        onLoad();
      };
      img.onerror = () => {
        if (tileSupportRef.current !== "available") {
          tileSupportRef.current = "missing";
        }
        onLoad();
      };
      tilesRef.current.set(key, img);
    }
    return img;
  }, []);

  // Stable draw function — reads everything from refs
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const s = stateRef.current;
    const totalMapPx = TILE_SIZE * s.zoom;

    ctx.fillStyle = "#0a0e17";
    ctx.fillRect(0, 0, width, height);

    const baseMap = getBaseMap(() => scheduleDraw());
    if (baseMap.complete && baseMap.naturalWidth > 0) {
      ctx.drawImage(baseMap, s.offsetX, s.offsetY, totalMapPx, totalMapPx);
    }

    const idealZ = Math.log2(Math.max(1, s.zoom));
    const tileZoom = Math.min(MAX_TILE_ZOOM, Math.max(MIN_TILE_ZOOM, Math.round(idealZ)));
    const tilesPerAxis = Math.pow(2, tileZoom);
    const tileScreenSize = totalMapPx / tilesPerAxis;

    if (tileSupportRef.current !== "missing") {
      const startTileX = Math.max(0, Math.floor(-s.offsetX / tileScreenSize));
      const startTileY = Math.max(0, Math.floor(-s.offsetY / tileScreenSize));
      const endTileX = Math.min(tilesPerAxis - 1, Math.floor((width - s.offsetX) / tileScreenSize));
      const endTileY = Math.min(tilesPerAxis - 1, Math.floor((height - s.offsetY) / tileScreenSize));

      for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
          const drawX = tx * tileScreenSize + s.offsetX;
          const drawY = ty * tileScreenSize + s.offsetY;
          const key = `${tileZoom}_${tx}_${ty}`;
          const url = `${TILE_BASE}/${tileZoom}/${tx}_${ty}.jpg`;
          const img = getTile(key, url, () => scheduleDraw());

          if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, drawX, drawY, tileScreenSize + 0.5, tileScreenSize + 0.5);
          } else {
            for (let fz = tileZoom - 1; fz >= MIN_TILE_ZOOM; fz--) {
              const fTilesPerAxis = Math.pow(2, fz);
              const ftx = Math.floor(tx * fTilesPerAxis / tilesPerAxis);
              const fty = Math.floor(ty * fTilesPerAxis / tilesPerAxis);
              const fKey = `${fz}_${ftx}_${fty}`;
              const fImg = tilesRef.current.get(fKey);
              if (fImg?.complete && fImg.naturalWidth > 0) {
                const srcX = ((tx / tilesPerAxis) - (ftx / fTilesPerAxis)) * fTilesPerAxis * TILE_SIZE;
                const srcY = ((ty / tilesPerAxis) - (fty / fTilesPerAxis)) * fTilesPerAxis * TILE_SIZE;
                const srcSize = TILE_SIZE * (fTilesPerAxis / tilesPerAxis);
                ctx.drawImage(fImg, srcX, srcY, srcSize, srcSize, drawX, drawY, tileScreenSize + 0.5, tileScreenSize + 0.5);
                break;
              }
            }
          }
        }
      }
    }

    // Draw markers with animation
    const currentMarkers = markersRef.current;
    const currentSelectedId = selectedMarkerIdRef.current;
    const now = Date.now();
    let needsAnotherFrame = false;

    currentMarkers.forEach((marker) => {
      const { px, py } = worldToMapPercent(marker.x, marker.y);
      const screenX = (px / 100) * totalMapPx + s.offsetX;
      const screenY = (py / 100) * totalMapPx + s.offsetY;

      if (screenX < -80 || screenX > width + 80 || screenY < -80 || screenY > height + 80) return;

      const color = TONE_COLORS[marker.tone % TONE_COLORS.length];
      const isSelected = marker.id === currentSelectedId;

      let animT = markerAnimRef.current.get(marker.id);
      if (animT === undefined) {
        markerAnimRef.current.set(marker.id, now);
        animT = now;
      }
      const elapsed = Math.min((now - animT) / 300, 1);
      const scale = elapsed < 1 ? 0.3 + 0.7 * easeOutBack(elapsed) : 1;
      const alpha = Math.min(elapsed / 0.3, 1);
      if (elapsed < 1) needsAnotherFrame = true;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(screenX, screenY);
      ctx.scale(scale, scale);

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(0, -14, 18, 0, Math.PI * 2);
        ctx.fillStyle = color + "30";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, -14, isSelected ? 11 : 9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, -14, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();

      ctx.restore();

      const label = marker.label;
      const coords = `X: ${marker.x}, Y: ${marker.y}${marker.z !== undefined ? `, Z: ${marker.z}` : ""}`;
      ctx.font = "bold 11px Inter, system-ui, sans-serif";
      const labelW = Math.max(ctx.measureText(label).width, ctx.measureText(coords).width) + 16;
      const labelX = screenX + 16;
      const labelY = screenY - 32;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isSelected ? "rgba(15, 23, 42, 0.96)" : "rgba(15, 23, 42, 0.92)";
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, labelW, 34, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(label, labelX + 8, labelY + 14);
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(coords, labelX + 8, labelY + 27);
      ctx.restore();
    });

    if (needsAnotherFrame) scheduleDraw();

    // Crosshair on hover
    if (mouseRef.current && isHoveringRef.current) {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      ctx.save();
      ctx.strokeStyle = "rgba(45, 212, 191, 0.5)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);

      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, my);
      ctx.lineTo(width, my);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(45, 212, 191, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
    }
  }, [getBaseMap, getTile]); // Stable — only depends on cached image loaders

  const scheduleDraw = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  // Initial centering
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    stateRef.current.zoom = Math.max(width, height) / TILE_SIZE;
    const totalMap = TILE_SIZE * stateRef.current.zoom;
    stateRef.current.offsetX = (width - totalMap) / 2;
    stateRef.current.offsetY = (height - totalMap) / 2;
    scheduleDraw();
  }, [scheduleDraw]);

  // Redraw when markers/selection change
  useEffect(() => { scheduleDraw(); }, [markers, selectedMarkerId, scheduleDraw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => scheduleDraw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [scheduleDraw]);

  // All mouse/wheel handlers — stable, never re-attached
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let pressedOnMap = false;
    const onMouseDown = (e: MouseEvent) => {
      pressedOnMap = true;
      stateRef.current.dragging = true;
      stateRef.current.startX = e.clientX;
      stateRef.current.startY = e.clientY;
      stateRef.current.movedPixels = 0;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      mouseRef.current = { x: mx, y: my };

      if (onMouseCoordsChangeRef.current) {
        const s = stateRef.current;
        const totalMap = TILE_SIZE * s.zoom;
        const px = ((mx - s.offsetX) / totalMap) * 100;
        const py = ((my - s.offsetY) / totalMap) * 100;
        if (px >= 0 && px <= 100 && py >= 0 && py <= 100) {
          const { x, y } = mapPercentToWorld(px, py);
          onMouseCoordsChangeRef.current({ x, y });
        } else {
          onMouseCoordsChangeRef.current(null);
        }
      }

      if (!stateRef.current.dragging) {
        scheduleDraw();
        return;
      }
      const dx = e.clientX - stateRef.current.startX;
      const dy = e.clientY - stateRef.current.startY;
      stateRef.current.offsetX += dx;
      stateRef.current.offsetY += dy;
      stateRef.current.movedPixels += Math.abs(dx) + Math.abs(dy);
      stateRef.current.startX = e.clientX;
      stateRef.current.startY = e.clientY;
      const totalMap = TILE_SIZE * stateRef.current.zoom;
      stateRef.current.offsetX = Math.min(0, Math.max(rect.width - totalMap, stateRef.current.offsetX));
      stateRef.current.offsetY = Math.min(0, Math.max(rect.height - totalMap, stateRef.current.offsetY));
      scheduleDraw();
    };

    const onMouseUp = (e: MouseEvent) => {
      const wasDrag = stateRef.current.movedPixels > 5;
      const hadPress = pressedOnMap;
      pressedOnMap = false;
      stateRef.current.dragging = false;

      if (hadPress && !wasDrag && onMapClickRef.current) {
        const rect = container.getBoundingClientRect();
        const s = stateRef.current;
        const totalMap = TILE_SIZE * s.zoom;
        const px = ((e.clientX - rect.left - s.offsetX) / totalMap) * 100;
        const py = ((e.clientY - rect.top - s.offsetY) / totalMap) * 100;
        if (px >= 0 && px <= 100 && py >= 0 && py <= 100) {
          const { x, y } = mapPercentToWorld(px, py);
          onMapClickRef.current(x, y);
        }
      }
    };

    const onMouseEnter = () => {
      isHoveringRef.current = true;
      scheduleDraw();
    };
    const onMouseLeave = () => {
      isHoveringRef.current = false;
      mouseRef.current = null;
      onMouseCoordsChangeRef.current?.(null);
      scheduleDraw();
    };

    const getMinZoom = () => {
      const rect = container.getBoundingClientRect();
      return Math.max(rect.width, rect.height) / TILE_SIZE;
    };

    const clampOffset = (s: typeof stateRef.current) => {
      const rect = container.getBoundingClientRect();
      const totalMap = TILE_SIZE * s.zoom;
      s.offsetX = Math.min(0, Math.max(rect.width - totalMap, s.offsetX));
      s.offsetY = Math.min(0, Math.max(rect.height - totalMap, s.offsetY));
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const s = stateRef.current;
      const oldZoom = s.zoom;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const minZoom = getMinZoom();
      s.zoom = Math.max(minZoom, Math.min(40, s.zoom * factor));
      s.offsetX = mouseX - (mouseX - s.offsetX) * (s.zoom / oldZoom);
      s.offsetY = mouseY - (mouseY - s.offsetY) * (s.zoom / oldZoom);
      clampOffset(s);
      // Draw immediately for responsiveness during rapid zoom
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        draw();
      });
    };

    container.addEventListener("mousedown", onMouseDown);
    container.addEventListener("mouseenter", onMouseEnter);
    container.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("mouseenter", onMouseEnter);
      container.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      container.removeEventListener("wheel", onWheel);
    };
  }, [scheduleDraw, draw]);

  return (
    <div ref={containerRef} className="relative w-full cursor-crosshair active:cursor-grabbing select-none" style={{ aspectRatio: "16 / 10" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-b-xl" />
    </div>
  );
};

export default CoordinateMap2D;
