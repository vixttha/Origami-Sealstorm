# Document Standard

## Canon ID

`<STORYWORLD>-<TYPE>-<NNNN>`

Examples: `DV-UNIV-0001`, `DV-CHAR-0001`, `DV-EVENT-0001`.

- The prefix belongs to the whole storyworld/franchise, not an individual universe.
- Prefix: stable 2-8 uppercase alphanumeric characters beginning with a letter.
- Type: a code registered in `CANON-TYPES.yaml`.
- Number: four digits, sequential within type.
- IDs never contain mutable names or titles and are never reused.
- Renaming never changes an ID.

## Required Source-of-Truth frontmatter

```yaml
---
canon_id: DV-CHAR-0001
title: Example Character
type: character
status: WORKING
scope:
  level: universe
  container: DV-UNIV-0001
version: 0.1.0
source_of_truth: true
owner_domain: characters
dependencies: []
variant_of: null
supersedes: []
superseded_by: null
aliases: []
tags: []
last_reviewed: null
---
```

The registry repeats routing metadata, including `owner_path`. The owner document remains the narrative Source of Truth. Registry and owner metadata must agree or validation fails.

### Optional cross-scope bridge

When a dependency intentionally points to canon whose declared scope is outside the consumer's scope, add the same ID to `cross_scope_dependencies` in both the registry entry and owner frontmatter:

```yaml
dependencies:
  - DV-CHAR-0009
cross_scope_dependencies:
  - DV-CHAR-0009
```

Do not use bridges for ordinary same-scope or ancestor-scope dependencies. An unnecessary bridge is a **review error**. The free writing-only v1.0 includes a manual cloud review checklist; separate optional validator software may detect the same defect when explicitly installed.

## Scope meaning

Scope means **where this object/fact is true**, not where its file is stored. A Universe record itself is storyworld-scoped; a continuity is normally universe-scoped; a timeline is normally continuity-scoped. Never create a circular container.

## Version convention

- PATCH: editorial/non-semantic correction.
- MINOR: compatible canon addition or clarification.
- MAJOR: approved meaning-changing revision.
