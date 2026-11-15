# Qisma (قِسمة)

Personal salary-splitting web app for a single user. When income arrives, the
user enters the amount; the app splits it across budget buckets by rules, then
shows which transfers to make between real bank accounts.

## Design direction

**Concept: the split bar.** The amount is one horizontal bar. As the user types
the amount, the bar divides into coloured segments, one per bucket, in priority
order. The last segment is the remainder. It appears on the distribution
preview, the home screen (last distribution), and bucket settings. Everything
else stays quiet so the bar is the only loud thing on screen. In RTL the bar
fills from the inline-start (right) edge.

**References** (techniques only — never copy assets, layout or code):
- Copilot Money: home opens on summary cards and progress bars, not lists.
- Monzo Salary Sorter: adjust each line with + / - or type an exact figure on
  the preview before confirming.
- Jeton: strict single-accent palette.

### Tokens

Defined as CSS variables in `app/globals.css` and exposed to Tailwind via
`@theme inline`. Use the Tailwind names (`bg-surface`, `text-muted`, ...), never raw hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F6F5F1` | `#0F1113` | page background |
| `surface` | `#FFFFFF` | `#181B1E` | cards, nav |
| `ink` | `#15171A` | `#F2F1ED` | primary text |
| `muted` | `#6B7078` | `#9AA0A6` | secondary text |
| `hairline` | `#E4E2DC` | `#26292D` | borders, dividers |
| `accent` | `#0E7C66` | `#34C6A4` | actions and the remainder segment **only** |
| `on-accent` | `#FFFFFF` | `#0F1113` | text on accent |
| `danger` | `#B3372B` | `#E5766A` | error text only (functional, not part of the palette) |

**Bucket colours** — `bucket-1` … `bucket-8`, a muted categorical palette. Used
ONLY inside the split bar and as a small dot next to a bucket name. Never text,
never card backgrounds. No green hue: green is the remainder.

| | 1 blue | 2 ochre | 3 plum | 4 terracotta | 5 slate | 6 rose | 7 olive | 8 indigo |
|---|---|---|---|---|---|---|---|---|
| Light | `#4F7CAC` | `#A67722` | `#8A5A9E` | `#B9644A` | `#5F6B7A` | `#B5577A` | `#7A8540` | `#5A5FB0` |
| Dark | `#7FA6D6` | `#D9AE5F` | `#B58CC8` | `#DE8E73` | `#94A0B0` | `#DB88A6` | `#AAB56C` | `#8E93DB` |

**Contrast (WCAG AA, checked):** every text pair is >= 4.5:1 with the hex values
as specified — the tightest is `muted` on `bg` in light, 4.57:1 — so none were
adjusted. Bucket colours and accent are >= 3:1 against `bg` and `surface` in
both themes (non-text contrast). Re-check any pair you add.

Theme follows `prefers-color-scheme`; `:root[data-theme="light|dark"]` overrides
it (manual toggle comes later).

- **Font:** IBM Plex Sans Arabic everywhere (400/500/600/700). Tabular numerals, Western digits (0-9).
  Every amount gets the `.amount` class and is produced by `formatAmount`.
- **Type scale:** amount display 40 / 28 / 20 = `text-display / text-title / text-heading`,
  body 16 = `text-base`, label 13 = `text-label`. Nothing else.
- **Radius:** 16px cards `rounded-card`, 12px inputs and buttons `rounded-control`.
- **Spacing:** 4px grid (Tailwind default scale).
- **Motion:** 200ms UI state (Tailwind default transition, `--duration-ui`), 450ms split-bar
  segments (`--duration-bar`), easing `cubic-bezier(0.22, 1, 0.36, 1)` (`ease-out`).
  No scroll effects, WebGL or parallax. Honour `prefers-reduced-motion`.
  `motion` is for UI animation only, never for logic.

## Stack

- **Next.js 16** (App Router, TypeScript) — server components + server actions cover the
  whole app with no separate API layer; first-class on Vercel.
- **Tailwind CSS v4** — tokens as CSS variables, logical-property utilities for RTL.
- **Supabase** (Postgres + auth) via `@supabase/supabase-js` + `@supabase/ssr` — the app
  uses only the **publishable key** and Row Level Security. No secret key, no DB password, ever.
- **motion** — UI animation only.
- **Vitest** — unit tests for pure logic (money, allocation).
- **Vercel** — deploy target.

Next 16 note: the request interceptor file is `proxy.ts` (was `middleware.ts`). It
refreshes the Supabase session with `supabase.auth.getClaims()` and redirects
signed-out requests to `/login`. Server code protects data with `getClaims()`, never `getSession()`.

## Folder structure

```
app/
  layout.tsx          html lang="ar" dir="rtl", font, globals
  globals.css         design tokens (light/dark) + Tailwind theme
  login/              sign-in page + server action (no sign-up)
  (app)/              authenticated shell
    layout.tsx        bottom tab bar (mobile) / side rail (desktop)
    page.tsx          الرئيسية
    distribute/       توزيع
    history/          السجل
    settings/         الإعدادات
components/           shared UI
lib/                  pure domain logic, no React, no Supabase (money.ts, allocate.ts) + tests
utils/supabase/       client.ts, server.ts, proxy.ts (session refresh)
supabase/migrations/  SQL migrations (schema, RLS, views, confirm_distribution)
proxy.ts              Next 16 proxy entry
```

## Conventions

