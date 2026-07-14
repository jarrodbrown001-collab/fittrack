# FitTrack

**Live app:** https://jarrodbrown001-collab.github.io/fittrack/

A standalone web app for nutrition/macro tracking, workout planning (strength +
cardio), workout logging, and a health/fitness dashboard.

**Stack:** React + Vite + Tailwind CSS, React Router, Recharts. Deployed as a
static build to GitHub Pages via GitHub Actions.

**Two storage modes,** selected by whether `src/lib/supabaseConfig.ts` holds
Supabase credentials (see `src/lib/api.ts` for the dual backend):

- **Local-only (default):** no backend, no login. All data lives in the
  browser's `localStorage` (see `src/lib/storage.ts`) — open the link and it
  works immediately.
- **Cloud sync (optional):** data lives in Supabase Postgres behind an
  email/password sign-in, so it syncs across devices. Setup below.

## Local-only mode: data lives in your browser

This is the trade-off for zero setup: your data is stored in `localStorage` on
whatever device/browser you're using, not synced anywhere.

- It's lost if you clear browser data, use a different browser, or use a
  different device.
- **Settings → Backup** lets you export a JSON snapshot and import it back
  (e.g. onto a new device, or to move browsers). Export regularly.

## Cloud sync mode (optional Supabase backend)

To turn on cross-device sync:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the Supabase dashboard, open **SQL Editor → New query**, paste the
   contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. Every
   table is protected by row-level security scoped to the signed-in user.
3. Create your login under **Authentication → Users → Add user** (email +
   password, confirm the email). The app has no sign-up screen by design —
   it's a single-user app, and this keeps strangers from creating accounts.
4. Copy the project's URL and anon/publishable key (**Settings → API**) into
   `src/lib/supabaseConfig.ts`. Both are safe to commit: the anon key is
   public by design and RLS is what protects the data.
5. Push to `main` to deploy. The app now shows a sign-in gate; once signed
   in, **Settings → Account & sync → "Upload this device's local data"**
   migrates any existing localStorage data into your account.

Leave both config values empty to stay in (or return to) local-only mode —
the Supabase code path is never taken without them.

## Local development

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

Already wired up in this repo:

1. Repo must be **public** (GitHub Pages on the free plan needs Pro for
   private repos).
2. **Settings → Pages** → Source: **GitHub Actions**.
3. Push to `main` — [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   builds and deploys automatically, no secrets required.
4. If you rename the repo, update `base` in `vite.config.ts` to match
   (`/your-repo-name/`).

## Notes on the data model

- All weight/distance/measurement values are stored internally in **metric**
  (kg, km, cm) regardless of display preference. The `unit_system` toggle on
  the profile only affects display — conversions live in `src/lib/units.ts`.
- The nutrition "history/trend" view lives on the **Dashboard** (calorie/macro
  trend charts) rather than as a separate Nutrition sub-page.
- In local mode, `src/lib/api.ts` mimics FK cascade behavior on delete (e.g.
  deleting a food removes its food logs, deleting a plan removes its plan
  exercises) since there's no real database enforcing it. In cloud mode,
  Postgres `on delete cascade` constraints do this for real.

## Deferred / not in scope

- Google OAuth (original spec; dropped after repeated setup friction — cloud
  mode uses plain email/password instead)
- Seeded exercise library (users build their own)
- Social/sharing features between users
