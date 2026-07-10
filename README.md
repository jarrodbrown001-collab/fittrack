# FitTrack

**Live app:** https://jarrodbrown001-collab.github.io/fittrack/

A standalone web app for nutrition/macro tracking, workout planning (strength +
cardio), workout logging, and a health/fitness dashboard.

**Stack:** React + Vite + Tailwind CSS, React Router, Recharts. No backend —
all data is stored in the browser's `localStorage` (see `src/lib/storage.ts`),
deployed as a static build to GitHub Pages via GitHub Actions.

**Single-user, no login, no server.** There's nothing to configure or sign up
for — open the link and it works immediately.

## Data lives only in your browser

This is the trade-off for zero setup: your data is stored in `localStorage` on
whatever device/browser you're using, not synced anywhere.

- It's lost if you clear browser data, use a different browser, or use a
  different device.
- **Settings → Backup** lets you export a JSON snapshot and import it back
  (e.g. onto a new device, or to move browsers). Export regularly.

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
- `src/lib/api.ts` mimics FK cascade behavior on delete (e.g. deleting a food
  removes its food logs, deleting a plan removes its plan exercises) since
  there's no real database enforcing it.

## Deferred / not in scope

- Any backend/sync (this was originally spec'd with Supabase + Google OAuth;
  dropped after repeated setup friction — see git history if reviving it)
- Seeded exercise library (users build their own)
- Social/sharing features between users
