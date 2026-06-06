# DB Setup (Supabase) — EcoWeatherSME

## Environment
Create a `.env` in the repo root and set:

- `DATABASE_URL` (Supabase Transaction/Session pooler URL)
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL` (example: `15m`)
- `JWT_REFRESH_TTL` (example: `30d`)
- `COOKIE_SECURE` (`false` for local HTTP, `true` in production HTTPS)
- `COOKIE_SAME_SITE` (recommended `lax`)
- `REFRESH_COOKIE_NAME` (default `refreshToken`)

> Note: Direct DB connections can fail on IPv4-only networks. Use Supabase pooler URL.

## Apply schema and auth migration
Run in Supabase SQL Editor or with `psql`:

```bash
psql "$DATABASE_URL" -f ./schema.sql
psql "$DATABASE_URL" -f ./db/migrations/001_refresh_tokens.sql
```

## Seed demo data
```bash
set -a; source .env; set +a
npm run db:seed:all
```

Demo login:
- Email: `admin.demo@climalogix.local`
- Password: `DemoPass123!`

## Quick auth verification
Start backend:

```bash
cd backend
npm install
npm start
```

Register:
```bash
curl -i -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"new.user@example.com","password":"StrongPass123!","name":"New User"}'
```

Login (stores refresh cookie, returns access token):
```bash
curl -i -c /tmp/eco.cookies -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.demo@climalogix.local","password":"DemoPass123!"}'
```

Refresh token rotation:
```bash
curl -i -b /tmp/eco.cookies -c /tmp/eco.cookies -X POST http://localhost:5001/api/auth/refresh
```

Protected route example (`<ACCESS_TOKEN>` from login/refresh response). Add your access token header when running:
```bash
curl -i -X POST http://localhost:5001/api/batches \
  -H "Content-Type: application/json" \
  -d '{"batch_number":"BATCH-NEW-001","feedstock_type":"Food waste","trust_score":88}'
```

Logout (revokes refresh token):
```bash
curl -i -b /tmp/eco.cookies -X POST http://localhost:5001/api/auth/logout
```
