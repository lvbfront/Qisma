# Qisma (قِسمة)

Personal money app for a single user, built around one job: when income arrives,
the user enters the amount; the app splits it across budget buckets by rules, then
shows which transfers to make between real bank accounts.

Two things hang off the buckets:
- **Subscriptions** — recurring payments (monthly, yearly, every N months). The app shows
  what is due next, what they cost per month and per year, and "mark as paid" records
  the spend and moves the due date forward.
- **Investments** — one bucket is the investment bucket; its balance is "available to
  invest". Money placed with investing apps is tracked per placement (where, how much,
  when it is expected back, what came back) so the user never loses track of it.
  Cost basis only: no market prices, no unrealised gains.

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
    page.tsx          الرئيسية: accounts, pending transfers, last distribution, buckets,
                      and two marked SLOTs (subscriptions, investments) for later prompts
    buckets/[id]/     bucket detail: balance, entries, actions.tsx (تسجيل صرف, تعديل الرصيد)
    investments/      الاستثمار
    distribute/       توزيع (the primary action): page.tsx (server loader), distribute.tsx
                      (steps 1-2: amount, preview), transfers.tsx (step 3: checklist at
                      ?income=<id>), data.ts (checklist + pending queries, grouping)
    subscriptions/    الاشتراكات
    more/             المزيد (mobile only: links to السجل and الإعدادات)
    history/          السجل: incomes with their split; snapshot.ts reads incomes.snapshot
    settings/         الإعدادات: page.tsx (server loader), settings.tsx (amounts), accounts.tsx,
                      buckets.tsx (list + editor), preview.tsx, data.ts (types, queries), use-writes.ts
components/           shared UI:
  nav.tsx             5 items on mobile, 6 destinations on desktop
  split-bar.tsx       THE split bar. Reuse it; never re-draw it.
  bucket-color.ts     bucketBg() for segments and colour dots (plain module: server + client)
  sheet.tsx           modal on native <dialog>: bottom sheet on mobile, card on desktop
  sortable.tsx        drag-to-reorder list (handle, or arrow keys on the handle)
lib/                  pure domain logic + tests, no React, no Supabase:
                      money.ts, dates.ts, allocate.ts, subscriptions.ts, investments.ts
utils/supabase/       client.ts, server.ts, proxy.ts (session refresh)
supabase/migrations/  SQL migrations, applied in filename order
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
- **Reading Supabase in a server component:** put it in an async component inside `<Suspense>`
  and call `await connection()` before `createClient()` (see `settings/page.tsx`). Cache
  Components is on, and the Supabase client reads the clock, which is only allowed at request time.
- **Browser Supabase client:** `supabaseBrowser()` from `utils/supabase/client.ts`, called
  inside event handlers, never during render (same clock rule). Client-side writes rely on RLS; nothing is trusted from the browser.
- **Percentages** are basis points in data and `formatPercent()` on screen (it is bidi-safe;
  a bare "38%" after Arabic text is drawn as "%38"). A typed percent is read with `parseAmount()`.
- **Dates** are ISO `YYYY-MM-DD` strings in data and `formatDate()` on screen ("15 نوفمبر 2026");
  a bare ISO date is reordered by RTL text. "Today" comes from the server in Asia/Riyadh.
- **Signed amounts** (ledger entries) use `formatSigned()`: "+500 ر.س" / "-200 ر.س". A bare
  "+50" in RTL text is drawn as "50+".
- **Functions called from server components** must live in a plain module, not in a
  `"use client"` file (that is why `bucketBg` is in `bucket-color.ts`). The build does not
  catch this on dynamic pages; only loading the page does.
- **`usePathname()` and other URL reads in client components** go behind `<Suspense>` (see
  `nav.tsx`), or dynamic routes fail to build.
- **Manual changes to a bucket only add entries:** a spend is a negative `spend` entry; setting
  the balance records an `adjustment` entry for the difference. Each form generates its entry id
  once, so a double submit is rejected by the primary key.
- **Empty states:** every screen has one, and it names the single next action with a button.
- **Switches** are `<input type="checkbox" role="switch" class="switch">`.
- **Warning colour** is the `danger` token, for both blocking errors and soft warnings.
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
`settings`, `subscriptions`, `investments`. Every table has `user_id` and RLS (own rows only,
signed-in users only; signed-out callers have no access at all).

