# FitTrack

A standalone web app for nutrition/macro tracking, workout planning (strength +
cardio), workout logging, and a health/fitness dashboard.

**Stack:** React + Vite + Tailwind CSS, React Router, Supabase (Postgres + Auth
+ Row-Level Security), Recharts. Static frontend deployed to GitHub Pages;
Supabase hosts the database and handles auth — no server to run or maintain.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), create a free-tier project.
2. In **SQL Editor**, paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates all tables, Row-Level Security policies, and the trigger that
   auto-creates a `profiles` row on signup.
3. In **Authentication → Sign In / Providers**, enable **Google**. You'll need
   a Google Cloud OAuth client (OAuth consent screen + Web application
   credentials) — Supabase's Google provider page links directly to the
   Google Cloud steps and tells you which redirect URI to register.
4. In **Project Settings → API**, copy the **Project URL** and **anon public
   key**.

## 2. Configure the app locally

```bash
npm install
cp .env.example .env
# edit .env with your Project URL + anon key from step 1.4
npm run dev
```

The anon key is safe to expose client-side — it only grants what Row-Level
Security policies allow, and every table is scoped to `auth.uid()`.

## 3. Deploy to GitHub Pages

1. Push this repo to GitHub.
2. In **Settings → Pages**, set Source to **GitHub Actions**.
3. In **Settings → Secrets and variables → Actions**, add repo secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main` — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   builds and deploys automatically.
5. If you rename the repo, update `base` in `vite.config.ts` to match
   (`/your-repo-name/`).

Also add the deployed Pages URL as an **authorized redirect URI** in both the
Supabase Google provider settings and the Google Cloud OAuth client, or sign-in
will fail in production.

## Notes on the data model

- All weight/distance/measurement values are stored in the database in
  **metric** (kg, km, cm) regardless of a user's display preference. The
  `unit_system` toggle on `profiles` only affects display — conversions live
  in `src/lib/units.ts`.
- `plan_exercises` and `workout_log_sets` don't have their own `user_id`
  column; RLS scopes them through their parent `workout_plans` /
  `workout_logs` row.
- The nutrition "history/trend" view lives on the **Dashboard** (calorie/macro
  trend charts) rather than as a separate Nutrition sub-page.

## Deferred (not v1)

- Apple Sign-In (needs a paid Apple Developer account)
- Seeded exercise library (users build their own)
- Social/sharing features between users
