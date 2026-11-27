# Character Identity vs Narrative Role

**Roles are scoped to individual stories**, not permanent labels attached to a character's identity. A character can be protagonist, villain or background civilian depending on story and arc without acquiring duplicate CHAR records.

## Independent axes

| Axis | Example values |
|---|---|
| Narrative prominence | Protagonist, co-protagonist, deuteragonist, ensemble lead, supporting, minor, background, guest |
| Opposition function | Main antagonist, secondary antagonist, side villain, rival, foil, henchperson, false antagonist, none |
| Moral framing | Heroic, antiheroic, villainous, sympathetic villain, conflicted, morally ambiguous, neutral |
| In-world function | Civilian, scientist, mentor, medic, teacher, soldier, politician, merchant, witness, quest giver, companion |
| Gameplay/media | Playable character, NPC, party member, POV character, recurring, cameo, unreliable narrator |

These classifications are **non-exclusive and extensible**. An antagonist need not be villainous, a villain may not oppose the primary protagonist, and a civilian may become the central hero.

## Canon ownership

- `CHAR` owns stable identity, motivations, biography, abilities, historical status and traits.
- `REL` owns enduring interpersonal relationship facts.
- `STORY` owns that production's casting/narrative role assignments.
- `ARC` and `INST` define the sequence of role transitions.
- `EVENT` owns historical occurrences confirmed as shared canon.
- Optional player-state graphs own temporary or persistent *playthrough* outcomes, not universal canon.

`templates/17-character.md` should only point to relevant story IDs, not mirror the authoritative casting table. `templates/21-story-bible.md` should list roles and relevant CHARACTER IDs. A researcher may be a supporting ally in Story A, a secondary antagonist by its finale, and a lead protagonist in Story B, without changing identity.

**Limit:** the base validator checks Source-of-Truth metadata; it does not yet semantically validate each role declared in prose or a Markdown casting table.
