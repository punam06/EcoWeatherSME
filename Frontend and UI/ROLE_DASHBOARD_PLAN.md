# ROLE_DASHBOARD_PLAN

## PART 1: UNDERSTAND THE CURRENT AUTH & ROLE SYSTEM

### 1. Database Schema (`users` table)
The `users` table includes the following columns: `id`, `email`, `password_hash`, `name`, and `role`. 
The `role` column holds the following exact values: `'processor'` (Producer), `'buyer'` (SME Owner), and `'admin'` (Inspector).

### 2. JWT Payload
When a user logs in, the JWT payload contains the following properties: `id` (or `sub`), `email`, and `role`. This proves the auth mechanism already natively supports role differentiation at the token level without requiring subsequent database lookups per request.

### 3. Frontend Storage
Upon a successful login (or signup auto-login) via `AuthPanel.jsx`, the frontend stores:
- The token in `localStorage.setItem("climaLogix_token", token)` and `window.SUPABASE_SESSION_TOKEN`.
- The user metadata object in `localStorage.setItem("climaLogix_user", JSON.stringify(userData))`.

### 4. Post-Login Routing & Logic
Currently, there is no true post-login React routing. The entire app resides in `climalogix_dashboard.jsx`. The dashboard uses a function called `getTabsForRole(role)` to dynamically filter which Sidebar tabs are available. Based on `currentUser.role`, it populates an array of visible tabs (e.g., hiding the "verification" tab from SME Owners). If the active tab isn't permitted, it forces navigation to the first allowed tab. 

### 5. Registration Flow
The registration flow natively asks for a role. In `AuthPanel.jsx`, users click a segmented control to self-select: **"SME Owner"**, **"Producer"**, or **"Inspector"**. These UI roles map to backend enum roles (`buyer`, `processor`, `admin` respectively) before being passed to `POST /api/auth/signup`.

---

## PART 2: ROLE-FEATURE MATRIX

| Feature / View | SME Owner (`buyer`) | Producer (`processor`) | Inspector (`admin`) | Notes |
|---|---|---|---|---|
| Main Dashboard (Overview) | Yes | Yes | Yes | Content varies (purchases vs. sales vs. audits) |
| Marketplace (Orders) | Yes | No | No | Buying materials |
| Voice Order Portal | Yes | No | No | Specific to SME Owners |
| Tracking (Delivery) | Yes | Yes | No | Track incoming (SME) or outgoing (Producer) |
| Inventory / Batches | No | Yes | No | Create batches, submit IoT readings |
| Verification / QA | No | No | Yes | Review batches, run QA, issue certs |
| SME Configurator | Yes | No | No | Exclusive tool for buyers |
| Delivery Dispatch (DVS) | No | Yes | No | Dispatch route mapping for logistics |
| Notifications | Yes | Yes | Yes | Filtered by user |
| System Docs | Yes | Yes | Yes | Shared |

### Existing Role-Scoped Backend Routes
- Most routes currently *lack* strict role enforcement (noted as `// TODO: Enforce Role`).
- The `authenticateJWT` middleware extracts the role, and the `requireRole(...roles)` middleware exists in `authenticateJWT.ts`, but it is rarely invoked on individual controller routes outside of experimental agent endpoints.

---

## PART 3: ARCHITECTURE & BUILD PLAN

### 3.1 Backend Changes Required
- **Route Authorization Middleware:** Apply `requireRole('admin')` to QA/certification routes (`/api/qa/certify`). Apply `requireRole('processor')` to batch creation routes. Apply `requireRole('buyer')` to checkout routes.
- **Validation:** Add strict validation (Zod) to prevent privilege escalation or data corruption on `PUT /api/profile`.

### 3.2 Frontend Architecture Plan
Role-based routing should live directly inside a central `<AppRouter>` component that reads from `climaLogix_user` local storage.

**Proposed Folder Structure:**
```text
Frontend and UI/
  src/
    dashboards/
      SMEOwnerDashboard.jsx
      ProducerDashboard.jsx
      InspectorDashboard.jsx
    components/
      SharedNav.jsx
      NotificationToast.jsx
      LanguageSelector.jsx
```

**Pseudocode for Routing:**
```javascript
const AuthRouter = () => {
  const [user, setUser] = useState(getSavedUser());

  if (!user) return <AuthPanel onLogin={setUser} />;

  const role = user.role;
  switch(role) {
    case 'buyer': return <SMEOwnerDashboard user={user} />;
    case 'processor': return <ProducerDashboard user={user} />;
    case 'admin': return <InspectorDashboard user={user} />;
    default: return <ErrorPage message="Unknown Role" />;
  }
};
```

