# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A shared, no-login web app ("The Captain's Log") for tracking a pirate D&D campaign:
ship, crew, roles, inventory, funds/ledger, a fog-of-war map, quests, journal, and a
DM tab. Everything persists to Supabase and syncs live to every open browser. React +
Vite SPA, deployed to GitHub Pages.

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

**Edit gate.** Everything is world-readable and world-writable at the DB level (public
anon key, open RLS). Editing in the UI is gated by a shared passphrase stored in the
`settings` table (`edit_passphrase`). `canEdit` from `useData()` toggles editability
everywhere; `EditGate.jsx` handles unlock/lock/change. This is a soft deterrent, **not
real security** — do not treat the client gate as an authorization boundary.

**Drag-and-drop** uses `@dnd-kit` wrapped by `src/components/common/Dnd.jsx`
(`Draggable`/`Droppable`) so every tab drags the same way.

**Dice + rolls.** `src/lib/dice.js` has pure roll/parse helpers (`parseExpr`,
`rollD20`, `abilityMod`). Any roll from anywhere calls `useRoller().show()` from
`src/context/RollContext.jsx`, which plays a sound and pops the global animated overlay.

**Provider nesting** (`src/main.jsx`): `DataProvider` → `RollProvider` → `App`.

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
`ledger_entries`, `map_locations`, `quests`, `journal_entries` (collections); `settings`
(key/value). All have Realtime enabled. `crew_members.roles` is a `text[]` (multiple
stations per hand); `crew_members.sheet_data` holds the normalized D&D Beyond sheet.
