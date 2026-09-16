# Web App Onboarding Plan (living doc)

## Goal
Help users install the web app (`/webapp`, the URL-less `FrozenHalls` edition merged in PR #10) to their phone Home Screen via a guided onboarding overlay.

## What PR #10 gives us (merged to main)
- `app/webapp.tsx` — canonical `/webapp` route: `FrozenHalls` + `usePinUrlPath('/webapp')`; native redirects to `/`.
- `lib/webApp.ts` — `useIsWebApp()` (true when `segments[0] === 'webapp'`).
- `lib/pinUrlPath.ts` — pins the bar to `/webapp`, rewrites ANY `pushState`/`replaceState` (including `?search`/`#hash`) back to bare `/webapp`, canonicalizes trailing slash, leaves Back alone. **Confirmed: `?onboarding` will be stripped unless we carve it out.**
- `lib/webStack.tsx` + `components/WebStackHost.tsx` — the overlay pattern to copy: provider in `app/_layout.tsx`, host renders absolute cover (`zIndex: 100`, `role="dialog"`), Escape-to-close, and **clears the stack when leaving `/webapp`** so Back is never swallowed and overlays never resurrect on return. `DiningTabBar` opens settings/search via `webStack.open()` in webapp mode.
- `FrozenHallsGate` waits for prefs `loaded` before first paint — onboarding must do the same for its dismissal flag (no flash-of-overlay).
- `public/_redirects` exists (`/home → /`) but the onboarding redirector stays client-side (`router.replace`); no Pages config needed since static export emits `webapp/onboarding.html`.

## How onboarding plugs in
- New `components/WebAppOnboardingHost.tsx` mirroring `WebStackHost`: web-only (`Platform.OS` guard like `WebStackHost`), `role="dialog"`, absolute cover with z-index ABOVE 100 so it sits over settings/search, same leave-`/webapp`-clears-state behavior.
- Keep it separate from `WebScreen` (don't extend the union) — onboarding owns step machine + persistence + deep links; `webStack` stays settings/search-only. While onboarding is up, settings/search are unreachable behind it.
- New `app/webapp/onboarding.tsx` (+ `onboarding/2.tsx`) redirector routes; register all three (`webapp`, `webapp/onboarding`, `webapp/onboarding/2`) in the `app/_layout.tsx` Stack with `headerShown: false` (only `webapp` is registered today).
- `usePinUrlPath` needs a narrow carve-out: tolerate `?onboarding=*` until the host consumes it, then clean to bare `/webapp`.
- Dismissal flag read goes through the prefs-gate pattern (don't decide show/suppress until storage is read).

## Routes & trigger model
- `/webapp` = `FrozenHalls` + `WebAppOnboarding` overlay. Canonical install target (`start_url`).
- `/webapp/onboarding` = tiny redirector: sets one-time sessionStorage handoff, `replace`s to `/webapp?onboarding=1` (force-show, even if dismissed).
- `/webapp/onboarding/2` = same redirector targeting step 2: `replace`s to `/webapp?onboarding=2` (used after breaking out of in-app browsers).
- Overlay step state is internal (`opt-in → browser-check → picker → instructions → success`), deep-linkable via `?onboarding=<step>`. No per-screen route files.
- Consume the sessionStorage handoff on read + use `replace` (not `push`) so Back never loops through the redirector.
- `usePinUrlPath` currently strips `?search`/`#hash`; it must tolerate `?onboarding=*` until the overlay consumes it, then clean the URL.

## Persistence ("never show again")
- `Done` / close writes versioned flag `webapp:onboarding:v1` (AsyncStorage → localStorage on web). Persists across quit/reboot/reopen on same origin + browser profile.
- Launch logic in `/webapp` (client-only):
  1. Forced handoff/`?onboarding` → show (even if dismissed).
  2. Else if flag set → never show.
  3. Else if `display-mode: standalone` / `navigator.standalone` → suppress (+ optionally write flag).
  4. Else if first visit (no flag) → auto-show once.
- Does NOT survive private browsing, clear-website-data, different browser, or different device.
- DECIDED: mark-only-on-Done. Quitting/closing mid-flow (or opt-in No) does NOT write the flag → auto-shows again from Step 0 next visit. Only Step 6 Done suppresses.
- In-app-browser detection (UA sniffing): possible as a HINT only, not reliable — iOS Google app sends a `GSA/` UA token (decent signal); Android in-app/Custom Tabs usually look like plain Chrome (`; wv)` = WebView is heuristic). Plan: always ask Step 1, optionally pre-highlight the likely answer from UA. Never auto-route on UA alone.
- Escape hatch: "Replay install instructions" row in Settings clears the flag.

## PWA prerequisites (for real installability)
- Minimal (do now): `manifest.webmanifest` (`display: standalone`, `start_url/scope: /webapp/`), `<link rel=manifest>`, `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-capable`.
- Full Android install prompt (later): service worker with fetch handler (Expo emits none; needs Workbox/custom SW).
- iOS has NO programmatic install/detection — Done is trust-based. Android detection (`beforeinstallprompt`/`appinstalled`) needs the full setup.

## Onboarding flow (per latest spec)

### Step 0 — Opt-in (AUTO flow only, skipped when coming from /onboarding)
- "Do you want to add 5C Dining to your Home Screen?"
- Yes → stay on `/webapp`, continue to Step 1. No → go to site root `/`.
- Only Done (Step 6) suppresses future auto-shows. Anything else (quit, close, opt-in No) writes nothing → auto-shows again from Step 0 on next `/webapp` visit.
- DECIDED: opt-in "No" remembers nothing. This is free: "No" sends them to `/`, which never auto-shows, so there's no nag loop. Re-asking on a later `/webapp` return is intended.

### Step 1 — Real browser check (DECIDED)
- Default: "Are you in a real browser? Not the Google app?" Yes / No.
- When UA suggests in-app (e.g. iOS `GSA/` token): headline becomes "Looks like you're in the Google app" with primary button "Yep" (= confirm, go to breakout) and a secondary underlined text-button "No I'm not" (= deny, go to Step 2). The "No" is real text, underlined, tappable, adequate touch target — just not a filled button.
- Yes / "No I'm not" → Step 2. No / "Yep" → breakout screen: copy-link button (copies `/webapp/onboarding/2` link) + "Open this site in a real browser (Safari, Chrome, etc.)" + "tap … → Open in Safari/Chrome" instructions.
- Copy must handle clipboard blocking in in-app webviews: try `navigator.clipboard`, fall back to selectable text + manual copy.
- A page CANNOT force-open the default browser from Google's in-app webview; copy-link + instructions is the reliable path (`window.open` best-effort only).

### Step 2 — Browser picker + instruction subscreens (DECIDED: steps 3–6 shared)
- Picker: Safari / Chrome / Other (generic icon + name). On select, picker collapses to sticky top bar (still tappable to switch); body below swaps per browser.
- Sticky footer on every (sub)screen: Back + Next always visible (flex column + safe-area, no scroll-to-find).
- Safari: sub 1 (More icon, left of URL bar, bottom + screenshot) → sub 2 (Share + screenshot) → shared Steps 3–6.
- Chrome: sub 1 (Share icon, right of URL bar, top + screenshot) → shared Steps 3–6.
- Other: "Most browsers have a visible Share button or a ⋮ (3 dots) menu with Share inside — find it and tap Share." → shared Steps 3–6.
- Shared Steps 3–6 (same for all browsers):
  - 3: View more (+ screenshot). 4: Scroll down → Add to Home Screen (+ screenshot).
  - 5: Name + ensure "Open as Web App" enabled → Add (+ screenshot).
  - 6: Success — "5C Dining is installed just like a normal app!" Back + Done.

## Assets needed
- ~7 screenshots (Safari More/Share/View-more/Add-to-Home-Screen/name-dialog, Chrome share entry, home-screen success). Build with placeholder boxes first.
- Use generic labeled icons, not official Safari/Chrome logos.
- Final copy for opt-in + Step 1.

## Open questions
1. "Open as Web App" toggle in Step 5 — which browser/version shows this? Needs screenshot confirmation (stock iOS Safari's dialog is name-only). Placeholder until then.
2. Copy-link URL: full `https://<domain>/webapp/onboarding/2`? Confirm canonical domain (currently `better5cmenu.pages.dev`).

## Risks & edge cases
- **Desktop:** first-visit auto-show must NOT fire on desktop (no Home Screen concept). Gate auto-show on mobile (coarse pointer / mobile UA); forced `/onboarding` links still work everywhere.
- **Copy-link origin:** build the copied URL from runtime `window.location.origin` + `/webapp/onboarding/2`, never hardcode the domain — otherwise preview deployments copy production links.
- **Safari URL-bar position:** bar can be top or bottom (user setting). Safari sub 1 says "bottom" — add "(if yours is at the top, same icons, mirrored)" or equivalent.
- **Platform scope (DECIDED): v1 is iOS-only.** Safari + Chrome-on-iOS (same Share sheet, different sub 1) + generic "Other" fallback. Android Chrome is out of scope — its ⋮-menu flow doesn't match the shared steps; revisit post-v1.
- **Browser Back mid-flow:** with the pinned URL, system Back leaves `/webapp` entirely (can't reliably intercept on web). Acceptable: per mark-only-on-Done, they restart at Step 0 on return. Overlay Back buttons step back within the flow; deep-linked entry (step 2) Backs into Step 1.
- **iOS "Other" browsers** (Firefox/Edge) are Safari-skinned (WebKit + Share sheet) — shared steps hold there.
- **Screenshot rot:** browser chrome changes yearly; crop screenshots tight on the icon, not full-screen, so they survive redesigns longer.
- **A11y:** underlined "No I'm not" still needs a ~44pt touch target + accessible role; all screenshots need alt text.

## Build order
1. `webapp` overlay shell: `WebAppOnboardingHost` (sticky footer, step router, deep links, placeholder bodies) + Stack registration + `?onboarding` carve-out in `usePinUrlPath`.
2. Opt-in + Step 1 + breakout/copy-link.
3. Picker + sticky top bar + per-browser bodies.
4. Persistence (auto first-visit, force-link, Done flag, standalone suppress).
5. Screenshots + copy, `deploy:preview`, verify on real iOS Safari + Android Chrome.
