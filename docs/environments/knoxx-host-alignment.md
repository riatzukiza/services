# Knoxx host alignment: repo as source of truth

Status: proposal. Nothing here has been applied to the knoxx droplet. All host
observations below were taken read-only on 2026-10-26 (`sudo -n cat`,
`docker inspect` with env **keys only**, `ss -ltn`). No secret values were read
into or written to this repository.

Companion to `docs/proposals/knoxx-integration-staging-on-host.md` (services#8).

## Invariants

Let `Env = {prod, staging, testing}` and `Actor` the set of Axxium actors.
`creds(e)` is every secret material `e` can present (DB passwords, JWT/session
secrets, Axxium identity keys, OpenPlanner and Proxx keys, MCP tokens).

1. **Environments are actors.** `∀e ∈ Env: e ∈ Actor`, with its own origin
   `https://e.axxium.promethean.rest` and its own identity keypair `k_e`, and
   `e ≠ e' ⇒ k_e ≠ k_e'`.
2. **Promotion carries only a digest and a receipt.**
   `promote(e → e') : (d, r) ↦ deploy_e'(d)` where `d = sha256(image)` and
   `r = receipt_e(d)` attests `gate_e(d) = pass`. Nothing else crosses: no env
   file, no state, no credential. `promote` is defined only when
   `verify(r, k_e) ∧ r.digest = d`.
3. **No cross-environment credentials.** `∀e ≠ e': creds(e) ∩ creds(e') = ∅`,
   and a credential of `e` presented to `e'` is rejected
   (`accept_e'(c) ⇒ c ∈ creds(e')`).
4. **Loopback only.** `∀ published port p of a slot: bind(p) = 127.0.0.1`;
   Caddy reaches slots via relays on `172.31.255.1` that admit `172.31.255.2/32` only.
5. **Bounded.** `∀ container c in a slot: mem(c), cpu(c), pids(c) < ∞`.

## (a) Caddy: live vs repo

Live: `/srv/open-hax/services/caddy/Caddyfile` plus `/srv/open-hax/state/caddy/managed/*.caddy`.

| Item | Live | Repo before | This PR |
|---|---|---|---|
| global `on_demand_tls { ask http://axxium-pds:3000/tls-check }` | yes | no | **folded** |
| knoxx site: `@colab_oauth_discovery` + `handle_path /colab/*` → `172.31.255.1:18024` | yes | no | **folded** |
| `axxium.promethean.rest, *.axxium.promethean.rest` site (DID doc, API → `axxium:8787`, rest → `axxium-pds:3000`) | yes | no | **folded** |
| caddy mount for `axxium-did.json` | `./axxium-did.json` (deploy dir) | no | folded as `${CADDY_STATE_PATH}/axxium-identity/did.json` (durable state) |
| testing/staging axxium+knoxx, stealth/yoga axxium+knoxx site blocks | in **managed** `live-host-routes.caddy` | **inline** in Caddyfile | unchanged; see hazard |
| `orbit.promethean.rest` → `172.31.255.1:19084` | managed `orbit-desktop.caddy` | no | **not folded** (decision) |
| `staging.website.promethean.rest` | managed | `caddy/managed/website-staging.caddy` | same |

Minor drift inside `live-host-routes.caddy`: stealth/yoga axxium lack
`import common`; stealth/yoga knoxx lack `tls { issuer acme }` and the 503
`handle_errors`. The repo versions are stricter and are kept.

**Hazard (blocking for any caddy deploy, today and after this PR):** the repo
Caddyfile defines the eight environment site blocks inline *and* imports
`/etc/caddy/managed/*.caddy`, which on the host still contains
`live-host-routes.caddy` with the same hostnames. Caddy rejects this
(`ambiguous site definition: testing.knoxx.promethean.rest`, reproduced with
caddy 2.8.4 `adapt`). Applying requires removing `live-host-routes.caddy` from
managed state in the same change window (keep the bytes as rollback).

The patched Caddyfile adapts cleanly with caddy 2.8.4.

Relays: only `19077–19081` (stealth/yoga) listen on `172.31.255.1` today;
`19071/19072/19082/19083` are not installed, so testing/staging routes
currently answer 503.

## (b) Service definitions

`digitalocean/services/axxium/{compose.yaml,env.template,verify.sh}` are the
live host files verbatim (they already used placeholders only); `service.yaml`
is new. `digitalocean/services/colab-mcp/` mirrors the live project with two
deliberate deviations: image injected (`COLAB_MCP_IMAGE`) instead of
`build: ./app`, and added caps `mem_limit 256m, cpus 0.5, pids_limit 128`
(live has none). Live runtime matches the compose (host network, read-only,
cap_drop ALL, no-new-privileges, binds `172.31.255.1:18024`).

Live images: `axxium-federation:local` (host-built) and
`knoxx-colab-mcp:candidate` (host-built). The lane requires CI-built,
digest-pinned GHCR images; until those exist these definitions cannot be
deployed by `deploy-digitalocean.yml`.

## (c) Slots: knoxx-testing, knoxx-staging

`scripts/apply-knoxx-environment-slots.sh` (dry-run by default, not run) wraps
the existing reviewed tooling:

| Requirement | Mechanism |
|---|---|
| own Axxium identity per env (I1) | `prepare-service-environments.mjs` generates an ed25519 keypair and origin per slot |
| separate DB namespace (I3: no shared creds or data) | each knoxx slot has its own `database` (mongo:7) container and volume; each axxium slot its own postgres |
| OpenPlanner REST | new `OPENPLANNER_BASE_URL` / `OPENPLANNER_API_KEY` placeholders in `environments/knoxx.compose.yaml`; required in staging by the gate |
| own Proxx identity/budget | new `PROXX_*` placeholders, per-env token |
| caps (I5) | existing `mem_limit`/`cpus`/`pids_limit` in the templates |
| 127.0.0.1 ports (I4) | `127.0.0.1:18881/18882` (knoxx), `18871/18872` (axxium) |
| ingress | `install-environment-ingress.py` relays |
| promotion (I2) | slots are started only by `deploy-service-environment.yml` with a digest |

## (d) Integration gate

`digitalocean/services/knoxx/gate/run.sh` runs `mcp-e2e.sh`,
`oauth-roundtrip.sh`, `memory-roundtrip.sh`. Unimplemented halves exit 2 so
the gate cannot pass vacuously.

- [ ] MCP: anonymous 401; resource metadata names this env; authenticated initialize → tools/list → read-only call
- [ ] OAuth: issuer is this env; DCR → PKCE → token → call → revoke → refused; token refused by every other env (I3)
- [ ] Memory: `push_claim` → `memory_search` finds it (regression: project mismatch); `graph_query` works (regression: OpenPlanner REST)
- [ ] receipt `(digest, gate result)` emitted and signed by the env's identity (I2)

## Decisions needed before apply

1. Remove `live-host-routes.caddy` from managed state when the repo Caddyfile is deployed (hazard above).
2. Install the four testing/staging relays (makes the four hostnames reachable; DNS must exist).
3. Publish GHCR images for axxium and colab-mcp (or accept host builds as an exception).
4. Source of `axxium-identity/did.json` in caddy state (copy the live public file).
5. Fold `orbit.promethean.rest` (dev desktop) into the repo or leave it host-managed.
6. Issue per-env OpenPlanner and Proxx keys for staging (via secret request).
7. Colab caps (256m/0.5 CPU) acceptable.
