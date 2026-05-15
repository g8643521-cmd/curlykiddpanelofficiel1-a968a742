import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Users, Wifi, WifiOff } from "lucide-react";

interface EmbedData {
  hostname: string;
  playerCount: number;
  maxPlayers: number;
  players: { name: string }[];
  gametype?: string;
  mapname?: string;
}

const ServerEmbed = () => {
  const { serverCode } = useParams<{ serverCode: string }>();
  const [searchParams] = useSearchParams();
  const theme = searchParams.get("theme") || "dark";
  const [data, setData] = useState<EmbedData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const isDark = theme !== "light";

  useEffect(() => {
    if (!serverCode) return;

    const fetchData = async () => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke("cfx-lookup", {
          body: { serverCode, skipWebhook: true },
        });
        if (fnError || result?.error) throw new Error();
        setData({
          hostname: result.hostname || "Unknown",
          playerCount: result.playerCount ?? result.players?.length ?? 0,
          maxPlayers: result.maxPlayers ?? 32,
          players: result.players || [],
          gametype: result.gametype,
          mapname: result.mapname,
        });
      } catch {
        setError(true);
      }
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [serverCode]);

  const colors = isDark
    ? { bg: "linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)", text: "#e2e8f0", sub: "#94a3b8", foot: "#64748b", border: "rgba(255,255,255,0.08)", barBg: "rgba(255,255,255,0.1)", barFill: "linear-gradient(90deg, #6366f1, #8b5cf6)", loaderBorder: "#333" }
    : { bg: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)", text: "#1e293b", sub: "#475569", foot: "#94a3b8", border: "rgba(0,0,0,0.1)", barBg: "rgba(0,0,0,0.08)", barFill: "linear-gradient(90deg, #4f46e5, #7c3aed)", loaderBorder: "#cbd5e1" };

  if (loading) {
    return (
      <div style={{ ...baseStyles.container, background: colors.bg, borderColor: colors.border, color: colors.text }}>
        <div style={{ ...baseStyles.loader, borderColor: colors.loaderBorder, borderTopColor: "#6366f1" }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ ...baseStyles.container, background: colors.bg, borderColor: colors.border, flexDirection: "row" as const, alignItems: "center", gap: 8, color: "#ef4444" }}>
        <WifiOff size={20} />
        <span>Server offline or not found</span>
      </div>
    );
  }

  const fillPct = Math.min((data.playerCount / data.maxPlayers) * 100, 100);

  return (
    <div style={{ ...baseStyles.container, background: colors.bg, borderColor: colors.border, color: colors.text }}>
      <div style={baseStyles.header}>
        <Wifi size={14} style={{ color: "#22c55e" }} />
        <span style={baseStyles.hostname}>{stripColors(data.hostname)}</span>
      </div>
      <div style={{ ...baseStyles.stats, color: colors.sub }}>
        <Users size={14} />
        <span>{data.playerCount} / {data.maxPlayers}</span>
      </div>
      <div style={{ ...baseStyles.barBg, background: colors.barBg }}>
        <div style={{ height: "100%", borderRadius: 3, background: colors.barFill, width: `${fillPct}%`, transition: "width 0.5s ease" }} />
      </div>
      <div style={{ ...baseStyles.footer, color: colors.foot }}>
        <span>cfx.re/join/{serverCode}</span>
        <span style={{ fontStyle: "italic" }}>CurlyKiddPanel</span>
      </div>
    </div>
  );
};

function stripColors(text: string): string {
  return text.replace(/\^[0-9]/g, "").replace(/~[a-zA-Z]~/g, "");
}

const baseStyles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: 12,
    padding: "16px 20px",
    maxWidth: 360,
    fontSize: 13,
    border: "1px solid",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  header: { display: "flex", alignItems: "center", gap: 8 },
  hostname: { fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  stats: { display: "flex", alignItems: "center", gap: 6 },
  barBg: { height: 6, borderRadius: 3, overflow: "hidden" },
  footer: { display: "flex", justifyContent: "space-between", fontSize: 11 },
  loader: { width: 20, height: 20, border: "2px solid", borderRadius: "50%", animation: "spin 1s linear infinite" },
};

export default ServerEmbed;
