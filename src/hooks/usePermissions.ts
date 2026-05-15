import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PermissionMap = Record<string, boolean>;

export function usePermissions(permissionKeys: string[]) {
  const keys = useMemo(() => Array.from(new Set(permissionKeys)).filter(Boolean), [permissionKeys]);

  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<PermissionMap>({});

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      const session = sessionRes.session;
      if (!session) {
        setPermissions({});
        setIsLoading(false);
        return;
      }

      const results = await Promise.all(
        keys.map(async (k) => {
          // @ts-ignore - rpc function not in generated types yet
          const { data, error } = await supabase.rpc("has_permission" as any, {
            _user_id: session.user.id,
            _permission_key: k,
          });
          if (error) {
            console.error("has_permission error", { k, error });
            return [k, false] as const;
          }
          return [k, Boolean(data)] as const;
        }),
      );

      setPermissions(Object.fromEntries(results));
    } finally {
      setIsLoading(false);
    }
  }, [keys]);

  useEffect(() => {
    // Listener first
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    // Then fetch
    refresh();

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const can = useCallback((key: string) => Boolean(permissions[key]), [permissions]);

  return { isLoading, permissions, can, refresh };
}
