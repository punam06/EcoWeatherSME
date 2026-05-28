# Project Completion Plan: EcoSortha AI

This version of the plan is written around the current reality of the team:

- Punam cannot handle deployment or frontend-to-backend wiring right now.
- Orce does not have a laptop yet, so coding work for Orce is blocked for now.
- The fastest path is to finish backend services, define clear API contracts, and prepare the UI work so it can be connected later without rework.

## What Each Person Owns

### Sabbir: Infrastructure, database, and deployment foundation

Sabbir should own anything that makes the system runnable in a stable environment. That includes Supabase setup, database migrations, security, Docker, and deployment plumbing. In practice, Sabbir is the person who makes sure the backend can be started, tested, and hosted without manual setup every time.

Concrete responsibilities:
- Finalize the Supabase schema and seed flow.
- Enable `pgvector` and set up the RAG tables and indexes.
- Define and apply RLS policies.
- Prepare the backend Docker setup.
- Own backend deployment to Railway, Render, or AWS.
- Set up shared environment variables and deployment config.
- Add CORS, rate limiting, and other basic API protections.

### Zihad: AI logic and backend endpoints

Zihad should own the actual API behavior that produces answers and scores. This is the layer that receives text, runs the RAG search, calls Gemini, and returns structured responses the frontend can consume.

Concrete responsibilities:
- Build the Gemini integration.
- Implement the RAG pipeline using the BARI knowledge source.
- Build the weather lookup service for live wind and temperature data.
- Expose API endpoints for chat, MERM, DVS, and batch verification.
- Make response formats predictable so the frontend can render them cleanly.
- Return Bangla-friendly text that can be read aloud by browser speech synthesis later.

### Punam: Product coordination, UI specification, and acceptance checking

Since deployment and direct frontend-backend connection are not in your scope right now, your job should be to keep the product coherent from the UI side and make sure the backend contracts are usable. You can still drive the flow, the wording, the UI behavior, and the acceptance criteria, even if someone else performs the wiring and deployment.

Concrete responsibilities:
- Define the screen flow and button behavior.
- Specify what each API response should contain for the UI.
- Review whether the speech flow feels usable in Bangla.
- Verify that the dashboard state, errors, and results make sense.
- Prepare test cases and manual acceptance steps.
- Coordinate handoff between backend output and UI display.

### Orce: UI/UX work once available

Orce is blocked until a laptop is available. Until then, Orce can still review screenshots, mockups, and state descriptions if needed, but cannot be assigned implementation work that requires a machine.

Concrete responsibilities once available:
- Add loading, error, and success UI states.
- Polish the dashboard layout and interaction flow.
- Connect map visuals and live gauges.
- Improve visual feedback for speech and processing states.

## Execution Plan

### Phase 1: Lock the contracts first

This phase happens before any frontend wiring. The goal is to agree on what each backend route returns so the UI can be built or reviewed without guessing.

1. Zihad defines the response shape for each API route.
2. Sabbir confirms the route names, environment variables, and deployment target.
3. Punam reviews the JSON shape and confirms whether it is enough for the dashboard, chat view, and voice flow.
4. If Orce is unavailable, the UI review is done through screenshots or written state descriptions only.

Acceptance check:
- Every endpoint has a clear input, output, and error response.
- The frontend team can tell which field drives the text, which field drives the gauge, and which field drives the map.

### Phase 2: Build backend services

This is the main technical build and should happen before deployment or UI connection work.

1. Sabbir prepares Supabase, migrations, `pgvector`, and security policies.
2. Zihad implements the Gemini/RAG service using the project knowledge base.
3. Zihad implements the weather lookup service.
4. Zihad exposes the API endpoints needed by the app.
5. Sabbir adds Docker and local run support.

Acceptance check:
- The backend can run locally from a clean environment.
- API endpoints return stable JSON.
- RAG and weather calls work independently before being combined.

### Phase 3: Define the voice and chat flow

The Web Speech API itself belongs in the browser, so the backend should not try to own microphone capture. The correct split is: browser captures speech, backend processes text, browser reads the response.

1. Punam defines the UI flow for microphone start, listening state, transcription, submit, and response playback.
2. Zihad ensures the chat endpoint accepts plain transcribed text and returns clean Bangla text.
3. The speech synthesis step stays on the frontend and should only read the final response, not the raw transcription.

What this means in practice:
- `SpeechRecognition` captures the user’s Bangla voice in the browser.
- The recognized text is sent to the backend chat endpoint.
- The backend returns the answer in a display-friendly format.
- `SpeechSynthesis` reads the final answer aloud in the browser.

Acceptance check:
- The app can show listening, processing, and done states.
- The returned text is short, natural, and suitable for TTS playback.

### Phase 4: UI work without direct backend wiring

Because Punam cannot do the actual connection work right now, the UI task should be split into preparation and later integration.

