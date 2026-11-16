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
- **CranL** (GitHub-connected PaaS, Riyadh region) — deploy target. Vercel is the fallback.

Next 16 note: the request interceptor file is `proxy.ts` (was `middleware.ts`). It
refreshes the Supabase session with `supabase.auth.getClaims()` and redirects
signed-out requests to `/login`. Server code protects data with `getClaims()`, never `getSession()`.

## Folder structure

```
app/
  layout.tsx          html lang="ar" dir="rtl", font, globals, theme-color, saved-theme script
  manifest.ts         web app manifest (installable, standalone); icon.svg, apple-icon.png
  globals.css         design tokens (light/dark) + Tailwind theme
  login/              sign-in page + server action (no sign-up)
  (app)/              authenticated shell
    layout.tsx        skip link, bottom tab bar (mobile) / side rail (desktop)
    error.tsx         shown when any screen fails to load its data; offers a retry
    page.tsx          الرئيسية: accounts, pending transfers, last distribution, buckets,
                      upcoming subscriptions, investments summary
    buckets/[id]/     bucket detail: balance, entries, actions.tsx (تسجيل صرف, تعديل الرصيد)
    investments/      الاستثمار: page.tsx (server loader), investments.tsx (figures, bar, open
                      positions by platform, new / receive / close sheets, closed list),
                      data.ts (loader for investment_summary and investment_positions)
    distribute/       توزيع (the primary action): page.tsx (server loader), distribute.tsx
                      (steps 1-2: amount, preview), transfers.tsx (step 3: checklist at
                      ?income=<id>), data.ts (checklist + pending queries, grouping)
    subscriptions/    الاشتراكات: page.tsx (server loader), subscriptions.tsx (totals, list,
                      add/edit sheet, تم الدفع + undo toast), data.ts (row type, loader, today)
    more/             المزيد (mobile only: links to السجل and الإعدادات)
    history/          السجل: incomes with their split; snapshot.ts reads incomes.snapshot
    settings/         الإعدادات: page.tsx (server loader), settings.tsx (amounts), accounts.tsx,
                      buckets.tsx (list + editor), preview.tsx, data.ts (types, queries), use-writes.ts,
                      theme-toggle.tsx (system / light / dark), export-button.tsx (all data as JSON)
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
- **Undo never deletes.** Undoing a subscription payment adds an `adjustment` entry for the
  amount on the bucket that was actually charged and moves `next_due_on` back (two statements,
  marked `ponytail:`).
- **No save fails silently.** Every write (insert, update, upsert, delete, rpc, sign-in,
  sign-out, even saving the theme on the device) checks its result and shows an Arabic message
  that says what was and was not saved. When adding a write, add its message.
- **Subscription `billing_day`:** on save it is the day of the picked date, unless the date was
  not touched, in which case the stored day is kept (a "31st" subscription sitting on 28 Feb
  stays a 31st).
- **Arabic labels for cycles and due dates** come from `cycleLabel()` and `dueLabel()` in
  `lib/subscriptions.ts`; day differences from `daysBetween()` in `lib/dates.ts`.
- **Investments are cost basis only:** what was paid in and what came back. No market prices,
  no advice, no ranking: platforms are always listed alphabetically (`groupByPlatform`).
- **`SplitBar` colours:** bucket 1-8, `"remainder"` (accent) and `"muted"` (money that is away,
  used for "invested" in the available/invested bar). `thin` halves its height.
- **Installable, not offline.** `app/manifest.ts` + icons make the app installable; there is no
  service worker and no caching. `/manifest.webmanifest` is excluded from the auth gate in
  `proxy.ts` because browsers fetch it without cookies. Icons are rendered from `app/icon.svg`.
- **Theme:** system by default. A forced choice is `data-theme` on `<html>`, saved in
  `localStorage` ("theme") on that device, applied before first paint by the inline script in
  `app/layout.tsx`.
- **Accessibility rules:** every control has a visible label or `aria-label`; keyboard focus is
  always visible (`:focus-visible` in the base layer); icons are `aria-hidden`; a quiet row uses
  the `.dimmed` class (muted text), never opacity, so it still passes AA; when a step changes,
  focus moves to the new step's heading.
- **Motion:** the split bar and reordering check `prefers-reduced-motion` and then change with
  no animation; CSS transitions are cut by the media query in `globals.css`.
- **Loading and errors:** every server loader sits in `<Suspense>` with a loading line and under
  `app/(app)/error.tsx`; every client write shows an Arabic message on failure and says whether
  anything was saved. A distribution is one database function, so a failed confirm writes nothing.
- **Security headers** are set in `next.config.ts` (from the Next.js PWA guide, with
  `X-Frame-Options: SAMEORIGIN` instead of `DENY`).
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
  | `pay_subscription` | `spend` entry on the subscription's bucket, else on the default payment bucket, + advances `next_due_on` one cycle. With neither it raises `QS001` and changes nothing | the entry id, also kept in `last_payment_id` |
  | `open_investment` | investment + `invest` entry (negative) on the investment bucket; refuses more than the available balance | the investment id |
  | `record_investment_return` | `return` entry (positive), linked to the investment; several per investment | the entry id |
  | `close_investment` | fixes `result` = total returned - invested (a loss is fine) | none needed: closing twice is rejected |
  | `reopen_investment` | undoes a close made by mistake: back to `open`, `result` and `closed_on` cleared; entries untouched | none needed: only a closed one can be reopened |

- `incomes.snapshot` stores the exact lines and rules used, so history survives rule changes:
  `{ amount, livingFloor, lines: [Line + name, color, accountId, accountName], allocations }`.
- **Transfers checklist** is derived, not stored: a distribution's `allocation` entries grouped
  by the account their bucket lives in. Buckets in the income account need no transfer
  ("يبقى في الحساب") and are never ticked; a distribution is pending while any entry in another
  account has `transfer_done = false` (`loadPending`).
- `buckets.color` is 1..8 and maps to the `bucket-N` design tokens.
- `buckets.is_investment`: at most one active per user, never the remainder bucket.
- **Every subscription payment comes out of a bucket.** The bucket is the subscription's own
  `bucket_id`, otherwise `settings.default_subscription_bucket_id` ("بند الدفع الافتراضي
  للاشتراكات", set in settings; cleared automatically if that bucket is deleted). With neither,
  "تم الدفع" opens a sheet to choose one (saved on the subscription, or as the default) and only
  then pays. The database enforces this too (`QS001`), so the date can never advance without a
  deduction.
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

```
npm start        # production server; listens on $PORT (default 3000) on all interfaces
```

## Deploy (CranL)

**Live: https://qisma-app-jdq8dq.cranl.net/** (deployed 16 Nov 2026, Railpack build of `main`;
a push to `main` redeploys).

Confirmed by the first deploy:
- **CranL does provide Environment-tab variables at build time.** The two `NEXT_PUBLIC_SUPABASE_*`
  variables were set before the first build and the guarded build succeeded. Set them BEFORE
  building; a change needs a Rebuild, not a Reload.
- **Port setting: 3000** (the value given in the setup steps; `next start` listens on 3000
  unless the host sets `PORT`). If the dashboard shows a different value, correct this line.
- Right after a deploy the URL can answer "Bad Gateway" for a short while until the server is up.

What CranL's docs say (read 16 Nov 2026: docs.cranl.com, app.cranl.com/llms-full.txt, cranl.com,
and railpack.com for the builder):
- It builds from a GitHub repo with **Railpack (auto-detect)** or a **Dockerfile**, runs the
  result as a service on a **Port** you set, and gives every app `https://<name>-<id>.cranl.net`
  with HTTPS. Pushes to the app's branch redeploy. Next.js is in its "zero-config builds" list.