- **No bank account numbers, IBANs or bank credentials anywhere.** An account or an
  investing platform is just a name.
- **Balances are never stored.** Read them from views: `bucket_balances` (sum of entries per
  bucket), `account_balances` (sum of bucket balances per account).
- **Entries are the ledger and are immutable**, enforced by the database: the client cannot
  update or delete `entries` (except the `transfer_done` flag) and can insert only plain
  `spend` / `adjustment` / `transfer` entries. `incomes` and `investments` money fields are
  read-only to the client.
- **Money movements go through Postgres functions**, each atomic and safe against a double
  submit (the app generates the id with `crypto.randomUUID()` and a repeat is rejected):

  | Function | Does | App-generated id |
  |---|---|---|
  | `confirm_distribution` | income + all its `allocation` entries; must sum to the amount | the income id |
  | `pay_subscription` | `spend` entry on the linked bucket (if any) + advances `next_due_on` one cycle | the entry id, also kept in `last_payment_id` |
  | `open_investment` | investment + `invest` entry (negative) on the investment bucket; refuses more than the available balance | the investment id |
  | `record_investment_return` | `return` entry (positive), linked to the investment; several per investment | the entry id |
  | `close_investment` | fixes `result` = total returned - invested (a loss is fine) | none needed: closing twice is rejected |

- `incomes.snapshot` stores the exact lines and rules used, so history survives rule changes:
  `{ amount, livingFloor, lines: [Line + name, color, accountId, accountName], allocations }`.
- **Transfers checklist** is derived, not stored: a distribution's `allocation` entries grouped
  by the account their bucket lives in. Buckets in the income account need no transfer
  ("يبقى في الحساب") and are never ticked; a distribution is pending while any entry in another
  account has `transfer_done = false` (`loadPending`).
- `buckets.color` is 1..8 and maps to the `bucket-N` design tokens.
- `buckets.is_investment`: at most one active per user, never the remainder bucket.
- **Subscriptions:** cycle = `cycle_count` x `cycle_unit` (month | year). `billing_day` (1-31)
  is the original day of the month; `next_due_on` is always that day or the last day of a
  shorter month (a check constraint enforces it), so dates never drift. When the app changes
  `next_due_on` it must set `billing_day` to match (`billingDayOf`). Deleting a subscription
  keeps its payment entries. Monthly/yearly costs are derived in `lib/subscriptions.ts`.
- **Investments:** `investment_positions` (per investment: invested, returned, outstanding,
  result, days to expected return, overdue) and `investment_summary` (available, currently
  invested, realised profit). `result` is null until closed. A closed investment accepts no
  more returns. Dates in these views use "today" in Asia/Riyadh.
- Applying migrations: paste the file into the Supabase dashboard SQL Editor and run it
  (no database password needed). New changes go in a NEW migration file; never edit an applied one.
- Every migration is first tested on a throwaway local Postgres with a stubbed `auth` schema.

## Domain glossary

- **Account** (حساب) — a real bank account money physically sits in.
- **Bucket** (بند) — a budget category (rent, savings, ...). Each bucket lives in one account.
- **Rule** — how a bucket gets its share of an income:
  `fixed` (a set amount), `percent` (a share of the income), `remainder` (whatever is left).
- **Income** (دخل) — one arrival of money (e.g. a salary) with an amount and date.
- **Distribution** (توزيع) — the confirmed split of one income across buckets. Immutable.
- **Entry** (قيد) — one line in the ledger: a signed amount into (+) or out of (-) a bucket.
  Kinds: `allocation`, `spend`, `adjustment`, `transfer`, `invest`, `return`.
- **Subscription** (اشتراك) — a recurring payment: name, amount, billing cycle, next due date,
  optionally the bucket it is paid from. Can be paused.
- **Billing cycle** — an interval count plus a unit (month or year): monthly, yearly, every 3 months.
- **Monthly equivalent** — a subscription's cost spread per month (yearly 1,200 = 100 a month). Derived.
- **Investment bucket** — the one bucket whose balance means "available to invest".
- **Investment** (استثمار) — one placement of money with a platform: amount invested, date,
  optional expected return date and expected profit, status `open` or `closed`.
