import { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { MapPin, Search, Crosshair, Trash2, Copy, Check, Sparkles, RotateCcw, Map, Box, Plane, Mountain, Building2, MapPinned, Edit2, Download, ChevronDown, MousePointer2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import AppHeader from "@/components/AppHeader";
import CoordinateMap2D from "@/components/CoordinateMap2D";
import CoordinateMapMarkersOverlay from "@/components/CoordinateMapMarkersOverlay";
const CosmicNebulaBackground = lazy(() => import('@/components/CosmicNebulaBackground'));
import { useI18n } from "@/lib/i18n";
import { QUICK_LOCATIONS, parseCoordinateString, worldToSketchfabWorldPosition } from "@/lib/gtaMap";

declare global {
  interface Window {
    Sketchfab?: any;
  }
}

interface MapMarker {
  id: string;
  x: number;
  y: number;
  z?: number;
  label: string;
  tone: number;
}

interface SketchfabNode {
  instanceID: number;
  name?: string;
  type?: string;
}

interface SketchfabApi {
  start: () => void;
  addEventListener: (event: string, callback: (...args: unknown[]) => void, options?: Record<string, unknown>) => void;
  setCameraLookAt: (position: [number, number, number], target: [number, number, number], duration?: number) => void;
  getNodeMap: (callback: (error: unknown, nodes?: Record<string, SketchfabNode>) => void) => void;
  rotate: (instanceID: number, rotation: [number, number, number, number], options: { duration?: number; easing?: string }, callback?: (error: unknown) => void) => void;
  getWorldToScreenCoordinates: (worldCoord: [number, number, number], callback: (coord: { glCoord?: number[]; canvasCoord?: number[] }) => void) => void;
}

interface ProjectedMarker extends MapMarker {
  details: string;
  screenX: number;
  screenY: number;
  visible: boolean;
}

const MARKER_TONES = [
  { dotClass: "bg-primary border-primary/40" },
  { dotClass: "bg-accent border-accent/40" },
  { dotClass: "bg-secondary border-secondary/40" },
];

const LOCATION_ICONS: Record<string, typeof Plane> = {
  "LS Airport": Plane,
  "Mount Chiliad": Mountain,
  "Maze Bank Tower": Building2,
  "Fort Zancudo": Navigation,
};

const SKETCHFAB_MODEL_ID = "61cc46fc244245dfa288d17643712949";
const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 0, -40];
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

const getTransformNodeId = (nodeMap: Record<string, SketchfabNode>) => {
  const nodes = Object.values(nodeMap);
  const rootLikeNode = nodes.find((node) => node.type === "MatrixTransform" && /root|scene|map/i.test(node.name ?? ""));
  return rootLikeNode?.instanceID ?? nodes.find((node) => node.type === "MatrixTransform")?.instanceID;
};

const CoordinateLookup = () => {
  const { t } = useI18n();
  const STORAGE_KEY = "coord_markers_v1";
  const [markers, setMarkers] = useState<MapMarker[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (m): m is MapMarker =>
          m && typeof m.id === "string" &&
          typeof m.x === "number" && typeof m.y === "number" &&
          typeof m.label === "string" && typeof m.tone === "number",
      );
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
    } catch {
      // quota or serialization issue — ignore
    }
  }, [markers]);

  const [inputX, setInputX] = useState("");
  const [inputY, setInputY] = useState("");
  const [inputZ, setInputZ] = useState("");
  const [inputLabel, setInputLabel] = useState("");
  const [combinedInput, setCombinedInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"2d" | "3d">("2d");
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [mouseCoords, setMouseCoords] = useState<{ x: number; y: number } | null>(null);
  const [addingState, setAddingState] = useState<"idle" | "adding" | "success">("idle");

  // 3D state
  const [viewerKey, setViewerKey] = useState(0);
  const viewerFrameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const apiRef = useRef<SketchfabApi | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [projectedMarkers, setProjectedMarkers] = useState<ProjectedMarker[]>([]);
  const projectionGenerationRef = useRef(0);
  const projectionInFlightRef = useRef(false);
  const projectionRafRef = useRef<number | null>(null);

  // Parse preview for smart input
  const parsedPreview = useMemo(() => {
    if (!combinedInput.trim()) return null;
    return parseCoordinateString(combinedInput);
  }, [combinedInput]);

  const isSmartInputValid = parsedPreview !== null;
  const isManualInputValid = !Number.isNaN(parseFloat(inputX)) && !Number.isNaN(parseFloat(inputY));

  const addMarkerFromCoords = useCallback((x: number, y: number, z?: number, label?: string) => {
    setAddingState("adding");
    setMarkers((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        x, y, z,
        label: label?.trim() || `Marker ${prev.length + 1}`,
        tone: prev.length % MARKER_TONES.length,
      },
    ]);
    setTimeout(() => {
      setAddingState("success");
      toast.success(`Marker placed at X: ${x}, Y: ${y}`);
      setTimeout(() => setAddingState("idle"), 1500);
    }, 200);
  }, []);

  const addMarkerManual = () => {
    const x = parseFloat(inputX);
    const y = parseFloat(inputY);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      toast.error(t("coord.invalid_xy"));
      return;
    }
    const z = inputZ ? parseFloat(inputZ) : undefined;
    addMarkerFromCoords(x, y, Number.isNaN(z) ? undefined : z, inputLabel);
    setInputX(""); setInputY(""); setInputZ(""); setInputLabel("");
  };

  const addMarkerCombined = () => {
    const parsed = parseCoordinateString(combinedInput);
    if (!parsed) { toast.error(t("coord.parse_error")); return; }
    addMarkerFromCoords(parsed.x, parsed.y, parsed.z);
    setCombinedInput("");
  };

  const removeMarker = (id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
    if (selectedMarkerId === id) setSelectedMarkerId(null);
  };

  const renameMarker = (id: string, newLabel: string) => {
    setMarkers((prev) => prev.map((m) => m.id === id ? { ...m, label: newLabel.trim() || m.label } : m));
    setEditingMarkerId(null);
  };

  const copyCoords = async (marker: MapMarker, format: string = "plain") => {
    let text: string;
    switch (format) {
      case "vector3":
        text = `vector3(${marker.x}, ${marker.y}, ${marker.z ?? 0})`;
        break;
      case "csv":
        text = `${marker.x}, ${marker.y}${marker.z !== undefined ? `, ${marker.z}` : ""}`;
        break;
      case "json":
        text = JSON.stringify({ x: marker.x, y: marker.y, ...(marker.z !== undefined ? { z: marker.z } : {}) });
        break;
      default:
        text = `X: ${marker.x}, Y: ${marker.y}${marker.z !== undefined ? `, Z: ${marker.z}` : ""}`;
    }
    await navigator.clipboard.writeText(text);
    setCopied(marker.id);
    toast.success("Copied to clipboard");
    window.setTimeout(() => setCopied(null), 1500);
  };

  // === 3D projection logic ===
  const projectMarkers = useCallback(() => {
    const api = apiRef.current;
    const viewerFrame = viewerFrameRef.current;
    if (!api || !viewerReady || !viewerFrame) return;
    if (markers.length === 0) { setProjectedMarkers([]); return; }

    projectionInFlightRef.current = true;
    const generation = ++projectionGenerationRef.current;
    const { width, height } = viewerFrame.getBoundingClientRect();
    const nextMarkers: globalThis.Map<string, ProjectedMarker> = new globalThis.Map();
    let completed = 0;

    markers.forEach((marker) => {
      api.getWorldToScreenCoordinates(worldToSketchfabWorldPosition(marker.x, marker.y, marker.z ?? 0), (coord) => {
        const screenX = coord.canvasCoord?.[0];
        const screenY = coord.canvasCoord?.[1];
        const hasValidPosition = Number.isFinite(screenX) && Number.isFinite(screenY);

        nextMarkers.set(marker.id, {
          ...marker,
          details: `X: ${marker.x}, Y: ${marker.y}${marker.z !== undefined ? `, Z: ${marker.z}` : ""}`,
          screenX: hasValidPosition ? screenX ?? 0 : -9999,
          screenY: hasValidPosition ? screenY ?? 0 : -9999,
          visible: hasValidPosition && (screenX ?? 0) >= -32 && (screenX ?? 0) <= width + 32 && (screenY ?? 0) >= -32 && (screenY ?? 0) <= height + 32,
        });
        completed += 1;
        if (completed !== markers.length) return;
        projectionInFlightRef.current = false;
        if (projectionGenerationRef.current !== generation) return;
        setProjectedMarkers(markers.map((m) => nextMarkers.get(m.id)).filter((m): m is ProjectedMarker => Boolean(m)));
      });
    });
  }, [markers, viewerReady]);

  // 3D viewer init
  useEffect(() => {
    if (mapMode !== "3d") return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    setViewerReady(false);
    setProjectedMarkers([]);
    apiRef.current = null;
    projectionGenerationRef.current += 1;
    projectionInFlightRef.current = false;

    const existingScript = document.querySelector('script[data-sketchfab-viewer="true"]') as HTMLScriptElement | null;
    let cancelled = false;

    const initializeViewer = () => {
      if (!iframeRef.current || !window.Sketchfab || cancelled) return;
      const client = new (window.Sketchfab as any)("1.12.1", iframeRef.current);
      client.init(SKETCHFAB_MODEL_ID, {
        autostart: 1, camera: 0, preload: 1, ui_theme: "dark", ui_infos: 0, ui_watermark: 0, ui_stop: 0,
        success: (api: SketchfabApi) => {
          if (cancelled) return;
          api.start();
          const finalizeViewer = () => { if (cancelled) return; apiRef.current = api; setViewerReady(true); };
          const setDefaultCamera = (callback?: () => void) => {
            window.setTimeout(() => { api.setCameraLookAt(DEFAULT_CAMERA_POSITION, DEFAULT_CAMERA_TARGET, 0); callback?.(); }, 100);
          };
          api.addEventListener("viewerready", () => {
            if (cancelled) return;
            api.getNodeMap((error, nodeMap = {}) => {
              if (error) { setDefaultCamera(finalizeViewer); return; }
              const transformNodeId = getTransformNodeId(nodeMap);
              if (typeof transformNodeId !== "number") { setDefaultCamera(finalizeViewer); return; }
              api.rotate(transformNodeId, [Math.PI, 1, 0, 0], { duration: 0 }, () => { setDefaultCamera(finalizeViewer); });
            });
          });
        },
      });
    };

    if (existingScript) { initializeViewer(); } else {
      const script = document.createElement("script");
      script.src = "https://static.sketchfab.com/api/sketchfab-viewer-1.12.1.js";
      script.async = true;
      script.dataset.sketchfabViewer = "true";
      script.onload = initializeViewer;
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      setViewerReady(false); setProjectedMarkers([]);
      projectionGenerationRef.current += 1;
      projectionInFlightRef.current = false;
      if (projectionRafRef.current !== null) { window.cancelAnimationFrame(projectionRafRef.current); projectionRafRef.current = null; }
      apiRef.current = null;
    };
  }, [viewerKey, mapMode]);

  // 3D projection loop
  useEffect(() => {
    if (mapMode !== "3d" || !viewerReady) { setProjectedMarkers([]); return; }
    projectMarkers();
    const handleResize = () => { projectionInFlightRef.current = false; projectMarkers(); };
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (!projectionInFlightRef.current) projectMarkers();
      projectionRafRef.current = window.requestAnimationFrame(tick);
    };
    window.addEventListener("resize", handleResize);
    projectionRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", handleResize);
      projectionInFlightRef.current = false;
      if (projectionRafRef.current !== null) { window.cancelAnimationFrame(projectionRafRef.current); projectionRafRef.current = null; }
    };
  }, [projectMarkers, viewerReady, mapMode]);

  const markerCount = markers.length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background relative">
        <Suspense fallback={<div className="fixed inset-0 -z-10" style={{ background: 'hsl(230, 25%, 4%)' }} />}>
          <CosmicNebulaBackground />
        </Suspense>
        <AppHeader />
        <div className="container mx-auto px-4 py-5 relative z-10 max-w-[1400px]">
          {/* Header — compact */}
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-[10px] bg-primary/10 border border-primary/15">
              <Crosshair className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-foreground tracking-tight leading-tight">{t("coord.title")}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Convert GTA V coordinates into precise map locations</p>
            </div>
            {markerCount > 0 && (
              <Badge variant="secondary" className="text-[10px] font-mono h-6 px-2 rounded-md bg-muted/60 border border-border/30">
                <MapPinned className="w-3 h-3 mr-1 text-primary" />
                {markerCount}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
            {/* Map Card */}
            <div className="rounded-xl overflow-hidden border border-border/30 bg-card/80 backdrop-blur-sm shadow-[0_8px_40px_-12px_hsl(0,0%,0%,0.6)]">
              {/* Map toolbar */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/20 bg-card/60">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-primary/80" />
                  <span className="text-xs font-medium text-foreground/80">
                    {mapMode === "2d" ? "Satellite" : "Terrain"} View
                  </span>
                  {mouseCoords && (
                    <span className="text-[10px] text-muted-foreground font-mono ml-1 bg-background/60 px-2 py-0.5 rounded-md border border-border/20">
                      {mouseCoords.x}, {mouseCoords.y}
                    </span>
                  )}
                </div>
                <div className="flex items-center bg-background/40 rounded-lg p-0.5 border border-border/20">
                  <button
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                      mapMode === "2d" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setMapMode("2d")}
                  >
                    <Map className="w-3 h-3" /> 2D
                  </button>
                  <button
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-200 ${
                      mapMode === "3d" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setMapMode("3d")}
                  >
                    <Box className="w-3 h-3" /> 3D
                  </button>
                </div>
              </div>
              {/* Map content */}
              <div className="relative">
                {mapMode === "2d" ? (
                  <CoordinateMap2D
                    markers={markers}
                    selectedMarkerId={selectedMarkerId}
                    onMapClick={(x, y) => addMarkerFromCoords(x, y, undefined)}
                    onMouseCoordsChange={setMouseCoords}
                  />
                ) : (
                  <div ref={viewerFrameRef} className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 10" }}>
                    <div className="absolute top-3 right-3 z-10">
                      <Button variant="secondary" size="sm" className="gap-1.5 h-7 text-[11px] rounded-lg" onClick={() => setViewerKey((v) => v + 1)}>
                        <RotateCcw className="w-3 h-3" /> Reset
                      </Button>
                    </div>
                    <CoordinateMapMarkersOverlay markers={projectedMarkers} />
                    <iframe
                      key={viewerKey}
                      ref={iframeRef}
                      title="GTA V 3D Map"
                      className="absolute inset-0 h-full w-full border-0"
                      allow="autoplay; fullscreen; xr-spatial-tracking"
                      allowFullScreen
                    />
                  </div>
                )}
                <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 text-[10px] text-muted-foreground/70 bg-background/70 backdrop-blur-sm px-2 py-1 rounded-md border border-border/15">
                  <MousePointer2 className="w-2.5 h-2.5" />
                  Click map to place marker
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-3">
              {/* Input Card */}
              <div className="rounded-xl border border-border/30 bg-card/80 backdrop-blur-sm overflow-hidden">
                <div className="p-3.5">
                  <Tabs defaultValue="smart" className="w-full">
                    <TabsList className="w-full mb-3 h-8 bg-background/40 border border-border/20 rounded-lg p-0.5">
                      <TabsTrigger value="smart" className="flex-1 gap-1 text-[11px] h-full rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Sparkles className="w-3 h-3" /> Smart
                      </TabsTrigger>
                      <TabsTrigger value="manual" className="flex-1 gap-1 text-[11px] h-full rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        <Search className="w-3 h-3" /> Manual
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="smart" className="space-y-2.5 mt-0">
                      <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{t("coord.smart_desc")}</p>
                      <div className="relative">
                        <Input
                          placeholder={t("coord.smart_placeholder")}
                          value={combinedInput}
                          onChange={(e) => setCombinedInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && isSmartInputValid && addMarkerCombined()}
                          className={`h-9 text-xs pr-8 rounded-lg bg-background/60 border transition-all duration-200 ${
                            combinedInput.trim()
                              ? isSmartInputValid
                                ? "border-primary/40 ring-1 ring-primary/15"
                                : "border-destructive/40 ring-1 ring-destructive/15"
                              : "border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/30"
                          }`}
                        />
                        {combinedInput.trim() && (
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            {isSmartInputValid ? <Check className="w-3.5 h-3.5 text-primary" /> : <span className="text-destructive text-xs">✗</span>}
                          </span>
                        )}
                      </div>

                      {parsedPreview && (
                        <div className="flex gap-1.5">
                          {[
                            { label: "X", value: parsedPreview.x },
                            { label: "Y", value: parsedPreview.y },
                            ...(parsedPreview.z !== undefined ? [{ label: "Z", value: parsedPreview.z }] : []),
                          ].map(({ label, value }) => (
                            <div key={label} className="flex-1 bg-background/50 rounded-lg px-2.5 py-1.5 border border-border/20">
                              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</span>
                              <p className="font-mono text-xs font-medium text-foreground">{value}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-[10px] text-muted-foreground/50 space-y-0.5 bg-background/30 rounded-lg p-2 border border-border/15">
                        <p className="text-[10px] text-muted-foreground/70 font-medium mb-0.5">Formats</p>
                        <p className="font-mono">123, 456, 789</p>
                        <p className="font-mono">x:123 y:456 z:789</p>
                        <p className="font-mono">vector3(123, 456, 789)</p>
                      </div>
                      <Button
                        onClick={addMarkerCombined}
                        disabled={!isSmartInputValid || addingState === "adding"}
                        className="w-full h-9 text-xs font-medium rounded-lg transition-all duration-200 active:scale-[0.98] shadow-[0_0_20px_-4px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_24px_-2px_hsl(var(--primary)/0.4)]"
                      >
                        {addingState === "adding" ? (
                          <><span className="animate-spin mr-1.5">⟳</span> Placing…</>
                        ) : addingState === "success" ? (
                          <><Check className="w-3.5 h-3.5 mr-1" /> Added</>
                        ) : (
                          <><MapPin className="w-3.5 h-3.5 mr-1" /> Place Marker</>
                        )}
                      </Button>
                    </TabsContent>

                    <TabsContent value="manual" className="space-y-2.5 mt-0">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1 block">X</label>
                          <Input placeholder="-1200" value={inputX} onChange={(e) => setInputX(e.target.value)} className="h-9 text-xs font-mono rounded-lg bg-background/60 border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/30" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1 block">Y</label>
                          <Input placeholder="3500" value={inputY} onChange={(e) => setInputY(e.target.value)} className="h-9 text-xs font-mono rounded-lg bg-background/60 border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/30" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1 block">Z (optional)</label>
                        <Input placeholder="30" value={inputZ} onChange={(e) => setInputZ(e.target.value)} className="h-9 text-xs font-mono rounded-lg bg-background/60 border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/30" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1 block">Label</label>
                        <Input placeholder={t("coord.label_placeholder")} value={inputLabel} onChange={(e) => setInputLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && isManualInputValid && addMarkerManual()} className="h-9 text-xs rounded-lg bg-background/60 border-border/30 focus-visible:ring-primary/20 focus-visible:border-primary/30" />
                      </div>
                      <Button
                        onClick={addMarkerManual}
                        disabled={!isManualInputValid || addingState === "adding"}
                        className="w-full h-9 text-xs font-medium rounded-lg transition-all duration-200 active:scale-[0.98] shadow-[0_0_20px_-4px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_24px_-2px_hsl(var(--primary)/0.4)]"
                      >
                        {addingState === "adding" ? (
                          <><span className="animate-spin mr-1.5">⟳</span> Placing…</>
                        ) : addingState === "success" ? (
                          <><Check className="w-3.5 h-3.5 mr-1" /> Added</>
                        ) : (
                          <><MapPin className="w-3.5 h-3.5 mr-1" /> Place Marker</>
                        )}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              {/* Markers List */}
              <div className="rounded-xl border border-border/30 bg-card/80 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/20">
                  <div className="flex items-center gap-1.5">
                    <MapPinned className="w-3.5 h-3.5 text-primary/80" />
                    <span className="text-xs font-medium text-foreground/80">Markers</span>
                    {markerCount > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded-md border border-border/20">{markerCount}</span>
                    )}
                  </div>
                  {markerCount > 0 && (
                    <button className="text-[10px] text-destructive/70 hover:text-destructive transition-colors flex items-center gap-1" onClick={() => { setMarkers([]); setSelectedMarkerId(null); }}>
                      <Trash2 className="w-3 h-3" /> Clear
                    </button>
                  )}
                </div>
                <div className="p-2.5">
                  {markerCount === 0 ? (
                    <div className="text-center py-10 px-4">
                      <div className="w-10 h-10 rounded-xl bg-muted/30 border border-border/20 flex items-center justify-center mx-auto mb-3">
                        <MapPin className="w-4.5 h-4.5 text-muted-foreground/30" />
                      </div>
                      <p className="text-xs font-medium text-muted-foreground/60">No markers placed</p>
                      <p className="text-[10px] text-muted-foreground/40 mt-1 max-w-[200px] mx-auto leading-relaxed">
                        Click on the map or enter coordinates above to get started
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-[260px] overflow-y-auto pr-0.5 scrollbar-thin">
                      {markers.map((marker) => {
                        const tone = MARKER_TONES[marker.tone];
                        const isSelected = marker.id === selectedMarkerId;
                        const isEditing = marker.id === editingMarkerId;
                        return (
                          <div
                            key={marker.id}
                            className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-all duration-200 group ${
                              isSelected
                                ? "border-primary/30 bg-primary/5"
                                : "border-transparent hover:border-border/20 hover:bg-muted/20"
                            }`}
                            onClick={() => setSelectedMarkerId(isSelected ? null : marker.id)}
                          >
                            <div className={`h-2.5 w-2.5 shrink-0 rounded-full border ${tone.dotClass} ${isSelected ? "ring-2 ring-primary/20 ring-offset-1 ring-offset-card" : ""}`} />
                            <div className="flex-1 min-w-0">
                              {isEditing ? (
                                <Input
                                  autoFocus
                                  value={editingLabel}
                                  onChange={(e) => setEditingLabel(e.target.value)}
                                  onBlur={() => renameMarker(marker.id, editingLabel)}
                                  onKeyDown={(e) => { if (e.key === "Enter") renameMarker(marker.id, editingLabel); if (e.key === "Escape") setEditingMarkerId(null); }}
                                  className="h-5 text-[11px] px-1.5 py-0 rounded-md"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <p className="text-[11px] font-medium truncate text-foreground/90">{marker.label}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground/50 font-mono leading-tight">
                                {marker.x}, {marker.y}{marker.z !== undefined ? `, ${marker.z}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button className="p-1 rounded-md hover:bg-muted/40 transition-colors" onClick={(e) => { e.stopPropagation(); setEditingMarkerId(marker.id); setEditingLabel(marker.label); }}>
                                <Edit2 className="w-3 h-3 text-muted-foreground" />
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-1 rounded-md hover:bg-muted/40 transition-colors" onClick={(e) => e.stopPropagation()}>
                                    {copied === marker.id ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-[140px]">
                                  <DropdownMenuItem onClick={() => copyCoords(marker, "plain")} className="text-[11px]">
                                    <Copy className="w-3 h-3 mr-2" /> Plain
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => copyCoords(marker, "vector3")} className="text-[11px] font-mono">
                                    <Copy className="w-3 h-3 mr-2" /> vector3
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => copyCoords(marker, "json")} className="text-[11px] font-mono">
                                    <Copy className="w-3 h-3 mr-2" /> JSON
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <button className="p-1 rounded-md hover:bg-destructive/10 transition-colors" onClick={(e) => { e.stopPropagation(); removeMarker(marker.id); }}>
                                <Trash2 className="w-3 h-3 text-destructive/60" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Locations */}
              <div className="rounded-xl border border-border/30 bg-card/80 backdrop-blur-sm overflow-hidden">
                <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-border/20">
                  <Navigation className="w-3.5 h-3.5 text-primary/80" />
                  <span className="text-xs font-medium text-foreground/80">Quick Locations</span>
                </div>
                <div className="p-2.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    {QUICK_LOCATIONS.map((location) => {
                      const Icon = LOCATION_ICONS[location.label] || MapPin;
                      return (
                        <button
                          key={location.label}
                          className="flex items-center gap-2 text-left px-2.5 py-2 rounded-lg border border-transparent text-[11px] text-foreground/70 hover:bg-primary/8 hover:border-primary/20 hover:text-primary transition-all duration-200 active:scale-[0.97] group"
                          onClick={() => addMarkerFromCoords(location.x, location.y, location.z, location.label)}
                        >
                          <Icon className="w-3 h-3 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                          <span className="truncate font-medium">{location.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Export */}
              {markerCount > 0 && (
                <div className="rounded-xl border border-border/30 bg-card/80 backdrop-blur-sm overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-border/20">
                    <Download className="w-3.5 h-3.5 text-primary/80" />
                    <span className="text-xs font-medium text-foreground/80">Export</span>
                  </div>
                  <div className="p-2.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: "vector3", fn: () => markers.map((m) => `vector3(${m.x}, ${m.y}, ${m.z ?? 0})`).join("\n") },
                        { label: "CSV", fn: () => markers.map((m) => `${m.x}, ${m.y}${m.z !== undefined ? `, ${m.z}` : ""}`).join("\n") },
                        { label: "JSON", fn: () => JSON.stringify(markers.map((m) => ({ x: m.x, y: m.y, ...(m.z !== undefined ? { z: m.z } : {}), label: m.label })), null, 2) },
                      ].map(({ label, fn }) => (
                        <Button
                          key={label}
                          variant="outline"
                          size="sm"
                          className="text-[10px] font-mono h-8 rounded-lg border-border/30 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.97] transition-all duration-200"
                          onClick={async () => {
                            await navigator.clipboard.writeText(fn());
                            toast.success(`Copied as ${label}`);
                          }}
                        >
                          <Copy className="w-2.5 h-2.5 mr-1" /> {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default CoordinateLookup;
