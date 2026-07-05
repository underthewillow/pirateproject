# ☠ The Captain's Log — Pirate Campaign Manager

A login-gated web app for tracking a pirate D&D crew: the ship, the crew,
their roles, inventory & cargo, funds & ledger, a map of charted waters, and a
posterboard of quests. Everything saves to a Supabase database and syncs live to
everyone who has the page open. Styled like a captain's log — parchment, ink,
brown leather and wood.

## What's inside

- **The Ship** — portrait, stat bars, upgrades, captain's notes.
- **The Crew** — drag hands between *Aboard*, *Ashore*, and the *Available* reserve. Click any hand to open their character sheet.
- **Crew Roles** — drag hands onto the ten stations (Captain, Boatswain, Quartermaster, Navigator, Gunmaster, Master at Arms, Cook, Surgeon, Rigger, Carpenter).
- **Inventory** — two cargo holds plus the party's packs; drag items between them.
- **Funds & Ledger** — coin purse plus a running ledger of income and expenses.
- **The Map** — drop and drag markers on a chart; mark places discovered or unknown.
- **Posterboard** — main quests and side quests you can mark done.

Logging in is required to see anything — either with SSO (via a self-hosted
Authentik instance) or a local breakglass admin password, set from **⚙ Settings
→ Authentication** (admin only). New logins start out read-only with no roles
at all; an admin grants **Crew Member**/**DM**/**Admin**/etc. from **⚙ Settings
→ User Management**.

## Running it locally

You need [Node.js](https://nodejs.org) (18+). Then:

```bash
npm install
npm run dev
```

Open the printed URL (it will end in `/pirateproject/`).

## Deploying to GitHub Pages

This repo includes a workflow at `.github/workflows/deploy.yml`. Once the code is
on the `main` branch of `github.com/underthewillow/pirateproject`:

1. Go to the repo's **Settings → Pages**.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually). It builds and publishes to
   `https://underthewillow.github.io/pirateproject/`.

## Changing things

The project is built to be easy to extend:

- **Add or rename a tab:** edit `src/config/tabs.js` and add a component in `src/components/tabs/`.
- **Crew, roles, quests, etc.** are all rows in the database — add them in-app (as an admin or DM) or in the Supabase table editor.
- **Colours, fonts, textures** all live as CSS variables at the top of `src/styles/theme.css`.
- **Supabase connection** is in `src/config/supabaseConfig.js` (the publishable key is safe to ship in a public app).

## Data model (Supabase)

Tables: `ship`, `crew_members`, `roles`, `inventory_items`, `funds`,
`ledger_entries`, `map_locations`, `quests`, `settings`, `app_users`. Row-level
security is on but open to the public anon key — access control (who can log in,
who can edit) is enforced in the app, not the database, so this is a soft
deterrent, not real security. All tables have Realtime enabled so edits appear
for everyone instantly.

To harden later: trust the OIDC-issued JWT at the database layer (Supabase
supports this for any standards-compliant OIDC provider — see "Third-party auth"
in their docs) and tighten RLS to require it, rather than leaving every table
open to the anon key.
