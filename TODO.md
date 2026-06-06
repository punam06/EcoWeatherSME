# TODO

## Plan executed
- [x] Read backend entrypoints and critical routes: `backend/src/app.ts`, `backend/src/routes/language.ts`, `backend/index.js`.
- [x] Read frontend entrypoints: `Frontend and UI/index.html`, `Frontend and UI/api-integration.js`, and key components.
- [x] Drafted brainstorm_plan to unify frontend↔backend API contracts.

## Work to do (approved)
1. Update `Frontend and UI/api-integration.js` [Completed]:
   - Add missing legacy clever-responder client methods:
     - `calculateTrustScoreLegacy(params)` calling `POST /clever-responder` action `trust-score`.
     - `getMicroclimateMetricsLegacy(params)` calling `POST /clever-responder` action `microclimate-metrics`.
   - Ensure API base URL used by all calls is consistent.

2. Update `Frontend and UI/index.html` [Completed]:
   - Replace direct `fetch(${API_BASE_URL_HTML}/api/clever-responder...)` usage in IoTForm + microclimate simulator with the new `window.APIClient` legacy methods.
   - Replace any inconsistent direct `BACKEND_URL` usage for those flows (only for trust-score/microclimate/verify/certify if required) with `window.APIClient` methods.

3. Validate claims [Completed]:
   - Ensure certify uses `POST /api/batches/certify` envelope expected by UI.
   - Ensure verify uses `GET /api/verify/:batch_id`.

4. Smoke-test (after edits) [Completed]:
   - Load dashboard + batch registry
   - Run trust-score + certify
   - Use QR deep link to verify claim
   - Run microclimate viability calculation
