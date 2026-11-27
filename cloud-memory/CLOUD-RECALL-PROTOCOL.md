# GitHub-Connected Cloud Recall — No Runner, No Second Memory Store

This protocol can be performed **directly in a ChatGPT conversation** with a connected GitHub app **when the user has that capability**. The template must also work for users with **no connector**: copy the current GitHub registry and relevant owner documents into ChatGPT chat, have ChatGPT draft revisions, and save approved changes with GitHub's web editor. Pasted text has user-supplied provenance; do **not** pretend ChatGPT independently confirmed a SHA. No local repo, installed browser dashboard, GitHub Pages, runner, PC or hosted runtime is required. See `docs/CHATGPT-CHAT-FIRST-WORKFLOW.md`. Files reside in the user's GitHub repository.

## 1. Freeze provenance

- Resolve requested repository/branch/PR source to one 40-digit commit SHA via GitHub.
- Retrieve `STORYWORLD.yaml`, `CANON-TYPES.yaml` and `CANON-REGISTRY.yaml` at *that same SHA*.
- Verify repository identity, storyworld code, configured/unconfigured state, type coverage and registry availability.
- Never read `main` implicitly if the actual source lives on another branch. Never mix owner content read from new HEAD with a stale Registry.

## 2. Recall (read-only)

- Search IDs, titles, aliases, tags and status in `CANON-REGISTRY.yaml`. Select a continuity, universe, timeline or story scope for authoritative narrative interpretation. A result spanning multiple contexts is **discovery-only**, never evidence that all facts are simultaneously true.
- Fetch registered `owner_path` Markdown files at the **same SHA**. For content/semantic recall, inspect actual body lines and provide GitHub source links with `blob/<sha>/<path>#L...` provenance.
- Default to `CANON` and `LOCKED_CANON`; label PROPOSAL/WORKING/REJECTED/SUPERSEDED as noncurrent and include only when explicitly useful.
- Filter against the selected scope's ancestry; reject sibling-story/timeline facts without explicitly justified cross-scope bridges. Follow required dependencies and scope ancestors; stop when query relevance falls off. Report owner reads that failed or were skipped.
- If no registered canon exists (the source is still a template), say so; do not fabricate fictional facts.
- Build a temporary context packet using `cloud-memory/CONTEXT-PACKET-TEMPLATE.md`. It is a derivative, never a second canonical owner.

## 3. Build relationship and impact views

- Treat `dependencies`, `cross_scope_dependencies`, `scope.container`, `variant_of`, `supersedes` and `superseded_by` as **explicit registry relationships** with named edge types.
- Mark recognized Canon IDs mentioned in owner prose as **text mentions only**, not confirmed friendship, causation, ownership or permission.
- To evaluate a proposed revision to Canon ID X, follow reverse dependency edges to identify potentially affected owners. Distinguish direct/indirect links, explicit/weak links and confidence limits.
- Describe a possible narrative contradiction as a *human semantic review finding*, not automatic proof.

## 4. Runnerless verification

- Inspect exact-SHA repository tree and requested owner paths; check type/domain/status/ID parity, missing SW when configured, scope ancestry, dependency and supersession reciprocity, owner frontmatter where accessible.
- Explicitly label verified static checks `CLOUD_STATIC_PASS`; incomplete inspections `CLOUD_STATIC_PARTIAL` or `UNVERIFIED`; material blockers `BLOCKED`.
- The manual cloud review in writing-first v1.0 is **not equivalent** to an executed JSON Schema, PyYAML or Python validator. Browser engines and Python validators are optional development utilities **not bundled in the core public v1.0 template**. Never claim an executable test passed when it did not run.
- Do **not** change release state merely because a chat assistant inspected code; an independent exact-SHA reviewer/owner acceptance remains a separate governance decision.

## 5. Privacy, freshness, and recovery

- GitHub owner documents and commit history are durable memory; provider chat memory or indexed search are transient derived caches.
- Read only the minimum necessary files; never automatically publish a private repository or share secrets inside context packets.
- Recheck source HEAD whenever changing or promoting content. When the SHA differs, refresh affected files and disclose stale retrieval.
- Without connected GitHub access, **the manual GitHub-web-to-chat copy/paste workflow remains supported**. Distinguish user-provided file content from independently SHA-verified GitHub reads, and never make up Canon facts or successful write claims. No always-on agent is required.
