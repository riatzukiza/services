# Caddy hostname capacity and certificate decision

Decision date: 2026-10-15. Owner: existing Knoxx coordination card
`services-caddy-hostname-scale-decision` (two points).

Keep **exact-name automatic HTTPS with Caddy's existing default HTTP-01 and
TLS-ALPN-01 challenges**, DNS-only direct-origin routing, and persistent ACME
state. This changes the recorded decision and inventory; it changes no runtime
setting, route, DNS record, credential, image or deployed service.

## Count the intended names

All names below end in `promethean.rest`. The capacity envelope is **18 names**:
seven authored on current main, eight in unmerged controller source, one planned
name and two reserved aliases. Source presence is distinct from adoption,
working DNS, certificate issuance and deployment.

| Names | Count | Source and status |
| --- | ---: | --- |
| `knoxx`, `proxx`, `open-hax` | 3 | Current main's Caddyfile and env.template: existing production aliases. |
| `knoxx-dev`, `opencode-dev`, `shadow-dev` | 3 | Current main's guarded development routes and env.template. |
| `staging.website` | 1 | Current main's managed Website staging route. |
| `testing.knoxx`, `staging.knoxx`, `stealth.knoxx`, `yoga.knoxx` | 4 | Explicit routes in still-unmerged Services PR83; no main adoption or live proof follows. |
| `testing.axxium`, `staging.axxium`, `stealth.axxium`, `yoga.axxium` | 4 | Explicit routes in that same unmerged controller source. |
| `staging.proxx` | 1 | Planned name for the existing Proxx staging owner. The current controller does not admit Proxx. |
| `production.knoxx`, `production.axxium` | 2 | Capacity reservations from the documented phase convention; neither is a configured production ingress route. |
| **Total: 7 + 8 + 1 + 2** | **18** | **16 authored or specifically planned names, plus two reserved aliases.** |

The current source baseline is Services
[`a3034cc`](https://github.com/open-hax/services/tree/a3034ccddbc43aecf34a70df444ebe0e5314f83c).
The additional eight routes come from PR83's
[`1e7ad3d` Caddyfile](https://github.com/open-hax/services/blob/1e7ad3dda3bb2a8c996425b3de6c802fffb020d1/digitalocean/services/caddy/Caddyfile)
and [nested-hostname inventory](https://github.com/open-hax/services/blob/1e7ad3dda3bb2a8c996425b3de6c802fffb020d1/docs/knoxx-nested-hostnames.md).
The two reservations follow its [documented environment vocabulary](https://github.com/open-hax/services/blob/1e7ad3dda3bb2a8c996425b3de6c802fffb020d1/docs/environments/promotion.md).
The [Proxx staging owner](https://github.com/open-hax/knoxx/blob/3409977bca4ba35e09967f9a99d50867a679a73c/kanban/tasks/services-proxx-staging-migration.md)
remains separate work.

Axxium has no production ingress route or production inventory role in this
baseline; its reservation makes that missing route visible. OpenPlanner's
standalone HTTP dependency is retired and its data plane runs inside Knoxx, so
it adds no independent hostname. Caddy itself and the smoke service add none.
Future service additions must update this inventory before ingress expansion.

## Choice and review ceilings

At this size, exact-name automation keeps the existing standard Caddy image and
avoids introducing Cloudflare API credentials or a DNS-provider module on this
host. Its costs remain one explicit route and DNS preparation per name, and
more fresh certificate issuances than a consolidated wildcard plan.

Wildcard DNS-01 would require DNS challenge authority and its operational
protection. A single `*.promethean.rest` wildcard would not cover nested phase
names such as `staging.knoxx.promethean.rest`; a suitable plan needs additional
wildcard identifiers or certificates. Consolidating keys also expands the
impact of their loss or rotation. Reconsider that option when the inventory or
issuance pattern warrants the added machinery.

The local review ceilings are **20 managed names** and **20 planned fresh or
non-ARI issuances per rolling seven days**. Review the decision before exceeding
either, or when repeat validation failures, state loss, domain-wide issuance
pressure or new hostname depth makes the current approach unsuitable. These
ceilings are operator policy, not CA limits or reserved issuance tokens. Other
Let's Encrypt clients using the same registered domain share its budget; check
recent issuance across accounts and hosts before a bulk change. The difference
between 20 and the published domain limit is planning headroom, not observed
available capacity.

## CA rules and the configured Caddy family

[Let's Encrypt's rules](https://letsencrypt.org/docs/rate-limits/), checked
2026-10-15, distinguish these budgets:

- 50 new certificates per registered domain per seven days, across all accounts;
  capacity refills gradually rather than resetting on a weekly boundary.
- Five certificates for the exact same identifier set per seven days.
- 300 new orders per account per three hours.
- Five authorization failures per identifier/account per hour.

Qualifying ARI renewals are exempt from these limits. Recognized same-set
non-ARI renewals are exempt from the new-order and registered-domain limits but
remain subject to exact-set and authorization-failure limits. Losing account
and certificate state can prevent normal renewal handling. Stop on rate-limit
responses and observe `Retry-After`; repeated reinstallations do not reset
capacity.

The source declares `caddy:2.8-alpine`. Tagged
[v2.8.4 source](https://github.com/caddyserver/caddy/blob/v2.8.4/modules/caddytls/automation.go#L390-L411)
enables both HTTP and TLS-ALPN challenges by default; the existing Caddyfile
disables neither. Caddy's [v2.8.0 release](https://github.com/caddyserver/caddy/releases/tag/v2.8.0)
introduced ARI support, and its CertMagic dependency carries renewal replacement
metadata. That establishes family capability, not the exact running patch or
an observed ARI-exempt renewal. Keep the conditional renewal treatment above.
See also [Caddy's automatic HTTPS documentation](https://caddyserver.com/docs/automatic-https).

## Preserve state during migration

Keep complete `/data` and `/config`, including certificate private keys, ACME
accounts and renewal metadata. Take a protected backup and verify its recovery
before a host/storage move; restore existing state before serving on the
destination. Preserve the current bind paths through ordinary deployments and
rollback. Do not recover by deleting ACME state and reissuing the entire set.

Exercise new issuance against the CA staging endpoint with separate storage
and disposable names. Confirm A/AAAA records and challenge reachability before
using the production CA. Migrate in observed batches, check the shared domain
budget, and stop on validation or rate-limit failures. A service's **staging
environment** and the **CA staging endpoint** are different: public service
staging still needs publicly trusted TLS for browser acceptance.

This decision does not issue certificates, validate live DNS, back up production
state or activate PR83. Those actions belong to the admitted deployment work.
Verification for this change is unchanged parsed Compose data, unchanged
environment assignments, source-backed inventory arithmetic and the existing
repository static checks; no live issuance or reload is needed.

License: GPL-3.0-or-later.
