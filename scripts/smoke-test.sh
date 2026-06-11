#!/usr/bin/env bash
# smoke-test.sh — end-to-end test for internal affiliate API endpoints
# Usage: SECRET=local-affiliate-secret CODE=YOURCODE bash scripts/smoke-test.sh
# Or edit the defaults below.

set -euo pipefail

SECRET="${SECRET:-local-affiliate-secret}"
CODE="${CODE:-YOURCODE}"
BASE_URL="${BASE_URL:-http://localhost:3001}"

sign() {
  local body="$1"
  local ts="$2"
  node -e "
    const c = require('crypto');
    const sig = c.createHmac('sha256', '$SECRET').update('$ts.$body').digest('hex');
    process.stdout.write(sig);
  "
}

echo "=== Smoke Test: $BASE_URL ==="
echo "SECRET=$SECRET  CODE=$CODE"
echo ""

# ── 1. Validate code ─────────────────────────────────────────────────────────
echo "── 1. POST /api/internal/codes/validate"
BODY='{"code":"'"$CODE"'"}'
TS=$(date +%s)
SIG=$(sign "$BODY" "$TS")

curl -sS -X POST "$BASE_URL/api/internal/codes/validate" \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $TS" \
  -H "X-Signature: $SIG" \
  --data "$BODY" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const r=JSON.parse(d);
      console.log(JSON.stringify(r,null,2));
      if(!r.active){console.error('FAIL: code not active');process.exit(1);}
      console.log('PASS');
    });
  "
echo ""

# ── 2. Send a test mealtrack event ────────────────────────────────────────────
echo "── 2. POST /api/internal/mealtrack-events (affiliate_attribution_created)"
EVT_ID="smoke-$(date +%s)"
# Get affiliate_id from validate result — re-run to capture
VALIDATE_BODY='{"code":"'"$CODE"'"}'
VTS=$(date +%s)
VSIG=$(sign "$VALIDATE_BODY" "$VTS")
AFFILIATE_ID=$(curl -sS -X POST "$BASE_URL/api/internal/codes/validate" \
  -H "Content-Type: application/json" \
  -H "X-Timestamp: $VTS" \
  -H "X-Signature: $VSIG" \
  --data "$VALIDATE_BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).affiliateId||''))")

if [ -z "$AFFILIATE_ID" ]; then
  echo "SKIP: could not resolve affiliateId from code $CODE"
else
  EVENT_BODY='{"event_id":"'"$EVT_ID"'","event_type":"affiliate_attribution_created","occurred_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","mealtrack_user_id":"smoke-user-'"$(date +%s)"'","affiliate_id":"'"$AFFILIATE_ID"'","affiliate_code":"'"$CODE"'"}'
  ETS=$(date +%s)
  ESIG=$(sign "$EVENT_BODY" "$ETS")

  curl -sS -X POST "$BASE_URL/api/internal/mealtrack-events" \
    -H "Content-Type: application/json" \
    -H "X-Timestamp: $ETS" \
    -H "X-Signature: $ESIG" \
    --data "$EVENT_BODY" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        const r=JSON.parse(d);
        console.log(JSON.stringify(r,null,2));
        if(r.status==='accepted'||r.status==='duplicate') console.log('PASS');
        else{console.error('FAIL');process.exit(1);}
      });
    "

  echo ""
  echo "── 3. POST /api/internal/mealtrack-events (duplicate check)"
  DETS=$(date +%s)
  DESIG=$(sign "$EVENT_BODY" "$DETS")
  curl -sS -X POST "$BASE_URL/api/internal/mealtrack-events" \
    -H "Content-Type: application/json" \
    -H "X-Timestamp: $DETS" \
    -H "X-Signature: $DESIG" \
    --data "$EVENT_BODY" | node -e "
      let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
        const r=JSON.parse(d);
        console.log(JSON.stringify(r,null,2));
        if(r.status==='duplicate') console.log('PASS (idempotent)');
        else console.log('NOTE: expected duplicate, got: '+r.status);
      });
    "
fi

echo ""
echo "=== Done ==="
