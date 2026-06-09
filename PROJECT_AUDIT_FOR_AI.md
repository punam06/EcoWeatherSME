# ClimaLogix AI (EcoWeatherSME) - Full Project Audit & AI Agent Onboarding Guide

This document is a comprehensive audit and architectural reference designed specifically to onboard AI engineering agents working on the ClimaLogix AI project. It details the system architecture, domain models, technical constraints, security posture, and active technical debt.

---

## 1. High-Level Architecture & Tech Stack

ClimaLogix is a B2B agricultural and SME supply chain platform featuring a "Trust Layer" that tracks biological assets (like biofertilizers) and ensures climate-resilient transport.

### The Stack
- **Frontend**: React 18 SPA. **Crucial constraint:** There is *no modern bundler* (like Vite or Webpack) in production yet. The frontend relies on CDN-loaded React and is compiled via `@babel/standalone` using a custom script (`scripts/compile-frontend.js`). Most files live in `Frontend and UI/`.
- **Backend**: Express 4 + TypeScript 6.0 running on Node.js (entry point `backend/src/app.ts`, Port 5001). 
- **Database**: Supabase (PostgreSQL 17 with `pgvector` for RAG). All database migrations are located in `supabase/migrations/`.
- **AI/LLM**: Groq API using `llama-3.3-70b-versatile` for agent orchestrations, demand forecasting, and voice order parsing.
- **Math/Domain Logic**: A pure TypeScript domain math library located at the root `/lib` (independent of the backend).

---

## 2. Core Domain Entities & Database Schema

The database uses Row Level Security (RLS) policies relying on a custom `public.get_user_role()` function which checks the `auth.uid()` against the `public.users` table.

### 2.1 Users & Roles
- **Table:** `public.users`
- **Fields:** `id`, `full_name`, `badge_id`, `role`, `pref_zone`, `created_at`
- **Roles:** 
  - `producer` / `processor`: Creates batches. (Routed to `ProducerDashboard.jsx`)
  - `sme_owner` / `buyer`: Purchases batches via marketplace. (Routed to `SMEOwnerDashboard.jsx`)
  - `admin` (Inspector): Performs QA, certification, and system auditing. (Routed to `InspectorDashboard.jsx`)

### 2.2 Batches (Biological Assets)
- **Table:** `public.batches`
- **Purpose:** Represents a physical volume of product (e.g., BARI EM-1 biofertilizer).
- **Key Columns:** `id`, `batch_number`, `product_name`, `feedstock_type`, `volume_liters`, `status`, `producer_id`, `inspector_id`, `sme_owner_id`.
- **Status Lifecycle:** `created` ➔ `inspected` ➔ `in_transit` ➔ `sme_inventory` ➔ `sold`.

### 2.3 Asset Tracking & Provenance (Trust Layer v2)
The system maintains cryptographic integrity and physical custody chains.
- **Table:** `public.batch_custody_ledger`
  - Append-only ledger recording custody handoffs (`action_type`: `production`, `inspection`, `dispatch`, `sme_receipt`, `retail_sale`).
- **Table:** `public.provenance_records`
  - Maintains a SHA-256 hash chain (`prev_hash`, `current_hash`) of critical QA and delivery events.
- **Table:** `public.qa_reports`
  - Stores QA metrics submitted by either `iot` sensors or human `inspector`s. Must meet tolerances defined in `public.product_categories`.

### 2.4 E-Commerce & Orders
- **Table:** `public.orders`
- **Key Columns:** `id`, `buyer_id` (SME), `product_id` (Batch ID), `quantity`, `totalBdt`, `status` (`pending`, `processing`, `completed`, `cancelled`).
- Supported by a separate `public.order_lifecycle_logs` table.

---

## 3. Frontend Architecture

