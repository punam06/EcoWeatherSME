# DB Setup (Supabase) — EcoWeatherSME

## Environment
Create a `.env` in the repo root and set at least:

- `DATABASE_URL` = Supabase **Transaction Pooler** connection string (IPv4-friendly)
- (optional for later tasks) `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

> Note: Direct DB connections may resolve to IPv6 and fail on IPv4-only networks. Use Session Pooler or enable the IPv4 add-on.

## Apply schema
Run `schema.sql` in the Supabase Dashboard:
- Project → SQL Editor → paste `schema.sql` → Run

(Alternatively, if your network supports it:)
```bash
psql "$DATABASE_URL" -f ./schema.sql
