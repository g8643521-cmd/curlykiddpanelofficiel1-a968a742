# Loading / Error / Timeout — Stabilization Plan

## ✅ Done (this round)

### Global foundation
- `src/lib/asyncRequest.ts` — `runAsync` (timeout + abort + transient retry)
- `src/lib/apiFetch.ts` — wrapped `fetch` for `/api/public/*` calls
- `src/hooks/useAsyncData.ts` — standardized hook
- `src/components/feedback/LoadingState.tsx`, `ErrorCard.tsx`
- `src/components/RootErrorBoundary.tsx` mounted in `__root.tsx`
- Router transitions tightened (`defaultPendingMs`, `defaultPendingMinMs`)

### Migrated to async pattern
- `useCfxApi` — Server Lookup (abort propagation + 12s wall-clock)
- `Dashboard` lookup error UI uses `ErrorCard`
- `AppHeader` profile/session fetch → `useAsyncData` + `runAsync`
- `Profile` init (`checkAuth`), Discord OAuth callback, link/unlink/membership refresh → `apiFetch` + `runAsync`, error UI via `ErrorCard`
- `ScanHistory` history fetch → `runAsync` + `ErrorCard` retry

## 🟡 Roadmap — mechanical rollouts

Pattern for every remaining panel:
1. Replace ad-hoc `useEffect + supabase.from(...)` with `runAsync` (5–8s timeout)
2. Store `{ data, isLoading, error }`; render `<ErrorCard onRetry={...}>` on failure
3. Replace custom spinners with `<LoadingState>`
4. For `/api/public/*` fetches, swap `fetch` → `apiFetch`

### Admin panels still on custom loaders
- `UserManagementPanel` (data fetched in parent `AdminPanel` — refactor parent)
- `ScanDiagnosticsPanel`, `BotDiagnosticsPanel`, `BotOverviewPanel`
- `AuditActivityPanel`, `OwnerAuditLogViewer`, `UserAuditPanel`
- `SystemStatusPanel`, `SystemWebhooksPanel`, `DatabaseExportPanel`
- `DiscordBotPanel`, `DiscordAutoSetupPanel`, `DiscordCredentialsPanel`,
  `DiscordModUploadPanel`, `DiscordServerSetup`, `DiscordSetupWizard`
- `RoleManagementPanel`, `RoleSetsPanel`, `AccessControlPanel`,
  `ApiKeysPanel`, `ServerCreationKeysPanel`
- `HeroImagePanel`, `ManagedImagePanel`, `SocialLinksPanel`, `StatsOverridePanel`
- `HiddenCheatersPanel`, `UserLifecyclePanel`, `TransferOwnership`

### Other pages with custom loading
- `CheaterSearch`, `CoordinateLookup`, `FiveMMods`, `ModeratorPanel`,
  `Settings`, `PublicProfile`, `ServerEmbed`, `BotSetup`
- Friend/social components: `FriendsPanel`, `FriendsActivityFeed`,
  `FavoriteFriends`, `MutualFriends`, `FriendSuggestions`,
  `SocialNotifications`, `Leaderboard`, `LatestMods`,
  `FeaturedModsCarousel`, `ServerRecommendations`, `PlayerLocator`,
  `UnifiedSearch`, `DashboardHero`

## 🔴 Routing cleanup (deferred)

The project currently mixes `react-router-dom` (in `src/App.tsx`, all pages,
and many components) with TanStack Router scaffolding (`src/router.tsx`,
`src/routes/__root.tsx`). This blend is fragile — `<Link>` from one library
can't preload routes registered with the other, and any future SSR work will
break.

**Recommended single-router cleanup (one dedicated PR):**
1. Pick one router. Given existing TanStack scaffolding + framework
   templates, migrate fully to TanStack Router.
2. Move every page under `src/pages/` into a `src/routes/<name>.tsx` file
   with `createFileRoute`.
3. Replace every `useNavigate`/`useLocation`/`Link`/`useSearchParams` import
   from `react-router-dom` with the `@tanstack/react-router` equivalent.
   - `useSearchParams` → `Route.useSearch()` + `validateSearch`
   - `<Link to="/x">` keeps same API; dynamic params via `params={{...}}`
4. Delete `react-router-dom` from `package.json`.
5. Delete `src/App.tsx`'s `<BrowserRouter>` once all routes are file-based.

Estimated touched files: ~40. Mechanical but must be done in one pass —
partial migration is worse than the current state.
