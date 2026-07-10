# Avarent Outbound

**The internal outbound sales operating system for Avarent.** A single, fast, deterministic
workspace that replaces a stack of separate tools — CRM, sequencer, sending platform, unified
inbox, analytics, and deliverability monitoring — built for a two-person founding team.

Nearly everything is **deterministic code, not LLMs**. AI is optional, isolated, and off by
default — used only where it has clear ROI (low-confidence reply classification and opt-in
writing assistance).

---

## Quick start (demo mode)

```bash
npm install
npm run dev
# open http://localhost:3000  →  sign in as George or Lucas (no password needed)
```

The app boots in **demo mode**: a rich, seeded dataset (45 companies, ~90 contacts, campaigns,
sequences, templates, hundreds of emails, threads, meetings, analytics) lives entirely in your
browser (`localStorage`). Everything is fully interactive — create campaigns, move pipeline
cards, run crawls, review the follow-up queue, mark replies — with zero backend.

Use the avatar menu → **Reset demo data** to regenerate a fresh dataset.

---

## Architecture

```
src/
├─ app/
│  ├─ (app)/…            # authenticated app routes (dashboard, leads, campaigns, inbox, …)
│  ├─ login/             # sign-in
│  └─ api/
│     ├─ crawl/          # deterministic server-side website crawler (live)
│     └─ worker/tick/    # background worker — drains the email queue (cron)
├─ components/
│  ├─ ui/                # design-system primitives + SVG charts (no chart deps)
│  ├─ shell/             # sidebar, topbar, command palette (⌘K)
│  └─ shared.tsx         # PageHeader, StatCard, …
└─ lib/
   ├─ types.ts           # the domain model (single source of truth)
   ├─ store.ts           # Zustand store — the demo "database" + all mutations + audit log
   ├─ seed.ts            # deterministic seed-data generator
   ├─ engines/           # ★ the deterministic core — NO AI ★
   │  ├─ analytics.ts    #   every dashboard/report metric
   │  ├─ stats.ts        #   two-proportion z-test, Wilson score, trends (A/B + insights)
   │  ├─ scoring.ts      #   explainable opportunity scoring from configurable rules
   │  ├─ scheduler.ts    #   business-hour sending, natural spread, sequence timing
   │  ├─ crawler.ts      #   URL/HTML parsers: emails, socials, tech signatures, page class
   │  ├─ merge.ts        #   {{variable}} + /snippet template rendering
   │  ├─ dedup.ts        #   contact/company dedup + email validity
   │  ├─ import.ts       #   CSV/Excel/website-list normalization & validation
   │  ├─ classify.ts     #   deterministic reply sentiment/intent classifier
   │  ├─ followups.ts    #   daily follow-up queue generation
   │  └─ insights.ts     #   Learning Center findings (statistics, not AI)
   ├─ email/             # provider-agnostic sending: Resend + SMTP adapters
   ├─ supabase/          # browser/server/admin clients (live mode)
   └─ ai/                # OPTIONAL, off by default — reply-classify + writing assist
```

### Data layer: demo ↔ live

`NEXT_PUBLIC_DATA_MODE` switches the source of truth:

- **`demo`** (default): the Zustand store in `lib/store.ts` is the database, seeded from
  `lib/seed.ts`, persisted to `localStorage`. No credentials required.
- **`live`**: the same domain model is backed by Supabase (Postgres + Auth + Storage +
  Realtime). Schema in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
  mirrors `lib/types.ts` exactly, with workspace-scoped Row-Level Security.

The deterministic **engines never touch storage** — they're pure functions over the domain
types, so they behave identically in both modes and are trivially testable.

---

## Feature map

