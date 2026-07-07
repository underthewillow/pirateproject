# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A login-gated web app ("The Captain's Log") for tracking a pirate D&D campaign:
ship, crew, roles, inventory, funds/ledger, a fog-of-war map, quests, journal, and a
DM tab. Everything persists to Supabase and syncs live to every open browser. React +
Vite SPA, deployed to GitHub Pages. Login is via OIDC (Authentik) or a local breakglass
admin password; role-based access control gates editing and admin features (see
Authentication & roles below).

## Commands

```bash
npm install
npm run dev       # local dev server; URL ends in /pirateproject/
npm run build     # production build to dist/
npm run preview   # serve the built dist/
```

There is no test suite, linter, or typecheck configured. Deploys happen automatically
via `.github/workflows/deploy.yml` on push to `main` (build → GitHub Pages).

## Architecture

**State is centralized in one context, not per-component.** `src/context/DataContext.jsx`
loads every table once, subscribes to Supabase Realtime for all of them, and exposes the
data plus mutation helpers via `useData()`. Components never call Supabase directly —
they call `addItem` / `patchItem` / `removeItem` (collections), `patchSingleton` (ship,
funds), `setSetting` (key/value settings), or the role helpers. Mutations are optimistic:
local state updates immediately, then persists; on failure they reload or roll back.

**Two shapes of data** (see the maps at the top of `DataContext.jsx`):
- `COLLECTIONS` — array-backed tables (`crew`→`crew_members`, `roles`, `inventory`→
  `inventory_items`, `ledger`→`ledger_entries`, `locations`→`map_locations`, `quests`,
  `journal`→`journal_entries`). State key ≠ table name; the maps translate between them.
- `SINGLETONS` — single-row tables (`ship`, `funds`), always row `id = 1`.
- `settings` — a key/value table flattened into a `{ key: value }` object.

Collections sort by `sort_order` except `ledger`/`locations` which sort by `created_at`.
Realtime events route back through the same `COLLECTIONS`/`SINGLETONS` maps, so a new
table needs an entry there to sync.

**All DB access flows through `src/lib/api.js`** — five generic helpers
(`fetchAll`/`insertRow`/`updateRow`/`deleteRow`/`upsertRow`). Adding a feature is
usually "new table + new tab," no new data plumbing.

**Tabs are data-driven.** `src/config/tabs.js` is the single registry; add an entry
(`key`, `label`, `icon`, `component`) plus a component in `src/components/tabs/` to add
a section. `App.jsx` renders the active tab from this list.

**Authentication & roles.** Everything is world-readable and world-writable at the DB
level (public anon key, open RLS) — auth is enforced at the app layer only, **not a real
security boundary** (same soft-deterrent model as before, now backed by real identity
instead of a shared word). `src/context/AuthContext.jsx` (`AppAuthProvider`/`useAppAuth()`)
is the login layer, mounted between `DataProvider` and `App`: it wraps `react-oidc-context`
for OIDC login against Authentik (config read from `settings.oidc_issuer_url` /
`oidc_client_id`, editable live in Settings but only applied to the OIDC client after a
page refresh — see the comment in `AppAuthProvider`) and a local breakglass admin path
(`settings.local_admin_passphrase`, checked client-side like the old passphrases). Every
logged-in identity — OIDC subject or the single reserved `local-admin` row — is a row in
the `app_users` table (`supabase/schema/app_users.sql`), holding `roles` (`text[]`) and
`linked_crew_ids` (`uuid[]`, foundation for a future "which character am I playing"
feature). `src/config/roles.js` defines the fixed role set (`admin`, `dm`, `crew_member`,
plus the ship-station names) — distinct from the `roles` table, which is ship-station
*content*. A brand-new login gets **no roles at all** (read-only birthright access,
`upsertAppUser` in `DataContext.jsx`); an admin grants `crew_member`/`dm`/`admin`/etc. from
Settings > User Management. `canEdit`/`isDM` (from `useData()`, consumed the same way everywhere) are now
derived from roles (`admin`/`dm` → both true) via an effect in `AuthContext.jsx`, not a
standalone unlock action. `App.jsx` hard-gates all tabs behind `authReady && identity`,
rendering `LoginPage.jsx` otherwise. `SettingsPage.jsx` (opened from the header gear) has
role-gated sub-tabs: Authentication and User Management (admin-only), DM Settings
(admin/dm), General (everyone).

**DM unlocks.** Features the DM opens up to the whole crew as the campaign progresses are
plain settings booleans, listed in `DM_UNLOCKS` in `SettingsPage.jsx` (DM Settings tab) —
each entry is just a `{ key, label, desc }` toggled via `setSetting`; the feature's own tab
reads that same settings key to decide what to show (e.g. `ShipTab.jsx`'s shipyard reads
`settings.shipyard_unlocked`, replacing what used to be a standalone `shipyard_passphrase`).
Adding a new DM-unlockable feature is just another `DM_UNLOCKS` entry plus a settings-key
check in that feature's own component — no new plumbing.

