#!/usr/bin/env bash
# End-to-end walk through every endpoint against a running stack.
# Usage: ./scripts/smoke.sh [API base URL]   (default http://localhost:8080)
set -euo pipefail
API="${1:-${API:-http://localhost:8080}}"
STUDENT="$(printf '2%016d' "$(( (RANDOM << 15 | RANDOM) ))")"
FAILS=0

# call METHOD PATH EXPECTED_STATUS [STUDENT_ID] [BODY] -> prints body, checks status
call() {
  local method=$1 path=$2 expected=$3 student=${4:-} body=${5:-}
  local args=(-s -o /tmp/smoke_body.$$ -w '%{http_code}' -X "$method" "$API$path")
  [[ -n $student ]] && args+=(-H "X-Student-Id: $student")
  [[ -n $body ]] && args+=(-H 'Content-Type: application/json' --data "$body")
  local status
  status=$(curl "${args[@]}") || status=000
  local out; out=$(cat /tmp/smoke_body.$$ 2>/dev/null || true)
  if [[ $status == "$expected" ]]; then
    printf '  ok   %-6s %-45s %s\n' "$method" "$path" "$status" >&2
  else
    printf '  FAIL %-6s %-45s got %s want %s  %s\n' "$method" "$path" "$status" "$expected" "$out" >&2
    FAILS=$((FAILS + 1))
  fi
  printf '%s' "$out"
}
field() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }

echo "Smoke test against $API (student $STUDENT)" >&2
CLASS=$(call POST /classes 201 "" '{"name":"Smoke - Class 6 Morning","totalSeats":2}' | field id)
call GET /classes 200 >/dev/null
call GET "/classes/$CLASS" 200 >/dev/null
HOLD=$(call POST "/classes/$CLASS/holds" 201 "$STUDENT" | field holdId)
call POST "/classes/$CLASS/holds" 409 "$STUDENT" >/dev/null                       # one active per class
call GET "/holds/$HOLD" 200 >/dev/null                                             # no header needed
call POST "/holds/$HOLD/confirm" 403 "$(printf '9%016d' 1)" >/dev/null             # someone else's hold
call POST "/holds/$HOLD/confirm" 200 "$STUDENT" >/dev/null
call POST "/holds/$HOLD/confirm" 200 "$STUDENT" >/dev/null                         # idempotent
call DELETE "/holds/$HOLD" 409 "$STUDENT" >/dev/null                               # confirmed can't be cancelled
call POST "/classes/$CLASS/holds" 400 "123" >/dev/null                             # bad header
call POST /classes 400 "" '{"name":"x",' >/dev/null                                # malformed JSON
call POST /classes 400 "" '{"name":"x","totalSeats":0}' >/dev/null
call GET /classes/not-an-id 400 >/dev/null
call GET "/holds/h_$(printf '%032d' 0)" 404 >/dev/null
ME=$(call GET /me/holds 200 "$STUDENT")
[[ $ME == \[* ]] || { echo "  FAIL /me/holds is not an array: $ME" >&2; FAILS=$((FAILS + 1)); }
CONFIRMED=$(call GET "/classes/$CLASS" 200 | sed -n 's/.*"confirmedSeats":\([0-9]*\).*/\1/p')
[[ $CONFIRMED == 1 ]] || { echo "  FAIL confirmedSeats=$CONFIRMED want 1" >&2; FAILS=$((FAILS + 1)); }
rm -f /tmp/smoke_body.$$

if (( FAILS == 0 )); then echo "ALL OK (class $CLASS)"; else echo "$FAILS check(s) failed"; exit 1; fi