- Railpack starts the app with the `start` script in `package.json` and picks Node from
  `engines.node`.
- Regions include `riyadh-1` and `jeddah-1`; the Saudi regions need the **Pro** plan or above.
- **Not stated in the docs:** whether Environment-tab variables are available during the build
  (they are: see above), whether a `PORT` variable is injected (still unknown), and anything
  specific about SSR or `proxy.ts` (both work on the live app: gated routes redirect).

What the repo does about it:
- Build type: **Railpack**, no Dockerfile (CranL does not require one). Build `npm run build`,
  start `npm start` (`next start`: a Node server, so SSR and `proxy.ts` work as on any Node host).
- `engines.node` is `24.x`.
- `next start` listens on `$PORT` if the host sets it, else 3000. Set CranL's **Port to 3000**.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` must exist at BUILD
  time. `next.config.ts` fails the production build with a clear message if they are missing,
  so a host that only provides them at run time produces a failed deploy, never a broken app.
- Vercel remains the fallback host (import the repo, set the same two variables, deploy).

After the first deploy: set the HTTPS URL as **Site URL** in Supabase → Authentication → URL
Configuration, and turn off "Allow new users to sign up".

## Backlog

Screens, in rough order. None are built yet; every tab is a placeholder.

1. ~~**الإعدادات**~~ — done (phase 3).
2. ~~**توزيع**~~ — done (phase 4).
3. ~~**الرئيسية**~~, bucket detail and ~~**السجل**~~ — done (phase 5). Home still has two
   empty SLOTs, filled by items 4 and 5.
