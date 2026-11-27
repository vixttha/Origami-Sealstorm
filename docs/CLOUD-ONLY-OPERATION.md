# Cloud-Only, Runnerless Operation Contract

Status: **APPROVED PRODUCT REQUIREMENT / IMPLEMENTATION CANDIDATE** (2026-10-16).

## Primary experience and audience

**The product is a GitHub template for people creating original stories in ChatGPT.com chat, not a deployed browser application.** GitHub Free repository plus ChatGPT chat and GitHub web editing is the supported baseline; a GitHub connector is optional and plan-dependent. Non-programmers and mobile-browser users are first-class. See `docs/CHATGPT-CHAT-FIRST-WORKFLOW.md` for the complete free/no-connector writer workflow.

## Required outcome

A final Writing Universe Template instance must be **fully usable without any local installation, local AI model, dedicated machine, self-hosted runner, GitHub-hosted Actions runner, cloud VM, paid token, scheduled worker or always-on service**. A browser or cloud AI with authorized access may create, inspect, edit and review stored files. The user need not keep a machine online after saving work.

**Runnerless is not computation-free.** Browser clients and managed AI services use compute, but none is a prerequisite to *keeping and reading the storyworld*. Optional machine-enforced validation requires some ephemeral compute when deliberately invoked and may incur a provider cost. Such compute is never a framework service dependency.

## Canon storage = cloud memory

The GitHub repository holds the durable canonical data: `CANON-REGISTRY.yaml`, owner documents, fictional continuities and stories, review decisions and commit history. ChatGPT memory, summaries, vector embeddings, indexes and chat transcripts are **non-authoritative caches** that must be reconciled against the latest approved Git SHA before canon-sensitive changes.

Cloud memory tiers:

| Tier | Location | Authority | Persistence |
|---|---|---|---|
| Canon truth | GitHub registry + registered owners | Authoritative within approved status/scope | Versioned Git commits |
| Story/playthrough design | STORY/ARC/INST and optional extension | Authoritative only for owned production/scope | Versioned Git commits |
| Decisions and evidence | Review records and commit URLs | May authorize changes; do not replace owners | Versioned Git commits |
| On-demand context | `cloud-memory/` guides and generated context packets | Temporary read-only derivative, not canon | Rebuildable |
| AI conversation memory | Provider-specific session/memory | Untrusted convenience cache | Provider-dependent |

## Exactly how a cloud-only author works (with or without a GitHub connector)

1. Open the GitHub repo in its web editor on a phone/tablet/any browser. Open ChatGPT.com chat. **The GitHub app is not required:** copy the current registry and relevant owner docs from GitHub into chat when live connected reads are unavailable; disclose that source SHA could not be independently verified in chat.
2. Read `START-HERE.md`, `STORYWORLD.yaml`, `CURRENT-STATE.md`, `CANON-REGISTRY.yaml` and task-relevant registered owners at a recorded commit SHA.
3. Ask ChatGPT to propose complete Markdown/YAML owner and registry changes. Using the GitHub web editor, save after human review (a working branch is recommended but not required by the framework). Connected write operations are optional and must be confirmed as supported and authorized. The AI cannot auto-promote unsupported lore.
4. Review changes and document evidence. A cloud-only reviewer may inspect schema, registry uniqueness, owner locations, links and scope relationships via GitHub content/tree APIs without executing scripts; record exactly which checks were actually performed.
5. Approve and merge according to canon change control. GitHub commits and branch history provide durable memory. New work reloads source files from cloud.
6. Maintain optional `cloud-memory/` packets as **reconstructible references**, not a second canonical truth store.

No local command, GitHub Actions run, persistent agent, background service, database migration or synchronized AI-memory setting is necessary for this core workflow.

## Release scope — no browser-app or native OS gate

The complete `ChatGPT chat → original storyworld draft → GitHub web-file save → re-read owner/registry → continuity review → creator approval` journey is the primary end-to-end workflow. It must work without a GitHub connector. Separate browser dashboards, native filesystem exporters, Playwright suites and game-engine experiments are **optional and not included in writing-first public v1.0**. Their absence or `UNVERIFIED` status must not block a scoped release of this GitHub authoring template, but any public feature claims for those components must be accurately qualified. A distinct reviewer of the core workflow and explicit owner approval remain separate release decisions.

## Release verification: accurate evidence labels

- **CLOUD_STATIC_PASS:** content/API inspection on frozen exact SHA supports only declared static checks (e.g. files exist, IDs unique, source metadata aligned). Include reviewer, date, SHA, inspected paths, limitations and audit result.
- **RUNTIME_PASS:** actual validator commands were executed on exact SHA with captured outputs. Optional higher-assurance claim; cloud-hosted ephemeral execution permitted but never required for basic usage.
- **UNVERIFIED:** no trustworthy observation for a claim. The existence of code/tests is not an execution result.
- **BLOCKED:** contradiction, material missing source, or a mandatory *declared* gate unsatisfied. A dormant optional GitHub Actions workflow is not itself a release blocker.

A release must be transparent about which level it attained. **Do not label validators as having passed when they never ran.** A release claiming executable-validated safety must still obtain RUNTIME_PASS on its exact SHA, potentially using ephemeral cloud execution.

## No mandatory runner policy

- No Actions trigger on push or PR is required by the distribution.
- Existing optional GitHub Actions validation is **manual invocation only** and must not be a mandatory branch status check or release gate.
- No self-hosted runner, user workstation, Codespaces subscription, GitHub Actions minutes, Vercel deployment, Supabase account, vector DB or external governance repository may be a prerequisite.
- Optional services must be removable without altering existing Canon IDs or breaking basic browsing/editing.

## Privacy and cloud durability

Use private repositories and explicit minimum necessary connector permissions. Never store private passwords, identity information or unpublished confidential third-party assets in chat memory as a substitute for repo permissions. Protect secrets separately. Review provider retention and access settings, keep documented backup/export and disaster recovery procedures. A single cloud provider can still fail or suspend access; `cloud-memory/` is *not* an automatic backup system.

## Remaining verification work

Runnerless authoring is supported by GitHub web/API capabilities by design. Cloud-only **full semantic validation**, no-overwrite dual-installation via GitHub APIs, comprehensive retrieval and backup automation remain *future capabilities*. Do not claim that this document alone implements them.
