# Review Gates

Important promotion passes applicable gates:

1. Scope
2. Canon ownership
3. Continuity
4. Timeline/chronology
5. Mechanics/hard limits
6. Character integrity
7. Anti-slop
8. Cross-universe/cross-story impact
9. Evidence/provenance
10. Final approval

Allowed results: `PASS`, `PARTIAL`, `BLOCKED`, `UNVERIFIED`.

A broken required gate blocks promotion. Missing evidence cannot become PASS by confidence or prose quality.

## Cloud-only evidence policy

Each applicable review gate must be supported by an actual observation on the frozen GitHub commit, with author and exact SHA. By default this is a runnerless cloud content/API audit. Static consistency reviews are labeled `CLOUD_STATIC_PASS`; optional executable script tests are labeled `RUNTIME_PASS` **only if executed with recorded output**. Missing mandatory facts or unresolved canon conflicts block the corresponding promotion, but lack of a GitHub Actions runner is not itself a defect in the runnerless product. Never silently convert UNVERIFIED executable behavior to PASS. See `docs/CLOUD-ONLY-OPERATION.md`.
