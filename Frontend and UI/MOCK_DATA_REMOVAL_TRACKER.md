# Mock Data Removal Tracker

| File | Line | Mock Item | Replacement Needed | Estimated Effort |
|------|------|-----------|--------------------|------------------|
| `Frontend and UI/climalogix_dashboard.jsx` | 4838 | `MOCK_PRODUCTS` | ✅ Removed completely. | Low |
| `Frontend and UI/index.html` | 4499 | `MOCK_PRODUCTS` | ✅ Removed previously when extracting inline scripts. | Low |
| `Frontend and UI/climalogix_dashboard.js` (Legacy) | 8400, 9039, 15022 | `MOCK_PRODUCTS` | ✅ Deleted legacy file previously. | Low |
| `Frontend and UI/AuthPanel.js` (Legacy) | 266 | `mock-dev-token` | ✅ Deleted legacy file previously. | Low |
| `Backend/src/api/routes/weather.route.ts` | 74 | `Math.random()` | ✅ Replaced with a sensible deterministic Dhaka-based fallback (32°C, 75% RH). | Medium |
| `Backend/src/lib/services/agentOrchestrator.service.ts` | 370 | `Math.random()` | 🔵 Intentionally kept. It is used to select a random conversational greeting, not an embedding vector. | Low |
| `Backend/src/app.ts` | 330-807 | `Math.random()` | 🔵 Intentionally kept (with comments). These instances simulate demo/test variations (e.g., slight daily temp/noise shifts), not pgvector arrays. | Medium |
| `Backend/src/scripts/seed-data.ts` | 49 | `Math.random()` | ✅ Fixed previously. Array.from generating mock vectors no longer exists. | Medium |
