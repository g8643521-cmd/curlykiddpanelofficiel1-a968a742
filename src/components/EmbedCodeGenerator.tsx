import { useState } from "react";
import { Code, Copy, Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Props {
  serverCode?: string | null;
}

const EmbedCodeGenerator = ({ serverCode }: Props) => {
  const [code, setCode] = useState(serverCode || "");
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const embedUrl = `${window.location.origin}/embed/${code}${theme === "light" ? "?theme=light" : ""}`;
  const iframeCode = `<iframe src="${embedUrl}" width="380" height="140" frameborder="0" style="border-radius:12px;overflow:hidden;" loading="lazy"></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeCode);
    setCopied(true);
    toast.success("Embed code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Code className="w-5 h-5 text-primary" />
          Server Status Widget
        </h3>
        <Badge variant="outline">Embeddable</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Embed a live server status widget on your website. It auto-refreshes every 60 seconds.
      </p>

      {!serverCode && (
        <Input
          placeholder="Enter server code (e.g. ygjqrk)"
          value={code}
          onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
          className="bg-background/50"
        />
      )}

      {/* Theme selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Theme:</span>
        <Button
          variant={theme === "dark" ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme("dark")}
          className="text-xs h-7"
        >
          Dark
        </Button>
        <Button
          variant={theme === "light" ? "default" : "outline"}
          size="sm"
          onClick={() => setTheme("light")}
          className="text-xs h-7"
        >
          Light
        </Button>
      </div>

      {code && (
        <>
          <div className="relative">
            <pre className="bg-background/80 border border-border rounded-lg p-4 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
              {iframeCode}
            </pre>
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Preview widget
            </a>
          </div>

          {/* Live preview */}
          <div className="border border-border rounded-lg p-4 bg-background/30">
            <p className="text-xs text-muted-foreground mb-2">Preview:</p>
            <iframe
              src={embedUrl}
              width="380"
              height="140"
              style={{ borderRadius: 12, overflow: "hidden", border: "none" }}
              loading="lazy"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default EmbedCodeGenerator;
