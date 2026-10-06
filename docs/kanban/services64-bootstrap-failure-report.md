---
uuid: 3a316531-9460-471f-b5b7-5675e1699507
title: Retain a bounded bootstrap-failure report before host verification
status: incoming
priority: P1
points: 3
labels: services, planning, host-failure-evidence
---

## Context

Refs [open-hax/services#64](https://github.com/open-hax/services/issues/64).
This three-point story is one proposed slice of that still-open issue, not its
complete estimate or resolution. The [full issue context](../notes/services64-bootstrap-failure-report-plan.md)
retains all diagnosis, retry, test, and two-consecutive-live-proof requirements.
The historical one-run recovery in [writer reconciliation 5464216088](https://github.com/open-hax/services/issues/64#issuecomment-5464216088)
does not supply those remaining proofs. No existing issue64 card was found in
accepted source or the personal synchronization branch; foreign task ownership
remains unknown because task inventory was unavailable.

## Outcome

Propose a schema-checked, allowlisted failure artifact when bootstrap fails before
independent verification can start. Preserve the primary command's original
failure even when report creation or artifact upload also fails. Report absence,
malformation, or upload failure must remain visible; evidence retention cannot
turn an unsuccessful bootstrap into success or admit a deployment.

## Scope

- Portable Clojure-shaped report schema and pure classification laws in `.cljc`
  where practical; explicit JSON conversion only in the existing host/Actions
  effect adapter. Proposed future paths are listed in the linked plan.
- Allowlisted operation, phase, original command exit, source revision, run ID and
  attempt, report-production outcome, and independent-verification state
  (`not-run`, `failed`, `passed`, or `unknown`). Unknown/unavailable facts remain
  explicit; they never become fabricated successful verification.
- A runner-local fallback for failures that prevent a remote report from being
  created or fetched. Upload always attempts an available valid failure artifact;
  a separate diagnostic reports failures in creation/validation/upload without
  replacing the first failing command's exit or concealing job failure.
- Deterministic offline fixtures with fictional identities, times, and secret
  sentinels, using no SSH, systemd, Docker, host/network, credential, or service
  calls. Preserve existing bootstrap cleanup and strict Docker readiness.

## Non-goals

No operational root-cause claim, new manager retry, bounded host diagnostics,
production run, two-live-run proof, host address capture, raw journals/environment,
secret provisioning, deployment/controller activation, workflow protection,
reviewer invitation, or source implementation in this planning PR. Existing
source workflow, scripts, trust configuration, and all established card/event
bytes remain unchanged. No alternate Rheos parser or board-state operation.

## Acceptance criteria

1. Reject malformed identity/phase/exit inputs and contradictory outcome tuples;
   preserve exact primary command exit and distinguish provenance from unrun
   independent verification. Declared allowlist omits fictional secret sentinels,
   arbitrary environment keys, host addresses, raw logs and credential material.
2. Model failed bootstrap, persistent manager timeout, unavailable transport,
   missing/truncated remote report, failure while writing/validating/uploading a
   report, and successful verification. A report-handling failure never replaces
   or clears the primary failure; a successful artifact never implies readiness.
3. Runner-local failure evidence survives a failure before verify starts, with
   verification explicitly `not-run`. Missing or invalid evidence remains failed
   or unavailable; both remote verification and its success may be claimed only
   from their own actually observed outcomes.
4. Upload is attempted for a valid local report even after prior failure. The
   original failed job remains failed; creation and upload failures are separate
   recorded facts. Preserve EXIT cleanup, pinned SSH trust, production-host lock,
   reusable-only bootstrap, direct-dispatch verify-only behavior, and secret-free
   PR validation.
5. Offline laws/tests and fixture adapter prove these cases in red and green only
   after exact-head planning qualification and lawful Rheos readiness. They prove
   local behavior, never historical host diagnosis, recovery or live admission.
6. Keep issue64 open. All remaining issue criteria stay visible in the context
   note, including bounded secret-free diagnostics, root cause, classified-only
   retry/exhaustion, and two consecutive real bootstrap/verify/upload proofs with
   persistent injected failure red. No `Closes #64` declaration.

## Verification

The local planning candidate receives native Rheos readback, owning Receipt River
schema/kind validation, source/prefix/hash preservation and complete base-to-head
whitespace checks. These are planning preparation, not board readiness or native
review qualification. No implementation command or host test runs in this PR.

After qualified planning and Rheos readiness, proposed pure commands are
`nbb -cp digitalocean/src:digitalocean/test digitalocean/test/bootstrap_failure_report_test.cljs`
and `bb --classpath digitalocean/src:digitalocean/test digitalocean/test/bootstrap_failure_report_test.clj`.
The proposed isolated adapter fixture command is
`python3 digitalocean/scripts/test-bootstrap-failure-report.py`. These files do
not yet exist; tooling availability and fixtures must be reviewed before
implementation. Existing offline Docker readiness regression remains required
when the future adapter changes bootstrap code. Credentialed host workflows and
live proofs require separate authorized operational work.

## Risks and proposed follow-up

Report failure can mask the first failure unless primary exit is captured before
cleanup/upload. Capturing logs wholesale can leak secrets. Reconciliation proved
one ready-host run and must not become a substitute for requested repeatability.
Three points estimates this report slice only; remaining work needs independent
estimates and qualified owner stories. No GitHub issue number is a task UUID and
no foreign planning issue/UUID is invented as a hard dependency. The personal
sync PR1 is this branch's immutable Git base, not a fabricated board dependency.
