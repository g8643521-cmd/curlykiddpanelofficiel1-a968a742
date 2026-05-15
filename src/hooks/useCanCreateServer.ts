import { useMemo } from 'react';
import { useAdminStatus } from '@/hooks/useAdminStatus';

/**
 * Returns whether the current user can create new bot servers.
 * Allowed roles: admin, owner, server_owner.
 */
export function useCanCreateServer() {
  const { roles, isAdmin, isOwner, isLoading } = useAdminStatus();

  const canCreate = useMemo(() => {
    if (isAdmin || isOwner) return true;
    return roles.includes('server_owner' as any);
  }, [roles, isAdmin, isOwner]);

  return { canCreate, isLoading };
}