**Drag-and-drop** uses `@dnd-kit` wrapped by `src/components/common/Dnd.jsx`
(`Draggable`/`Droppable`) so every tab drags the same way.

**Dice + rolls.** `src/lib/dice.js` has pure roll/parse helpers (`parseExpr`,
`rollD20`, `abilityMod`). Any roll from anywhere calls `useRoller().show()` from
`src/context/RollContext.jsx`, which plays a sound and pops the global animated overlay.

**Provider nesting** (`src/main.jsx`): `DataProvider` → `AppAuthProvider` → `RollProvider`
→ `App`. Auth is nested inside `DataProvider` because it needs `settings`/`app_users` via
`useData()`.

## D&D Beyond sync

Crew character sheets can sync from a public D&D Beyond character. The browser can't
call D&D Beyond directly (CORS), so a Supabase Edge Function does it:
`supabase/functions/ddb-sheet/index.ts` (Deno) fetches the character and **normalizes
it into the app's `sheet_data` shape** — this is where all the D&D 5e math lives (ability
mods, proficiency, AC/HP, attacks, spell DCs). `src/lib/ddb.js` is the thin client. If
sheet numbers look wrong, the fix is almost always in the Edge Function's `normalize()`.
The function must be deployed to Supabase separately (`supabase functions deploy
ddb-sheet`); it is not part of the Vite build.

## Conventions

- **Assets:** always resolve image paths through `assetUrl()` (`src/lib/asset.js`), never
  hardcode `/pirateproject/...`. It respects the base path for GitHub Pages vs. local/
  custom-domain. Crew art lives in `public/crew/{icons,portraits}/`.
- **Base path:** set by `VITE_BASE` (default `/pirateproject/`) in `vite.config.js`.
  Override to `/` for a custom domain or Vercel.
- **Inline editing:** use the `Editable` component (`src/components/common/Editable.jsx`)
  for click-to-edit fields; it already respects `canEdit`.
- **Styling:** all colors, fonts, and textures are CSS variables at the top of
  `src/styles/theme.css`; the aesthetic is parchment/ink/brass. There is no CSS
  framework or CSS-in-JS — plain classes plus occasional inline styles.
- **Supabase keys are intentionally public** (`src/config/supabaseConfig.js`,
  `.env.example`). The publishable/anon key is meant to ship in the client; don't treat
  it as a leaked secret.

## Data model (Supabase)

Tables: `ship`, `funds` (singletons, id=1); `crew_members`, `roles`, `inventory_items`,
`ledger_entries`, `map_locations`, `quests`, `journal_entries`, `ports`, `merchants`,
`market_goods`, `app_users` (collections); `settings` (key/value). All have Realtime
enabled. `crew_members.roles` is a `text[]` (multiple stations per hand);
`crew_members.sheet_data` holds the normalized D&D Beyond sheet. `app_users` holds RBAC
state keyed by OIDC subject (or `local-admin`) — see Authentication & roles above.

**Provisions market** (Inventory tab). A three-level model: a **port** (`ports`, with a
`flair` type + `price_mult`) contains **merchants** (`merchants`, each with a `type` +
`price_mult`). Each merchant carries an explicit **`stock`** (jsonb array of catalog item
ids), seeded with a random assortment of its type's categories at creation; the DM adds
(from the whole catalog, via the picker modal) or removes items. The taxonomy (flairs,
merchant types, category mappings) is client config in `src/data/market-config.js`.
Wares come from a bundled SRD 5.1 catalog (`src/data/srd-equipment.json` + curated
food/drink in `src/data/catalog.js`; CC-BY-4.0, prices in gp) — no table for the catalog.
`market_goods` are homebrew extras (custom items not in the SRD, e.g. "Cask of Coconut
Rum"), each scoped to one `merchant_id` and shown inline with that merchant's stock — a
merchant's wares = its `stock` items + its custom goods. Goods with a null `merchant_id`
(legacy/imports) surface in a DM-only "unassigned goods" box to reassign or delete.
Price = catalog base × port mult × merchant mult. Buying adds to Ship's Stores,
logs a `ledger` expense, and deducts the `funds` purse (smallest-coin-first, in
`InventoryTab.jsx`). One-time SQL for the tables: `supabase/schema/market.sql`.

**Market permissions** use the same `isDM` flag as the rest of the app (role-derived, see
Authentication & roles above) — market setup (create/edit ports, merchants, prices) is
gated by `isDM`, not a separate unlock. Port visibility to crew is a plain `ports.locked`
boolean the DM toggles per port (`supabase/schema/ports_locked.sql`) — locked ports are
filtered out of the port picker entirely for non-DM users, not just content-gated; the DM
always sees every port and can flip `locked` from the port card. New ports default to
`locked: true` so a port being stocked isn't visible until the DM is ready to reveal it.
The old `ports.password` column is unused now (kept, not dropped). Players don't need
`isDM`/`canEdit` to shop once a port is visible — *buying* is open to anyone.
