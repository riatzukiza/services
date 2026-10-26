#!/usr/bin/env bash
# Knoxx integration gate. Every check must pass before a digest is promoted
# out of an environment (doc §Integration gate). Stubs exit 2 ("not
# implemented") so an unfinished gate can never read as green.
set -uo pipefail
: "${KNOXX_GATE_BASE:?e.g. https://staging.knoxx.promethean.rest}"
dir=$(cd "$(dirname "$0")" && pwd); rc=0
for t in mcp-e2e oauth-roundtrip memory-roundtrip; do
  if "$dir/$t.sh"; then echo "PASS $t"; else s=$?; echo "FAIL($s) $t"; rc=1; fi
done
exit $rc
