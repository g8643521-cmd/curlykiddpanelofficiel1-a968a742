import { Component, type ReactNode } from "react";
import { AlertOctagon, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Optional fallback override. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catch-all error boundary wrapped around the app's <Outlet />. Prevents
 * any uncaught render error from blanking the entire site — the user
 * always sees a recovery surface.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[RootErrorBoundary]", error, info);
  }

  private handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  private handleHome = () => {
    if (typeof window !== "undefined") window.location.assign("/");
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <AlertOctagon className="h-6 w-6 text-destructive" aria-hidden />
            <h1 className="text-lg font-semibold">Something went wrong</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            The page hit an unexpected error and couldn't render. Try
            reloading — if it keeps happening, go back to the home page.
          </p>
          {this.state.error.message ? (
            <pre className="mt-3 text-xs bg-muted/50 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap break-words">
              {this.state.error.message}
            </pre>
          ) : null}
          <div className="flex gap-2 mt-5">
            <Button onClick={this.handleReload} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
              Reload
            </Button>
            <Button variant="outline" onClick={this.handleHome} className="flex-1">
              <Home className="h-4 w-4 mr-2" aria-hidden />
              Home
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
