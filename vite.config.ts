import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { cloudflare } from "@cloudflare/vite-plugin";
import { componentTagger } from "lovable-tagger";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig(({ command, mode }) => {
  const isVitest = mode === "test" || process.env.VITEST === "true";

  return {
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    !isVitest && command === "build" && cloudflare({ viteEnvironment: { name: "ssr" } }),
    !isVitest && tanstackStart({ server: { entry: "server" } }),
    react(),
    !isVitest && mode === "development" && componentTagger(),
  ].filter(Boolean) as any,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  ssr: {
    noExternal: command === "build" ? true : [
      /^@tanstack\//,
      "seroval",
      "seroval-plugins",
      "h3-v2",
      "h3",
      "rou3",
      "srvx",
    ],
  },
};
});
