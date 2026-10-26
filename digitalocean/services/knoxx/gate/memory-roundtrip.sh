#!/usr/bin/env bash
# Memory write/read round trip. Regression for the project mismatch found in
# knoxx-mcp-conformance.md (push_claim writes "workspace", memory_search reads
# "knoxx-session") and for graph_query failing without OpenPlanner REST.
set -euo pipefail
: "${KNOXX_GATE_BASE:?}"
marker="gate-$(date +%s)-$RANDOM"
# TODO(gate): push_claim {text: $marker} -> memory_search {query: $marker} must
# return it; graph_query must not return "OpenPlanner is not configured";
# then delete the claim. Must run in staging with OPENPLANNER_* set.
echo "marker=$marker (not yet written)"; exit 2
