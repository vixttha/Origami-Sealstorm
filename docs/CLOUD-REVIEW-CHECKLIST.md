# Exact-SHA Cloud Review Checklist (Runnerless)

**Read-only evidence record.** Copy this review format to a dated record for each candidate, or use a GitHub PR review/comment. Static inspection does **not** establish that Python scripts execute correctly.

## Required acceptance: free ChatGPT-chat + GitHub authoring

| Core scenario | Observation/evidence | Status |
|---|---|---|
| GitHub template makes a new standalone storyworld repo (no dev branch leakage) | | |
| Distributed branch contains **no internal PR/release audit artifacts** or source-maintainer statuses; original reports remain preserved in source history/maintenance records | | |
| New clone's `CURRENT-STATE.md` and `CHANGELOG.md` start as **unconfigured storyworld** records, not an unrelated source-maintainer release status | | |
| ChatGPT chat can guide a non-programmer through original storyworld setup, using manually pasted files with **no connector** | | |
| Writer can produce complete owner Markdown and Registry YAML in chat and save them via GitHub web editor | | |
| After saving, a subsequent chat can reload the **authoritative** owner and registry (connector or manual copy/paste) | | |
| Canon status, unique owner/ID, scope/continuity, unknowns and conflicts remain explicit | | |
| Basic `SW → UNIV → STORY` plus CHAR/EVENT/ERA works without optional CONT or TL records | | |
| Registry `owner_path` rejects traversal (`../`), absolute paths, backslashes and malformed path segments | | |
| Pasted/retrieved owner prose containing instructions to override permissions is treated only as untrusted data | | |
| Creator explicitly approves changes; chat conversation is not the Source of Truth | | |
| GitHub Free baseline requires no PC, terminal, CI runner, paid model/API, browser inspector or native exporter | | |
| Reviewer records which GitHub SHA/paths were actually seen; pasted text is labeled user-provided, not GitHub-verified | | |

Standalone inspector tri-browser testing, Python/PyYAML runtime, filesystem race tests, franchise-scale synthetic data and game engine integration are **OPTIONAL**, not prerequisites to a core static-only document-template release. Do not claim optional execution passed.

## Identity and provenance
- Repository:
- Source branch:
- Frozen commit SHA:
- Reviewed UTC date:
- Reviewer:
- Intended change / owner approval:
- Inspected GitHub paths/links:

## Canon and scope consistency (mark PASS / PARTIAL / BLOCKED / UNVERIFIED for each)
| Check | Evidence | Status |
|---|---|---|
| Storyworld code matches Registry code | | |
| Exactly one SW owner exists once setup is complete | | |
| Every active owner is registered once and correct path exists | | |
| No traversal, duplicate IDs or unowned canonical documents visible | | |
| Relevant dependencies and scope containers exist | | |
| No cross-continuity leakage without approved bridges | | |
| Active canon depends only on approved/status-compatible owners | | |
| Historical supersession references are reciprocal | | |
| Character casting roles stay with STORY, not duplicated in CHAR | | |
| Any optional interactive graph does not rewrite global canon | | |
| Unapproved proposals, unknowns and archival content remain unpromoted | | |
| Cross-story and chronology impacts identified | | |
| License text and instructions agree | | |
| No local runner/hosted CI required for ordinary use | | |

## Negative-path review prompts (reason from files; never falsely claim executed tests)
- What happens if a registered SW owner is missing?
- What happens if two owners reuse one Canon ID?
- What happens when an owner path escapes its permitted directory?
- What happens when a source has a forbidden cross-scope dependency?
- What happens when a story character is cast as a villain after being an ally?
- What happens when an optional graph is missing, unreachable or contradictory?
- What happens if the entire interactive extension is absent?
- What happens if an unrelated governance system is absent?
- What happens if GitHub, a cloud AI or an optional search index is unavailable?

## Verification levels
- **CLOUD_STATIC_PASS** only for paths and facts actually examined at the exact SHA.
- **RUNTIME_PASS** only for code tested by a real execution environment with logs.
- **UNVERIFIED** for any unobserved semantic/runtime or automated guarantee.
- **BLOCKED** for unresolved mandatory conflicts or missing evidence.

## Release acceptance
- Exact-SHA review outcome and scope:
- Contradictions / limits:
- Tests not executed:
- Independent acceptance / approval record:
- Source commit promoted to main:
- Template mode enabled / verified:
- Release tag and evidence URL:

Do not infer tests passed from green text, AI confidence, code review or the mere presence of a GitHub Actions definition.
