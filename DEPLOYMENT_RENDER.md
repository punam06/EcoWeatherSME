# Render + Supabase Production Deployment

## Backend service (Render)

| Setting | Value |
|---------|--------|
| Root directory | `backend` |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |

The legacy `backend/index.js` now delegates to `dist/app.js`. **Do not** use `node index.js` as the primary start command unless you accept the deprecation shim.

## Required Render environment variables (set in dashboard — never commit secrets)

```env
NODE_ENV=production
LOG_LEVEL=info
FRONTEND_URL=https://ecoweathersme.onrender.com
NEXT_PUBLIC_APP_URL=https://ecoweathersme.onrender.com
BACKEND_API_URL=https://backsme.onrender.com
PUBLIC_BACKEND_URL=https://backsme.onrender.com

SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=<rotate-in-supabase-dashboard>
SUPABASE_SERVICE_ROLE_KEY=<rotate-in-supabase-dashboard>

# Supabase Postgres — use Session pooler (IPv4) from Supabase Dashboard → Database → Connection string
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require

JWT_SECRET=<openssl rand -hex 64>
GROQ_API_KEY=<rotate-in-groq-console>
OPENWEATHER_API_KEY=<rotate-in-openweather>
```

### Rotate these if they ever appeared in git, logs, or chat

- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `OPENWEATHER_API_KEY`
- `JWT_SECRET`
- Postgres password
- Render deploy hook / API key

## Apply migrations (Supabase SQL editor or psql)

Run in order:

1. `db/migrations/002_batch_verification_lifecycle.sql`
2. `db/migrations/003_investor_scale_indexes.sql`

Optional investor demo seed (staging only):

```bash
DATABASE_URL="postgresql://..." npm run seed:investor-demo
```

## Post-deploy smoke checks

```bash
curl -sS https://backsme.onrender.com/api/health | jq
curl -sS https://backsme.onrender.com/api/verify/test | jq
curl -sS -H "Authorization: Bearer <token>" https://backsme.onrender.com/api/verification-requests | jq
```

Expected:

- Health shows `"backendEntry": "backend/src/app.ts → dist/app.js"`, `"environment": "production"`, `"supabaseReachable": true`
- `/api/verify/test` returns JSON (not `Route not found`)
- Verification requests require valid JWT (401 without token)

## Frontend (Render static)

Frontend API base is hardcoded to `https://backsme.onrender.com` when not on localhost (`Frontend and UI/api-integration.js`).
