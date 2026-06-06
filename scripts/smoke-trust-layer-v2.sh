#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# CLIMALOGIX AI — TRUST LAYER v2 SMOKE TEST
# File: scripts/smoke-trust-layer-v2.sh
#
# Starts the backend in dev mode (no Supabase / no Groq required),
# hits the 3 new Trust Layer v2 endpoints + the category-aware
# trust score route, and asserts that the demo fallbacks return
# the expected shapes. Used to gate merges / pre-deploys.
#
# Exit code 0 = all good, 1 = at least one assertion failed.
# ═══════════════════════════════════════════════════════════════

set -o pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$ROOT/backend"
PORT="${PORT:-4799}"
BASE="http://127.0.0.1:${PORT}"
SERVER_LOG="$(mktemp -t climalogix-smoke.XXXXXX.log)"
PASS=0
FAIL=0

# Force the offline path: no real Supabase / Groq. The backend's app.ts loads
# the root .env automatically, so unsetting isn't enough — we also need to
# point the env at obviously-placeholder values that isSupabaseConfigured()
# will reject.
unset SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY GROQ_API_KEY
export SUPABASE_URL="https://your-project-id.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-placeholder"
export PORT NODE_ENV=test

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$SERVER_LOG"
}
trap cleanup EXIT

# ── Helpers ────────────────────────────────────────────────────


fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

