# Canon ID Lifecycle

Canon IDs identify durable owners, not filenames or current names.

## Keep the same ID when

- the object is renamed;
- spelling or formatting changes;
- compatible detail is added;
- an approved major revision changes the same conceptual owner.

Use the document version and change-control process to record those changes.

## Create a new ID when

- an alternate-universe/timeline version becomes independently authoritative (`variant_of`);
- one owner is split into multiple independent owners;
- several owners are merged into a genuinely new owner;
- an old concept is replaced by a different conceptual identity rather than revised in place.

## Supersession

`supersedes` is always a list. `superseded_by` is `null` while current/not replaced and becomes a list when a superseded owner has one or more replacements.

### One-to-one replacement

Old: `superseded_by: [DV-OBJ-0002]`

New: `supersedes: [DV-OBJ-0001]`

### Split

Old: `superseded_by: [DV-OBJ-0002, DV-OBJ-0003]`

Each replacement lists the old ID in `supersedes`.

### Merge

Each old owner points to the new ID in `superseded_by`; the new owner lists all old IDs in `supersedes`.

All relationships must be reciprocal or validation fails.

## Never

- recycle a rejected/superseded ID;
- change an ID because a title changes;
- create a second owner merely to restate the same fact;
- split an owner only to make folders look tidy.
