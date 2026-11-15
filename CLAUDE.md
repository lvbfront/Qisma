# Qisma (قِسمة)

Personal salary-splitting web app for a single user. When income arrives, the
user enters the amount; the app splits it across budget buckets by rules, then
shows which transfers to make between real bank accounts.

## Design direction

> **PROVISIONAL.** The owner's "Design direction" section was not supplied when
> this file was written (the prompt still had its paste placeholder). Everything
> in this section is a stand-in proposed by Claude. Replace it with the owner's
> text when provided; tokens live only in `app/globals.css`, so swapping is one file.

**The split bar.** One horizontal bar represents one income. It is divided into
coloured segments, one per bucket, each sized by its share of the amount. The
bar is the app's central object: it is the preview while typing an amount, the
confirmation of a distribution, and the thumbnail of each entry in the history.
In RTL the bar fills from the inline-start (right) edge. Everything else on
screen is quiet so the bar and the numbers carry the page.

### Tokens

Defined as CSS variables in `app/globals.css` and exposed to Tailwind via
`@theme inline`. Use the Tailwind names (`bg-surface`, `text-muted`, ...), never raw hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#FAF8F4` | `#12110F` | page background |
| `surface` | `#FFFFFF` | `#1C1B18` | cards, nav |
| `ink` | `#1B1A17` | `#F2EFE9` | primary text |
| `muted` | `#6F6B63` | `#A19C92` | secondary text |
| `line` | `#E7E2D9` | `#2E2C28` | borders, dividers |
| `accent` | `#0F6B5C` | `#4FBFA8` | primary action, active nav |
| `on-accent` | `#FFFFFF` | `#0B1513` | text on accent |
| `danger` | `#B3372B` | `#E5766A` | errors |

Theme follows `prefers-color-scheme`; `:root[data-theme="light|dark"]` overrides
it (manual toggle comes later).

- **Type:** IBM Plex Sans Arabic (400/500/600/700). Scale: 12 / 14 / 16 / 20 / 28 / 40 px.
  Amounts use the `.amount` class: tabular numerals, Western digits (0-9), `dir="ltr"` isolation.
- **Radius:** 8px (controls), 14px (cards), full (pills, bar ends).
- **Spacing:** 4px base grid (Tailwind default scale).
- **Motion:** 150ms (press/hover), 250ms (layout, bar segments), ease `cubic-bezier(0.2, 0, 0, 1)`.
  Honour `prefers-reduced-motion`. `motion` is for UI animation only, never for logic.

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
lib/                  pure domain logic, no React, no Supabase (money.ts, later allocate.ts)
utils/supabase/       client.ts, server.ts, proxy.ts (session refresh)
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
- **Secrets:** `.env.local` is git-ignored; `.env.example` has empty values. Never commit real keys.

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
npm run dev      # dev server on :3000
npm test         # vitest run
npm run lint     # eslint
npm run build    # production build
```

Deploy: import the repo in Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in project env vars; pushes to `main` deploy.

## Current status

**Phase 1 (setup) — in progress.** CLAUDE.md written. Nothing else yet.
