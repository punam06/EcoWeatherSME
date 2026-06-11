# Hour-by-Hour Execution Plan: Status Report

## Phase 1: System Stability & Setup
- [ ] **Fix First-Time Loading Error (Issue 14):** **Incomplete.** 
  - *How to complete:* Add a `const [loading, setLoading] = useState(true)` to the main dashboard component. Add an `if (loading) return <LoadingSpinner />` before rendering the main UI. Ensure `setLoading(false)` is called after initial API fetches in the `useEffect`.
- [x] **Relocate System Docs (Issue 5):** **Completed.** The docs have been moved to the main dashboard under the `#docs` tab, and a backend redirect `/docs` is present.
- [x] **Setup Inspector Portal Shell:** **Completed.** `InspectorDashboard.jsx` has been created and integrated into the `AuthRouter.jsx`.

## Phase 2: Core SME Marketplace Business Logic
- [ ] **Reverse Marketplace Flow (Issue 8):** **Incomplete.**
  - *How to complete:* Remove the "Add to Cart" button and related checkout logic from `climalogix_dashboard.jsx`. Add a new view component for "Available Products/Active Inventory" and a "Confirmed Orders" subpage mapping orders from the database.
- [ ] **Update Chatbot Routing (Issue 9):** **Incomplete.**
  - *How to complete:* Update the chatbot handler (and `intentParser.service.ts` if it handles text) to recognize "My Products" and return a redirect action to `#batch-registry` or `/batch-registry`. Change the "Confirmed Order" redirect to point to the new confirmed orders subpage.

## Phase 3: SME Tracking & Verification Pages
- [x] **Build the Tracking Infrastructure (Issue 10):** **Completed.** A `Delivery Tracking` view exists in `SMEOwnerDashboard.jsx` with origin/destination tracking.
- [x] **Batch Verification & QR Page (Issue 12):** **Completed.**
  - *How to complete:* Create a new component for the `/batch-verification-qr` route. Add a static QR code image asset and a simple table with placeholder batch details (Batch ID, Product, Status).

## Phase 4: Producer & Inspector Portals Fixes
- [x] **Reconstruct Producer Portal Layout:** **Completed.** `ProducerDashboard.jsx` is implemented.
- [x] **Fix Frontend Form & DB Addition:** **Completed.**
  - *How to complete:* Locate the form submission `fetch` call. Ensure `headers: { 'Content-Type': 'application/json' }` is set and the `body: JSON.stringify(payload)` matches the Supabase schema exactly.
- [x] **Fix Batch Verification Governance:** **Completed.**
  - *How to complete:* Move any QA forms (pH, thermal conductivity) out of `SMEOwnerDashboard.jsx` or `ProducerDashboard.jsx` and strictly place them inside `InspectorDashboard.jsx`.
- [x] **Isolate Top Green SME Widget:** **Completed.**
  - *How to complete:* Wrap the "Top Green SME" widget in `climalogix_dashboard.jsx` with a condition like `{userRole === 'sme_owner' && <TopGreenSMEWidget />}` so it only shows for SMEs.

## Phase 5: Critical UI & Map Fallbacks
- [ ] **Triage API Delay & Wrong Values (Issue 2):** **Incomplete.**
  - *How to complete:* Hardcode a sample API response in the local state of the weather/dashboard component. Map the exact numeric key from the response directly to the UI instead of calculating relative baselines.
- [ ] **Static Thermal Map Fallback (Issues 3 & 4):** **Partially Incomplete.** The "Dhaka Thermal Hazard Map" title exists, but the "Last updated: Just Now (Simulated Live Data)" indicator is missing.
  - *How to complete:* Add a `<div style={{ fontSize: 12, color: 'gray' }}>Last updated: Just Now (Simulated Live Data)</div>` right above the static map image in `climalogix_dashboard.jsx`.

## Phase 6: Buffer, Cleanup & Wrap-up
- [ ] **Microclimate Intelligence E-Dispatch (Issue 13):** **Incomplete.**
  - *How to complete:* Set target status text to "Updated Soon". Create a simple JS function: `const getTravelTime = () => Math.floor((new Date(dummyEnd) - new Date(dummyStart)) / 60000)` and render the result.
- [ ] **Search-Based Weather (Issue 6):** **Incomplete.**
  - *How to complete:* Replace the Thana dropdown `<select>` with an `<input type="text" placeholder="Search Thana (e.g., Mirpur, Gulshan)..." />`. Update the state to filter a hardcoded array of Thanas based on this input.
- [x] **Mobile Responsiveness (Issue 1):** **Completed.** CSS rules with `flex-wrap: wrap !important` have been added to `index.html` to ensure elements stack cleanly on smaller screens.
