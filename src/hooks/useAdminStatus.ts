import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { getSessionWithTimeout } from '@/lib/authSession';

type UserRole = 'admin' | 'moderator' | 'user' | 'owner' | 'mod_creator' | 'server_owner' | 'integrations_manager';

const ROLE_CACHE_KEY = 'ckp_roles_cache';

const getCachedRoles = (): UserRole[] => {
  try {
    const cached = sessionStorage.getItem(ROLE_CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch { return []; }
};

const setCachedRoles = (roles: UserRole[]) => {
  try { sessionStorage.setItem(ROLE_CACHE_KEY, JSON.stringify(roles)); } catch {}
};

// ── Singleton store so ALL useAdminStatus() hooks share one fetch ──

interface RoleState {
  roles: UserRole[];
  isLoading: boolean;
}

let _state: RoleState = { roles: [], isLoading: true };
let _listeners = new Set<() => void>();
let _fetchPromise: Promise<void> | null = null;
let _lastFetchedUserId: string | null = null;
let _authSubActive = false;
let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let _realtimeUserId: string | null = null;

function emit() {
  // Defer to avoid triggering store updates during React render phase
  // which causes "Should have a queue" errors with useSyncExternalStore
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => _listeners.forEach(fn => fn()));
  } else {
    setTimeout(() => _listeners.forEach(fn => fn()), 0);
  }
}

function setState(partial: Partial<RoleState>) {
  _state = { ..._state, ...partial };
  emit();
}

async function fetchRoles(force = false) {
  // Deduplicate concurrent calls
  if (_fetchPromise && !force) return _fetchPromise;

  _fetchPromise = (async () => {
    try {
      const { data: { session } } = await getSessionWithTimeout();

      if (!session) {
        _lastFetchedUserId = null;
        sessionStorage.removeItem(ROLE_CACHE_KEY);
        setState({ roles: [], isLoading: false });
        return;
      }

      // Skip if we already fetched for this user (unless forced)
      if (!force && _lastFetchedUserId === session.user.id && _state.roles.length > 0) {
        setState({ isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Error checking role status:", error);
        _lastFetchedUserId = session.user.id;
        sessionStorage.removeItem(ROLE_CACHE_KEY);
        setState({ roles: [], isLoading: false });
        return;
      }

      const roleList = (data ?? [])
        .map((r) => r.role as UserRole)
        .filter((r, idx, arr) => arr.indexOf(r) === idx);

      _lastFetchedUserId = session.user.id;
      setCachedRoles(roleList);
      setState({ roles: roleList, isLoading: false });
    } catch (error) {
      console.error("Error in fetchRoles:", error);
      setState({ isLoading: false });
    } finally {
      _fetchPromise = null;
    }
  })();

  return _fetchPromise;
}

// One global auth listener
function ensureAuthSub() {
  if (_authSubActive) return;
  _authSubActive = true;

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      _lastFetchedUserId = null;
      sessionStorage.removeItem(ROLE_CACHE_KEY);
      setState({ roles: [], isLoading: false });
      teardownRealtime();
    } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      // Intentionally NOT reacting to TOKEN_REFRESHED — that fires every
      // time the tab regains focus and re-fetching roles each time causes
      // admin pages to flash into loading on every tab switch.
      fetchRoles(true);
      ensureRealtime();
    }
  });
}

function teardownRealtime() {
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
    _realtimeUserId = null;
  }
}

async function ensureRealtime() {
  const { data: { session } } = await getSessionWithTimeout();
  if (!session) return;
  if (_realtimeUserId === session.user.id && _realtimeChannel) return;

  teardownRealtime();
  _realtimeUserId = session.user.id;
  _realtimeChannel = supabase
    .channel(`user_roles:${session.user.id}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${session.user.id}` },
      () => { fetchRoles(true); },
    )
    .subscribe();
}

function subscribe(cb: () => void) {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

function getSnapshot(): RoleState {
  return _state;
}

// ── Hook ──

export const useAdminStatus = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    ensureAuthSub();
    ensureRealtime();
    // Always verify roles against the current restored session on mount.
    // Never trust a role cache by itself; a stale cache can make admin pages
    // render before RLS sees the correct user, which causes hanging loaders.
    fetchRoles(_lastFetchedUserId === null);
  }, []);

  const computeFlags = (roleList: UserRole[]) => {
    const owner = roleList.includes("owner");
    const admin = owner || roleList.includes("admin");
    const moderator = admin || roleList.includes("moderator");
    return { owner, admin, moderator };
  };

  const flags = computeFlags(state.roles);

  const userRole = (state.roles.includes("owner")
    ? "owner"
    : state.roles.includes("admin")
      ? "admin"
      : state.roles.includes("moderator")
        ? "moderator"
        : state.roles.includes("server_owner")
          ? "server_owner"
          : state.roles.includes("integrations_manager")
            ? "integrations_manager"
            : state.roles.includes("mod_creator")
              ? "mod_creator"
              : "user") as UserRole;

  return {
    isOwner: flags.owner,
    isAdmin: flags.admin,
    isModerator: flags.moderator,
    roles: state.roles,
    userRole,
    isLoading: state.isLoading,
    refetch: () => fetchRoles(true),
  };
};
