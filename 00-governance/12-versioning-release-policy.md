# Framework Versioning & Release Policy

The reusable framework uses `MAJOR.MINOR.PATCH`.

- **PATCH** — compatible documentation, validation, or template correction.
- **MINOR** — backward-compatible capability, type, template, or validation addition.
- **MAJOR** — breaking governance/schema/workflow change.

## Release gate

A stable framework release requires all seven audits to pass:

1. Governance
2. Registry/schema
3. Templates
4. Exact-SHA cloud integrity/evidence review (runnerless; declare limits)
5. LLM usability
6. Missing-case coverage
7. Release lock

The release version must agree in `VERSION`, `STORYWORLD.yaml`, `CANON-REGISTRY.yaml`, and `CHANGELOG.md`.

The default release path is **ChatGPT.com chat + GitHub Free web editor**, with a manual copy/paste fallback whenever the ChatGPT GitHub app is unavailable, and **requires no runners**. The core user journey (create template-derived repo, chat-created original Canon owner, browser-save, reload, continuity review and human approval) is the acceptance target. Optional tri-browser dashboard testing, OS-specific exporter race safety, game-engine integration, complete Python validator parity and stress benchmarks are not gates for the core template release; disclose them as unverified optional capabilities. A genuine separate reviewer must still review the exact final SHA, and Founder release authorization is still separate. Before a release can be called `PASS`, a reviewer must examine a frozen exact source SHA through cloud-repository content/API access, record scope and canon ownership checks, registry/schema and template coverage, missing-case/negative-scenario reasoning, contradictions, and explicit limitations. The review receipt must say `CLOUD_STATIC_PASS` for static checks that were actually inspected. It must **not** claim validator tests executed without machine-execution evidence.

Python validator scripts and optional manual GitHub Actions may be run on ephemeral compute only when the owner chooses. `RUNTIME_PASS` requires actual executed logs for the exact source SHA and is mandatory only for claims or release profiles that explicitly assert runtime-verified validator behavior. No self-hosted, GitHub-hosted or other CI runner is a prerequisite to *using* or *shipping the runnerless core*.

A release with unexecuted validation code must document that runtime validity is **UNVERIFIED**, even if its cloud-only documentary/canon functionality is accepted. No green badges for tests that did not run. A Git tag may be created only after the release commit is on `main`. See `docs/CLOUD-ONLY-OPERATION.md` and `cloud-memory/README.md`.
