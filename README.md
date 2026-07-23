# CQC Compliance Intelligence Bulletin

An MVP for a SaaS product that helps UK care home operators stay ahead of CQC
regulatory changes. This build prioritises the two parts worth demoing to real
care home managers before investing in an automated scraping pipeline: the
**admin content pipeline** (turn a raw regulatory update into a structured
bulletin entry) and the **customer dashboard** (a filterable, plain-English
feed of those entries).

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4
- SQLite via Prisma 7 (driver adapter: `@prisma/adapter-better-sqlite3`)
- Custom email/password auth (signed session cookie via `jose`, no external
  auth provider — see [Auth](#auth) below)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The database
(`dev.db`, SQLite) and its migrations are already included, seeded with 6
realistic bulletin entries and two demo accounts, so the app isn't empty on
first run.

If you want to reset the database from scratch:

```bash
rm -f dev.db
npx prisma migrate dev
npx prisma db seed
```

### Demo accounts

| Role     | Email                              | Password        |
| -------- | ----------------------------------- | ---------------- |
| Customer | manager@sunnymeadowscare.co.uk      | DemoPass123!      |
| Admin    | admin@cqcbulletin.co.uk             | AdminDemo123!     |

The login page also shows these credentials for convenience during a demo.

## What's built

- **Landing page** (`/`) — value proposition, "how it works", pricing tiers
  (Solo Home / Small Group / Multi-Site), signup CTA.
- **Signup / login** (`/signup`, `/login`) — email/password auth, tier
  selection at signup.
- **Admin content pipeline** (`/admin`) — paste a raw update's title, source
  and text; a rule-based generator drafts a summary, impact score (High /
  Medium / Low), affected topics, CQC regulated activities, and an action
  checklist. Every field is editable before saving as a draft or publishing.
  See [`src/lib/bulletin-generator.ts`](src/lib/bulletin-generator.ts).
- **Admin entries list** (`/admin/entries`) — all entries, publish/unpublish,
  edit, delete.
- **Customer dashboard** (`/dashboard`) — chronological feed of published
  entries, filterable by impact level and topic; each entry has a detail page
  with the full action checklist.
- **Email digest preview** (`/dashboard/digest`) — renders the HTML email a
  subscriber would receive (rendered preview + raw HTML source). Preview
  only — nothing is actually sent in this MVP.
- **Account / subscriber management** (`/dashboard/account`) — care home
  name, plan tier, and a mocked billing status (no payment provider wired
  up).

## The content generator is a mock

`generateBulletin()` is a deterministic, keyword-based heuristic — not a call
to an LLM. It exists so the *shape* of the pipeline (raw text in → structured,
editable bulletin entry out) can be validated with real users before
committing to a specific AI provider and prompt design. Swapping it for a
real model call later shouldn't require touching the admin form, the review
UI, or the data it writes — see the module for the extension point.

## Auth

The brief asked for NextAuth; this build uses a small custom
email/password + signed-cookie session (`src/lib/session.ts`,
`src/lib/password.ts`, `src/proxy.ts`) instead. At the time of writing,
NextAuth (Auth.js) v5 is still in beta and its peer dependencies target
Next 14/15, which doesn't line up with the Next 16 / React 19 versions
`create-next-app` installs here. A hand-rolled session is small enough to
audit directly and avoids that version mismatch; swapping in NextAuth or
another provider later is a contained change (session creation/verification
is centralised in those three files).

## Data model

See [`prisma/schema.prisma`](prisma/schema.prisma). SQLite has no native
enum or array types, so impact level, status, tier, etc. are plain strings
validated against TypeScript union types in [`src/lib/types.ts`](src/lib/types.ts),
and list-shaped fields (topics, regulated activities, action checklist) are
stored as CSV / JSON strings and parsed back into typed arrays by
[`src/lib/bulletin-view.ts`](src/lib/bulletin-view.ts).

## Not built yet (by design, for this MVP)

- Automated scraping/ingestion from CQC, Skills for Care, DHSC, UKHSA, etc.
  — the admin pipeline assumes a human pastes in the raw update.
- Real outbound email sending — the digest is preview-only.
- Real payment processing — billing status is a manually-toggled mock.
