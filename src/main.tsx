import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installAuthRecovery } from "@/lib/authRecovery";

const restoreSpaPath = () => {
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  if (pathname !== "/login" && params.get("state") === "discord_login" && params.get("code")) {
    params.set("discord_redirect_path", window.location.pathname || "/");
    window.history.replaceState({}, "", `/login?${params.toString()}${window.location.hash}`);
    return;
  }

  const spaPath = params.get("__spa_path");
  if (!spaPath || !spaPath.startsWith("/") || spaPath.startsWith("//")) return;
  if (window.location.pathname !== "/") return;

  params.delete("__spa_path");
  const query = params.toString();
  window.history.replaceState({}, "", `${spaPath}${query ? `?${query}` : ""}${window.location.hash}`);
};

restoreSpaPath();

// Boot-time guard: detects stale/corrupted JWTs and forces a clean sign-out
// so the app never gets stuck silently failing every query.
installAuthRecovery();

createRoot(document.getElementById("root")!).render(<App />);
