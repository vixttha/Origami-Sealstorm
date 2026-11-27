# Platform Enforcement Policy

The canon model must remain usable without paid repository features.

## Required by the framework

- the files and ownership rules in this repository;
- deterministic Canon IDs and registry routing;
- review gates and evidence status;
- the Canon registry/schema structural contract and human cloud-review checklist. Writing-first v1.0 does not include executable validators.

## Recommended when the hosting platform supports them

- pull-request review before changes reach the authoritative branch;
- required validation/status checks;
- protected branches or rulesets;
- CODEOWNERS or equivalent reviewer routing.

These controls strengthen enforcement but do not change canon authority.

## GitHub template mode and clean distribution

The **separate released public product repository**, not the private development Bible, should have GitHub's **Template repository** setting enabled so new projects can use the native `Use this template` workflow. A repository created from the template does not need to remain a template unless it will itself seed other repositories.

**Distribution cleanliness is a release gate:** GitHub template creation copies the files on the selected source branch. A released default branch must not give new writers the maintainer's PR numbers, blocked release candidate notes, development branch references, internal red-team receipts, source-specific approval decisions masquerading as story canon or unpublished private links. Keep historical maintainer audit artifacts in the **private development Bible** and its Git history; extract an allowlisted **fresh public product repository** so the public default branch contains only reusable writer-facing files and explicitly supported optional tools. Never merge/fork/copy the Bible's complete history into the new public product. Do not rely on GitHub Template mode to selectively exclude files—it does not automatically filter them. Validate the new repository's starter `CURRENT-STATE.md` and `CHANGELOG.md` are unconfigured *writer* records, not framework release logs.

A clean distribution must preserve the 28 registered Canon types, approved governance, schemas, templates, ownership rules and controlling framework license. Sanitization must not silently erase or rewrite audit evidence from the source history.

## Zero-runner, cloud-only operation

GitHub browser/API file access is sufficient for the ordinary creation, review, storage and recovery of fictional canon. No GitHub Actions runner, local computer installation, persistent machine, paid service or unrelated governance repository is required by this framework. The optional Actions workflow is **manual-only** and must never be a mandatory branch protection check or distribution dependency.

When cloud execution is unavailable or not requested, record exact-SHA static evidence with a declared `CLOUD_STATIC_PASS` scope. Do not assert `RUNTIME_PASS` for validator code unless those commands genuinely executed and the outputs were captured. A historical failed pre-step Actions job is evidence only that hosted execution did not start, not evidence that the validator itself failed. No release may imply stronger verification than its proof supports.

Optional paid hosting, automation, semantic indexing and stronger mechanical test execution can improve assurance but must remain detachable and nonblocking for standalone use. See `docs/CLOUD-ONLY-OPERATION.md`.
