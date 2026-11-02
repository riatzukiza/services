# Axxium mailbox integration: configuration boundary

## User story
As the operator qualifying Axxium's mailbox candidate, I need an explicit environment, issuer and distinct signing-key mount so that an isolated staging image does not silently use a production audience or the identity-transfer JWK as its signing PEM.

This is a non-activating integration carrier. It adds an opt-in configuration diagnostic and fixture tests, not a new deployment gate or an authorized rollout. Existing production adoption, source admission, review and deployment rules remain unchanged. No workflow, Compose template, host, DNS, account, credential or running service is modified.

## Bound source revisions

| Component | Source inspected | Meaning |
| --- | --- | --- |
| Services | `3fdf9f3922271ea36e52247c3844b07f4eeb463e` | Fixed integration base, not a claim about the latest main |
| Axxium mailbox | riatzukiza/axxium#18 `eaf47420664513f55a53f2ed51216278b049808b` | Includes instance/signing changes from #13/#14 |
| Axxium regression carrier | riatzukiza/axxium#20 `97e9fefa4e222852eb118a2ffb2712930183c7be` | Tests-only; native execution not yet established here |
| Clio store | riatzukiza/clio#7 head `35ddb9ce816de521380b5c2c477dbe17571cb7d5`; personal merge `ae4d51984793fd78ad09f362e206dc288494c9c6` | Single-event append; transfers are not batch transactions |
| OpenPlanner | riatzukiza/openplanner#4 `f56303e4d513306f92420ea095ee1bf7efb2263e` | Side-by-side nbb parity, not archive/restore implementation |

Coordination anchor: open-hax/axxium#47. The owning Axxium sequence is personal #13 -> #14 -> #15 -> #16 -> #17 -> #18; #19 is the sibling Drive resource work. Katamorph owns shared portable shapes; this diagnostic does not redefine them. OpenPlanner archive/restore is a later phase with no implementation PR identified in Grokbot's handoff. Services#11's explicit-source controller work is separate and is not copied here.

## Observed mismatch and candidate configuration

The inspected base `digitalocean/environments/axxium.compose.yaml` supplies `NODE_ENV=production`, `JWT_SECRET`, `JWT_ISSUER` and `AXXIUM_IDENTITY_KEY_FILE=/run/axxium/identity-private.json`. `prepare-service-environments.mjs` creates that transfer identity key as a JWK. It does not provision the new signer.

The candidate Axxium config requires `AXXIUM_SIGNING_KEY_FILE` as an Ed25519 PKCS#8 PEM and derives audience from service+environment. Candidate isolated configuration must explicitly select:

- `AXXIUM_SERVICE=promethean` and `AXXIUM_ENV=testing` or `staging`.
- `AXXIUM_ISS` and `AXXIUM_PUBLIC_BASE_URL` equal to the independently selected HTTPS origin.
- `AXXIUM_SIGNING_KEY_FILE` pointing at its own read-only bind, with `bind.create_host_path: false` so a missing PEM is not replaced by a directory.
- A distinct host source from the existing transfer identity key. Do not repurpose or rotate that JWK.
- `JWT_AUDIENCE` absent/blank or equal to `promethean+<environment>`.

`NODE_ENV=production` may remain the Node runtime setting; it must not implicitly choose the token audience. New Axxium ignores JWT_SECRET; existing operator secrets and rollback configuration must not be deleted by this diagnostic. The eventual reviewed template migration can omit the unused value from the candidate container without rewriting the original operator file.

## Diagnostic contract

`scripts/check-axxium-signing-config.mjs` consumes bounded rendered Compose JSON on stdin and emits only `{ok, scope: "configuration-only", errors}`. Errors are fixed codes, never source values or parser messages. It neither invokes Docker nor opens key/environment files. It refuses production because this particular diagnostic is scoped to the proposed isolated candidate, not because it establishes a general platform policy.

Run fixture checks with Node 22:

```sh
node --test test/axxium-signing-config.test.mjs
```

On a separately authorized operator machine, pass the existing Compose renderer's output directly to the diagnostic; do not log or upload rendered configuration, which can contain secrets:

```sh
set -o pipefail
docker compose --env-file "$PRIVATE_ENV" -f "$REVIEWED_COMPOSE" config --format json \
  | node scripts/check-axxium-signing-config.mjs staging https://staging.axxium.promethean.rest
```

This command is inspection, not `up`, and was not executed against a host here. The producer's own diagnostics remain the operator's responsibility. A successful result does not prove key format, permissions, filesystem identity/symlink separation, per-instance key uniqueness, image identity, TLS, JWKS contents, auth behavior or deployment admission. Those require separate runtime checks.

## Acceptance evidence and remaining sequence

The test-first permissive scaffold produced 24 failures out of 27 cases. A subsequent boundary check produced three failures (non-string audience and NUL paths); those were repaired. The final local Node 22.16.0 run passed **31 tests, zero failures, errors or skips**. These are synthetic configuration and CLI fixtures, including a projection of the legacy configuration; they are not a Docker Compose render or live-service test. Full Services CI and deployed compatibility remain unverified.

Before an end-to-end mailbox claim: repair #18's commit/outbox/cursor/serialization issues; qualify its native tests and HTTP/auth adapter; qualify signing configuration and public-only JWKS in isolated staging; then verify one authenticated cross-client message, restart recovery and an actual subscribed recipient. Planning a notification is not delivery, and acceptance is not completion. Do not expose real credentials to the pilot or advance OpenPlanner projections before a source operation commits.
