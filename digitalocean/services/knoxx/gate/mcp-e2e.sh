#!/usr/bin/env bash
# MCP end to end. Credentials: KNOXX_GATE_TOKEN for THIS environment only.
set -euo pipefail
: "${KNOXX_GATE_BASE:?}"
# 1. anonymous initialize is refused
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$KNOXX_GATE_BASE/mcp" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"gate","version":"0"}}}')
[[ $code == 401 ]] || { echo "anonymous initialize returned $code"; exit 1; }
# 2. protected-resource metadata names this environment's origin
curl -fsS "$KNOXX_GATE_BASE/.well-known/oauth-protected-resource/mcp" | jq -e --arg b "$KNOXX_GATE_BASE" '.resource|startswith($b)' >/dev/null
# TODO(gate): with KNOXX_GATE_TOKEN: initialize -> tools/list (expect inputSchema
# bounds/enums per knoxx-mcp-conformance.md) -> call a read-only tool.
# Reuse digitalocean/services/knoxx/probe-mcp.js.
[[ -n "${KNOXX_GATE_TOKEN:-}" ]] || { echo "authenticated half not implemented/configured"; exit 2; }
exit 2
