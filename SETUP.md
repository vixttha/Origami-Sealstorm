# First-Time Storyworld Setup — No Coding

Use this after creating **your own** repository from an authorized Writing Universe Template baseline, including a private product-staging template you have permission to access. Designed for **ChatGPT.com chat + GitHub web editing**, including a browser-capable phone and a free-plan manual copy/paste path. No connector, CLI, code editor installation, PC, CI runner or paid service is required. See [Chat-first guide](docs/CHATGPT-CHAT-FIRST-WORKFLOW.md).

## Before writing: privacy

If the storyworld is unpublished, create your new GitHub repository as **private**. Never paste credentials or unnecessary personal information into ChatGPT or GitHub documents. Check the destination repository and file changes before saving; publishing a repository exposes its contents to the public. Only the owner approves publication.

## 1. Record your original-content rights

Review `CREATOR-CONTENT-RIGHTS.md` before sharing the storyworld or inviting collaborators. The template's proprietary `LICENSE` covers framework assets, not ownership of your original fiction; GitHub's public-fork and contribution terms may still apply. Keep your storyworld private while authorship and publication permissions remain undecided.

## 2. Choose one permanent storyworld code

Use 2-8 uppercase alphanumeric characters beginning with a letter, for example `EX`.

Do not encode a universe name in this code; the code belongs to the whole storyworld/franchise.

## 2. Configure the two routing files

In `STORYWORLD.yaml`:

- replace the storyworld name;
- replace `SETME` with the permanent code;
- replace the description;
- leave `setup_required: true` for now.

In `CANON-REGISTRY.yaml`, set `storyworld_code` to the same code.

## 3. Create the Storyworld Source of Truth

Copy `templates/00-storyworld.md` to:

`01-storyworld-core/storyworld.md`

In GitHub's browser file editor, choose to create a new file and enter the **complete path including directories** if the destination does not yet exist. Copy the template body as plain Markdown, without chat code fences. Replace its placeholders and assign `<CODE>-SW-0001`. You may prepare the content in ChatGPT.com chat, then save and confirm the file exists in GitHub. Mobile browser layouts may differ.

Register that exact file in `CANON-REGISTRY.yaml` as a `WORKING` Source of Truth.

## 4. Add only what the project needs

Use `CANON-TYPES.yaml` to find the correct template and destination. **Create the parent owner before its children.** The minimum default path for a beginner writing a story is `SW → UNIV → STORY`; character/event/era owners may use that same `UNIV` scope. Create a `CONT` (continuity) or `TL` (timeline) only when your fiction actually needs it. The starter STORY, EVENT and ERA templates default to `scope.level: universe` and `container: <CODE>-UNIV-0001` for this reason. Never leave a `SETME-CONT-0001` or `SETME-TL-0001` container without a registered matching owner.

**Important YAML caution:** ask ChatGPT for complete file contents and preserve indentation. Quote titles, names, descriptions, and aliases when they contain colons, `#`, brackets, date-looking text, or YAML-significant characters. Do not paste Markdown code fences into YAML files. The GitHub web editor saves files; it does not inherently run our optional validators. Review the generated YAML and owner/registry field parity in the cloud checklist.

## 5. Finish setup

When active project content no longer contains setup placeholders:

- set `setup_required: false`;
- using the GitHub web UI or an authorized cloud connector, check the frozen SHA, matching codes in both YAML files, exactly one registered SW owner, correct owner path/status/scope and missing references;
- record a scoped cloud-static review (and any unresolved issues) before canon promotion;
- **optional developer assurance:** separately distributed validator tooling may be tested in an execution environment, but **the writing-first v1.0 public template does not bundle or require Python scripts**. In the free baseline, check the YAML/owner correspondence and Canon IDs through the GitHub web editor and `docs/CLOUD-REVIEW-CHECKLIST.md`.

A runner, local Python installation, ChatGPT connector or standalone browser dashboard is **never required** for setup. When the GitHub integration is unavailable in ChatGPT, copy the exact files from GitHub into chat, prepare edits in chat, then use GitHub's browser editor to commit them. Do not claim SHA verification from text pasted into chat or claim optional Python validators passed unless they executed. Do not promote material to `CANON` or `LOCKED_CANON` until the applicable owner and reviewer decisions pass. See `docs/CLOUD-ONLY-OPERATION.md`.

## Normal work after setup

- `main` is the authoritative stable branch.
- Use short-lived work branches for normal changes.
- Use a separately reviewed feature branch for framework/governance/restructure work; no external project-governance toolkit is needed.
- Merge through reviewed pull requests when the repository settings support that workflow.

GitHub repository settings such as **Template repository**, rulesets, branch protection, and Actions availability are platform controls; they are not fictional canon.

## One franchise, many stories

A new story within this franchise gets a separate registered `STORY` owner, not an automatic Git fork. A new unrelated franchise gets an independently created repository from the released template. Canon continuities/timelines are fictional truth scopes, not Git branches. See `docs/STORY-INSTANCING.md` and `docs/STANDALONE-ARCHITECTURE.md`.

## Licensing your storyworld

The reusable framework uses the **Writing Universe Template Proprietary Use License 1.1**, not MIT. It expressly permits bona fide private and public storyworld repositories made from the template, including normal GitHub collaboration and forks, while prohibiting sale or repackaging of the Framework itself as a competing template product. See the controlling `LICENSE` and explanatory `LICENSE-SCOPE.md`. This remains proprietary/source-available, not open source.

Your original fictional canon, prose, scripts, artwork, media, and other project content are not automatically placed under MIT merely because you created the repository from this template. Choose and document the rights or license for your own storyworld content separately.