**The UI has recently been refactored from a monolith to Role-Based Dashboards:**
- `AuthPanel.jsx`: Handles login and passes the user object/JWT to the router.
- `AuthRouter.jsx`: Analyzes the user's `role` and lazy-loads the correct dashboard:
  - `dashboards/ProducerDashboard.jsx` (Role: `processor` / `producer`)
  - `dashboards/SMEOwnerDashboard.jsx` (Role: `buyer` / `sme_owner`)
  - `dashboards/InspectorDashboard.jsx` (Role: `admin` / `inspector`)
- *Dead Code Warning*: `climalogix_dashboard.jsx` (the former monolith) and its compiled version may still exist but are deprecated. Always build features in the designated role dashboard.

**API Communication**:
- `Frontend and UI/api-integration.js` exposes `window.apiCall` and `window.APIClient`.
- Most calls dynamically inject `Authorization: Bearer <token>` from localStorage.

---

## 4. Backend Architecture & Routing

All routes are mounted in `backend/src/app.ts`. Major API routes:
- `/api/auth`: Login/Register logic. Issues standard JWTs.
- `/api/profile`: Upserts to `public.users`.
- `/api/batch`: Full CRUD for batches, plus `batch/trust-score` and certification logic.
- `/api/qa`: QA ingestion logic and standard rulebook fetching.
- `/api/checkout`: Cart checkout and **Voice Order Processing** via Groq.
- `/api/order`: Order lifecycle and status updates.
- `/api/qr`: Handles Consumer QR scans, logging to `qr_scans`.
- `/api/agent/message`: Interface to the conversational RAG system.

**Middleware:**
- `authenticateJWT`: Validates tokens. *(Agent Note: Recently applied across the board, but some mock endpoints in development might skip it)*.
- `strictAiRateLimiter` & `aiCostShield`: Wraps all Groq LLM routes to prevent budget exhaustion.
- `requireRole`: Utility to guard admin/inspector routes.

---

## 5. Specialized Math & AI Engines

1. **Trust Score Engine (`lib/index.ts`)**:
   - Calculates a score (0-100) and grade (A-F) based on pH, EC (Electrical Conductivity), Temperature, C:N ratio, and fermentation days.
   - Now supports `is_sensor_verified` weighting (IoT data gets higher trust multipliers than manual entry).
2. **Dynamic Vulnerability Score (DVS)**:
   - Evaluates supply chain route exposure based on Dhaka Urban Heat Island (UHI) zones and live weather data.
3. **RAG Vector Database**:
   - Stores chunked domain knowledge (`bari_knowledge_chunks`) in pgvector. The `agent.route.ts` creates embeddings to answer agricultural questions.

---

## 6. Known Technical Debt & AI Agent Directives

When modifying this project, AI agents MUST be aware of the following constraints and issues:

1. **Dual Environment Variables**: 
   - There is a root `.env` and a `backend/.env`. The backend `.env` variables generally take precedence.
2. **Supabase Migration Pitfalls**:
   - `schema.sql` (at root) contains the legacy database dump.
   - `supabase/migrations/*.sql` contains the CI/CD automated migrations. **If you alter the database**, you MUST write a new `.sql` file in `supabase/migrations/` and test it meticulously. (e.g., making sure policies use `DROP POLICY IF EXISTS`).
3. **Frontend Compilation Fragility**:
   - Because there is no bundler, `import/export` semantics are emulated globally. 
   - When modifying `.jsx` components, ensure you do not use Node.js features or incompatible ES modules.
   - After editing frontend scripts, run `node scripts/compile-frontend.js` to transpile Babel safely.
4. **Mock Data Leakage**:
   - Legacy files may still contain `MOCK_PRODUCTS` or `Math.random()` vectors (e.g. `seed-data.ts`). Do not rely on them. Real implementations must query the database.
5. **No Strict ORM**:
   - The project uses raw queries via the `@supabase/supabase-js` client. Pay close attention to TypeScript interfaces as the database schema evolves, as they can drift.

---
*Generated by Antigravity IDE during Full System Audit.*
