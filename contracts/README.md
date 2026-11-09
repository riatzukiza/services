# Contracts — owned by open-hax/services

This directory is the **canonical owner of all runtime contracts** for the
Promethean trio. Application repos keep their *code*; the deployed contract
state lives here, version-controlled with the deployment topology, because the
three apps are separate projects whose deploys must know about each other
(shared nginx ingress, shared databases).

## Layout

```
contracts/
  proxx/policies/runtime/   EDN policy contracts for Proxx (manifest-ordered:
                            00-manifest.edn loads siblings; routing, model
                            families, providers, pricing, queues, router).
  knoxx/                    Knoxx EDN contract tree (agents, actors, roles,
                            capabilities, models, pipelines, policies, ...).
  axxium/identity/          Axxium identity seeds (secret-free actor trees).
```

## Wiring

- **Proxx** reads `PROXX_CLJS_POLICY_MANIFEST` →
  `contracts/proxx/policies/runtime/00-manifest.edn` (compose mounts the
  directory read-only at `/etc/proxx/policies`).
- **Knoxx** reads `CONTRACTS_DIR` → `contracts/knoxx`
  (an explicit `CONTRACTS_DIR` replaces the source-tree default).
- **Axxium** reads `AXXIUM_IDENTITY_SEED_FILE` →
  `contracts/axxium/identity/foresight-tree.edn` (Err's tree: grokbots,
  per-repo bots, and the yoga/stealth host agents). Axxium applies it
  idempotently at startup through its policy-checked provision op: missing
  actors are created, existing ones are never changed or deleted. The file
  holds actors and policies only; credentials are provisioned at runtime in
  the Axxium portal. Seed application also requires a usable
  `AXXIUM_GITHUB_IDENTITY_KEY_FILE` and a nonempty
  `AXXIUM_GITHUB_IDENTITY_LEDGER_FILE`; without both, Axxium skips the seed.
  **Direct portal link:** the portal identifies a signed-in human as
  `:auth/actor-id` (`actor_<uuid>`, minted at first Google signup on
  riatzukiza/axxium#21). Set both host-local values together so that
  session acts as the seed root (see
  `contracts/axxium/identity/root-operator.env.example`):
  `AXXIUM_IDENTITY_ROOT_OPERATOR_ACTOR_ID=actor_<uuid>` and
  `AXXIUM_IDENTITY_ROOT_DID=did:web:<host>:actors:err`. The seed keeps the
  stable path id `err`; the binding is the direct link, not a second alias
  account. Not wired into deployment yet: `digitalocean/services/axxium` is
  applied by a qualified fixed transaction (`scripts/axxium_minimal_release.py`
  + `minimal-production-plan.json`) that preserves a host-owned compose/.env
  by digest, and open-hax/services#92 is still reshaping that service.
  Wiring needs a read-only bind of `contracts/axxium/identity` plus the
  seed path, admitted as a new overlay, and an Axxium image that contains
  the loader. Format: open-hax/axxium
  `docs/github-identity-resource.md#seed-files` (riatzukiza/axxium#21).
- **OpenPlanner** owns no contracts; it consumes Proxx and Knoxx.

## Policy notes

- No schedules are deployed for now. Knoxx deploys two deliberate event
  triggers in `contracts/knoxx/namespaces/publication.edn`: one starts the
  contract-owned translation agent after publication admission derives and
  claims translation work; the other crafts a review-bound post draft from an
  admitted anchor revision.
- EDN changes take effect on service restart; no app rebuild required.
- Deploy scripts must not rewrite contracts at deploy time (see receipts.edn,
  2026-06-02): contract changes land here via PR, deploys only ship them.
- Admission-generated draft resources are runtime state. Knoxx writes them to
  `KNOXX_GENERATED_CONTRACTS_DIR` on its durable workspace, never into this
  read-only deployed contract tree.
- Shared Proxx provider/model routing facts belong in the Proxx EDN policies
  here. A Knoxx agent-specific deployment override may select a directly
  configured local provider, but it must name a deployed Knoxx model resource
  and the service gate must fail when that provider or model is unavailable.
