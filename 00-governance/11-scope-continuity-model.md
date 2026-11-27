# Scope & Continuity Model

A repository instance is a **storyworld/franchise** and may contain one or many universes and one or many stories.

## Scope levels

- `storyworld` — true across the franchise/multiverse; container must be `null`.
- `universe` — true inside one registered `UNIV` object.
- `continuity` — true inside one registered `CONT` canon line/reboot.
- `timeline` — true inside one registered `TL` branch.
- `realm` — true inside one registered `REALM` plane/dimension.
- `story` — true only inside one registered `STORY` production.
- `installment` — true only inside one registered `INST` issue/episode/chapter/part.

Scope answers **where is this fact true?**

Therefore a Universe object is storyworld-scoped; a Continuity is normally universe-scoped; a Timeline is normally continuity-scoped; and ordinary canon uses the narrowest scope where it remains true.

A `STORY` is format-neutral: it may be a film, novel, game, comic, audio drama, miniseries, ongoing series, or other narrative production. `INST` is optional for a standalone story and useful for stories with discrete parts.

## Dependency compatibility

A dependency to an **ordinary fact** is compatible if its declared scope is storyworld-wide or its direct scope container belongs to the consumer's lineage. **Scope-defining owners are different:** `UNIV`, `CONT`, `TL`, `REALM`, `STORY`, `INST` may describe an entire subtree while their *own* records live at a parent scope. A consumer may use those scope-defining owners only if they are **the consumer's ancestor/self** (or a separately approved explicit bridge), not merely because sibling universe/continuity owners are both declared at `storyworld` or the same parent level. `SW` is the common storyworld root. This rule prevents silently importing sibling-canon facts. **Writers and reviewers must check it**; machine-enforced validator software is a separate optional capability not bundled in the writing-first v1.0 template.

Intentional cross-universe/cross-continuity dependencies must be listed in `cross_scope_dependencies`. The bridge is an exception ledger, not a shortcut for bad scoping. An unnecessary bridge is a validation error.

Scope-container cycles are invalid.

## Variants

Alternate-universe or alternate-timeline versions are distinct canon objects. Use `variant_of`; never overwrite the original object.

## Shared facts

Put a fact at the narrowest scope where it remains universally true. Do not promote a universe-specific fact to storyworld scope merely for convenience.