# JSON-path getter via node (no jq dependency). Usage: jget '.path' "$json"
jget() {
  local path="$1" json="$2"
  JSON_PAYLOAD="$json" JSON_PATH="$path" node -e '
    const d = JSON.parse(process.env.JSON_PAYLOAD);
    const p = process.env.JSON_PATH.split(".").filter(Boolean);
    let v = d;
    for (const k of p) {
      if (v == null) { console.log(""); process.exit(0); }
      // support array index syntax: events[0] → events,0
      const m = k.match(/^([^\[]+)(?:\[(\d+)\])?$/);
      if (m) {
        v = v[m[1]];
        if (m[2] !== undefined) v = v?.[parseInt(m[2], 10)];
      } else {
        v = v[k];
      }
    }
    console.log(v);
  '
}

assert_status() {
  local actual="$1" expected="$2" label="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label (status $expected)"
  else
    fail "$label — expected $expected, got $actual"
  fi
}

assert_eq() {
  local actual="$1" expected="$2" label="$3"
  if [[ "$actual" == "$expected" ]]; then
    pass "$label"
  else
    fail "$label — expected '$expected', got '$actual'"
  fi
}

# ── Start server ───────────────────────────────────────────────

cd "$BACKEND"
echo "→ Starting backend on port $PORT (no Supabase, no Groq)..."
TS_NODE_TRANSPILE_ONLY=true TS_NODE_COMPILER_OPTIONS='{"moduleResolution":"node10","ignoreDeprecations":"6.0"}' \
  npx ts-node src/app.ts > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

# Wait for the server to come up (poll /api/health, max 30s).
for i in {1..30}; do
  if curl -sf "$BASE/api/health" > /dev/null 2>&1; then
    echo "  Server up after ${i}s"
    break
  fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    echo "  ✗ Server failed to start within 30s. Log:"
    cat "$SERVER_LOG"
    exit 1
  fi
done

# ── Tests ──────────────────────────────────────────────────────

echo
echo "1) GET /api/qa/categories"
RES=$(curl -s -w "\n%{http_code}" "$BASE/api/qa/categories")
BODY=$(echo "$RES" | sed -e '$ d')
STATUS=$(echo "$RES" | tail -n 1)
assert_status "$STATUS" "200" "qa/categories status"
COUNT=$(jget 'data.length' "$BODY")
assert_eq "$COUNT" "5" "qa/categories returns 5 categories"
PHARMA_BSTI=$(JSON_PAYLOAD="$BODY" node -e 'const d=JSON.parse(process.env.JSON_PAYLOAD); const p=d.data.find(c=>c.category==="pharma"); console.log(p.requiresBSTI);')
assert_eq "$PHARMA_BSTI" "true" "pharma.requiresBSTI"

echo
echo "2) POST /api/qa/submit (organic iot) — should 422 (no DB)"
RES=$(curl -s -w "\n%{http_code}" -H "content-type: application/json" -X POST "$BASE/api/qa/submit" \
  -d '{"batch_id":"TEST-001","source":"iot","category":"organic","metrics":{"pH":6.5,"ec":3.5,"temp":28,"em1Ratio":0.002,"fermentationDays":10}}')
STATUS=$(echo "$RES" | tail -n 1)
BODY=$(echo "$RES" | sed -e '$ d')
assert_status "$STATUS" "422" "qa/submit without supabase"
ERR=$(jget 'error' "$BODY")
if [[ "$ERR" == *"Supabase is not configured"* ]]; then
  pass "qa/submit error mentions Supabase"
else
  fail "qa/submit error — got '$ERR'"
fi

echo
echo "3) POST /api/qa/submit (pharma, no BSTI) — should 422 with BSTI error"
RES=$(curl -s -w "\n%{http_code}" -H "content-type: application/json" -X POST "$BASE/api/qa/submit" \
  -d '{"batch_id":"TEST-002","source":"iot","category":"pharma","metrics":{"pH":6,"ec":2,"temp":5,"em1Ratio":0,"fermentationDays":0}}')
STATUS=$(echo "$RES" | tail -n 1)
BODY=$(echo "$RES" | sed -e '$ d')
assert_status "$STATUS" "422" "pharma without BSTI"
ERR=$(jget 'error' "$BODY")
if [[ "$ERR" == *"requires a BSTI credential"* ]]; then
  pass "BSTI requirement enforced"
else
  fail "BSTI requirement — got '$ERR'"
fi

echo
echo "4) POST /api/qa/submit (pharma, malformed BSTI) — should 422"
RES=$(curl -s -w "\n%{http_code}" -H "content-type: application/json" -X POST "$BASE/api/qa/submit" \
  -d '{"batch_id":"TEST-003","source":"iot","category":"pharma","bstiCredential":"NOT-A-BSTI-CODE","metrics":{"pH":6,"ec":2,"temp":5,"em1Ratio":0,"fermentationDays":0}}')
STATUS=$(echo "$RES" | tail -n 1)
BODY=$(echo "$RES" | sed -e '$ d')
assert_status "$STATUS" "422" "malformed BSTI"
ERR=$(jget 'error' "$BODY")
if [[ "$ERR" == *"Invalid BSTI credential format"* ]]; then
  pass "BSTI regex enforced"
else
  fail "BSTI regex — got '$ERR'"
fi

echo
echo "5) POST /api/qa/submit (iot with inspector notes) — should 422"
RES=$(curl -s -w "\n%{http_code}" -H "content-type: application/json" -X POST "$BASE/api/qa/submit" \
  -d '{"batch_id":"TEST-004","source":"iot","category":"organic","inspectorNotes":"nope","metrics":{"pH":7,"ec":1,"temp":22,"em1Ratio":0,"fermentationDays":0}}')
STATUS=$(echo "$RES" | tail -n 1)
BODY=$(echo "$RES" | sed -e '$ d')
assert_status "$STATUS" "422" "iot with inspector notes"
ERR=$(jget 'error' "$BODY")
if [[ "$ERR" == *"iot reports cannot include inspector notes"* ]]; then
  pass "iot/inspector cross-rule enforced"
else
  fail "iot/inspector — got '$ERR'"
fi

echo
echo "6) POST /api/batch/trust-score (ideal organic) — should be A-grade"
# Legacy route hardcodes category=organic. Standards: pH[6.5,7.5], ec[1.5,3.5],
# temp[25,35], em1Ratio≈0.001, fermentationDays≥21. All 5 sub-scores = 1.0 → 100.
RES=$(curl -s -w "\n%{http_code}" -H "content-type: application/json" -X POST "$BASE/api/batch/trust-score" \
  -d '{"pH":7.0,"ec":2.0,"temperatureCelsius":28,"em1Ratio":0.001,"fermentationDays":30}')
STATUS=$(echo "$RES" | tail -n 1)
BODY=$(echo "$RES" | sed -e '$ d')
assert_status "$STATUS" "200" "trust-score status"
GRADE=$(jget 'data.grade' "$BODY")
VIABLE=$(jget 'data.isViable' "$BODY")
SCORE=$(jget 'data.score' "$BODY")
assert_eq "$GRADE" "A" "trust-score grade A for ideal organic"
assert_eq "$VIABLE" "true" "trust-score isViable"
echo "    score=$SCORE"

echo
echo "7) POST /api/batch/trust-score (poor readings) — lower grade"
RES=$(curl -s -w "\n%{http_code}" -H "content-type: application/json" -X POST "$BASE/api/batch/trust-score" \
  -d '{"pH":9.0,"ec":8.0,"temperatureCelsius":18,"em1Ratio":0.01,"fermentationDays":1}')
BODY=$(echo "$RES" | sed -e '$ d')
SCORE=$(jget 'data.score' "$BODY")
if [[ "$SCORE" -lt 80 ]]; then
  pass "trust-score degraded for poor readings (score=$SCORE)"
else
  fail "trust-score should be <80 for poor readings, got $SCORE"
fi

echo
echo "8) GET /api/verify/:batch_id — demo chain fallback"
RES=$(curl -s -w "\n%{http_code}" "$BASE/api/verify/DEMO-BATCH-001")
STATUS=$(echo "$RES" | tail -n 1)
BODY=$(echo "$RES" | sed -e '$ d')
assert_status "$STATUS" "200" "verify status"
SOURCE=$(jget 'data.source' "$BODY")
assert_eq "$SOURCE" "demo" "verify source=demo"
CHAIN_LEN=$(jget 'data.chain.events.length' "$BODY")
assert_eq "$CHAIN_LEN" "3" "verify chain has 3 events"
E0=$(jget 'data.chain.events[0].type' "$BODY")
E1=$(jget 'data.chain.events[1].type' "$BODY")
E2=$(jget 'data.chain.events[2].type' "$BODY")
assert_eq "$E0" "genesis" "event[0]=genesis"
assert_eq "$E1" "dispatched" "event[1]=dispatched"
assert_eq "$E2" "delivered" "event[2]=delivered"
VERIFIED=$(jget 'data.chain.verified' "$BODY")
assert_eq "$VERIFIED" "true" "chain verifies"
HEAD=$(jget 'data.chain.head_hash' "$BODY")
if [[ "${#HEAD}" -eq 64 ]]; then
  pass "head_hash is 64-char hex"
else
  fail "head_hash length is ${#HEAD}, expected 64"
fi

echo
echo "9) GET /api/esg/report?months=3 — demo aggregate"
RES=$(curl -s -w "\n%{http_code}" "$BASE/api/esg/report?months=3")
STATUS=$(echo "$RES" | tail -n 1)
BODY=$(echo "$RES" | sed -e '$ d')
assert_status "$STATUS" "200" "esg/report status"
SOURCE=$(jget 'source' "$BODY")
assert_eq "$SOURCE" "demo" "esg/report source=demo"
LEN=$(jget 'data.length' "$BODY")
assert_eq "$LEN" "3" "esg/report has 3 monthly rows"
KEYS_OK=$(JSON_PAYLOAD="$BODY" node -e 'const d=JSON.parse(process.env.JSON_PAYLOAD); const need=["e_score","s_score","g_score","esg_score","trust_score","dvs_score","plastic_offset_kg","carbon_sequestered_kg","water_saved_l","waste_reduced_kg","spoilage_prevented_bdt"]; for (const r of d.data) { for (const k of need) { if (typeof r[k] !== "number") { console.log("miss:"+k); process.exit(1); } } } console.log("ok");')
assert_eq "$KEYS_OK" "ok" "esg rows have all required numeric fields"

echo
echo "10) GET /api/esg/report clamping"
RES1=$(curl -s "$BASE/api/esg/report?months=999")
L1=$(jget 'data.length' "$RES1")
assert_eq "$L1" "24" "months=999 clamps to 24"
RES2=$(curl -s "$BASE/api/esg/report?months=0")
L2=$(jget 'data.length' "$RES2")
assert_eq "$L2" "1" "months=0 clamps to 1"
RES3=$(curl -s "$BASE/api/esg/report")
L3=$(jget 'data.length' "$RES3")
assert_eq "$L3" "1" "no months param defaults to 1"

# ── Summary ────────────────────────────────────────────────────

echo
echo "════════════════════════════════════════════════════════"
echo "  Smoke test summary:  $PASS passed,  $FAIL failed"
echo "════════════════════════════════════════════════════════"

if [[ "$FAIL" -gt 0 ]]; then
  echo "Server log (last 40 lines):"
  tail -40 "$SERVER_LOG" || true
  exit 1
fi
exit 0