Current Punam tasks:
- Finalize the component structure for chat, gauges, and map panels.
- Define loading and error text.
- Write the interaction spec for microphone behavior.
- Prepare dummy/mock data for visual testing.
- Review whether the layout can handle real API responses later.

Blocked until another teammate wires it:
- Real fetch calls.
- Real backend integration.
- Production deployment.

Orce tasks:
- Blocked until laptop availability.
- If needed, Orce can still review mockups, user flow notes, and screenshot feedback asynchronously.

Acceptance check:
- The UI can already be exercised with mocked data.
- No layout depends on live API access before the backend is ready.

### Phase 5: Map and gauge integration

This should only happen after the backend data contract is stable.

1. Sabbir or Zihad exposes the zone, route, and climate values.
2. The UI consumes those values to update the map and the DVS gauge.
3. Orce, once available, refines the visuals and state transitions.

Acceptance check:
- The gauge updates from a single score field.
- The map updates from a single location/zone payload.

### Phase 6: Deployment and merge

Deployment should be treated as the final stage, not something to do before the backend and UI contract are stable.

1. Sabbir deploys the backend.
2. The frontend is connected only after the API contract is stable.
3. Environment variables are added on the hosting platform.
4. A full end-to-end test is performed after deployment.

Current constraint note:
- Since Punam cannot do deployment or direct connection work, those tasks should stay with Sabbir or another available teammate.
- Since Orce has no laptop, Orce should not be assigned implementation-critical steps until access is available.

Acceptance check:
- Speak in Bangla -> browser captures speech -> backend processes text -> response displays -> TTS reads it aloud -> gauge updates.
- Deployment settings are documented so the setup can be repeated.

## Recommended Order Right Now

1. Lock API contracts.
2. Finish backend and database work.
3. Prepare UI behavior and mock states.
4. Deploy backend.
5. Connect frontend later when a teammate is available to do it.
6. Do the final end-to-end test.

## 48-Hour Emergency Plan

There are less than 2 days left, so the plan should be reduced to a minimum shippable scope. The goal is not to finish every feature; the goal is to make the most important path work end to end.

### Must ship in the next 48 hours

1. A working backend with the core API routes.
2. A stable Supabase database setup.
3. A simple UI flow that can show results with mock data if needed.
4. A clear voice flow spec: browser speech input -> backend text processing -> browser speech output.
5. One end-to-end demo path that can be tested manually.

### Can be simplified for now

1. Map visuals can be static or partially mocked.
2. Gauge animations can be basic instead of polished.
3. QR/PDF features can be deferred unless they are essential to the demo.
4. Advanced deployment hardening can be reduced to the minimum needed for a stable demo.

### Should be deferred

1. Full UI polish.
2. Complex state management refinements.
3. Extra backend endpoints that are not required for the demo.
4. Non-essential map accuracy improvements.

## 48-Hour Ownership Split

### Sabbir

Priority:
- Finalize the database and backend runtime setup.
- Ensure the backend can run locally and in the deployment target.
- Handle the minimum deployment path.

Deliverable by end of day 1:
- Backend starts cleanly and connects to Supabase.

Deliverable by end of day 2:
- Backend is deployed or at least deploy-ready with documented steps.

### Zihad

Priority:
- Finish the Gemini and RAG logic.
- Finish the weather lookup logic.
- Return consistent JSON for chat and score endpoints.

Deliverable by end of day 1:
- Core answer endpoint works with sample inputs.

Deliverable by end of day 2:
- Core endpoints are stable enough for a live demo.

### Punam

Priority:
- Own the demo flow, screen order, and acceptance checklist.
- Make the UI usable with mock data while the connection work is blocked.
- Prepare the voice interaction spec and the final demo script.

Deliverable by end of day 1:
- The screen flow and demo script are written.

Deliverable by end of day 2:
- The UI can present the demo path clearly, even if some data is mocked.

### Orce

Status:
- Blocked until laptop access is available.
- If access arrives, Orce should focus only on the most visible UI cleanup and state feedback.

## What To Cut Immediately

If time becomes tight, cut in this order:

1. Extra features not needed for the demo.
2. Visual polish that does not affect comprehension.
3. Secondary endpoints.
4. Nice-to-have deployment improvements.

## Final Success Condition

The project is good enough if a reviewer can complete this sequence without confusion:

1. Speak or type a Bangla query.
2. The system captures or accepts the text.
3. The backend returns a useful answer.
4. The UI displays the answer clearly.
5. The answer can be read aloud.
6. The app shows one meaningful score or status indicator.

## Short Version Of The Responsibility Split

- Sabbir: database, Docker, security, deployment.
- Zihad: AI, RAG, weather, backend routes.
- Punam: UI flow, acceptance criteria, product coordination, mock-based review.
- Orce: UI polish later, after laptop access is available.
