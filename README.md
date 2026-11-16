# Qisma (قِسمة)

A personal money app for one user, in Arabic (RTL). When income arrives you enter the
amount; Qisma splits it across your budget buckets by rules and shows which transfers to
make between your real bank accounts.

It stores no bank account numbers, IBANs or credentials. An account is just a name you pick.

## What it does

- **توزيع (distribute):** type the amount and watch one bar divide into coloured segments, one
  per bucket. Adjust any line for this distribution only, confirm, then tick off the transfers.
- **الرئيسية (home):** account balances, unfinished transfers, the last distribution, bucket
  balances, subscriptions due soon, and an investments summary.
- **Buckets:** record a spend, or set a bucket's balance to the real figure (the difference is
  saved as an adjustment).
- **الاشتراكات (subscriptions):** monthly, yearly or every N months; cost per month and per
  year; "paid" records the spend and moves the due date forward.
- **الاستثمار (investments):** one bucket is "available to invest". Each placement with an
  investing app is tracked by what was paid in and what came back. Cost basis only: no market
  prices, no advice.
- **السجل (history):** every income and exactly how it was split at the time.
- **الإعدادات (settings):** accounts, buckets and their rules, light/dark, export all data as JSON.

The ledger is append-only: a confirmed distribution is never edited, and corrections are new
adjustment entries.

## Allocation rules

Each bucket has one rule: a **fixed** amount, a **percent** of the income, or the **remainder**.
`allocate(amount, lines)` in [`lib/allocate.ts`](lib/allocate.ts) applies them in this order:

1. Lines that are switched off are ignored.
2. Exactly one enabled remainder line must exist, otherwise it returns an error.
3. Fixed lines are taken first, in priority order.
4. Percent lines are calculated from the **full** amount (not from what is left), then rounded
   **down** to a whole riyal.
5. A line with an override uses the override instead of its rule.
6. If fixed + percent is more than the amount, it returns a shortfall error naming the missing
   amount. An allocation is never negative.
7. The remainder line gets the amount minus everything else, including all rounding leftovers.
8. The allocations always sum exactly to the amount.

Example: 10,000 SAR with fixed 2,000 and 1,200 and percents 15%, 5%, 5%, 5% gives
2,000 / 1,200 / 1,500 / 500 / 500 / 500 and a remainder of 3,800.

Money is stored as integer halalas (1 SAR = 100 halalas), never as floats.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript, server-side rendering, `proxy.ts`)
- [Tailwind CSS](https://tailwindcss.com) 4
- [Supabase](https://supabase.com): Postgres and email + password auth. The app uses only the
  publishable key; every table is protected by Row Level Security, and money movements go
  through atomic Postgres functions.
- [motion](https://motion.dev) for the split bar and drag-to-reorder
- [Vitest](https://vitest.dev) for unit tests
- Installable as a web app (manifest and icons; no offline mode)

## Run it locally

You need Node.js 24 and a Supabase project.

1. Install dependencies:

   ```
   npm install
   ```

2. Create the database. In the Supabase dashboard open **SQL Editor** and run each file in
   [`supabase/migrations`](supabase/migrations) in filename order.

3. Create your user in the Supabase dashboard under **Authentication → Users → Add user**
   (the app has no sign-up page).

4. Copy `.env.example` to `.env.local` and fill in the two values from your Supabase project:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```

   Use the publishable key (`sb_publishable_...`). The app never needs the secret key or the
   database password. `.env.local` is git-ignored; do not commit it.

5. Start the dev server and open <http://localhost:3001>:

   ```
   npm run dev
   ```

### Start and stop

Start the local app (from the project folder):

```
npm run dev
```

Stop it (from any terminal; or press Ctrl+C in the terminal where it is running):

```
kill $(lsof -ti tcp:3001)
```

If the stop command prints a usage message, nothing was running on port 3001.

For a production run, `npm run build` then `npm start`. The server listens on `PORT`
(default 3000). The two variables above must be set when **building**, not only when running;
the build stops with a clear message if they are missing.

## Tests

```
npm test        # unit tests (Vitest)
npm run lint    # ESLint
```

The unit tests cover the pure logic in `lib/`: money parsing and formatting, the allocation
rules (including a randomised check that allocations always sum to the amount), subscription
dates and costs, investment results, and date helpers. They do not need Supabase.

## License

[MIT](LICENSE)