- **Platform** (منصة) — the investing app the money sits in. Just a name.
- **Return** (عائد) — money coming back from an investment into the investment bucket.
- **Outstanding** — invested minus returned so far, never below zero; what is still out there.
- **Result** — total returned minus amount invested, fixed when the investment is closed
  (positive = profit, negative = loss).

## Commands

```
npm run dev      # dev server on http://localhost:3001
npm test         # vitest run
npm run lint     # eslint
npm run build    # production build
```

Deploy: import the repo in Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in project env vars; pushes to `main` deploy.

## Backlog

Screens, in rough order. None are built yet; every tab is a placeholder.

1. ~~**الإعدادات**~~ — done (phase 3).
2. ~~**توزيع**~~ — done (phase 4).
3. ~~**الرئيسية**~~, bucket detail and ~~**السجل**~~ — done (phase 5). Home still has two
   empty SLOTs, filled by items 4 and 5.
4. **الاشتراكات** — list by next due date, totals per month and per year, add / edit / pause,
   mark as paid.
5. **الاستثمار** — available / invested / realised profit, open positions with overdue flags,
   place money, record a return, close.
7. Manual light/dark toggle, `motion` for the split bar, deploy to Vercel.

## Current status

**Phase 1 (setup) — complete, merged to `main`.** Scaffold, tokens, money helper, Supabase auth
(sign-in/sign-out verified live), app shell. Not deployed to Vercel yet.

**Phase 2 (engine) — complete, merged to `main`.** `lib/allocate.ts`, first migration applied
to the real project and probed signed-out (everything denied).

**Phase 2.5 (scope: subscriptions + investments) — complete, merged to `main`.**

Done and verified:
- `lib/subscriptions.ts` and `lib/investments.ts` with tests (month-end dates, yearly cycles,
  29 Feb, partial returns, loss, profit, overdue). `npm test`: 24 passing.
- `supabase/migrations/20261115150000_subscriptions_investments.sql`: 2 tables, `is_investment`,
  2 entry kinds + links, 4 functions, 2 views. **Applied to the real Supabase project** (owner
  ran it in the SQL Editor; check query returned 7 tables with RLS, 0 without, 4 views,
  5 functions, `is_investment` present).
- Signed-out probe of the real project with the publishable key: all 7 tables, all 4 views,
  inserts into `subscriptions` / `investments` / `entries` and all 5 functions return
  `42501 permission denied`.
- On a throwaway local Postgres 16 (both migrations): user isolation, double submit rejected,
  31 Jan -> 28 Feb -> 31 Mar, over-investing refused, loss closable, immutability, deleting a
  subscription keeps its history.
- Navigation: 5 items on mobile (توزيع in the centre as the primary action, المزيد holding
  السجل and الإعدادات), 6 destinations on the desktop rail, 3 new placeholder pages.
  Checked at 375px and 1440px, light and dark: RTL, no horizontal scroll. Lint and build clean.

Not verified yet:
- The signed-in path against the real project (own rows, calling the functions). It gets
  exercised when the screens are wired to the tables.

**Phase 3 (settings screen) — complete, merged to `main`.**

Done and verified (in a 375px frame, signed in, against the real Supabase project, with the
10,000 SAR example values, light and dark):
- Reference income and living floor: saved on blur, preview follows typing.
- Accounts: first-run offer of two accounts, add, rename, kind, which one receives income
  (moving it releases the previous one), delete, reorder.
- Buckets: first-run starter set of seven with empty values, list in priority order, add, edit
  (name, colour, account, rule switch, investment switch, pause), delete, reorder.
- Live conversion while typing (10% -> "= 1,000 ر.س من راتبك المرجعي", 2,000 -> "= 20% ...") and the
  value converts when switching between amount and percent.
- Split bar from the real `allocate()` above the list and inside the editor ("after saving"):
  the example gives 3,800 ر.س (38%). Shortfall turns the bar to the warning colour and blocks
  saving; a remainder below the living floor warns but saves.
- Only one remainder / one investment bucket: taking either releases the previous holder,
  and the editor says so before saving.
- This was also the first check of the signed-in path on the real project: reads, inserts,
  updates and the settings upsert all work under RLS.