4. ~~**الاشتراكات**~~ — done (phase 6).
5. ~~**الاستثمار**~~ — done (phase 7).
7. ~~Manual light/dark toggle~~ and ~~`motion` for the split bar~~ — done. Deploy to Vercel: not done.

## Version 2 backlog

Deliberately left out of version 1:
- **Push notifications** for subscriptions due soon or overdue (and, later, investments past
  their expected return date). Version 1 only shows them in the app.
- **Offline use** (service worker, cached screens). Version 1 is installable but needs the network.
- **Importing** a JSON export back into the app. Version 1 only exports.
- **Saved templates** for a distribution: "salary" (the normal rules) and "extra income" (for
  example rent and installment switched off), chosen on the amount step.
- **Goals:** a bucket can have a target amount and a target date, with progress and the
  monthly amount needed to get there.
- **Due dates and reminders for rent and installment:** fixed buckets get a due day, shown on
  home like subscriptions (and notified, once push notifications exist).
- **Transfers between buckets:** move an amount from one bucket to another as a pair of
  `transfer` entries (the kind already exists in the ledger), with the bank transfer to make
  if the buckets live in different accounts.
- **Monthly and yearly reports:** income, what went to each bucket, spends and adjustments,
  subscription cost, investment results, per month and per year.

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

**Phase 6 (الاشتراكات) — complete, merged to `main`.** The owner reviewed the screen and
confirmed it looks right.

Done and verified (375px frame, signed in, real Supabase project, example values 30 monthly,
400 yearly, 90 quarterly paused):
- Empty state seen on first open, with the "add first subscription" action.
- Top figures: شهرياً 63.33 ر.س, سنوياً 760 ر.س; the paused one is excluded.
- List sorted by nearest payment: overdue first ("متأخر 2 يوم"), then "بعد 4 أيام"; yearly and
  quarterly rows show their monthly equivalent; the paused row is last and dimmed.
