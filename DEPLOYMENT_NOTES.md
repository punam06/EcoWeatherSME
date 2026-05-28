# Deployment Notes & Required GitHub Secrets

This file documents the GitHub repository secrets and setup required so that pushing to `main` will automatically trigger deployments for the Frontend (Render) and Backend (Supabase Edge Functions).

## Frontend (Render)
- Recommended: Connect Render to GitHub via Render Dashboard for automatic deploys on push.
- Alternatively supply the following GitHub Secrets to trigger a deploy via GitHub Actions:
  - `RENDER_API_KEY` — Render service API key (bearer token)
  - `RENDER_SERVICE_ID` — Render service id (value like `srv-xxxxxx` without `srv-` in some cases; workflows expect the id part)

Workflow file: `.github/workflows/deploy-frontend.yml`
- This workflow triggers on changes to `Frontend and UI/**` and will call the Render deploy API using the secrets above.

## Backend (Supabase)
- Supabase edge functions and other assets can be deployed via the Supabase CLI.
- Add these GitHub Secrets:
  - `SUPABASE_ACCESS_TOKEN` — Personal access token with permission to deploy functions
  - `SUPABASE_PROJECT_REF` — Project ref ID (e.g., `pdeskdcdyhbldwfgbowz`)

Workflow file: `.github/workflows/deploy-supabase.yml`
- This workflow runs on changes to `supabase/**`, `backend/**`, or `lib/**` and uses the Supabase CLI to deploy functions.
- If the required secrets are not present, the workflow will skip deployment and output a note.

## Security
- DO NOT store secrets in the repository files. Use GitHub Secrets or Render / Supabase dashboards to store environment variables.
- If any secret was exposed publicly, rotate it immediately (Supabase DB credentials, publishable keys, LLM keys).

## How to Add Secrets in GitHub
1. Go to your GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret
2. Add `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` with appropriate values

## Notes
- Render also supports connecting a GitHub repo directly and will auto-deploy on pushes — recommended.
- Supabase has GitHub integration / CI workflows; if you prefer that, you can enable Supabase's own GitHub integration.

If you want, I can add the Render service ID and Supabase project ref into the workflows for you if you provide them as GitHub Secrets, or I can walk you through adding them in the GitHub UI and then verifying an automatic deploy.
