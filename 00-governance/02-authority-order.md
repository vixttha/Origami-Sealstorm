# Authority Order

When story material conflicts, use this order:

1. Governance
2. `LOCKED_CANON` Source-of-Truth record
3. `CANON` Source-of-Truth record
4. Approved production continuity contract
5. `WORKING`
6. `PROPOSAL`
7. `SUPERSEDED`
8. `REJECTED`

## Decision Records

Approved Decision Records **authorize and explain** a change. They do not outrank or replace the Source-of-Truth owner.

If a Decision Record changes canon but the affected owner documents have not yet been migrated, the affected promotion state is `BLOCKED` until migration is complete.

## Registry role

`CANON-REGISTRY.yaml` is authoritative for routing metadata only when it agrees with the owner document. A registry/document mismatch is a validation failure; neither side silently overrides the other.

Ownership beats repetition. A script, summary, crossover, research note, or old prompt cannot overwrite an owner merely by repeating a different value.