### 3.3 Shared Components
These should remain in `components/` and be imported across dashboards:
- Sidebar/Navigation (dynamically populated by props)
- `LanguageSelector` (Bangla/English)
- Toast / Error Notification System
- `RouteExposureMapCard` and `DhakaRouteMicroMap` (used by both SME and Producer)

### 3.4 New Components Needed Per Role
**SME Owner Dashboard:** `MarketplaceBrowser`, `VoiceOrderPortal`, `OrderHistoryPanel`, `SMEConfigurator`
**Producer Dashboard:** `BatchCreationForm`, `IoTReadingsPanel`, `TrustScoreViewer`, `DVSDispatchCard`, `ProductListingManager`
**Inspector Dashboard:** `BatchReviewQueue`, `CertificationIssuer`, `ProvenanceChainViewer`, `QAChecklist`

---

## PART 4: FULL BUG AUDIT

### 4.1 Frontend Bugs
| File | Line | Bug Type | Description | Severity | Fix |
|---|---|---|---|---|---|
| `climalogix_dashboard.jsx` | 338 | Missing Fallback | Hardcoded English strings bypass Language Toggle inside `getTabsForRole`. | Low | Wrap in `language === 'bn' ? ... : ...`. |
| `components/RouteExposureMapCard.jsx` | 42 | Null Crash | If `window.DhakaRouteMicroMap` is missing, it attempts to render it anyway without a safe fallback, crashing React. | High | Wrap in `<ErrorBoundary>` and strict undefined checks. |
| `api-integration.js` | 20 | Missing Error Handler | `window.apiCall` does not cleanly bubble up `catch` rejections, sometimes returning `undefined` rather than rejecting on network errors. | High | Add explicit `Promise.reject(err)`. |

### 4.2 Backend Bugs
| File | Line | Bug Type | Description | Severity | Fix |
|---|---|---|---|---|---|
| `api/routes/profile.route.ts` | 45 | Missing Validation | `PUT /` blindly trusts `req.body.full_name` without length or type checks, writing directly to DB. | High | Wrap request body in Zod schema validator. |
| `api/routes/auth.route.ts` | 134 | Missing Catch Return | In signup, a failed Argon2 hash will throw uncaught error rather than returning 500 cleanly. | Medium | Add internal `try/catch` specifically around hashing. |
| `api/routes/notifications.route.ts`| 194 | Null checking | Doesn't handle cases where `userId` is empty gracefully in the query parameters. | Medium | Short circuit if `!userId`. |

### 4.3 Data Flow Bugs
| File | Line | Bug Type | Description | Severity | Fix |
|---|---|---|---|---|---|
| `climalogix_dashboard.jsx` | 550 | Envelope Mismatch | API returns `{ success: true, user: {...} }` but frontend expects `res.data.user` rather than `res.user`. | High | Standardize frontend to read `res.user`. |

### 4.4 Security Bugs (Beyond JWT)
| File | Line | Bug Type | Description | Severity | Fix |
|---|---|---|---|---|---|
| `api/routes/checkout.route.ts` | 74 | ID Spoofing Risk | Doesn't confirm that the `req.user.role` allows purchasing; an Inspector could spoof checkout requests. | High | Inject `requireRole('buyer')`. |
| `api/routes/profile.route.ts` | 50 | XSS Risk | `upsert` accepts raw unsanitized strings for `badge_id` and `pref_zone`. | High | Run input through HTML sanitizer/Zod regex. |

---

## PART 5: IMPLEMENTATION ROADMAP

### Phase 1 — Foundation (Do First)
- Refactor `App.jsx` to establish the `AuthRouter` role-splitting logic.
- Secure backend endpoints by applying `requireRole()` middleware explicitly to `checkout.route.ts`, `qa.route.ts`, and `batch.route.ts`.
- Patch high-severity security vulnerabilities (input validation in `profile.route.ts`).

### Phase 2 — Producer Dashboard
- Build and isolate `BatchCreationForm`.
- Implement `TrustScoreViewer` isolated state.
- Wire `DVSDispatchCard` to `delivery.route.ts`.

### Phase 3 — SME Owner Dashboard
- Extract `MarketplaceBrowser` and `VoiceOrderPortal` to isolated views.
- Extract `OrderHistoryPanel` to fetch `/api/orders` only for this dashboard.

### Phase 4 — Inspector Dashboard
- Assemble the `BatchReviewQueue` polling view.
- Build `CertificationIssuer` component strictly for `admin` role.

### Phase 5 — Cleanup
- Completely delete the legacy 10,000-line `climalogix_dashboard.jsx` file.
- Perform a final end-to-end user journey test across all 3 roles.