- Reorder: arrow keys on the handle tested end to end (order persists after reload);
  touch drag confirmed by the owner on a phone.
- `npm test`: 25 passing. Lint and build clean. No horizontal scroll at 375px.

Not verified:
- The settings screen at 1440px with data (the shell was checked there earlier).
- Sign-in after these changes was done by the owner, sign-out was not re-run.

Known simplifications (marked `ponytail:` in the code): moving the remainder, the investment
flag or the income account is two statements, not one transaction.

The real project currently holds the example data from this test (2 accounts, 7 buckets,
reference income 10,000, living floor 3,000). The owner chose to keep it.

**Phase 4 (توزيع) — complete, merged to `main`.**

Done and verified (375px frame, signed in, real Supabase project, example data):
- Step 1: large amount input (`inputMode="decimal"`), split bar divides live while typing.
  7,333 gives 1,099 for 15% (rounded down), 3,000 shows the 1,100 shortfall.
- Step 2: one row per bucket with "ثابت" or its percent; + / − (100 ر.س steps), tap to type an
  exact figure, switch a row off for this distribution only, reset to the rule; remainder row
  last in accent and recalculated instantly; living-floor warning; shortfall error disables
  confirm while rows stay editable. Date (today in Riyadh) and optional note.
- Confirm calls `confirm_distribution` (first real call of it): **10,000 -> 2,000 / 1,200 /
  1,500 / 500 / 500 / 500, remainder 3,800, same as the unit test.** A double click recorded
  one distribution.
- Step 3 at `/distribute?income=<id>`: "حوّل من الحساب الجاري إلى حساب الادخار 2,000" (الاستثمار
  1,500 + السفر 500) and "يبقى في الحساب 8,000". Ticking sets `transfer_done`, survives a reload.
- Home shows the pending distribution with a link back, and clears once everything is ticked.
- Autofocus and the numeric keypad confirmed by the owner on a phone.
- `npm test`: 26 passing. Lint and build clean. No horizontal scroll at 375px.

Not verified:
- These screens at 1440px with data, and in light theme (settings was checked in both).
- A failed confirm (network error) and its retry with the same id.

The real project now also holds one test distribution (10,000, note "تجربة", 15 Nov 2026, all
transfers ticked). It is in the immutable ledger: the app cannot delete it. To remove it, the
owner runs in the SQL Editor:
`delete from entries where income_id in (select id from incomes where note = 'تجربة'); delete from incomes where note = 'تجربة';`
For the test, الاستثمار and السفر were moved to حساب الادخار.

**Phase 5 (home, bucket detail, history) — complete, merged to `main`.** The owner reviewed
the three screens and confirmed they look right.

Done and verified (375px frame, signed in, real Supabase project, example data):
- Home, top to bottom: account cards with balances from `account_balances` (8,000 and 2,000
  after the test distribution), pending-transfers banner (only when unfinished), last
  distribution (date, amount, split bar from the snapshot), bucket cards with balances from
  `bucket_balances`, then the two marked slots.
- Bucket detail (`/buckets/<id>`): balance, entries newest first, "تسجيل صرف" (200 from الصدقة:
  500 -> 300, one entry despite a double click) and "تعديل الرصيد" (set to 350: records +50).
  Home balances follow (الحساب الجاري 7,850).
- History: the income expands to its full split with rule labels and accounts, read from the
  stored snapshot, with a link to its transfers checklist.
- `npm test`: 27 passing. Lint and build clean. No horizontal scroll at 375px.

Not verified:
- **The empty states.** The project already has data, so the brand-new-user cards (home: no
  accounts / no buckets / no distribution; history: no income; bucket: no entries; unknown
  bucket or distribution) were written but never seen rendered.
- These screens at 1440px and in light theme.
- الاستثمار and الاشتراكات are still "قريبًا" placeholders (prompts 6 and 7).

Test data now in the real project's ledger (immutable from the app): the 10,000 distribution
(note "تجربة"), plus on الصدقة a spend of 200 (note "تجربة صرف") and an adjustment of +50.
To wipe ALL ledger test data, the owner runs in the SQL Editor:
`delete from entries; delete from incomes;`

Next: الاشتراكات (prompt 6), then الاستثمار (prompt 7).
