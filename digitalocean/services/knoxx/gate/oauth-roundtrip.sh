#!/usr/bin/env bash
# OAuth round trip against THIS environment's Axxium (never production's).
set -euo pipefail
: "${KNOXX_GATE_BASE:?}"
meta=$(curl -fsS "$KNOXX_GATE_BASE/.well-known/oauth-authorization-server")
issuer=$(jq -r .issuer <<<"$meta")
[[ $issuer == "$KNOXX_GATE_BASE"* ]] || { echo "issuer $issuer is not this environment"; exit 1; }
# TODO(gate): dynamic client registration -> PKCE authorize (gate test actor on
# <env>.axxium) -> token -> MCP call with the token -> revoke -> call refused.
# Assert the token is rejected by every OTHER environment (I2).
exit 2
