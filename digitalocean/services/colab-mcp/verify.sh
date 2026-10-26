#!/usr/bin/env bash
# Post-deploy gate: anonymous MCP must be refused; discovery must be served.
# A disconnected Stealth browser is an honest non-executing state, not a failure.
set -euo pipefail
base=http://172.31.255.1:18024
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST "$base/mcp" \
  -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
test "$code" = 401
curl -fsS --max-time 10 "$base/.well-known/oauth-protected-resource/colab/mcp" >/dev/null \
  || curl -fsS --max-time 10 "$base/.well-known/oauth-protected-resource/mcp" >/dev/null
echo "colab-mcp: anonymous 401, OAuth discovery served"
