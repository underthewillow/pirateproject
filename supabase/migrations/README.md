# Database migrations

This folder is the **source of truth for the database's shape**. Every change to
the Supabase schema (new table, new column, changed type, new policy, etc.) gets
recorded here as a numbered `.sql` file, so anyone on the team can see the full
history of how the database got to where it is — and, if we ever need to, rebuild
it from scratch on a fresh Supabase project.

## Why we do this

Supabase is a *single shared live database*. When someone changes the schema in
the dashboard, that change is invisible to everyone else — there's no record in
git, and a teammate whose code expects the old shape can suddenly break. Writing
each change down here fixes that: the change lives in a pull request, gets reviewed,
and travels with the code that depends on it.

## The convention

- Files are numbered in order: `0000_...`, `0001_...`, `0002_...`. The number is
  what fixes the order they must be applied in. Never renumber an existing file.
- One logical change per file. Give it a short snake_case name after the number,
  e.g. `0002_add_weather_to_journal.sql`.
- Write changes so they're safe to run more than once where practical
  (`create table if not exists`, `add column if not exists`,
  `drop policy if exists` before `create policy`). This makes them forgiving.
- **Additive changes are safe; destructive ones are not.** Dropping or renaming a
  column, or changing a type, can break the live app for everyone the moment it
  lands. Coordinate those, and take a backup of the affected tables first.

## How a schema change actually reaches the database

`0000_baseline_schema.sql` reflects the live database **as of 2026-07-04**; it is
documentation of the current state and does **not** need to be run against the
existing project. For every change *after* that:

1. Add the new numbered `.sql` file here in the same commit/PR as the code that
   needs it.
2. Apply the SQL to the live database (via the Supabase SQL editor, or Claude runs
   it through the Supabase tooling). Applying it and committing the file are two
   separate steps — do both, so the file and the live database stay in agreement.
3. Note in the PR that a migration is included so reviewers know the database is
   changing, not just the code.

## Rebuilding on a fresh project

Running every file here in order against a brand-new Supabase project reproduces
the schema, the row-level-security policies, and the realtime setup. It does **not**
restore campaign content (crew, quests, the map, etc.) — that's data, not schema.
Data lives in the live database and is backed up separately.
