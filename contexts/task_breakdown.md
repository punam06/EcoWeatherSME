# Project Completion Plan: EcoSortha AI

Based on the project's current state and your identified requirements, here is the complete breakdown of the remaining tasks, correctly delegated to your team members, and structured into a step-by-step execution guide.

## 🎯 Task Breakdown & Team Delegation

### Backend Development (Assigned to Sabbir & Zihad)

**Zihad (AI & Core API Developer)**
- **Gemini API & RAG Pipeline:** Integrate the Gemini API (replacing Claude). Build the Retrieval-Augmented Generation (RAG) logic using BARI guidelines to answer agricultural queries.
- **Weather API Integration:** Set up reliable weather API (e.g., Open-Meteo or WeatherAPI) to fetch live temperature and wind speed for the microclimate model.
- **RESTful Endpoints:** Expose backend routes (e.g., `/api/calculate-merm`, `/api/rag-query`, `/api/verify-batch`) so the frontend can interact with the mathematical models.
- **Web Speech API Processing:** While the actual Web Speech API runs on the frontend browser, Zihad needs to ensure the backend `/api/rag-query` endpoint is optimized to receive transcribed text and return natural-sounding Bangla text for Text-to-Speech playback.

**Sabbir (Database, Cloud, & Infrastructure Architect)**
- **Supabase DB:** Finalize Supabase setup, including schema migrations, `pgvector` for RAG, and Row Level Security (RLS) policies.
- **Map / Location Tracking API:** Integrate geolocation services (like Google Maps API or Mapbox) to capture the user's zone and calculate distance/wind speed impacts on delivery routes.
- **Dockerization:** Create `Dockerfile` and `docker-compose.yml` for the Node.js backend to ensure consistent deployment environments.
- **Other Backend Tasks:** 
  - *PDF Generation & QR Verification:* Build the logic to generate downloadable certificates (`jsPDF` or backend equivalent) for the Cryptographic QR Pipeline.
  - *Rate Limiting & Security:* Implement CORS and rate-limiting on APIs to prevent abuse.

### Deployment & Connection (Assigned to Punam & Orce)

**Punam (Team Lead & Connection Logic)**
- **Frontend-Backend Connection:** Use `fetch` or `axios` to hook up the standalone React UI to Zihad's REST API endpoints (Weather, TST, MERM).
- **Web Speech API (Frontend):** Implement the browser's native `SpeechRecognition` and `SpeechSynthesis` APIs to record spoken Bangla, send it to the backend, and read Gemini's response out loud.
- **Frontend Deployment:** Deploy the React frontend to Vercel or Netlify.
- **System Merge:** Oversee the final merge of the backend and frontend repositories (or folders), ensuring environment variables (`.env`) are correctly mapped in production.

**Orce (UI/UX & State Integration)**
- **UI State Management:** Create loading states, error boundaries, and success notifications while API calls are running.
- **Map/Location UI:** Integrate the map visual into the dashboard to display the active delivery route and microclimate hazard zones.
- **Live Gauge Connection:** Ensure the circular SVG viability gauges (DVS) update smoothly based on the live data fetched from the API.
- **Backend/DB Deployment:** Assist Sabbir in deploying the Dockerized backend to Railway, Render, or AWS, and connect it to the production Supabase database.

---

## 🚀 Step-by-Step Implementation Guide

### Step 1: Foundation & Database (Sabbir)
1. Initialize the Supabase project online.
2. Run the existing seed scripts (`seed:hazards`, `seed:data`) to populate the database.
3. Enable `pgvector` in Supabase for the AI RAG search.
4. Set up `.env` files with Supabase keys for the team.

### Step 2: External APIs & AI (Zihad & Sabbir)
1. **Zihad:** Get a Gemini API key. Build a basic script to query Gemini with a strict system prompt (acting as an agricultural expert).
2. **Zihad:** Fetch local weather data via the Weather API.
3. **Sabbir:** Set up the Map API to convert coordinates into neighborhood zones (e.g., "Old Dhaka").

### Step 3: Backend API Endpoints (Zihad)
1. Build an Express.js server (or Next.js API routes if using a full-stack framework).
2. Create `POST /api/chat` (Receives text from Voice API -> Queries Supabase Vector DB -> Queries Gemini -> Returns answer).
3. Create `POST /api/calculate-dvs` (Receives weather & location -> Runs Punam's math logic -> Returns viability score).

### Step 4: Frontend UI Connection (Punam & Orce)
1. **Punam:** Add microphone buttons in the UI that trigger the browser's Web Speech API.
2. **Punam:** Send the transcribed speech text to Zihad's `/api/chat` endpoint.
3. **Orce:** Show a "Listening..." animation, and then display the Gemini response cleanly in the chat interface. Update the DVS gauge using the `/api/calculate-dvs` response.

### Step 5: Dockerization (Sabbir)
1. Write a `Dockerfile` for the Node.js backend.
2. Test the image locally (`docker build` and `docker run`).

### Step 6: Final Deployment & Merge (Punam, Orce, Sabbir)
1. **Frontend:** Punam connects the Vercel project to the GitHub repo. Add environment variables.
2. **Backend:** Orce and Sabbir deploy the Docker image to Railway/Render. Add environment variables (Gemini Key, Supabase Key).
3. **Test:** Do a full end-to-end test (Speak in Bangla -> Process in backend -> Get response & update gauges).
