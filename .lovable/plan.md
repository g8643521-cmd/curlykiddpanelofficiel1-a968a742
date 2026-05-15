
# Globalt Loading & Error System

Fokuseret leverance der løser endless-loading, manglende feedback og hængende requests **én gang for alle** med ét genbrugeligt system, derefter rulles det ud på de prioriterede flows.

---

## Hvad der bliver bygget (det globale fundament)

### 1. `src/lib/asyncRequest.ts` — fælles request-runner
- Wrapper rundt om alle Supabase-funktioner / fetch-kald.
- **5 sekunders timeout** (justerbar pr. kald) via `AbortController`.
- Returnerer altid én af tre tilstande: `success`, `error`, `timeout`.
- Aldrig en hængende promise — `Promise.race` mellem kald, timeout og abort.
- Beskytter mod state-update efter unmount (`isCancelled` flag).
- Indbygget retry (max 1) for transient fejl (502/503/timeout). Ingen retry på 4xx.

### 2. `src/hooks/useAsyncData.ts` — standardiseret data-hook
- `{ data, isLoading, error, retry, cancel }` — én pattern overalt.
- Auto-abort ved unmount, ved nyt kald, ved component-skift.
- Kan ikke ende i evig loading: hvis ingen success/error inden timeout → error med retry.

### 3. `src/components/feedback/` — visuelt fælles system
- `LoadingState.tsx` — standardiseret skeleton/spinner med 5s "tager længere tid end forventet"-besked.
- `ErrorCard.tsx` — inline fejlkort med retry-knap, fejlbesked + valgfri detaljer.
- `EmptyState.tsx` — fallback når der ikke er data.
- `RouteErrorBoundary.tsx` — fanger crash på route-niveau, viser fallback i stedet for blank side.

### 4. `src/components/RootErrorBoundary.tsx` — wrappes om `<Outlet />` i `__root.tsx`
- Catch-all så hele appen aldrig crasher til hvid skærm.
- "Genindlæs" knap + "Gå til forsiden".

### 5. Toast-policy (anti-spam)
- Toast KUN på handlinger: save, submit, delete, sync, login.
- Aldrig toast på data-load fejl — det går i `ErrorCard` inline.
- Dedupe via sonner's `id`-felt så samme fejl ikke spammer.

---

## Konkrete fixes på prioriterede flows

### A. Server Lookup (`useCfxApi.ts` + `cfx-lookup` edge function)
**Problemer fundet:**
- `abortControllerRef` oprettes men **signalet videregives aldrig** til `supabase.functions.invoke` — abort gør reelt ingenting.
- Timeout er 20 sek (du vil have 5).
- Ved retry kan begge requests stadig være "in-flight" → race condition på state.
- Edge function har ingen egen timeout på upstream cfx.re-kald.

**Løsning:**
- Refactor hooket til at bruge `useAsyncData` + `asyncRequest`.
- 5s timeout med korrekt abort-propagation.
- Edge function: tilføj 4s `AbortSignal.timeout()` på fetch til cfx.re, returnér altid struktureret JSON med `fallback: true` ved 5xx/timeout (aldrig 500).
- Inline `ErrorCard` med "Prøv igen" + tydelig "serveren svarer ikke"-besked.

### B. Discord/Profile sync (`AppHeader.tsx`, `Profile.tsx`, `profileSync.ts`)
- Bruger `useAsyncData` med 5s timeout på profile-fetch.
- Toast ved sync-handlinger, inline badges (`avatar/banner/discord: missing`) med retry.
- Avatar/banner får skeleton mens de loader, fallback-initial hvis fail.

### C. Admin panel & dashboards
- Samme `useAsyncData` pattern på alle data-tabeller.
- `LoadingState` skeleton i stedet for tomme tabeller.
- `ErrorCard` med retry pr. sektion (én sektions fejl crasher ikke hele siden).

### D. Routing transitions
- `pendingComponent` på langsomme routes så navigation aldrig "fryser" uden feedback.
- `defaultPendingMs: 200`, `defaultPendingMinMs: 300` på router config.

---

## Tekniske detaljer

```
src/
  lib/
    asyncRequest.ts           [NY]  — timeout/abort/retry runner
  hooks/
    useAsyncData.ts           [NY]  — standardiseret data-hook
    useCfxApi.ts              [REF] — refactored til useAsyncData
  components/
    feedback/
      LoadingState.tsx        [NY]
      ErrorCard.tsx           [NY]
      EmptyState.tsx          [NY]
      RouteErrorBoundary.tsx  [NY]
    RootErrorBoundary.tsx     [NY]
    AppHeader.tsx             [REF] — bruger useAsyncData + ErrorCard
  routes/
    __root.tsx                [REF] — RootErrorBoundary + pending defaults
  pages/
    Profile.tsx               [REF] — useAsyncData + skeletons
    [admin sider]             [REF] — udrulles efter A+B er stabile
  router.tsx                  [REF] — defaultPendingMs/MinMs
supabase/functions/cfx-lookup/
  index.ts                    [REF] — 4s upstream timeout, struktureret error
```

---

## Eksekveringsrækkefølge

1. Byg det globale fundament (lib + hooks + feedback components + RootErrorBoundary).
2. Refactor `cfx-lookup` edge function (5xx → struktureret 200 + upstream timeout).
3. Refactor `useCfxApi` → bruger det nye system.
4. Refactor `AppHeader` + `Profile` Discord sync.
5. Rul ud på admin/dashboard sider.
6. Browser-test hele flowet (lookup, profil, admin) + tjek network/console.

---

## Hvad jeg leverer til sidst

Komplet rapport med:
- Liste over alle loading-bugs fundet (med fil + linje)
- Root cause for hver
- Hvordan de blev løst
- Alle ændrede filer
- Browser-test resultat (lookup-flow + profil + admin) inkl. network/console
- Performance-tjek på routing transitions

---

Det er en stor opgave — forventet 6-10 redigeringsrunder. Når du godkender planen, kører jeg det igennem uden at stoppe.
