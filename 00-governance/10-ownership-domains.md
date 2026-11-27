# Ownership Domains

`CANON-TYPES.yaml` is the machine-readable type registry and is authoritative for type routing. This file explains the human model.

## Core domains

- `storyworld_core` — shared laws, terminology, cosmology, storyworld identity.
- `continuities` — universes, canon lines, timelines, realms.
- `worldbuilding` — worlds, locations, factions, species, cultures, systems, technologies, relics, aetherial entities, named objects, materials.
- `characters` — characters and persistent relationships.
- `events` — canonical events and eras.
- `stories` — format-neutral stories, arcs, and installments.
- `crossovers` — cross-story/cross-universe event productions.
- `visual_language` — approved visual-production specifications.

## Important distinctions

- `STORY` is format-neutral: film, novel, comic, game, audio drama, standalone, miniseries, ongoing series, etc.
- `TECH` owns a technology class/platform; `OBJ` owns a unique named physical object/vehicle/machine.
- `MAT` owns reusable fictional material/resource properties.
- `RELIC` owns a singular artifact whose provenance/history is part of its identity.
- `SYS` owns an operating power/scientific/metaphysical system.

Exact codes, paths, and templates live in `CANON-TYPES.yaml`. Do not maintain a second manual type table here.

## Non-canon operational domains

- `08-production/` coordinates work and status but cannot override canon owners.
- `09-research/` stores evidence records, not fictional canon by itself.
- `99-archive/` preserves provenance and is never current authority.