| Area | Route | Notes |
|---|---|---|
| Executive dashboard | `/dashboard` | Real-time KPIs, funnel, task list, weekly/monthly |
| Pipeline | `/pipeline` | Drag-and-drop kanban, time-in-stage, conversion/drop-off |
| Lead database | `/leads` | Sortable grid, saved views, bulk actions, CSV export, auto-dedupe |
| Company profiles | `/companies/[id]` | Enrichment, tech stack, timeline, notes, attachments, meetings |
| Campaigns | `/campaigns` | Sequence, sending accounts, business hours, stop rules, approval |
| Sequence builder | `/sequences` | Visual drag-and-drop (Email → Wait → Follow-up → Stop on Reply) |
| Templates | `/templates` | Variables, snippets, live merge preview, reply-rate ranking |
| Follow-up queue | `/follow-ups` | Daily review/edit/skip/send, bulk approve & send |
| Unified inbox | `/inbox` | Threads, sentiment, assign, snooze, archive, meeting-booked |
| LinkedIn companion | `/linkedin` | **Compliant** — status + notes only, no automation |
| Website crawler | `/crawler` | Deterministic — regex + HTML signatures, **no AI** |
| Import wizard | `/import` | CSV / Excel / website list / paste → validate → dedupe |
| Analytics | `/analytics` | Campaign, template, subject, timing, sender, industry, funnel |
| A/B testing | `/ab-testing` | Two-proportion z-test → statistically significant winners |
| Learning Center | `/learning` | Statistical insights (Wilson score), not AI |
| Deliverability | `/deliverability` | Bounce, SPF/DKIM/DMARC, reputation, proactive warnings |
| Meetings | `/meetings` | Schedule, outcomes, next actions |
| Activity feed | `/activity` | Complete audit trail |
| Settings | `/settings` | Team & roles, sending accounts, opportunity scoring, snippets |
| Global search | `⌘K` | Companies, leads, campaigns, templates, meetings, navigation |

---

## Going live with Supabase

1. Create a Supabase project.
2. Run the migration: paste `supabase/migrations/0001_init.sql` into the SQL editor
   (or `supabase db push`).
3. Create a workspace + memberships for George and Lucas, and enable Supabase Auth.
4. Set env (`.env.local`):

```bash
NEXT_PUBLIC_DATA_MODE=live
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…      # server-only, used by the worker (bypasses RLS)
```

Every table is workspace-scoped and RLS-enforced; the service-role key is only ever used
server-side by the background worker.

## Email sending

Set either provider (or both — sending accounts pick their adapter):

```bash
RESEND_API_KEY=…                 # primary transactional provider
SMTP_HOST=… SMTP_PORT=587 SMTP_USER=… SMTP_PASS=…   # any mailbox
```

Sends are **queued** (`email_queue`), scheduled deterministically inside business hours with
natural spread and per-account daily limits, and drained by the worker. Stop-on-reply, retries
with backoff, and bounce handling are built in.

## Background worker (cron)

The worker drains the send queue. It's a protected route triggered on a schedule:

```bash
WORKER_SECRET=…                  # required to invoke the worker
```

- **Vercel**: `vercel.json` already schedules `/api/worker/tick` every 10 minutes
  (set `CRON_SECRET` in Vercel; cron sends it as a bearer token).
- **Anything else**: `curl -X POST https://your-app/api/worker/tick -H "x-worker-secret: $WORKER_SECRET"`

In demo mode (no service key) the worker is a safe no-op.

## Optional AI (off by default)

Per Avarent's philosophy, AI is disabled unless you opt in:

```bash
AI_ENABLED=true
ANTHROPIC_API_KEY=…
```

When enabled it's used only for (1) **reply classification** on the small fraction of replies
the deterministic classifier is unsure about, and (2) **opt-in writing assistance** that never
auto-sends. Uses the cost-efficient `claude-haiku-4-5` model. With AI off, both fall back to
deterministic behavior.

---

## Scripts

```bash
npm run dev         # dev server (Turbopack)
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run start       # serve production build
```

## Tech

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Zustand · Supabase · Resend / Nodemailer ·
dnd-kit · cmdk · Papaparse · custom SVG charts. Deploys to Vercel.
