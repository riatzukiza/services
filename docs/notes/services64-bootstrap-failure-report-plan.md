# Services64: first failure-evidence slice, with full issue scope retained

Status: proposed planning only. Refs [Services64](https://github.com/open-hax/services/issues/64);
keep it open. This note is context, not an admitted umbrella card or a whole-issue
three-point estimate. Story UUID `3a316531-9460-471f-b5b7-5675e1699507` estimates only
runner-local bootstrap-failure evidence. No implementation or operational state
transition is included.

## Exact accepted source and historical reconciliation

Accepted upstream main is `054cad89b9b817ad07e1021b8429d12912ee492f`.
Personal fork main is `214882daad9ec324e66d552203b22e5a0838f79d`; mapped fork parent
is `open-hax/services`. Preparation stacks on immutable personal
[synchronization PR1](https://github.com/riatzukiza/services/pull/1) head
`f070fb7eaf6a59a51f94928ac1537748bcc44259`, which preserves accepted upstream as an
ancestor. It changes no source of the existing sync or foreign feature PRs.

The original issue records failed run `33266381358`, job `99137076322`, at merge
`47a3dc5e764f38da058418bc6a4f1dd1d9aaf8b5`; manager reload/enable timed out,
verification was skipped and no report existed for upload.
[Writer reconciliation 5464216088](https://github.com/open-hax/services/issues/64#issuecomment-5464216088)
records merged PR65 `fcd83d9d80097eb054f705834e7031c2be79c2b2`, successful run
`33269041500`, validation job `99144104433` and live job `99144121128`.
Artifact `9719580095` was 426 bytes with ZIP SHA-256
`f30aa7c30cff9a304446ca3ddc597357920f2244cc351d036fc93ac6ebad3c25`.
That is one historical ready-host proof; it does not explain manager timeouts in
jobs `99137076322`/`99137631512`, add classified retry, retain bootstrap-failure
reports, or prove two consecutive runs. It expressly keeps the issue open.
These are native historical writer claims, not a new host inspection.

## Entire issue64 criteria and proposed decomposition

| Original requirement | Proposed disposition and remaining evidence |
| --- | --- |
| Bounded systemctl running/failed-unit, D-Bus, load, memory and relevant journal evidence without secrets | Separate unestimated owner slice; real diagnostics still unsatisfied. This report slice does not collect raw diagnostics. |
| Determine resource pressure, wedged manager or bootstrap ordering root cause | Separate diagnosis; no cause established by source inspection or offline fixtures. |
| Bounded retry only for classified transient manager timeouts | Separate pure classification and host adapter after diagnosis; no retry added or persistent failure concealed here. |
| Structured bootstrap-failure report even when independent verification cannot start | The proposed three-point incoming story, with primary-exit preservation and runner-local fallback. |
| Deterministic retry-classification, exhaustion and report tests | This story proposes report laws/fixtures only; retry-classification/exhaustion remain unsatisfied follow-up. |
| Two consecutive idempotent real bootstrap/verify runs with uploaded reports; injected persistent systemd failure remains red | Separate authorized live verification/admission; one historical success is insufficient and no offline fixture can qualify it. |

The pure report outcome must remain independent of its artifact handling outcome.
A primary failure has an original exact exit and observed phase; independent
verification can be `not-run` without an exit. An unknown source/run identifier
must be unavailable or invalid, never guessed. Report failure must preserve the
primary failure while exposing its own diagnostic. This story does not estimate
or close the diagnosis/retry/live outcomes above. Future decomposition may assign
UUIDs and dependencies only after the owning planning review; no fictional foreign
UUIDs are supplied now.

## Current implementation seam, without modifying it

`.github/workflows/digitalocean-host.yml` calls `bootstrap-host.sh` through SSH.
Its later Verify host step is success-conditioned and is responsible for copying
`host-verification.json`; Upload verification report uses `always()` with
`if-no-files-found: error`. A bootstrap failure can therefore skip the only report
producer. Source confirms this seam; no live failure was reproduced here.
The bootstrap's existing EXIT trap cleans up sudoers temporary state, and its
strict Docker readiness requires the installed unit, canonical complete config
stream, offline enabled state and responsive Docker. Preserve these laws/traps.

Proposed future pure files: `digitalocean/src/services/host/failure_report.cljc`
and paired CLJS/JVM tests. Proposed outer offline fixture runner:
`digitalocean/scripts/test-bootstrap-failure-report.py`; the existing shell and
Actions adapters remain the eventual effect boundary. JSON is transport output,
not domain or ledger authority. A fixed allowlist contains operation, failed
phase, exact primary exit, source SHA, run/attempt, verification state and report
handling outcome; no raw environment/journal/log, host address or secret fields.
Phase enumeration and contradictory-state rejection must be reviewed before red.

Capture the first failure before cleanup/reporting. Handling/report-upload failure
cannot override the original failed status. Always attempt a schema-valid local
failure artifact when remote verification never starts; if local evidence cannot
be produced, retain failed/unavailable outcome and explicit report-handling
failure. Success reporting must require observed independent verification and
must not grant deployment admission by itself. Avoid applying `continue-on-error`
or a broad success waiver to preserve a green job.

## Future verification contract, not executed now

After native exact-head planning qualification and lawful Rheos readiness, run
new pure tests in red then green with NBB and Babashka commands listed in the card,
and the offline Python adapter fixture. Fixtures use fictional identifiers and
mock boundaries; reject secret sentinels and invalid/truncated/missing reports.
Cover pre-verification bootstrap failure, persistent timeout, transport failure,
report-writing/validation/upload failures, and observed verification success.
Run the existing offline Docker-readiness regression if that source is later
changed. No local fixture establishes root cause, retry recovery or production
proof. Required actual live qualification remains separate and unexecuted.

## Ownership, review and release holds

No root AGENTS or project-local skills exist in this accepted Services source;
`contracts/knoxx/AGENTS.md` applies to that unrelated target. No accepted configured
board/card corpus exists; sync PR1 adds only its separate incoming sync card.
Native task inventory was unavailable, so foreign ownership remains unknown.
Current origin PR83 environment controller, PR84 publication tenant scope and
PR92 Axxium/PDS deployment touch different source seams and remain untouched.

No source implementation, workflow/gate/settings/protection, SSH/trust, host,
service, publisher, deployment, credential, or board state mutation occurs here.
New incoming Markdown is first-class planning input, not readiness. Automatic
merge stays off; native planning rounds/required checks and lawful Rheos ready
are prerequisites. No manual reviewer requests occur in this lane. No historical
review transfers from PR65 or syncPR1. Full source ancestry, native evidence and
append-only provenance remain reviewable.
