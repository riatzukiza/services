# Proposal: Knoxx integration + staging on the Knoxx host, promote the tested image

> Status: **proposal.** Scope is Knoxx (backend + frontend) and its Axxium identity
> dependency on the single DigitalOcean host (`open-hax-services-production`,
> 157.245.125.134, hostname `knoxx`). It extends, and doesn't replace,
> [`docs/deployment-model.md`](../deployment-model.md) §3 and
> [`docs/environments/promotion.md`](../environments/promotion.md).

## Problem

Agents prototype against **production Knoxx**: it's the only live Knoxx with
real OAuth, MCP and data. `dev-instances.md` §6 already says "do not deploy to
production to find out whether something works", but the dev instance it points
to (`knoxx-dev`, host :8000) isn't a deployment. It's a hand-started process
from a mutable checkout, so it can't stand in for one (see "knoxx-dev" below).
Production is the only place an image is integration-tested today.

## Proposal

```text
dev          agent boxes, stealth (192.168.12.128), yoga (192.168.12.68); never the knoxx host
testing      knoxx host, compose project knoxx-testing, PR head, exclusive 2h lease (promotion.md)
staging      knoxx host, compose project knoxx-staging, exact merge SHA on services main
production   knoxx host, compose project knoxx, the SAME image digests staging passed
```