- **Money is integer halalas** (1 SAR = 100 halalas). Never floats, anywhere: DB columns
  are integers, parsing goes string → halalas without passing through a float.
  Use `lib/money.ts` (`parseAmount`, `formatAmount`) for all input and display.
- **The allocation function is pure** and lives in `lib/`, outside the UI. Given an
  amount and rules it returns the split; it does no I/O and is unit-tested.
- **Confirmed distributions are never edited.** Corrections are made with a new
  adjustment entry.
- **RTL:** logical properties only (`ps/pe/ms/me`, `start/end`, `border-s/e`). Never `left/right`,
  `pl/pr`, `ml/mr`.
- **Digits are always Western (0-9)**, including inside Arabic text.
- **Secrets:** `.env.local` is git-ignored; `.env.example` has empty values. Never commit real keys,
  the secret key, or the database password.
- **The repo is public on purpose.** Never put real personal amounts in code, tests, seed data
  or screenshots. Use the 10,000 SAR example values only.

## Allocation rules (`lib/allocate.ts`)

`allocate(amount, lines)` returns `{ ok: true, allocations }` or `{ ok: false, error }`.
Percent values are basis points (10% = 1000).

1. Lines with `enabled = false` are ignored.
2. Exactly one enabled `remainder` line must exist, else error `remainder`.
3. Fixed lines are taken first, in priority order.
4. Percent lines are computed from the FULL amount, rounded DOWN to a whole riyal.
5. A line with `override` uses it instead of its rule (ignored on the remainder line).
6. If fixed + percent > amount: error `shortfall` with the missing halalas. Never negative.
7. The remainder gets amount minus everything else, including rounding leftovers.
8. Invariant: allocations sum exactly to amount.

Errors are codes plus data; the UI turns them into Arabic text.
`percentToAmount` / `amountToPercent` convert a rule against the reference income for settings.

## Database

Schema lives in `supabase/migrations/`. Tables: `accounts`, `buckets`, `incomes`, `entries`,
`settings`. Every table has `user_id` and RLS (own rows only, signed-in users only).

- **No bank account numbers, IBANs or bank credentials anywhere.** An account is just a name.
- **Balances are never stored.** Read them from the views `bucket_balances` (sum of entries per
  bucket) and `account_balances` (sum of bucket balances per account).
- **Immutability is enforced by the database**, not just by convention: the client cannot
  insert/update/delete `incomes`, cannot update or delete `entries` (except the `transfer_done`
  flag), and cannot insert `allocation` entries directly.
- **Confirming a distribution is one call:** `rpc('confirm_distribution', { p_id, p_amount,
  p_received_on, p_note, p_snapshot, p_allocations })`. It inserts the income and all its
  allocation entries atomically and rejects allocations that do not sum to the amount.
  `p_id` is a client-generated uuid, so a double submit fails instead of recording twice.
- `incomes.snapshot` stores the exact lines and rules used, so history survives rule changes.
- `buckets.color` is 1..8 and maps to the `bucket-N` design tokens.
- Applying migrations: paste the file into the Supabase dashboard SQL Editor and run it
  (no database password needed). New changes go in a NEW migration file; never edit an applied one.

## Domain glossary

- **Account** (حساب) — a real bank account money physically sits in.
- **Bucket** (بند) — a budget category (rent, savings, ...). Each bucket lives in one account.
- **Rule** — how a bucket gets its share of an income:
  `fixed` (a set amount), `percent` (a share of the income), `remainder` (whatever is left).
- **Income** (دخل) — one arrival of money (e.g. a salary) with an amount and date.
- **Distribution** (توزيع) — the confirmed split of one income across buckets. Immutable.
- **Entry** (قيد) — one line in the ledger: an amount moved into/out of a bucket, either
  from a distribution or as a correcting adjustment.

## Commands

```
npm run dev      # dev server on http://localhost:3001
npm test         # vitest run
npm run lint     # eslint
npm run build    # production build
```

Deploy: import the repo in Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in project env vars; pushes to `main` deploy.

## Current status

**Phase 1 (setup) — complete, merged to `main`.** Scaffold, tokens, money helper, Supabase auth
(sign-in/sign-out verified live), app shell. Not deployed to Vercel yet.

**Phase 2 (engine) — complete, merged to `main`.**

Done and verified:
- `lib/allocate.ts` (+ `percentToAmount`, `amountToPercent`) with 9 tests, including the
  10,000 SAR example and a 5,000-case property test. `npm test`: 13 passing.
- `supabase/migrations/20261115120000_schema.sql`: 5 tables, RLS, 2 balance views,
  `confirm_distribution()`. **Applied to the real Supabase project** (owner ran it in the SQL
  Editor; all 5 tables report `rowsecurity = true`).
- Signed-out probe of the real project with the publishable key: every table, both views, an
  insert and the function all return `42501 permission denied`.
- User isolation, atomic rollback, double-submit rejection, immutability and balances were
  checked on a throwaway local Postgres 16 with a stubbed `auth` schema.

Not verified yet:
- The signed-in path against the real project (reading/writing own rows, calling
  `confirm_distribution`). It gets exercised when phase 3 wires the UI to the tables.

Not done yet:
- Nothing in the UI uses the engine or the tables yet.
- `motion` unused; manual theme toggle; Vercel deploy.

Next: phase 3 (settings UI for accounts and buckets, the split bar, distribution preview and confirm).
