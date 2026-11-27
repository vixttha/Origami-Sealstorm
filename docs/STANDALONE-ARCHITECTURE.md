# Standalone Storyworld Architecture

Status: DESIGN CANDIDATE — not a claim of certified packaging.

The Writing Universe Template is a complete **independent storyworld product**. It has its own canon registry, schemas, validators, authoring and review rules. No external governance repository, branch, paid API, AI model, hosted runner or game engine is required to use it.

## Three compositions

| Composition | Requirement |
|---|---|
| Storyworld framework alone | Complete authoring, core setup, validation and release guidance |
| An unrelated governance framework alone | Absence of storyworld imposes no obligation or missing-file error |
| Both in one repository | Separate namespaces, authority, configs, validators and file paths; zero forced references |

**Critical branch distinction:** Git branches are alternative revision snapshots; a branch does not mount its files into another checkout. To use both systems simultaneously, each distribution must occupy a non-overlapping directory or be integrated explicitly. The source Writing Universe Template presently has root-level `README.md`, `AGENTS.md`, `LICENSE`, `.github/` and other files; blind copy-into-root can conflict. The public writing-first v1.0 release is designed for an **independent new GitHub repository** created using *Use this template*. It does not ship an automatic folder exporter or co-installation script; do not copy its root files into another existing project's root without a separately reviewed namespace plan. Advanced exporter testing is maintained separately from the public writing core.

## Invariants

- No imports, runtime checks, identifiers, configuration or shared release gate referencing any unrelated governance toolkit.
- No accidental changes to external governance authority, files or audit results.
- All fictional canon remains in the storyworld owner/registry model.
- Separate interactive-narrative software can be added in future but is **not included** in the writing-first public v1.0 core.
- Removing the optional extension must leave the standalone core fully usable.
- A new project may use only this framework; any other governance product must separately stand on its own.

## Verification matrix

A: GitHub web-editor core-only setup. B: unrelated-tool-alone noninterference (out of scope). C: core without optional extensions. D: exact-SHA manual canon review. E: root-file collision avoidance for any later co-installation. F: no assumed cross-branch filesystem visibility. G: correct license and rights boundaries.

Core browser-based writing has documented procedures, but the actual new-repository end-user walkthrough remains a release acceptance check. **Co-installation and cross-repository compatibility are unverified** and are not public v1.0 features.
