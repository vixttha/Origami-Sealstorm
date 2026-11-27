# Story Instancing, Not Implicit Git Forking

The current repository represents one storyworld/franchise, which can contain **many distinct stories**. New stories do not automatically get Git forks, new repositories or branches.

## Mode A — Another story in the same franchise (default)

Create a registered `STORY` owner using `templates/21-story-bible.md`, with a unique Canon ID. Add `ARC` and `INST` only when they provide value; reuse CHAR, WORLD, FAC and EVENT IDs instead of duplicating facts. A character can be a main villain in one story and an ally in another without duplicating their identity.

## Mode B — A new independent franchise

Generate a separate repository from the **released** GitHub repository template (once enabled), or intentionally copy the independently packaged source into a new repository. Configure a new `storyworld.code` and registry. This is *not* a Git fork; template repositories start independent histories.

## Mode C — A genuine alternate canon

Add continuity/timeline records (`CONT`, `TL`) where fictional facts actually diverge. A choice in one player's run is a playthrough path, not automatically fixed world canon. Git branches are editing snapshots, not fictional timelines.

## Out of scope for current implementation

No automatic story scaffolding or Git repository forking is shipped. An optional scaffolder would need explicit user invocation, safe ID assignment, registry updates and its own tests. No story should silently mutate another story's canon.
