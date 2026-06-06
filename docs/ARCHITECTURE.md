# ClimaLogix ClimateShield Target Architecture

ClimaLogix can be built in the architecture shown in the recommended workflow diagram, but the safest implementation path is evolutionary. The current Render backend, Supabase schema/functions, and standalone frontend should remain in place while the product is reorganized conceptually into clearer domains.

## Investor-Grade Product Positioning

ClimaLogix ClimateShield is an authenticated SME operating system for climate-sensitive commerce. It combines product verification, microclimate-aware dispatch, AI decision support, and AI cost governance.

This is strong enough as a foundation for a large company vision because it has:

- A real SME pain point: product spoilage, lack of trust, climate-disrupted delivery, and hidden AI operating cost.
- A repeatable workflow: every order can be scored, verified, routed, dispatched, and measured.
- Defensible data loops: batch quality, route risk, delivery outcome, ESG impact, and AI ROI improve over time.
- Expansion paths: verticals beyond compost/agro into retail perishables, biological inputs, pharmaceuticals, and temperature-sensitive manufacturing.

It is not yet sufficient alone for a $100M company. To reach that level, the architecture also needs production-grade auth, multi-tenant billing, observability, partner integrations, compliance, SLAs, and strong data quality controls. The diagram is a credible target architecture; the business becomes $100M through execution, distribution, and repeatable revenue.

## Target Layers

### 1. Users + External Actors

- SME Owner
- Buyer / Customer
- Warehouse / Industry
- Delivery Partner
- Admin

These actors should never access core workflows directly. Every action passes through authentication, role checks, and audit logging.

### 2. Authentication + Access Control

Responsibilities:

- Login / signup
- Secure session or JWT verification
- Role-based access control
- Permissions per workflow
- Audit logs for sensitive actions

Recommended roles:

| Role | Allowed Actions |
| --- | --- |
| SME Owner | Manage products, batches, orders, dispatch, AI budget, reports |
| Buyer | Browse marketplace, place orders, confirm receipt, verify certificates |
| Warehouse | Update inventory, confirm packaging, execute dispatch |
| Delivery | View assigned routes, update delivery status |
| Admin | Manage tenants, policies, audits, system settings |

### 3. Commerce Layer

Responsibilities:

- Marketplace listing
- Order creation
- Destination capture
- Batch selection
- Customer/order state

Current project mapping:

- Frontend marketplace/dashboard views
- `backend/src/api/routes/agent.route.ts`
- `backend/src/lib/services/orderExecution.service.ts`
- `backend/src/lib/services/productSearch.service.ts`

### 4. Product Trust Layer

Responsibilities:

- Batch registry
- IoT/QA readings
- Trust score calculation
- Certificate/QR verification

Current project mapping:

- `backend/src/api/routes/batch.route.ts`
- `backend/src/api/routes/trustScore.route.ts`
- `backend/src/lib/services/trustScore.service.ts`
- Supabase batch/trust tables and migrations

### 5. Climate Supply Chain Layer

Responsibilities:

- Weather signals
- Microclimate intelligence
- Route and zone risk
- Delivery Viability Score
- Dispatch windows

Current project mapping:

- `backend/src/api/routes/climateDVS.route.ts`
- `backend/src/lib/services/dvs.service.ts`
- `backend/src/lib/services/merm.service.ts`
- `backend/src/lib/services/weather.service.ts`

### 6. AI Decision Layer

Responsibilities:

- AI assistant / copilot
- RAG recommendations
- Decision engine for accept, delay, reroute, packaging change, or rejection
- AI CostShield budget, token, and ROI tracking

Current project mapping:

- `backend/src/api/routes/aiChat.route.ts`
- `backend/src/api/routes/aiRecommend.route.ts`
- `backend/src/lib/services/agentOrchestrator.service.ts`
- `backend/src/lib/services/rag.service.ts`
- `backend/src/lib/groq.ts`

Recommended next addition:

- `backend/src/lib/services/aiCostShield.service.ts`
- `backend/src/api/routes/aiCostShield.route.ts`
- Supabase tables for `ai_usage_logs`, `ai_budget_policies`, and `ai_value_outcomes`

### 7. Execution Layer

Responsibilities:

- Dispatch recommendation
- SME / warehouse confirmation
- Climate-safe dispatch
- Delivery partner handoff
- Customer receipt confirmation

Current project mapping:

- Order execution service
- Agent order flow
- Dashboard dispatch states

Recommended next addition:

- Standardize delivery state transitions:
  `draft -> verified -> climate_checked -> recommended -> confirmed -> dispatched -> delivered -> received`

### 8. Business Intelligence Layer

Responsibilities:

- Impact dashboard
- ESG report
- Spoilage prevented
- AI ROI
- Operational analytics

Current project mapping:

- `backend/src/api/routes/esg.route.ts`
- `backend/src/lib/services/esg.service.ts`
- Dashboard ESG and impact UI

## Safe Repo Rearrangement

Do not move deployment-critical files yet:

- Keep `backend/src/app.ts` as the Express entrypoint.
- Keep `backend/render.yaml` unchanged for Render.
- Keep `supabase/` migrations and functions in place.
- Keep `Frontend and UI/` paths unchanged because static hosting and integration references may depend on them.

Instead, treat the current folder structure as implementation modules under the target architecture:

```text
backend/src/
  app.ts                         # Deployment entrypoint, unchanged
  api/routes/                    # Public API layer
  lib/middleware/                # Auth, rate limit, permissions
  lib/services/                  # Domain services by architecture layer
  lib/supabase.ts                # Supabase infrastructure adapter
  lib/groq.ts                    # LLM infrastructure adapter

supabase/
  migrations/                    # Database schema
  functions/                     # Edge functions

Frontend and UI/
  climalogix_dashboard.jsx        # Main UI shell
  api-integration.js             # API client
  components/                    # Reusable UI modules
```

## Recommended Implementation Order

1. Add authentication middleware and role model.
2. Add audit logging for batch verification, dispatch confirmation, and AI calls.
3. Add AI CostShield service and dashboard tab.
4. Standardize order and dispatch status transitions.
5. Add tenant/company IDs to major records for multi-tenant SaaS readiness.
6. Add observability: request IDs, error tracking, usage metrics, and health checks.
7. Add partner integration adapters for delivery and warehouse systems.

## Deployment Safety Notes

This architecture does not require breaking Render or Supabase deployment.

- Render still builds from `backend/` using `npm install && npm run build`.
- Render still starts with `node dist/app.js`.
- Supabase migrations/functions remain under `supabase/`.
- New backend routes can be mounted from `backend/src/app.ts` incrementally.
- New database tables should be added through Supabase migrations rather than ad hoc schema edits.

