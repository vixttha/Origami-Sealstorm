# Modeling Coverage

Use the smallest model that accurately represents the project. Optional layers stay optional.

| Case | Recommended model |
|---|---|
| One standalone story, one universe | `SW → UNIV → STORY`; `INST` optional |
| Serialized novel/comic/show | `SW → UNIV → STORY → INST`; `ARC` when useful |
| Multiple stories sharing one universe | one `UNIV`, multiple `STORY` objects |
| Multiple universes | multiple `UNIV` objects under one storyworld |
| Reboot/adaptation/canon line | `CONT` inside the relevant universe |
| Branching/time-travel canon | `TL` inside a continuity |
| Dimension/plane with distinct rules | `REALM` |
| Alternate version of a character/object/event | new Canon ID + `variant_of` |
| Cross-universe story/event | `CROSS` consuming the relevant owners |
| Named ship/vehicle/unique machine | `OBJ` |
| Technology class/platform | `TECH` |
| Special material/resource | `MAT` |
| Ancient/singular artifact defined by provenance | `RELIC` |
| Power/scientific/metaphysical operating system | `SYS` |
| Deity/metaphysical being or contract-bound entity | `AETHER` or `CHAR`, according to narrative identity |
| Bilateral/interpersonal dynamic reused across stories | `REL` |
| Historical period | `ERA` |
| Real-world support/evidence | research record; not fictional canon by itself |
| Visual production rule | `VIS` |
| Scene/beat that matters only inside one installment | keep inside the installment; do not create registry noise |
| Unknown fact | keep unknown; do not create fake canon |

## Character role ownership and interactive media

`CHAR` owns stable character identity; `STORY` owns production-specific protagonist, antagonist, supporting, civilian and other roles; `ARC`/`INST` own the narrative order of role transitions. Role classifications are non-exclusive and should not conflate morality with antagonistic function. Interactive story choices should stay in story-scoped production records rather than being registered as fixed shared Canon events. The optional software extension is not included in public v1.0. Player choices do not create a new TL unless the fictional canon actually diverges. See `docs/CHARACTER-ROLES.md` and `docs/STORY-INSTANCING.md`.

## Anthologies

Use one `STORY` with `INST` entries when pieces share a production identity. Use separate `STORY` objects when pieces need independent canon ownership or can stand alone across productions.

## Interactive / game branching

Use `TL` only when branches are canonically distinct world histories. Player-choice branches that are merely production paths can remain inside the story/installment structure instead of becoming universe canon.

## Object boundary rule

Create a new Canon object only when the thing needs independent authority, reuse, scope, lifecycle, or cross-production reference. Otherwise keep the fact inside its existing owner.
