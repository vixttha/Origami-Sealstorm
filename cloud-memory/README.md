# Cloud Memory — Navigation and Reconstruction

Cloud memory is **the existing versioned repository** plus a deterministic lookup procedure. It is not a new database, hosted service, background job or second Source of Truth.

## Memory recall procedure (cloud-only)

At the beginning of a creative task:

1. Record requested repository and exact source SHA.
2. Read `STORYWORLD.yaml` and `CANON-REGISTRY.yaml`; confirm storyworld code and current Canon ID scope.
3. Resolve only referenced owners and their upstream dependencies using the registry.
4. Load relevant STORY casting and ARC/INST records for character roles, plus EVENT/ERA/TL for chronology.
5. Report four separate buckets: approved canon, proposals, unknowns, conflicts.
6. Deliver a short context packet with source commit SHA, Canon ID list, exact paths, role/chronology constraints and token budget.
7. On subsequent tasks, recheck recorded SHA; if the head changed, refresh affected owners rather than trusting an old summary.

## Cloud memory categories to expand

| Category | Canonical owner | Derived memory output |
|---|---|---|
| Character facts | CHAR, REL | character-specific dossiers / relationship summaries |
| Faction and social history | FAC, WORLD, EVENT, ERA | faction timeline / alliance map |
| Main plot and unresolved threads | STORY, ARC, INST | plot/foreshadowing tracker |
| World laws, costs and prohibitions | LAW, SYS, TECH | mechanical constraint sheet |
| Player paths | optional interactive graph | reachable choices and endings |
| Story-specific roles | STORY, ARC | cast-function/role-change table |
| Visual language | VIS | production visual constraints |
| Change history | decisions + Git history | audit/retcon impact report |

A derived cache does not get a Canon ID, cannot override Source-of-Truth ownership and is never treated as complete simply because it is long.

## Freshness, permissions and recovery

Each generated context packet must carry `repository`, `commit_sha`, `retrieved_at`, `canon_ids`, `source_paths`, `status`, `unknowns` and `unverified_claims`. Do not write facts into a secondary 'memory' file as a way around canonical owner review. Use Git history for restoration and independently exported backups if resilience is important.

If GitHub is temporarily unavailable, drafts can remain unapproved in the current cloud conversation; no promotion or factual canon verification should be claimed until authoritative files can be reloaded.

## Operational cloud recall

See `cloud-memory/CLOUD-RECALL-PROTOCOL.md` for live GitHub connector retrieval steps, source lineage, review grading and privacy controls. A standalone browser inspector is a separate optional engineering component; the public writing-first v1.0 template provides the cloud recall **procedure**, not a hosted web app, installed browser client or second database. AI context packets remain derived, rebuildable and subordinate to source Canon IDs.

**Audit safety:** Never collapse mutually exclusive sibling continuities into one canon answer. Select explicit story/timeline context for creative claims; public-browser search without context is marked `DISCOVERY_ONLY`. For private repository content, use the connected GitHub cloud app, not an untrusted website asking for personal access tokens.
