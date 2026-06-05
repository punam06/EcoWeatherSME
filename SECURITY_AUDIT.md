# Global Multilingual Intelligence Layer — Security & Compliance Audit

## 1. Zero Paid APIs / Vendor Lock-in Check
- **Language Detection**: Using open-source `franc-min` entirely offline/in-memory on our backend. No external API calls are made for text detection.
- **Geolocation/IP Detection**: Using `http://ip-api.com/json/` (Free tier, no API key required). Included rate-limiting fallback.
- **Inference**: Continuing to use Groq SDK exclusively for LLM queries. No new LLM services or paid translation endpoints were introduced.

## 2. PII / Data Privacy
- **IP Addresses**: The user's IP is retrieved securely from Express (`req.ip` / `x-forwarded-for`) strictly for the `detect-location` endpoint. It is not stored in the database.
- **Input Text**: Text is sent to the LLM exactly as the previous agent implementation handled it. `franc-min` runs locally and does not log user inputs to external services.

## 3. Rate Limiting & Failover
- **IP Geolocation**: Fallbacks to 'en' gracefully if `ip-api.com` is unreachable or blocks requests due to rate-limiting.
- **Error Handling**: `EcoLang.initialize()` traps initialization errors gracefully and defaults to English.

## 4. UI / XSS Considerations
- Text changes correctly bypass any script injections, since they flow through React's internal text rendering and Groq's sanitized JSON returns.
- Allowed supported language sets are tightly restricted to a hardcoded `ISO_TO_SPEECH_CODES` in the backend and frontend.

## 5. Security Posture
- Status: **PASSED**. No severe vulnerabilities found. Zero-paid API constraint maintained.
