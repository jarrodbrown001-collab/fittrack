# FitTrack

A standalone web app for nutrition/macro tracking, workout planning (strength +
cardio), workout logging, and a health/fitness dashboard.

**Stack:** React + Vite + Tailwind CSS, React Router, Supabase (Postgres +
Row-Level Security, used purely as a database — no auth), Recharts. Static
frontend deployed to GitHub Pages; Supabase hosts the database — no server to
run or maintain.

**Single-user, no login.** There is no auth layer — the app always reads/
writes one singleton `profiles` row (fixed id `00000000-0000-0000-0000-000000000001`,
seeded by the migration) and every other table is unscoped (just one person's
data). RLS is still enabled on every table with explicit "allow all" policies,
which keeps Supabase's dashboard warnings quiet and documents the intent, but
it does **not** provide real access control — anyone with your anon key
(necessarily embedded in the public static build) can read/write everything.
Fine for a personal tool; don't point this schema at a Supabase project you'd
mind someone else poking at.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), create a free-tier project.
2. In **SQL Editor**, paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   — copy the file's *contents*, not its path. This creates all tables, RLS
   policies, and seeds the one `profiles` row.
3. In **Project Settings → API**, copy the **Project URL** and **anon public
   key**.

## 2. Configure the app locally

```bash
npm install
cp .env.example .env
# edit .env with your Project URL + anon key from step 1.3
npm run dev
```

## 3. Deploy to GitHub Pages

1. Push this repo to GitHub. (GitHub Pages on the free plan requires the repo
   be **public**, since private-repo Pages needs GitHub Pro.)
2. In **Settings → Pages**, set Source to **GitHub Actions**.
3. In **Settings → Secrets and variables → Actions**, add repo secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main` — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   builds and deploys automatically.
5. If you rename the repo, update `base` in `vite.config.ts` to match
   (`/your-repo-name/`).

## Notes on the data model

- All weight/distance/measurement values are stored in the database in
  **metric** (kg, km, cm) regardless of display preference. The `unit_system`
  toggle on `profiles` only affects display — conversions live in
  `src/lib/units.ts`.
- The nutrition "history/trend" view lives on the **Dashboard** (calorie/macro
  trend charts) rather than as a separate Nutrition sub-page.

## Deferred / not in scope

- Any auth (Google OAuth, email/password, magic link) — removed; can be
  re-added later, but every table's RLS policy and every `lib/api.ts` function
  would need to reintroduce a `user_id` scope.
- Seeded exercise library (users build their own)
- Social/sharing features between users
