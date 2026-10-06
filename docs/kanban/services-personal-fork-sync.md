---
uuid: a2c63644-53ce-42cc-b963-1df21b2370fc
title: Synchronize Services personal fork with reviewed origin main
status: incoming
priority: P1
labels: fork-sync, planning, review
---

## Outcome

Review the ordinary synchronization of `riatzukiza/services` main at `214882daad9ec324e66d552203b22e5a0838f79d` with `open-hax/services` main at `054cad89b9b817ad07e1021b8429d12912ee492f` through a personal-fork PR. Preserve both histories. The source is merged origin PR 93, not the unmerged environment feature PR 83.

## Scope

The origin source adds the immutable shared evidence-review workflow pin `b5b28237c45323cdc1914317260192163d957735`, supplies the exact PR head input, and appends the original rollout receipts/reflections. Carry that three-file difference unchanged, plus this planning card and an append-only synchronization receipt/reflection.

## Non-goals

No merge of this PR, branch rewrite, origin publication, environment feature import, credential or protection changes, service execution, or deployment/controller activation. A proposed review workflow does not demonstrate that the personal fork has its named secrets or integration configured.

## Acceptance

- Fork parent/default branch and both forty-character source/base revisions are verified.
- An ordinary merge preserves the exact origin source commit as an ancestor.
- The three synchronized artifacts retain the source bytes as prefixes; any added receipt/reflection is identified separately.
- Workflow YAML and receipts parse, whitespace passes, and the unchanged local deployment-boundary scanners pass.
- Native current-head review and required checks qualify before any authorized merge. No approval is inferred from the original origin PR.

## Dependency for the pending runtime guard

Origin PR 83 (`1e7ad3dda3bb2a8c996425b3de6c802fffb020d1`) contains `scripts/build-service-environment.sh`, which is absent from both fork main and this origin main snapshot. The private red/green empty-runtime repair cannot be published as a standalone implementation on this base. It requires a separately scoped migration of the original feature, or remains blocked with its planning/evidence preserved. This synchronization alone does not supply that feature.

## Verification

Inspect `git diff 214882daad9ec324e66d552203b22e5a0838f79d 054cad89b9b817ad07e1021b8429d12912ee492f` before the merge. Run YAML/EDN parsing, byte-prefix/source identity checks, deployment-boundary self-test and scan, deploy source-pin and chain scanners, and `git diff --check`. Do not execute a candidate workflow, build, package install, Docker operation, or service/deploy command.
