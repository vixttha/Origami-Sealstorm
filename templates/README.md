# Reusable Writing Templates

This directory contains the **approved core canon-owner template family** registered in `CANON-TYPES.yaml`. Optional medium-specific production templates may exist under `extensions/` without creating new Canon types or modifying the core registry.

## Fast workflow

1. Find the object type in `CANON-TYPES.yaml`.
2. Copy its listed template to the listed owner domain.
3. Replace every `SETME`.
4. Assign the next unused permanent Canon ID.
5. Set the narrowest true scope and container. **The container must point to an existing registered owner.** A simple story starts `SW → UNIV → STORY`; `CONT` and `TL` are optional, not prerequisites to a standalone story or an ordinary event/era.
6. Add the owner document to `CANON-REGISTRY.yaml`.
7. Reference other facts by Canon ID instead of duplicating them.
8. Review the registered owner/IDs/scopes in GitHub's cloud files at a recorded SHA. The Python validator is optional and only counts if actually executed.
9. Use the review gates before promoting to `CANON` or `LOCKED_CANON`.

## Canon ID format

`<STORYWORLD_CODE>-<TYPE_CODE>-<4 DIGITS>`

Example: `DV-CHAR-0007`.

IDs are permanent and name-independent. Renaming never changes an ID.

## Operational templates

Files `90-93` support production/review/research state but do not create canon objects by themselves.
