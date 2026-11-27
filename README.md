# Writing Universe Template

**A GitHub storyworld template designed first for everyday writers using ChatGPT.com chat.** Build your own original universe, characters and stories through conversation, then save approved canon in GitHub. No coding, PC, local installation, runner, paid API or always-on service is required; a browser-capable phone can be enough. **GitHub read/write integration with ChatGPT is optional and availability varies.** See [Chat-first guide](docs/CHATGPT-CHAT-FIRST-WORKFLOW.md).

One repository can support a simple standalone story or a large franchise containing multiple universes, continuities, timelines, realms, worlds, stories, installments, and cross-universe events.

## Governing model

**one fact → one owner → one Canon ID → explicit status → controlled changes → evidence → review → promotion**

## Fast start — ChatGPT chat + GitHub Free

1. If you have access to the template repository, use GitHub's **Use this template** to create **your own** private storyworld repo. The framework's product repository may remain private during early multi-project pilots; public availability is a separate future decision. Make your original storyworld public only after separately deciding its content rights.
2. Open ChatGPT.com chat. Use the [Chat-first guide](docs/CHATGPT-CHAT-FIRST-WORKFLOW.md) and `SETUP.md` to describe your original world; you do not need to know YAML or Markdown in advance.
3. **Without a connector:** copy the authoritative files from GitHub into chat, have ChatGPT draft proposed complete file changes, review them, and save them in GitHub's web file editor. **With authorized GitHub read access:** ask ChatGPT to retrieve files at a recorded SHA; use web editing unless your connected tool explicitly supports writes.
4. Continue writing stories, characters and canon through chat. Approved registry and Source-of-Truth files in GitHub, **not ChatGPT memory**, determine the current truth.
5. Review scope, Canon IDs, unknowns and contradictions before you approve any canon change. No software test or CLI is required for this ordinary workflow.

The framework intentionally separates canon, production coordination, research evidence, visual specifications, and archive history so authority can be resolved deterministically instead of guessed.

## Cloud-only and no runners

The complete source of truth lives in the **cloud repository**, including versioned Canon IDs, Storyworld/Story files, decisions and historical changes. A browser and authorized cloud editing/review tooling are sufficient to use the framework: no local clone, GitHub Actions, hosted/self-hosted runner, dedicated computer, running server, paid API or external governance framework is required. Optional AI memory is a *derived convenience cache*, not authoritative canon. See `docs/CLOUD-ONLY-OPERATION.md` and `cloud-memory/README.md`.

## Writing template v1.0 contents — private pilots first

This release includes GitHub-based writing and Canon templates, not executable developer tools. Use the ChatGPT chat guide and GitHub web editor with no connector, PC, paid API or runner. Canon Registry and owner documents remain authoritative. A fresh unrelated storyworld starts in a new repository; another story in the same world uses a registered STORY owner. See `docs/CHARACTER-ROLES.md` and `docs/STORY-INSTANCING.md`.

## License

The framework is distributed under the **Writing Universe Template Proprietary Use License 1.1**, a proprietary/source-available license. See `LICENSE` and `LICENSE-SCOPE.md`.

You may build a **private or public GitHub storyworld repository** from this template, including Framework files alongside your own original writing, and allow normal sharing, collaboration, cloning and forking of your genuine creative project. This permission also works for commercial creative projects. **Your original fictional content remains yours** and should have its own sharing/rights terms; configure `CREATOR-CONTENT-RIGHTS.md` before inviting contributors or publishing your own fiction. You must retain Framework notices and may **not sell or repackage the Framework itself** as a competing template, toolkit, or hosted framework product.
