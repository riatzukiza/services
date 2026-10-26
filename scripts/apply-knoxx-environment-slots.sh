#!/usr/bin/env bash
# Host-apply plan for the knoxx-testing and knoxx-staging slots on the knoxx
# droplet. NOT RUN by CI or by this PR. Default is --dry-run: it prints every
# step and touches nothing. --apply requires an operator with explicit approval
# (see docs/environments/knoxx-host-alignment.md §Decisions) and never prints
# secret values: generated credentials go straight to 0600 files.
#
# Invariants enforced here (doc §Invariants):
#   I1  each environment e is its own actor: own Axxium origin + identity keypair
#   I2  creds(e) ∩ creds(e') = ∅: per-slot generated secrets, per-slot Mongo
#       container + DB namespace, per-slot OpenPlanner/Proxx keys, no prod reuse
#   I3  every published port binds 127.0.0.1 (Caddy reaches slots only via the
#       172.31.255.1 relays that admit 172.31.255.2/32)
#   I4  every container has mem/cpu/pids caps (from environments/*.compose.yaml)
set -euo pipefail

MODE=dry-run
[[ "${1:-}" == "--apply" ]] && MODE=apply
ROOT=/srv/open-hax/environments
TEMPLATES=${TEMPLATES:-$(cd "$(dirname "$0")/.." && pwd)/digitalocean/environments}
ENVS=(testing staging)

run(){ printf "+ %s\n" "$*"; if [[ $MODE == apply ]]; then "$@"; fi; }
note(){ printf '# %s\n' "$*"; }

note "mode=$MODE root=$ROOT templates=$TEMPLATES"

note "0. preflight (read-only)"
run test -d "$ROOT/testing/knoxx"
run test -d "$ROOT/staging/knoxx"
run sh -c "ss -ltn | grep -E ':(1888[12]|1887[12]|1907[12]|1908[23]) ' && exit 1 || true"
run docker compose version

note "1. render slots (per-env Axxium identity keypair, DB/JWT secrets, origins, loopback ports)"
note "   prepare-service-environments.mjs writes only 0600 files and validates existing .env without printing it"
run sudo -u deploy node "$(dirname "$0")/prepare-service-environments.mjs" "$ROOT" "$TEMPLATES"

note "2. per-environment external integration placeholders (values via secret request only)"
for e in "${ENVS[@]}"; do
  f="$ROOT/$e/knoxx/.env"
  for k in OPENPLANNER_BASE_URL OPENPLANNER_API_KEY PROXX_BASE_URL PROXX_AUTH_TOKEN PROXX_DEFAULT_MODEL; do
    run sudo -u deploy sh -c "grep -q '^$k=' '$f' || printf '%s=\n' '$k' >> '$f'"
  done
  run sudo -u deploy chmod 0600 "$f"
done
note "   staging: OPENPLANNER_BASE_URL/API_KEY MUST be filled (gate memory-roundtrip fails otherwise)"
note "   each key is issued for that environment alone; never copy production's"

note "3. Caddy relays (172.31.255.1:{19071,19072,19082,19083} -> 127.0.0.1:{18871,18872,18881,18882})"
run sudo python3 "$(dirname "$0")/install-environment-ingress.py"

note "4. bring up slots from a promoted digest only (deploy-service-environment.yml), not by hand"
for e in "${ENVS[@]}"; do
  note "   gh workflow run deploy-service-environment.yml -f environment=$e -f service=axxium  (then knoxx)"
done

note "5. integration gate (digitalocean/services/knoxx/gate/run.sh) per environment"
for e in "${ENVS[@]}"; do
  run env KNOXX_GATE_BASE="https://$e.knoxx.promethean.rest" "$(dirname "$0")/../digitalocean/services/knoxx/gate/run.sh"
done

note "rollback: docker compose -p <env>-<svc> down (state kept); systemctl disable --now promethean-<env>-<svc>.socket"
