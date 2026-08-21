# OC Lead Desk

A sales workspace for a ~40,000-row med spa lead list: search and filter the list, work leads
through a pipeline, log every call/email/DM, and see what is warm, due, and won.

**Stack:** Next.js 16 (App Router, React Server Components) · Supabase (Postgres + Auth + RLS) ·
Tailwind v4 · deployed to Cloudflare Workers via `@opennextjs/cloudflare`.

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Apply every file in `supabase/migrations/` with the CLI:

   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```

3. Copy the env file and fill it in from **Project Settings → API**:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where it is used |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | app + import script |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app (safe in the browser — RLS constrains it) |
   | `SUPABASE_SERVICE_ROLE_KEY` | import script only — **never** deploy this to the Worker |

4. In **Authentication → Providers**, keep email/password on. Everyone who signs up sees the same
   shared pipeline, so turn off open sign-ups (or add an allowlist) once your team has accounts.

## 2. Import the lead list

The importer reads the spreadsheet's own headers (`Company Name`, `Google Star Rating`,
`Number of Locations`, …) and maps them case/space/punctuation-insensitively.

```bash
npm run import:leads -- data/sample-leads.csv --dry-run   # parse only, write nothing
npm run import:leads -- data/leads.csv                    # CSV
npm run import:leads -- data/leads.xlsx                   # Excel
npm run import:leads -- data/leads.csv --batch=1000
```

Drop a `.csv` or `.xlsx` in Settings → Import list, or run the CLI. What it does:

- **Idempotent.** Rows upsert on `dedupe_key` (company + street + ZIP), so re-running a refreshed
  scrape updates business data instead of creating duplicates.
- **Never clobbers sales data.** Only scraped columns are written — `status`, `owner_id`, `notes`,
  `tags`, `deal_value` and follow-up dates survive every re-import.
- **Cleans as it goes.** Categories split on `;` (the first becomes `primary_category`), the Google
  CID is pulled out of the maps URL, states are upper-cased, emails lower-cased, blanks become
  `NULL`, and duplicates inside the file are dropped before they reach the database.

40k rows takes a couple of minutes at the default batch size.

## 3. Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Sign up, and you are in. `npm run typecheck` and `npm run build` are the two checks worth running
before a deploy.

## 4. Deploy to Cloudflare

```bash
npx wrangler login
```

Put the two public values in `wrangler.jsonc` under `vars` (they ship to the browser regardless),
then:

```bash
npm run cf:preview   # build + run the real Worker locally
npm run cf:deploy    # build + publish
```

`npm run cf:typegen` regenerates `cloudflare-env.d.ts` if you add bindings.

---

## What is in the app

**Dashboard** — pipeline counts by stage, warm/won totals, open pipeline value, follow-ups due,
top states, and a live activity feed.

**Leads** — the working surface over the whole list:

- Prefix full-text search across name, city, category, email, phone and address (`derma spa`
  matches `DermaCare Premier Medical Spa`), debounced so a 40k-row count does not run per keystroke.
- Filters: status, state, owner (incl. *assigned to me* / *unassigned*), category, Google rating,
  review count, location count, follow-up window, and "must have email / phone / website /
  Instagram / online booking" — the qualification signals that decide who is worth a call.
- Sort by any of eight columns, 25–200 rows per page, server-side pagination with a stable
  tie-break so rows never repeat across pages.
- Inline status changes, multi-select with bulk actions (set status, assign to me, schedule a
  follow-up, select all matching), and CSV export of the current filter.
- Every filter lives in the URL, so a view like "WA, 4.5★+, 100+ reviews, has email, never
  contacted" is a bookmark you can share.

**Lead detail** — the full business record with click-to-call/email links, socials, booking URL
and Google listing; a pipeline panel (status, priority, owner, next follow-up, deal value, tags,
notes); a "log activity" form that records the touch, moves the stage and schedules the next
follow-up in one submit; and a complete history timeline.

## Data model

`leads` carries the scraped business columns plus the sales columns (`status`, `priority`,
`owner_id`, `notes`, `tags`, `deal_value`, `next_follow_up_at`, `last_contacted_at`).
`lead_activities` is the append-only log, and `profiles` mirrors `auth.users` so leads can be
assigned to a teammate by name.

Pipeline stages: `new → contacted → follow_up → interested → meeting_booked → proposal_sent →
won`, with `lost`, `not_interested`, `unqualified` and `do_not_contact` as terminal states.

The database does the bookkeeping so it cannot be skipped:

- status changes and re-assignments write an activity row automatically, whoever made them;
- logging a call/email/SMS/DM/meeting bumps `last_contacted_at`;
- `updated_at` and `status_changed_at` maintain themselves;
- a `tsvector` search column is kept current by trigger.

Indexes cover every filter and sort path (GIN for search/tags/categories, trigram for fuzzy name
and city matching, btree for status/state/owner/dates/ratings). Measured on 40k seeded rows, the
filtered-and-counted page query the UI issues runs in ~30–45 ms.

## Security model

- **One shared team pipeline.** Any signed-in teammate can read and work every lead; RLS blocks
  everyone else. Deleting leads is not granted to anyone — bulk changes belong to the import
  script, which uses the service role key.
- **Authorization is server-side, not in the UI.** Every page, Server Action and Route Handler
  calls `requireUser()` before touching data, all queries run through a `server-only` data access
  layer under the caller's identity, and RLS is the backstop if any of that is ever bypassed.
- **Inputs are validated with Zod** inside each Server Action — Server Actions are public HTTP
  endpoints, so the checks live in the function, not the form.
- Activity rows can only be written as yourself, and only edited or deleted by their author.

### One deployment note

Next 16 runs `proxy.ts` (the old `middleware.ts`) on the Node.js runtime only, and the Cloudflare
adapter cannot deploy Node middleware — so this app has no middleware. Two consequences, both
handled: signed-out visitors are redirected by the authenticated layout rather than at the edge,
and the Supabase session is refreshed in the browser by `components/session-sync.tsx`, which
rewrites the auth cookie the server reads. Authorization never depended on middleware.

## Where things live

```
app/(app)/dashboard        pipeline overview
app/(app)/leads            list, filters, bulk actions
app/(app)/leads/[id]       lead detail, activity log, history
app/api/leads/export       streaming CSV export of the current filter
lib/dal/                   server-only data access (auth + leads)
lib/actions/               Server Actions (validated, authorized)
lib/leads/query.ts         URL ⇄ filter state, shared by server and client
supabase/migrations/       schema, triggers, RLS, reporting functions
scripts/import-leads.mjs   bulk CSV / Excel importer
```
