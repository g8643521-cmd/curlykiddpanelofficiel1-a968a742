import { useState } from "react";
import { Search, Server, Clipboard } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface ServerLookupProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const ServerLookup = ({ onSearch, isLoading }: ServerLookupProps) => {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setQuery(text);
      toast.success("Pasted from clipboard");
    } catch {
      toast.error("Failed to read clipboard");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl overflow-hidden bg-card/40 backdrop-blur-xl border border-border/30 shadow-lg shadow-black/10 hover:border-border/50 transition-all duration-300 p-6 w-full max-w-2xl mx-auto"
    >
      <div className="text-center mb-5">
        <h2 className="font-display text-xl font-bold text-foreground mb-1">
          Server Lookup
        </h2>
        <p className="text-muted-foreground text-sm">
          Enter a server code or join URL to get detailed information
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <Input
              type="text"
              placeholder="Enter server code (e.g., abc123) or CFX URL..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-11 pr-11 h-12 bg-card/60 border-border/30 text-foreground placeholder:text-muted-foreground/50 focus:ring-primary focus:border-primary rounded-lg"
            />
            <button
              type="button"
              onClick={handlePaste}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground/40 hover:text-foreground transition-colors rounded hover:bg-muted/50"
            >
              <Clipboard className="w-4 h-4" />
            </button>
          </div>
          <Button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="h-12 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>
      </form>

      <div className="mt-4 pt-4 border-t border-border/15">
        <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">Supported Formats:</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-primary/60" />
            <span className="text-xs text-muted-foreground/60">Code:</span>
            <code className="text-xs text-primary/80 font-mono">abc123</code>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-primary/60" />
            <span className="text-xs text-muted-foreground/60">URL:</span>
            <code className="text-xs text-primary/80 font-mono">cfx.re/join/abc123</code>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-primary/60" />
            <span className="text-xs text-muted-foreground/60">Full:</span>
            <code className="text-xs text-primary/80 font-mono">https://cfx.re/join/...</code>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ServerLookup;
