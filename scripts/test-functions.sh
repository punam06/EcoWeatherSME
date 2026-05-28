#!/bin/bash
# Local testing script for Supabase Edge Functions

echo "Starting Supabase Edge Functions locally..."
echo "(Make sure you run 'npx supabase functions serve --no-verify-jwt --env-file .env' in another terminal first)"
echo ""
sleep 2

# Test 1: Trust Score
echo "--- Testing /trust-score ---"
curl -i --location --request POST 'http://localhost:54321/functions/v1/trust-score' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "pH": 4.1,
    "EC": 3.4,
    "temp": 28,
    "em1_ratio": "1:1:20",
    "fermentation_days": 9
  }'
echo -e "\n\n"

# Test 2: AI Processing
echo "--- Testing /ai-processing ---"
curl -i --location --request POST 'http://localhost:54321/functions/v1/ai-processing' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "userQuery": "আমার টমেটো গাছের জন্য কোন সার ভালো হবে?",
    "language": "bn"
  }'
echo -e "\n\n"

# Test 3: Climate DVS
echo "--- Testing /climate-dvs ---"
curl -i --location --request POST 'http://localhost:54321/functions/v1/climate-dvs' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "trustScore": 85,
    "zone": "Mirpur",
    "packagingType": "Standard Plastic",
    "dispatchTime": "2026-05-28T14:00:00Z"
  }'
echo -e "\n\n"

echo "Testing completed."