- Add / edit sheet: name, amount, interval + unit with a live label ("سنوي · ما يعادل 33.33 ر.س
  شهريًا"), date, optional bucket, note, pause, delete.
- "تم الدفع" (first real call of `pay_subscription`): القسط 1,200 -> 1,170, date moved from
  19 Nov to 19 Dec, toast shows the new date; a double tap paid once. "تراجع": +30 adjustment,
  balance back to 1,200, date back to 19 Nov.
- Home: the "الاشتراكات القادمة" card lists the overdue one and the one due in 4 days.
- Settings: in the bucket editor a fixed value below the linked monthly total shows the hint
  ("... أكثر من قيمته بـ 13.33 ر.س") and "تحديث إلى 64 ر.س" fills the field.
- `npm test`: 31 passing. Lint and build clean. No horizontal scroll at 375px.

Not verified:
- The home card being hidden when nothing is due (there is always something due in the test data).
- A month-end subscription edited in the sheet (the billing-day rule is unit-tested and was
  checked in the database on the local Postgres, but not through this form).
- Deleting a subscription from the sheet, and a failed undo.
- These screens at 1440px and in light theme.

Test data added to the real project: three subscriptions ("اشتراك شهري", "اشتراك سنوي",
"اشتراك فصلي"; deletable from their edit sheets) and, in the ledger, a 30 spend and a +30
adjustment on القسط from the pay/undo test.

**Phase 7 (الاستثمار) — complete, merged to `main`.** The owner reviewed the screen and
confirmed it looks right.

Done and verified (375px frame, signed in, real Supabase project, example values):
- Three figures from `investment_summary` and the thin available/invested bar (accent / muted).
- "استثمار جديد" (first real calls of `open_investment`): 2,000 is blocked with "المتاح 1,500 ر.س
  فقط"; 500 on "منصة أ" with an expected date and profit, 300 on "منصة ب" with a past date,
  100 on "منصة أ". Platform suggestions list the platforms already used. A double tap recorded once.
- Open investments grouped by platform, alphabetical, each with its outstanding subtotal; the
  past-date one shows "متأخر 3 يوم" and the "متأخر" tag.
- "استلمت مبلغ" 540 on the 500 one (`record_investment_return`), then "هل انتهى هذا الاستثمار؟"
  showing 500 / 540 / +40, "نعم، أغلقه" (`close_investment`): **profit +40 (+8%)**.
- "إغلاق" on the 100 one with nothing returned: the confirmation says the whole amount becomes
  a loss; result -100 (-100%).
- Figures after all of that: المتاح 1,140, مستثمر حالياً 300, الربح المحقق -60. The closed list is
  collapsed by default and shows invested, returned, result in SAR and percent, and duration.
- Home: the "ملخص الاستثمار" card shows the same three figures and "أقرب عودة متوقعة: 13 نوفمبر
  2026 · متأخر 3 يوم"; حساب الادخار's balance follows (1,640).
- Signs measured in the page: "+" and "-" sit before the digits in RTL text.
- `npm test`: 34 passing. Lint and build clean. No horizontal scroll at 375px.

Not verified:
- The empty state for "no investment bucket" (the test data has one), and the home card being
  hidden in that case.
- "لا، ما زال قائمًا" followed by a second return on the same investment (several returns per
  investment were checked in the database on the local Postgres, not through this screen).
- A failed call (network error) and its retry.
- 1440px and light theme.

Added after review, and verified live:
- "تعديل" on an open investment: platform, title, expected date and expected profit. The sheet
  shows the amount as text and has no amount field; the database refuses any other column.
- "إعادة فتح" on a closed investment, with a confirmation. Needs
  `supabase/migrations/20261116100000_reopen_investment.sql`, **applied to the real project**
  by the owner; tested first on the local Postgres (reopen, return, close again, other user and
  signed-out caller refused), and the signed-out probe of the real project returns
  `permission denied`. Reopening the written-off test investment moved الربح المحقق from -60 to
  +40 and مستثمر حالياً from 300 to 400; a double tap changed nothing further.

Test data added to the real project: three investments ("تجربة أولى" closed +40; "تجربة خسارة",
written off then reopened, now open; "تجربة متأخرة", renamed "تجربة معدّلة" on "منصة ج", open and
overdue) and their `invest` / `return` entries on the
الاستثمار bucket. From the app these are permanent. To wipe ALL test money data the owner runs
in the SQL Editor: `delete from entries; delete from investments; delete from incomes;`

**Phase 8 (polish) — code complete on `phase-8-polish`, not merged yet.**

Done and verified:
- **Installable:** `/manifest.webmanifest` serves signed-out (200, `application/manifest+json`,
  standalone, Arabic, RTL), icons 192 / 512 / maskable and the 180 apple icon load, and the page
  head carries the manifest link, theme-color for light and dark, and the apple web-app tags.
  Security headers are present.
- **Theme toggle** (live): light and dark each change the background and the browser chrome
  colour, the choice survives a reload with no flash script error, and "حسب الجهاز" clears it.
- **Responsive** (live, signed in, real data): الرئيسية, الاستثمار, توزيع, الاشتراكات, السجل
  (collapsed and expanded), الإعدادات, المزيد, a bucket page and a transfers checklist, each at
  375, 768 and 1440px: no horizontal scroll anywhere; bar at 375, side rail at 768 and 1440.
- **Export** (live): one JSON file `qisma-<date>.json` with settings 1, accounts 2, buckets 7,
  incomes 1, entries 15, subscriptions 3, investments 3. The file save itself was intercepted in
  the test, so nothing was written to disk.
- **Failed confirm** (live): with the network cut for the confirm call only, the preview shows
  "تعذّر تأكيد التوزيع. لم يُسجَّل شيء", stays on the preview with the button usable again, and
  السجل still shows exactly one income.
- **Keyboard and labels** (live): step 1 is a form (Enter continues), focus then lands on the
  preview heading, all 28 controls of step 2 are natively focusable with a name; on الرئيسية,
  الإعدادات, الاشتراكات and الاستثمار every control has a name, there is one h1, one main, a
  labelled nav, no duplicate ids.
- **Lighthouse 13.6, mobile, production build, `/login`: performance 100, accessibility 100,
  best practices 100** (FCP 0.8 s, LCP 0.8 s, TBT 10 ms, CLS 0).
- `npm test`: 34 passing. Lint and build clean.

Not verified:
- **Lighthouse on the signed-in screens.** It needs a session and the owner's password is never
  given to Claude; only `/login` was measured. The owner can run it from Chrome DevTools.
- **Installing the app** on a real phone or desktop (needs HTTPS, so after the Vercel deploy).
- **Reduced motion** was implemented but not observed with the system setting turned on.
- **A full keyboard-only run** with real key presses (Tab order was inspected, not driven), and
  a screen reader pass.
- `app/(app)/error.tsx` rendering (no load failure was provoked), and the retry after a failed
  confirm succeeding with the same id.
- The theme does not update live in OTHER open tabs; they follow on their next load.

**Phase 8 was merged to `main` together with phase 9.**

**Phase 9 (ship) — deployed on CranL and merged to `main`.**

Done and verified:
- CranL's docs read; verdict and gaps recorded in "Deploy (CranL)" above.
- `engines.node` 24.x; `npm start` honours `PORT` (checked with 4010) and binds all interfaces,
  default 3000; a production build without the two Supabase variables fails with the guard's
  message, and with them it builds.
- `README.md` written. Version 2 backlog extended.
- **Cross-user RLS check on the real project** (owner created a second user and signed in as
  it): direct reads of all 7 tables through the app's client return 0 rows; the owner's bucket
  page answers "لم نجد هذا البند" and the owner's distribution "لم نجد هذا التوزيع"; no name,
  amount or note of the owner appears on any screen.
- **Empty states**, seen for the first time with that brand-new user: home ("أهلًا بك في قِسمة",
  set up accounts), settings (two-account offer), history, subscriptions, and investments
  ("حدّد بند الاستثمار أولًا").

- **Signed-out checks of the live URL:** all nine app routes answer 307 to
  `https://qisma-app-jdq8dq.cranl.net/login` (the public host, not an internal one); `/login` is
  200 over HTTP/2 with a valid certificate, Arabic RTL, no sign-up link; plain `http://`
  redirects to `https://`; the security headers are present; the manifest (standalone) and all
  four icons load without a session; a gated route's redirect carries no cache headers.
- **Lighthouse 13.6, mobile, live `/login`: performance 100, accessibility 100, best practices
  100** (FCP 1.3 s, LCP 1.3 s, TBT 10 ms, CLS 0).

Not verified by Claude on the live site (needs the owner's session):
- Signing in, every signed-in screen, and installing the app from the HTTPS URL.
- Which region and plan the app runs on, and the Port value in the dashboard.

Still for the owner to do in Supabase:
- Site URL = the live URL (Authentication → URL Configuration).
- Turn off "Allow new users to sign up".
- Remove the test data and the test user (a one-off SQL script was given in chat, not kept in the repo).
- The second user's attempts to WRITE to the owner's rows were only tested on the local
  Postgres (every migration), not on the real project.
- The test user should be deleted in Supabase → Authentication → Users when no longer needed.
- Installing the app from the HTTPS URL, and the unverified items listed under each phase above.

**Fix (16 Nov 2026): a subscription with no bucket was "paid" without deducting anything.
Merged to `main` and deployed.**

Cause: `pay_subscription` only recorded a spend when the subscription had its own bucket, and
the app let a bucket-less subscription through. Fixed in the database and the app (see
"Every subscription payment comes out of a bucket" under Database).

Changed:
- Migration `20261116200000_subscription_default_bucket.sql`: `settings.default_subscription_bucket_id`
  and a `pay_subscription` that refuses to pay from nowhere. **Applied to the real project** by
  the owner; from outside, the new column answers "permission denied" (a made-up column answers
  "does not exist"), and the function still refuses signed-out callers. The owner did not report
  the result of the check query, so the function body on the real project is not confirmed
  beyond "the migration ran successfully".
- Settings: "بند الدفع الافتراضي للاشتراكات". Subscriptions: each row and the sheet say which
  bucket and account the payment comes from; "تم الدفع" with no bucket asks for one first; the
  toast names the bucket charged; undo refunds that bucket.
- A failed sign-out and a theme that cannot be saved on the device now show a message; every
  other write already did (audited: all write calls in `app/`).

Verified:
- On the local Postgres (all four migrations): paying with no bucket and no default raises
  `QS001` and leaves the date and the entries unchanged; with a default, the spend lands on the
  default bucket and the date advances; the subscription's own bucket wins over the default;
  another user's bucket cannot be set as default; deleting the default bucket clears the
  setting and keeps the other settings; same payment id twice is rejected; other user and
  signed-out caller refused; grants unchanged.
- `npm test` 34 passing, lint and build clean.

NOT verified: **the new screens were not clicked through in a browser.** The owner's project
may now hold real data, so no test rows were created there; the owner tests on the live URL.
The past payments that deducted nothing are not corrected by this fix: each such subscription
simply had its date advanced. If a real payment was made then, record it with "تسجيل صرف" on the
right bucket.
