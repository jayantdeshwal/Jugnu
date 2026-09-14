# Muzaffarnagar Ka Kaamgar

A frontend-only prototype for a local-services marketplace in Muzaffarnagar. It connects people looking for electricians, plumbers, carpenters, AC technicians, and painters with local workers.

The current version is in the first backend-foundation phase. Screens still use mock data and browser state, while the Supabase browser client is prepared for a later database and authentication slice.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment setup

Copy `.env.example` to `.env` and fill in only the browser-safe Supabase values:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
```

These values come from **Supabase Dashboard > Project Settings > API**. Never add a
service-role key, database password, MSG91 key, or other private secret to a
`VITE_*` variable. Private service credentials will be configured as Supabase
Edge Function secrets when those services are implemented.

## Structure

```text
public/       Static assets
src/
  components/ Shared layout
  context/    Local mock application state
  i18n/       English and Hindi translations
  pages/      Customer, worker, and admin screens
  shared/     Frontend constants and types
  ui/         Reusable interface controls
```

## Current flows

- Browse and filter local workers
- Review worker profiles and request a booking
- Register as a worker
- View bookings, notifications, profile settings, and the admin dashboard
- Switch between English and Hindi

The next implementation slice is the Supabase schema and security policy design.
We will not connect login, OTP, MSG91, bookings, or mobile features until the
foundation has been tested.