1. **Dev runs off the host.** Stealth and Yoga are already named environments
   (`stealth.knoxx` / `yoga.knoxx` routes in the Caddyfile, promotion.md). They
   replace the role `knoxx-dev` plays now. Development needs no Services
   deployment (deployment-model §3: "dev — developer machine; this repo owns
   nothing").
2. **Integration and staging are separate compose projects on the same host.**
   Each one gets:
   - the **same compose definition and image tags as prod**, phase-parameterised,
     not a forked template (slot-pattern card: "one service definition, a phase
     parameter");
   - isolated state, DB and volumes under `/srv/open-hax/environments/<env>/knoxx`;
   - its own Mongo **database** (never prod collections); see the open decisions
     for Proxx/inference;
   - ports on `127.0.0.1` only, reached through the existing
     `systemd-socket-proxyd` relays (`install-environment-ingress.py`, 19082/19083);
   - container names, service keys and aliases that carry the phase (the
     `website-staging` lesson: service keys become aliases on the shared
     `open-hax` network);
   - a Caddy subdomain, `testing.knoxx` / `staging.knoxx.promethean.rest`, with
     the **same OAuth/MCP allowlist and auth gates as prod**, and no
     localhost/admin bypass;
   - the CPU, memory and pids caps from promotion.md, which protect prod from the
     2026-08-27 starvation failure (dev-instances §7).
3. **The integration phase is a gate, not a smoke test.** In the testing slot,
   run Knoxx's MCP e2e suite plus `verify.sh` unchanged (it's phase-agnostic or
   it's a bug). Run anonymous and authorized probes per deployment-model §5,
   including an MCP OAuth round-trip and a memory write→read round-trip. That
   round-trip fails in prod today; see the conformance report.
4. **Promote bytes, not branches.** Production takes the *image digests* recorded
   in the staging `deployment.json` receipt for the exact source SHA. This closes
   the gap deployment-model rule 3 admits ("proves the source SHA was staged, not
   the image"). Production never rebuilds.
5. **The repo flow is unchanged:** develop on `riatzukiza/services`, then open an
   org PR from `promote/<sha>`, then the org merge, then staging, then promotion
   (foresight `docs/notes/promethean-review-and-promotion.md`).

## knoxx-dev (host :8000)

Observed 2026-10-26: `node …/nbb/cli.js scripts/start-server-dev.cljs`,
uid `err`, cwd `/home/err/spaces/knoxx/backend`. The checkout is at `b8ac36f1`,
not prod's `841642a`. It's bound to `0.0.0.0:8000` and reached only through
Caddy's `dev_guard` basic auth + ufw (`dev-instances.md`). Its OAuth metadata
advertises `knoxx-dev.promethean.rest`.

Recommendation: **retire it from the host once `knoxx-testing` serves.** Move live
dev to stealth/yoga, then remove the `knoxx-dev` vhost, ufw rule and DNS together,
following `dev-instances.md` §4 in reverse. It shares prod's 4 vCPUs uncapped,
runs unreviewed code with host-level reach, and is what agents actually test
against. The OpenCode web UI and shadow-cljs dev instances get the same decision.

## What already exists vs. what's missing (host read-only, 2026-10-26)

| Item | In repo (`open-hax/services` main) | On host |
| --- | --- | --- |
| testing/staging controller (`deploy-service-environment.yml`, `receive-service-environment.py`) | merged (#83) | `/srv/open-hax/environments/{testing,staging}/{knoxx,axxium}` exist, **empty** |
| `testing.knoxx` / `staging.knoxx` / `stealth` / `yoga` Caddy blocks | present | **absent**; the running Caddyfile is a hand-edited lineage (`Caddyfile.before-axxium-*`, `before-nested-*`) |
| website-staging | `compose.staging.yaml`, managed snippet | running (`website-staging`, 127.0.0.1:8082) |
| knoxx staging | `digitalocean/environments/knoxx.compose.yaml` | not running |
| axxium, colab-mcp | not in `digitalocean/services/` | running from local images (`axxium-federation:local`, `knoxx-colab-mcp:candidate`) |

The first work item is therefore reconciling the host with the repo, not
designing anything new.

## Duplicates and contradictions found

- **Two staging layouts.** website-staging uses `/srv/open-hax/services/staging/…`
  + `/srv/open-hax/state/staging/…` (`hosts/staging.yaml`). The Knoxx controller
  uses `/srv/open-hax/environments/<env>/<svc>`. Pick one. Proposal: environments/,
  with website migrated later.
- **A separate template vs. the same compose.**
  `digitalocean/environments/knoxx.compose.yaml` is a second Knoxx definition. It
  contradicts the slot-pattern card ("by parameter, not by a duplicate
  directory") and this request ("same compose as prod"). Converge on one compose
  plus a phase overlay.
- **Promotion branch name.** Foresight says `promote/<full-40-hex-sha>`. Current
  practice and instructions say `promote/<sha7>`. Short SHAs can collide; the
  receipt must bind the full SHA either way.
- **Who starts staging.** promethean-review-and-promotion says a qualified *fork*
  merge requests staging. promotion.md says a merge to (org) main does.
- **Repo-level staging workflows are stale.** Proxx's (and Knoxx's
  `deploy-staging.yml` / `deploy-testing.yml`) target the removed SSH/rsync lane.
  Knoxx `environment-promotion.yml` was pinned to an unmerged services SHA
  (`f9bfe172`); it now needs repinning to post-#83 main (four references).
  Deployment belongs to Services only.
- **Superseded text still reads as current:** `ROADMAP.md` ("staging remains
  proposals"), and Drive cards `services-staging-slot-pattern` and
  `services-knoxx-staging-migration` (marked superseded-in-part 2026-09-16, #83
  since merged).
- **The `pr-134` staging-ancestry gate** (Drive, three copies, rejected) belongs to
  the retired branch-based model. Don't revive it; this proposal gates on receipts,
  not branch ancestry.

## Open decisions for Err

1. Staging's Proxx: a staging Proxx, or prod Proxx with a separate key/budget?
   Prod Proxx means staging traffic hits prod inference.
2. Data: a separate Mongo DB per phase in the same Atlas cluster, or ephemeral and
   seeded? And is OpenPlanner REST configured in staging? (`graph_query` fails in
   prod for lack of it.)
3. Retire `knoxx-dev` now, or keep it until testing serves?
4. Whether the 4×250 mutation gate in promotion.md applies to Knoxx promotion now,
   or later.
5. The canonical layout (`environments/` vs `services/staging/`) and the
   `promote/` SHA length.
6. Whether axxium and colab-mcp get service descriptors before they're staged.

## Sources

- services: `docs/deployment-model.md` (§1-§6), `docs/dev-instances.md`,
  `docs/environments/promotion.md`, `docs/website-staging-deployment.md`,
  `digitalocean/hosts/{production,staging}.yaml`,
  `digitalocean/services/caddy/Caddyfile`,
  `scripts/install-environment-ingress.py`, `ROADMAP.md`, PRs #44 (closed), #83 (merged).
- foresight: `docs/notes/promethean-review-and-promotion.md`,
  `docs/notes/workstream-knoxx-mcp-auth-dev-deployment.md`, `AGENTS.md`.
- Drive: `services-staging-slot-pattern.md`, `services-knoxx-staging-migration.md`,
  `services-proxx-staging-migration.md` (listed, not lifted),
  `pr-134-staging-promotion-gate-blocker.md`.
- Host (read-only, 2026-10-26): `docker compose ls`, `docker ps`, `/srv/open-hax/*`,
  the running Caddyfile, the pid-2591 process. `/work/Caddyfile` is an empty
  directory, not the config.
