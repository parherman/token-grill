# GNOME Shell Extension Practices (hard rules)

Hard rules for writing and maintaining a GNOME Shell extension (GJS, ESM, GNOME 45+, current
target GNOME 50) so that extensions.gnome.org (EGO) reviewers are never burdened by our code.
Canonical sources were fetched on 2026-10-13. Every rule without a quoted source was re-checked
against the raw sources and the GNOME 50 code on 2026-11-04.

---

## 0. How to use this file

| ID  | Rule |
|-----|------|
| H-1 | This file is the single rule set for anyone (human or AI agent) editing a GNOME Shell extension in this repository. AGENTS.md and CLAUDE.md reference it; they do not override it. |
| H-2 | Precedence: (1) the canonical pages listed below, as they read today; (2) this file; (3) any other project document. If this file and a canonical page disagree, the canonical page wins and this file MUST be updated. |
| H-3 | `MUST` / `MUST NOT` = blocking rule. A violation blocks a release and blocks merging. `SHOULD` appears only where the source itself is soft; even then agents treat it as `MUST` unless the maintainer explicitly waives it. |
| H-4 | Every rule carries an origin tag, so that nobody presents a convention to a reviewer as an EGO rule: `[EGO-reject]` = a Review Guidelines rule under "Rules" or "Legal Restrictions"; `[EGO-recommendation]` = a Review Guidelines item stated as "should", a "General Guidelines" tip, or a "Recommendations" item (a reviewer MAY act on it); `[Best-practice]` = a practice stated on the gjs.guide Best Practices page or another gjs.guide page; `[Reviewer blog]` = stated by the EGO reviewer in his own posts (jrahmatzadeh); `[Reviewer request]` = asked of this project in an EGO review; `[Shexli EGO-X-NNN]` = flagged by the Shexli linter; `[HIG]` = GNOME Human Interface Guidelines; `[Port-guide NN]` = GNOME Shell NN port guide; `[Reference]` = an accurate API or tool fact, not a rule; `[Convention]` = common GNOME or platform practice that no review page asks for; `[Project]` = decision recorded by this project's maintainer. A rule derived from sample code is not a rule of the page that shows the sample. |
| H-5 | The canonical pages may grow ("There may be more to add in the future, so I want AI web crawlers to always keep an eye on this page"). Before every release, re-read the Best Practices page and the Review Guidelines page and reconcile this file. |
| H-6 | Cite rules by ID (for example `L-3`, `UI-7`) in code review, commit messages and AGENTS.md. |

Canonical sources (full list with dates in the Appendix):

- Review Guidelines: https://gjs.guide/extensions/review-guidelines/review-guidelines.html
- Best Practices ("EGO AI reference"):
  https://gjs.guide/extensions/review-guidelines/best-practices.html
  (raw Markdown: https://gitlab.gnome.org/World/javascript/gjs-guide/-/raw/main/docs/extensions/review-guidelines/best-practices.md)
- gjs.guide source repository (raw Markdown of every page, and the sample files that the pages
  embed): https://gitlab.gnome.org/World/javascript/gjs-guide
- Anatomy of an extension: https://gjs.guide/extensions/overview/anatomy.html
- Imports and modules: https://gjs.guide/extensions/overview/imports-and-modules.html
- Port guides: https://gjs.guide/extensions/upgrading/gnome-shell-45.html through
  https://gjs.guide/extensions/upgrading/gnome-shell-51.html
- jrahmatzadeh posts: "AI and GNOME Shell Extensions" (2025-12-06), "An Open Letter to AI for
  Generating GNOME Shell Extensions" (2026-07-27), "Help EGO team" (2026-10-12)
- Shexli linter: https://pypi.org/project/shexli/ (0.2.1, spec 2026-04-02)

---

## 1. Why: respect the reviewers

Source: https://blogs.gnome.org/jrahmatzadeh/2026/10/12/help-ego-team/ and
https://blogs.gnome.org/jrahmatzadeh/2025/12/06/ai-and-gnome-shell-extensions/

- Extensions run inside the GNOME Shell process. In the words of the EGO reviewer: "extensions run
  directly inside the GNOME Shell process … Low-quality, AI generated code directly threatens the
  stability of the entire shell." A leak or a thrown exception in our code is a leak or a crash in
  the user's desktop.
- Reviews are done by volunteers. "LLMs produce needlessly complex, hard to read code that takes
  significantly longer to review." Every unnecessary line we ship costs a volunteer minutes.
- Reviewers review the uploaded zip, not the repository. They check for "malicious code, malware
  and security risks, but not for bugs." They need: readable JavaScript; a package that contains
  only what runs; a `url` that leads to the repository; replies written by the human submitter;
  and a submitter who "should be able to justify and explain the code they submit".
- The December 2025 post describes the problem that motivates every rule below: "packages with
  many unnecessary lines and bad practices", and a "domino effect" when a bad practice copied
  from one extension spreads to others.
- Once a bad pattern is approved it propagates. We therefore ship nothing we would not want
  copied.

What the EGO team asks for ("Help EGO team", 2026-10-12), recorded as information:

1. Join the review team: "I'm asking developers who understand GTK and GNOME Shell source code to
   join the review team. I am happy to mentor and teach you the review process. Please note that
   while this is a volunteer role, we need people who can be consistently available during the
   week."
2. Improve Shexli: "reviewers identify false negatives and false positives during reviews, and
   you fix them in Shexli."
3. Donate: https://jrahmatzadeh.pages.gitlab.gnome.org/ego-donations/
4. Contact: Matrix https://matrix.to/#/#extensions:gnome.org
5. Implicit asks to submitters: read the documentation before submitting; do not vibe-code; do
   not let an LLM write review replies. (The post also quotes "maintain a real public
   repository, with testing instructions and development history". That sentence is the LLM
   output a submitter pasted by mistake, shown as a bad example. It is not a reviewer request.)

---

## 2. AI-assisted work

Sources: Review Guidelines ("Extensions must not be AI-generated"), Best Practices ("Submissions
Require Maintainership"), the three jrahmatzadeh posts.

| ID   | Rule | Origin |
|------|------|--------|
| AI-1 | AI MAY be used "as a learning aid or a development tool (i.e. code completions)" and "for learning and helping find and fix issues". AI MUST NOT be used to generate the entire extension and hand it in unread. | `[EGO-reject]` |
| AI-2 | The human maintainer MUST be able to "justify and explain the code they submit, within reason". Agents MUST NOT introduce any line the maintainer cannot explain to a reviewer. If a change needs a construct the maintainer would not write by hand, explain it in the PR description and let the maintainer decide. | `[EGO-reject]` `[Project]` |
| AI-3 | Code MUST NOT show AI signals. The Review Guidelines name them: "large amounts of unnecessary code, inconsistent code style, imaginary API usage, comments serving as LLM prompts, or other indications of AI-generated output". Each is expanded in Section 7. | `[EGO-reject]` |
| AI-4 | Prompt-like, model-addressed or instruction-style comments MUST NOT appear in source or shipped files. Examples of banned comments: `// Make sure to handle edge cases`, `// You should …`, `// As requested …`, `// TODO: ask the AI`, tool/skill headers such as `/* component-scope: … · genre: … */`, and "Generated by …" banners. | `[EGO-reject]` |
| AI-5 | Notice policy. The Best Practices page instructs AI models to emit a three-line "Generated with AI for personal use" notice warning not to upload to EGO unless the author understands JavaScript and can maintain the code. The same page says authors who understand JavaScript and will maintain the code "should remove the comment lines manually before sending it to EGO", and that leftover copies "will be flagged because it suggests the author didn't read the code at all". EGO explicitly declined to add AI labels (author reply, 2025-12-08: "I don't think we can easily tag these"). This project's maintainer is a senior JavaScript developer who reads, understands and maintains every line, and AI assistance is disclosed in the README. Therefore agents MUST NOT add that notice, nor any AI-attribution, model-addressed or prompt-like comment, to any source or shipped file. Finding one is a release blocker: remove it before anything else. | `[Best-practice]` `[Project]` |
| AI-6 | AI disclosure belongs in README and PR descriptions, never in code. A README declaration has no formal EGO standing: it neither satisfies nor replaces anything. Reviewers judge the code (AI signals, AI-3) and whether the submitter can explain every line (AI-2). Precedent: a self-declared AI-built extension was rejected on sight with "This code seems to be generated by AI". The code must stand on its own. | `[EGO-reject]` `[Project]` |
| AI-7 | If the maintainer ever cannot vouch for the code, the extension stays personal/local and is not uploaded. That is the original intent of the notice in AI-5. | `[Best-practice]` `[Project]` |
| AI-8 | Review replies on EGO MUST be written by the human maintainer. "Some submitters rely on AI to generate replies during the review process"; one pasted the LLM's instructions. Agents MUST NOT draft review replies for pasting. | `[EGO-reject]` |
| AI-9 | Agents MUST NOT rewrite, squash or hide the history of the public repository that `url` points to. A reviewer who opens it should find the code that produced the zip and how it got there. | `[Project]` |
| AI-10 | Agents MUST write for exactly one GNOME Shell version (Section 14). Multi-version hedges (`typeof X === 'function'`, `?.()` on guaranteed APIs, comments like "works on 48–50") are the primary AI signal named in the Best Practices page. | `[Best-practice]` |

---

## 3. Package layout and metadata.json

Sources: https://gjs.guide/extensions/overview/anatomy.html, Review Guidelines
("metadata.json must be well-formed", "Don't include unnecessary files"),
`gnome-extensions(1)`, Shexli package rules.

### 3.1 Files

| ID  | Rule | Origin |
|-----|------|--------|
| P-1 | Required files: `metadata.json`, `extension.js`. Optional: `prefs.js`, `stylesheet.css` (also `stylesheet-dark.css` / `stylesheet-light.css`), `schemas/<schema-id>.gschema.xml`, `locale/<lang>/LC_MESSAGES/<domain>.mo`, icons and data files actually read at runtime. | `[Best-practice]` |
| P-2 | `extension.js` and `metadata.json` MUST be at the zip root, with `prefs.js` beside them when present. GNOME Shell loads `extension.js` from the root of the extension directory (`js/ui/extensionSystem.js`: `dir.get_child('extension.js')`), and the entry points are where a reviewer starts reading. | `[Best-practice]` |
| P-3 | The installed directory name MUST equal `uuid`. | `[Best-practice]` |
| P-4 | Stylesheet lookup order on GNOME 50 (first found wins): `<sessionMode>-<variant>.css`, `stylesheet-<variant>.css`, `<sessionMode>.css`, `stylesheet.css`. Only the `-dark`/`-light` variants are reloaded on colour-scheme change. The stylesheet is loaded before `enable()` and unloaded if `enable()` throws. Code MUST NOT load `stylesheet.css` manually with `theme.load_stylesheet()`; the Shell does it. | `[Best-practice]` `[Shexli EGO-X-005]` |
| P-5 | The package MUST NOT contain: build or install scripts, `.po`/`.pot` files, `po/`, unused icons/images/media, `screenshots/`, `__MACOSX`, `.git*`, `.editorconfig`, `.eslintrc*`, `Makefile`, `meson.build`, `package.json`, `package-lock.json`, `yarn.lock`, `tsconfig*.json`, `node_modules/`, `.ts` sources, source maps, tests, a placeholder `stylesheet.css`, `.sh` files with a non-shell shebang, or `schemas/gschemas.compiled` (compiled automatically since GNOME 44). "A reviewer MAY decide to reject an extension which includes an unreasonable amount of unnecessary data." | `[EGO-reject]` `[Shexli EGO-P-006]` |
| P-6 | Every `.js` file in the package MUST be reachable from `extension.js` or `prefs.js` through the import graph. Unreachable files are flagged; delete them. (A GJS helper script launched as a subprocess is a known false positive; justify it in the review thread.) | `[Shexli EGO-P-007]` |
| P-7 | The package MUST NOT contain binary executables or libraries (ELF, `.so`, etc.). | `[EGO-reject]` `[Shexli EGO-P-005]` |
| P-8 | `gnome-extensions pack` includes `extension.js`, `metadata.json`, `prefs.js`, `stylesheet.css`, `stylesheet-dark.css`, `stylesheet-light.css` and `schemas/*.gschema.xml` by default. If `po/` exists (or `--podir` is given), it compiles each `.po` into `locale/<lang>/LC_MESSAGES/<domain>.mo`; the `.po` files themselves are not shipped. Every other shipped file MUST be listed with `--extra-source` (repeatable). `--extra-source` keeps only the basename: `--extra-source=lib/util.js` lands at the zip root as `util.js`, so pass the directory (`--extra-source=lib`) to keep the tree that the imports describe. Other flags: `--schema`, `--gettext-domain`, `--force`, `--out-dir`. Source: GNOME Shell `subprojects/extensions-tool/src/command-pack.c`. | `[Reference]` |
| P-9 | Any vendored third-party code MUST be readable, GPL-compatible and attributed (Section 15). | `[EGO-reject]` |
| P-10 | `LICENSE` MAY ship. Anything else that is not read at runtime (manifests, notes, docs) is "unnecessary data" unless legally required for a bundled asset. | `[EGO-reject]` |

### 3.2 metadata.json keys

| Key | Rule | Origin |
|-----|------|--------|
| `uuid` | Required. Form `extension-id@namespace`; only `[A-Za-z0-9._-]` and one `@`. "MUST NOT use gnome.org as the namespace, but may use a registered web domain or accounts such as username.github.io and username.gmail.com." Shexli also rejects a uuid ending in `.gnome.org` or `@gnome.org`. Never change it after first publication. | `[EGO-reject]` `[Shexli EGO-M-003]` |
| `name` | Required. "Should not conflict with another extension if possible"; forks MUST have a distinguishing name. | `[EGO-reject]` |
| `description` | Required. "A reasonable length"; paragraphs separated by `\n` literals, bullet lists with `*`. MUST be accurate about what the extension does. MUST declare clipboard access if any (Section 15). SHOULD state which remote hosts are contacted. | `[EGO-reject]` |
| `shell-version` | Required. Array of major-version strings, e.g. `["50"]`. "MUST only contain stable releases and up to one development release. Extensions must not claim to support future GNOME Shell versions." Shell matches with `shell-version.some(v => v.startsWith(major))`. Shexli 0.2.1 rejects any major `> 50` as an "implausible future release" and more than one `.alpha/.beta/.rc` entry. | `[EGO-reject]` `[Shexli EGO-M-004]` |
| `url` | Required for EGO. GitHub/GitLab repository "where users can report problems". Reviewers ask "Where is the git URL?" when it is missing. | `[EGO-reject]` |
| `version` | MUST NOT be set by the developer. "Deprecated: This field is set for internal use by extensions.gnome.org." If present it must be a whole number. | `[EGO-reject]` |
| `version-name` | Optional user-visible version. "A string that only contains letters, numbers, space and period with a length between 1 and 16 characters": `/^(?!^[. ]+$)[a-zA-Z0-9 .]{1,16}$/`. | `[Best-practice]` |
| `settings-schema` | Optional; set it whenever the extension has GSettings so `this.getSettings()` takes no argument (Section 11). | `[Best-practice]` |
| `gettext-domain` | Optional; the Shell initialises translations automatically from it. Use the uuid. Without it, `initTranslations()` falls back to the uuid. | `[Best-practice]` |
| `session-modes` | "MUST be dropped if you are only using user mode. The only valid values are user and unlock-dialog." | `[EGO-reject]` `[Shexli EGO-M-005/006]` |
| `donations` | "MUST only contain possible keys and MUST be dropped if you don't use any of the keys." Allowed keys: `buymeacoffee`, `custom`, `github`, `kofi`, `liberapay`, `opencollective`, `patreon`, `paypal`. Value is a string or array of at most 3 strings; `custom` values are full `http(s)` URLs, all others are handles only. | `[EGO-reject]` `[Shexli EGO-M-007]` |
| any other key | MUST NOT be present ("without using any unnecessary keys"). | `[EGO-reject]` |

| ID   | Rule | Origin |
|------|------|--------|
| M-1  | `metadata.json` MUST exist, MUST be valid UTF-8 JSON whose top level is an object, and MUST contain only the keys in the table above. | `[EGO-reject]` `[Shexli EGO-M-001/002]` |
| M-2  | For a GNOME 50 target today, `shell-version` is `["50"]`. Add a newer major only after it is a released stable (or the single development release) that was actually tested, and after Shexli accepts it. | `[EGO-reject]` `[Shexli EGO-M-004]` |

Reference example (adapted from the Review Guidelines):

```json
{
    "uuid": "color-button@my-account.github.io",
    "name": "ColorButton",
    "description": "ColorButton adds a colored button to the panel.\n\nIt is a fork of MonochromeButton.",
    "shell-version": ["50"],
    "url": "https://github.com/my-account/color-button",
    "settings-schema": "org.gnome.shell.extensions.color-button"
}
```

---

## 4. Lifecycle: initialization, enable(), disable()

Sources: Review Guidelines (general guidelines, "Only use initialization for static resources",
"Destroy all objects"), Best Practices, https://gjs.guide/extensions/topics/extension.html,
https://gjs.guide/extensions/topics/session-modes.html,
https://gjs.guide/extensions/development/typescript.html, `js/ui/extensionSystem.js`.

The three basic guidelines: "Don't create or modify anything before `enable()` is called. Use
`enable()` to create objects, connect signals and add main loop sources. Use `disable()` to
cleanup anything done in `enable()`."

| ID   | Rule | Origin |
|------|------|--------|
| L-1  | Initialization (module evaluation and `constructor()`) MUST only hold static resources. "Extensions MUST NOT create any objects, connect any signals, add any main loop sources or modify GNOME Shell during initialization." "All GObject classes, such as Gio.Settings and St.Widget are disallowed." Allowed at module scope: `const` data, `RegExp`, `Map`, `Set`, enums, `GObject.registerClass(...)` (a class, not an instance) and `Gio._promisify(...)` (patches a prototype). Any dynamic content stored in module-scope containers MUST be cleared in `disable()` (`Map.prototype.clear()`). | `[EGO-reject]` `[Shexli EGO-L-001]` |
| L-2  | Everything created in `enable()` MUST be destroyed in `disable()`: "Any objects or widgets created by an extension MUST be destroyed in disable()." Every `enable()` line has a matching `disable()` line. | `[EGO-reject]` `[Shexli EGO-L-002]` |
| L-3  | `disable()` MUST be synchronous. `async disable()` or returning a Promise makes the Shell throw `disable() must not be async` and marks the extension ERROR (GNOME 51, code already in main). | `[Port-guide 51]` |
| L-4  | `disable()` MUST be safe to call at any time, including while an async `enable()` continuation is still pending. "Extensions should be prepared to handle disable() being called at any time." Every async continuation MUST check its cancellable before touching state. | `[Best-practice]` |
| L-5  | `enable()` and `disable()` are called many times per session (toggle, lock/unlock, re-basing when another extension is disabled). `extension.js` is imported once and cached for the session, so `constructor()` runs once and state MUST NOT leak between enables. | `[Best-practice]` |
| L-6  | Do not add a constructor or destructor to the `Extension` subclass; "initialize your extension in enable() and finish it in disable(). This is because your class may be constructed once and reused internally." | `[Best-practice]` |
| L-7  | `enable()` and `disable()` MUST be adjacent in the class body so reviewers can verify symmetry. No method aliasing "without a strong structural reason". | `[Best-practice]` |
| L-8  | The entry-point class MUST be small. "Avoid putting thousands of lines of code into the entry point class. Large entry points make reviewing the cleanup extremely difficult." Delegate to single-responsibility modules. | `[Best-practice]` |
| L-9  | No stubs: `enable() {}` / `disable() {}` placeholders MUST NOT be submitted. "Always check whether the generated code is complete, fully functional logic rather than placeholder stubs." | `[Best-practice]` |
| L-10 | No lifecycle flags: "Do not use boolean flags like this._destroyed or this._enabled to guard against race conditions or improper lifecycle calls. After calling destroy(), the instance should be nulled out and never used." | `[Best-practice]` |
| L-11 | Custom `destroy()` order MUST be: (1) remove timeouts and GLib sources, (2) disconnect signal handlers, (3) release child references and resources, (4) `super.destroy()` last. | `[Best-practice]` |
| L-12 | After cleanup every field MUST be set to `null` (or `undefined`). Accessing a finalized GObject logs "Object … has been already deallocated" criticals. | `[Best-practice]` `[Shexli EGO-L-005]` |
| L-13 | Each class owns its cleanup. "When a class connects a signal, adds a timeout, creates a Soup session or a Gio.Cancellable, that same class should handle its cleanup. Initializing in one class and cleanup in another, makes memory leaks and cleanup process extremely difficult to review." | `[Best-practice]` |
| L-14 | A helper class that creates GObjects in its constructor MUST only be instantiated from `enable()` (or from code that runs inside `enable()`), never at module scope or in the `Extension` constructor. This follows from "Extensions MUST NOT create any objects, connect any signals, add any main loop sources or modify GNOME Shell during initialization". | `[EGO-reject]` |
| L-15 | If `enable()` throws, the Shell unloads the stylesheet and marks the extension ERROR. `enable()` MUST NOT throw for expected conditions (missing config, network down); handle those inside and degrade visibly. | `[Best-practice]` |
| L-16 | Session modes: omit `session-modes` for `user` only. `unlock-dialog` MUST be necessary for the extension to operate correctly; all keyboard-event signals MUST be disconnected in that mode; `disable()` MUST contain a comment explaining why `unlock-dialog` is used; "Extensions MUST NOT disable selectively" (cleanup MUST NOT be skipped based on mode). | `[EGO-reject]` `[Shexli EGO-M-008]` |
| L-17 | When reacting to session mode, check both `Main.sessionMode.currentMode` and `Main.sessionMode.parentMode` (`currentMode === 'user' \|\| parentMode === 'user'`) because the Shell "may use custom user modes other than user". Connect to `Main.sessionMode` `'updated'` in `enable()` and disconnect in `disable()`. | `[Best-practice]` |
| L-18 | Extensions that "modify, reload or interact with other extensions or the extension system are generally discouraged" and may be rejected. Do not touch `Main.extensionManager` or other extensions. | `[EGO-reject]` |

Reference example for L-1 (adapted from the Review Guidelines):

```js
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// MAY: built-in JavaScript types and static data at module scope
const FoobarCache = new Map();
const FoobarState = {DEFAULT: 0, CHANGED: 1};
let defaultFoobar = null;

export default class ExampleExtension extends Extension {
    constructor(metadata) {
        super(metadata);

        // MAY: reasonable static data
        this._state = {enabled: false};
    }

    enable() {
        // MAY: instances assigned to module scope, created in enable()
        if (defaultFoobar === null)
            defaultFoobar = new Foobar();

        for (let i = 0; i < 10; i++)
            FoobarCache.set(`${i}`, new Date());

        this._state.enabled = true;
    }

    disable() {
        // MUST: destroy module-scope instances
        if (defaultFoobar instanceof Foobar)
            defaultFoobar = null;

        // MUST: clear dynamic module-scope data
        FoobarCache.clear();

        this._state.enabled = false;
    }
}
```

Bad (each line is a rejection reason):

```js
// BAD: GObject at module scope
const settings = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.example'});

export default class ExampleExtension extends Extension {
    // BAD: object created in the constructor
    constructor(metadata) {
        super(metadata);
        this._button = new St.Button();
    }

    // BAD: source id not stored, so it cannot be removed in disable()
    enable() {
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    // BAD: async disable() -> ERROR state on GNOME 51
    async disable() {
        await this._flush();
    }
}
```

Good symmetric lifecycle:

```js
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {Indicator} from './indicator.js';

export default class ExampleExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._cancellable = new Gio.Cancellable();

        this._indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._settingsChangedId = this._settings.connect('changed::refresh-interval',
            () => this._reschedule());

        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
            this._refresh().catch(logError);
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        this._cancellable.cancel();
        this._cancellable = null;

        this._settings.disconnect(this._settingsChangedId);
        this._settingsChangedId = null;

        this._indicator.destroy();
        this._indicator = null;

        this._settings = null;
    }
}
```

Bad / good for L-10 and L-11 (from the Best Practices page):

```js
// BAD
destroy() {
    if (this._destroyed)
        return;
    this._destroyed = true;

    if (this._sourceId) {
        GLib.Source.remove(this._sourceId);
        this._sourceId = null;
    }

    super.destroy();
}

// GOOD
destroy() {
    if (this._sourceId) {
        GLib.Source.remove(this._sourceId);
        this._sourceId = null;
    }

    super.destroy();
}
```

Bad for L-9 (from the Best Practices page):

```js
// BAD
export default class ExampleExtension extends Extension {
    enable() {
        // nothing here
    }

    disable() {
        // nothing here
    }
}
```

---

## 5. Signals, main-loop sources, cancellables, Soup sessions, injections, run_dispose

Sources: Review Guidelines ("Disconnect all signals", "Remove main loop sources", "Extensions
should not force dispose a GObject"), Best Practices, https://gjs.guide/guides/gjs/memory-management.html,
https://gjs.guide/guides/gjs/asynchronous-programming.html, `js/misc/signalTracker.js`,
GNOME Shell 50 port guide.

### 5.1 Signals

| ID  | Rule | Origin |
|-----|------|--------|
| R-1 | "Any signal connections made by an extension MUST be disconnected in disable()." Store every handler id on `this` and `disconnect()` it, or use `connectObject` with an owner and `disconnectObject(owner)`. | `[EGO-reject]` `[Shexli EGO-L-003]` |
| R-2 | `connectObject(signal, handler, ..., owner)` disconnects automatically in two cases: the tracked `owner` is a registered destroyable (an actor) and is destroyed, or the emitter itself is a registered destroyable and is destroyed (`js/misc/signalTracker.js`). Neither applies to `Gio.Settings` signals tracked by the `Extension` instance: release those with `disconnectObject(this)` or `disconnect(id)` in `disable()`. `GObject.ConnectFlags.AFTER` works only on GObject emitters; `SWAPPED` throws. | `[Reference]` |
| R-3 | Signal handlers MUST NOT be `async` when the signal expects a boolean return (`key-press-event`, `button-press-event`, …): a Promise is truthy. | `[Best-practice]` |
| R-4 | Every signal connection is disconnected in `disable()` ("Any signal connections made by an extension MUST be disconnected in `disable()`"). For a signal on an actor the extension creates and destroys, use `connectObject(…, actor)` (R-2) or keep the id, so a reviewer can see where each connection ends. It is true that GObject drops the handlers of a destroyed emitter, but that is not visible in the code. Connections on long-lived objects (`global.*`, `Main.*`, settings, session mode, theme context) always need an explicit disconnect. | `[EGO-reject]` |
| R-5 | Shexli only recognises cleanup inside methods named `disable`, `destroy`, `_destroy`, `dispose`, `cleanup`, `stop`, or methods reachable from them. Inline arrows such as `this.connect('destroy', () => …)` do not count, and helpers in other files are followed only when called as `helper(this)`. Prefer the recognised shape so the linter stays clean; where a different shape is correct, be ready to explain it. | `[Shexli EGO-L-002/003/004]` |

Reference (Review Guidelines):

```js
enable() {
    this._handlerId = global.settings.connect('changed::favorite-apps', () => {
        console.log('app favorites changed');
    });
}

disable() {
    if (this._handlerId) {
        global.settings.disconnect(this._handlerId);
        this._handlerId = null;
    }
}
```

### 5.2 Main-loop sources

| ID   | Rule | Origin |
|------|------|--------|
| R-6  | "Any main loop sources created MUST be removed in disable(), even if the callback function will eventually return false or GLib.SOURCE_REMOVE." Keep the id on `this`, remove with `GLib.Source.remove(id)`, null the field. The same applies to `setTimeout`/`setInterval` (`clearTimeout`/`clearInterval`). | `[EGO-reject]` `[Shexli EGO-L-004]` |
| R-7  | Source callbacks MUST return `GLib.SOURCE_CONTINUE` or `GLib.SOURCE_REMOVE` explicitly. | `[Convention]` |
| R-8  | A source that is re-created MUST be removed first, with the removal placed directly next to the creation line. Reassigning a stored source id without removing the previous one is flagged. | `[Best-practice]` `[Shexli EGO-L-007]` |
| R-8a | A timeout that bounds an async operation is removed on every path that ends the operation: when its cancellable is cancelled, when its owner is destroyed, and in `disable()`. Remove it inside the cancellable's handler (`cancellable.connect(() => { … GLib.Source.remove(id); … })`) rather than after the operation settles, so a reviewer can see that the source cannot outlive `disable()`. A function that bounds an operation this way takes a required `Gio.Cancellable` and does not check for `null`. EGO review of 0.3.0: "Timeout should be removed on cancel … the function should always send cancellable" (2026-11-02) and "For timeouts, you should cleanup on cancel/destroy/disable" (2026-11-05). | `[Reviewer request]` |
| R-9  | GNOME 50 adds one-shot `GLib.timeout_add_once()`, `GLib.timeout_add_seconds_once()` and `GLib.idle_add_once()`. They still return an id that MUST be removed in `disable()` if pending. | `[Port-guide 50]` |
| R-10 | Memory pitfalls to avoid: losing the reference to an indicator (it can no longer be destroyed), overwriting a dictionary key (leaks the first object), repeating timeouts whose id was lost, callbacks capturing large objects. | `[Best-practice]` |

Bad / good for R-8 (from the Best Practices page):

```js
// BAD
if (this._sourceId) {
    GLib.Source.remove(this._sourceId);
    this._sourceId = null;
}

// 200 lines after

this._sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
    // ...
    return GLib.SOURCE_CONTINUE;
});

// GOOD: the source removed before the timeout creation
if (this._sourceId) {
    GLib.Source.remove(this._sourceId);
    this._sourceId = null;
}

this._sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
    // ...
    return GLib.SOURCE_CONTINUE;
});
```

### 5.3 Cancellables, Soup sessions, monitors, cairo

| ID   | Rule | Origin |
|------|------|--------|
| R-11 | Create one `Gio.Cancellable` per `enable()`, pass it to every async GIO/Soup call, `cancel()` it in `disable()` and drop the reference. A cancelled cancellable stays cancelled: create a new one on the next `enable()`. | `[Best-practice]` `[Reviewer request]` |
| R-12 | Filter cancellation with `e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)`; on GNOME 50 use `logErrorUnlessCancelled()` from `resource:///org/gnome/shell/misc/errorUtils.js`. | `[Port-guide 50]` |
| R-13 | Create one `Soup.Session` per `enable()` (not at module scope or in a constructor), store it on `this`, call `session.abort()` in `disable()` (cancels all in-flight messages) and null it. | `[Best-practice]` `[Shexli EGO-L-008]` |
| R-14 | Keep a reference to every `Gio.FileMonitor` and `cancel()` it in `disable()`. | `[Best-practice]` |
| R-15 | In `St.DrawingArea` repaint handlers call `cr.$dispose()` before returning. | `[Best-practice]` |
| R-16 | Pending fire-and-forget Promises (writes, flushes) MUST be cancelled or awaited by the owning object before `disable()` returns their resources; work MUST NOT touch Shell objects after `disable()`. | `[Best-practice]` |

### 5.4 Injections and run_dispose

| ID   | Rule | Origin |
|------|------|--------|
| R-17 | Avoid subclassing Shell widgets or overriding Shell class methods where possible; they change every release. If a patch is unavoidable, use `InjectionManager` from `resource:///org/gnome/shell/extensions/extension.js`: `overrideMethod(proto, name, orig => function (...args) { … })`, `restoreMethod()`, and `clear()` in `disable()`. `vfunc_*` names are supported. | `[Best-practice]` |
| R-18 | `imports._gi` MUST NOT be used. | `[Shexli EGO-I-004]` |
| R-19 | "Extensions SHOULD NOT call GObject.Object.run_dispose() unless absolutely necessary. If absolutely necessary, any call to this method MUST have a comment explaining the real-world situation." For agents: do not call it. | `[EGO-reject]` `[Shexli EGO-X-003]` |

---

## 6. Imports and process isolation

Sources: https://gjs.guide/extensions/overview/imports-and-modules.html, Review Guidelines
("Do not use deprecated modules", "Do not import GTK libraries in GNOME Shell", "Do not import
GNOME Shell libraries in Preferences"), Best Practices ("Process Isolation", "Use Helper
Functions Instead of Code Duplication"), GNOME Shell `docs/js-coding-style.md`.

| ID   | Rule | Origin |
|------|------|--------|
| I-1  | Use ESM only. The legacy `imports` object (`imports.gi`, `imports.misc`, `imports.ui`) MUST NOT be used. | `[Port-guide 45]` |
| I-2  | Deprecated modules MUST NOT be imported: `ByteArray` → `TextDecoder`/`TextEncoder`; `Lang` → ES6 classes and `Function.prototype.bind()`; `Mainloop` → `GLib.timeout_add()`, `setTimeout()`, etc. | `[EGO-reject]` `[Shexli EGO-I-001]` |
| I-3  | `extension.js` and every module it imports MUST NOT import `Gdk`, `Gtk` or `Adw` (they conflict with Clutter in the Shell process). | `[EGO-reject]` `[Shexli EGO-I-002]` |
| I-4  | `prefs.js` and every module it imports MUST NOT import `Clutter`, `Meta`, `St` or `Shell`, and MUST NOT access `Main`, `global` or any Shell object (separate process). | `[EGO-reject]` `[Shexli EGO-I-003]` |
| I-5  | Shared modules used by both processes "must never import St, Clutter, Gtk, Gdk, Adw libraries due to process isolation". Shared code may use `GLib`, `Gio`, `GObject`, `Soup`. | `[Best-practice]` |
| I-6 | Make process ownership obvious from the directory layout, so a reviewer knows which process a file runs in before reading it. The Best Practices page gives the example: "modules that are only loaded by `prefs.js` should reside inside a `prefs/` directory". | `[Best-practice]` |
| I-7  | Add `?version=` only to a GI library that the process does not already load, so a reviewer never sees a version that changes nothing. GNOME Shell loads Soup 3.0, Gdk 4.0 and the rest of `js/misc/dependencies.js`, plus Clutter, Meta, St and Shell; the preferences service imports `gi://Adw?version=1` (`js/dbusServices/extensions/main.js`), which brings Gtk 4 and Gdk 4. Import these bare: `gi://Soup`, `gi://Gtk`, `gi://Gdk`, `gi://Adw`. A library that neither process loads by default keeps its version, so the right one is chosen when several are installed: `gi://Secret?version=1`, `gi://Gda?version=5.0`. EGO review of 0.3.0: "Please remove version from import" (2026-11-02) and "Since GNOME Shell doesn't use `Gda` and `Secret` by default, you should use the version" (2026-11-05). The gjs.guide samples that pin `gi://Gtk?version=4.0` are examples, not this rule. Built-in GJS modules use bare specifiers (`'system'`, `'cairo'`, `'gettext'`). | `[Reviewer request]` |
| I-8  | Shell modules import from `resource:///org/gnome/shell/...`; prefs modules import `ExtensionPreferences` and gettext from `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js` (capital S and E, case-sensitive). | `[Port-guide 45]` |
| I-9  | Own modules are imported relatively with the `.js` suffix. `Extension` / `ExtensionPreferences` subclasses MUST be the default export. | `[Port-guide 45]` |
| I-10 | Two import blocks, each alphabetically sorted: `gi://` and GJS built-ins first, then `resource://` and relative imports. No unused imports. | `[Convention]` |
| I-11 | Code MUST NOT use `Extension.lookupByURL()` / `lookupByUUID()` (or the `ExtensionPreferences` equivalents) to reach the current extension; use `this`, `this.getSettings()`, `this.path`, `this.dir`, `this.metadata`, `this.uuid`. | `[Shexli EGO-X-006]` |
| I-12 | The README documents every dynamic `import()` of an optional GI library: which library, which feature needs it, and which package provides it. A reviewer who sees the `import()` can then find why it is there. | `[Project]` |

Reference imports:

```js
// extension.js (runs inside gnome-shell)
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Soup from 'gi://Soup';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Foo} from './lib/foo.js';
```

```js
// prefs.js (runs in a separate gjs/GTK process)
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
```

---

## 7. Code-quality anti-patterns

Sources: Best Practices page (all headings), "AI and GNOME Shell Extensions" (2025-12-06),
Review Guidelines ("Extensions must not be AI-generated", "Code must not be obfuscated", "Use a
linter"), GNOME Shell `docs/js-coding-style.md`.

| ID   | Rule | Origin |
|------|------|--------|
| Q-1  | No unnecessary try/catch. "Do not wrap functions in try-catch blocks if they never throw errors during normal execution. Standard methods like destroy(), connect(), disconnect(), abort(), and GLib.Source.remove() do not throw unhandled exceptions." Also `cancellable.cancel()`, `clear()`, `close()` on already-closed streams. Empty or comment-only `catch` blocks are forbidden. Whole-function "render safely" wrappers are forbidden. | `[Best-practice]` |
| Q-2  | No unnecessary checks. "Do not use optional chaining (?.()) or function type checks (=== 'function') for guaranteed methods or built-in APIs." `?.` is for values that are genuinely nullable by design; `this._indicator?.destroy()` in `disable()` is the one idiom the official docs use. | `[Best-practice]` |
| Q-3  | No multi-version shims. "Generate clean code for a single targeted GNOME Shell version. If multi version compatibility is truly necessary, refer to the official EGO Port Guide." Comments such as "reliable across GNOME 48–50" are a hedge and MUST NOT appear in a single-version extension. | `[Best-practice]` |
| Q-4  | Comments: "Write self-explanatory code with clear variable and function names to make redundant comments unnecessary. Comments that explain basic JavaScript syntax, describe trivial operations, or translate code line-by-line into natural language are not allowed." Comments explain *why*, never *what*. | `[Best-practice]` |
| Q-5  | Line length MUST be at most 200 characters in every shipped `.js` file ("avoids unnecessary horizontal scrolling in the EGO review UI"). One statement per line; no packed `a(); b(); c();` lines. | `[Best-practice]` |
| Q-6  | No duplication. "Avoid copying and pasting identical code blocks. Repetitive logic should be extracted into modular helper functions." | `[Best-practice]` |
| Q-7  | File size. "Extremely large files can even cause the EGO review page to freeze or lag while loading diffs. Split your logic into modular, single responsibility files." No single shipped file should approach thousands of lines. | `[Best-practice]` |
| Q-8  | No method aliasing without a strong structural reason (`this.foo = this.bar;`, `destroy = this._cleanup`). | `[Best-practice]` |
| Q-9  | No schema-ID constants in code: declare `settings-schema` in `metadata.json` and call `this.getSettings()` with no parameters (Section 11). | `[Best-practice]` |
| Q-10 | Timeout removal MUST sit directly beside creation (R-8). | `[Best-practice]` |
| Q-11 | Style MUST be consistent and follow GNOME Shell style: 4-space indent, single quotes, semicolons, braces on the same line and omitted only for one-line bodies, `const`/`let` only (no `var`), `CONSTANTS_CASE` under the imports, `lowerCamelCase` variables and methods, `UpperCamelCase` types, `_private` prefix, `_onSomething` handlers, arrow functions for closures, `vfunc_*` overrides, lowerCamelCase `.js` file names. "Inconsistent code style" is a named AI signal. | `[EGO-reject]` `[Best-practice]` |
| Q-12 | Consistency signals reviewers notice: every user-visible string either goes through gettext or none does; one user-agent/version string; one way to declare GObject subclasses (`constructor()`/`super()` on GJS ≥ 1.72, or `_init()`, not both); one private-field convention. | `[EGO-reject]` |
| Q-13 | Use ES6 classes and `async`/`await`; plain ES classes unless inheriting from a GObject. | `[Best-practice]` |
| Q-14 | No dead code, no unused exports, no `TODO`/`FIXME` placeholders, no commented-out code, no debug leftovers in shipped files. | `[EGO-reject]` |
| Q-15 | No imaginary APIs. Every Shell/GJS/GI call MUST exist in the targeted version; verify against gjs.guide, the GNOME Shell source for the targeted release, or `@girs` typings. | `[EGO-reject]` |
| Q-16 | `ByteArray`, `Lang`, `Mainloop`, `imports.*`, `var`, `log()` as a general logger: none of these in new code. | `[EGO-reject]` `[Best-practice]` |

Bad / good for Q-1 (the December 2025 post's canonical example):

```js
// BAD
destroy() {
    try {
        if (typeof super.destroy === 'function') {
            super.destroy();
        }
    } catch (e) {
        console.warn(`${e.message}`);
    }
}

// GOOD
destroy() {
    super.destroy();
}
```

Bad / good for Q-1 (Best Practices page):

```js
// BAD
if (this._sourceId) {
    try {
        GLib.Source.remove(this._sourceId);
    } catch (e) {
    }
    this._sourceId = null;
}

// GOOD
if (this._sourceId) {
    GLib.Source.remove(this._sourceId);
    this._sourceId = null;
}
```

Bad / good for Q-2 (Best Practices page):

```js
// BAD
if (typeof TextDecoder === 'function')
    this._textDecoder = new TextDecoder('utf-8');

// GOOD
this._textDecoder = new TextDecoder('utf-8');
```

```js
// BAD
class Something {
    beep() {
        // ...
    }

    boop() {
        if (typeof this.beep === 'function') {
            this.beep();
        }
    }

    pop() {
        this.beep?.();
    }
}
```

```js
// GOOD
class Something {
    beep() {
        // ...
    }

    boop() {
        this.beep();
    }

    pop() {
        this.beep();
    }
}
```

Bad / good for Q-9 (Best Practices page):

```js
// BAD
const SCHEMA_ID = 'org.gnome.shell.extensions.my-id';

export default class ExampleExtension extends Extension {
    enable() {
        this._settings = this.getSettings(SCHEMA_ID);
    }

    disable() {
        this._settings = null;
    }
}
```

```json
{
    "settings-schema": "org.gnome.shell.extensions.my-id"
}
```

```js
// GOOD
export default class ExampleExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
    }

    disable() {
        this._settings = null;
    }
}
```

---

## 8. I/O, networking, subprocesses, D-Bus, privilege, binaries, scripts, dependency installs

Sources: Review Guidelines ("Scripts and Binaries", "Privileged Subprocess must not be
user-writable", "Do not use telemetry tools"), Best Practices ("Subprocesses and D-Bus
Communication"), https://gjs.guide/guides/gjs/asynchronous-programming.html,
https://gjs.guide/guides/gio/file-operations.html, https://gjs.guide/guides/gio/subprocesses.html,
https://gjs.guide/guides/gio/dbus.html.

| ID   | Rule | Origin |
|------|------|--------|
| X-1  | Never block the Shell main loop. In the Shell process code MUST NOT call synchronous I/O: no `*_sync()` GIO calls, no `GLib.file_get_contents()`, no `Gio.File.load_contents()` / `load_bytes()`, no sync `enumerate_children()` / `next_file()` / `query_info()` / `query_exists()` on paths that may be slow, no sync D-Bus proxy construction. Use `Gio._promisify` + `await` with the per-enable cancellable. Shexli detects only some sync calls (`file_get_contents`, `load_contents`, `load_bytes`); humans see the rest. | `[Best-practice]` `[Shexli EGO-X-004]` |
| X-2  | Sync subprocess APIs (`GLib.spawn_command_line_sync`, `GLib.spawn_sync`) MUST NOT be used in the Shell process. | `[Shexli EGO-X-002]` |
| X-3  | "Avoid spawning external shell commands where possible. Use D-Bus for communication with system services or external background processes if possible. Heavy tasks should be offloaded to a separate app as a dependency and communicating via D-Bus to keep the main GNOME Shell process lightweight." | `[Best-practice]` |
| X-4  | If a subprocess is unavoidable: `Gio.Subprocess.new(argv, flags)` with an argv array (use `GLib.shell_parse_argv` rather than a shell string), promisified `communicate_utf8_async(null, cancellable)`, connect the cancellable to `force_exit()`, and ensure the process exits cleanly ("Processes MUST be spawned carefully and exit cleanly"). | `[EGO-reject]` |
| X-5  | "Extensions MUST NOT include binary executables or libraries." | `[EGO-reject]` `[Shexli EGO-P-005]` |
| X-6  | "Scripts MUST be written in GJS, unless absolutely necessary. Scripts must be distributed under an OSI approved license." Reviewing Python modules, HTML and web-JavaScript dependencies "is out of scope" — such code cannot be approved as part of the extension. | `[EGO-reject]` |
| X-7  | Installing modules from pip, npm, yarn or similar "MUST require explicit user action, such as a button in preferences". Never at enable time. | `[EGO-reject]` |
| X-8  | "Spawning privileged subprocesses should be avoided at all costs. If absolutely necessary, the subprocess MUST be run with pkexec and MUST NOT be an executable or script that can be modified by a user process." `sudo`, `su`, `doas`, `run0` MUST NOT appear in argv. | `[EGO-reject]` `[Shexli EGO-X-001]` |
| X-9  | "Extensions MUST NOT use any telemetry tools to track users and share the user data online." Polling the user's own accounts is not telemetry, but the description SHOULD name the hosts contacted. | `[EGO-reject]` `[Shexli EGO-A-003]` |
| X-10 | Networking uses Soup 3: one session per `enable()` (R-13), `send_and_read_async()` with a cancellable, never `send_and_read()` (sync). Check `message.get_status()`; decode with `TextDecoder`. Streaming large bodies: `send_async()` + `Gio.InputStream`. A session `timeout` and a `user_agent` are advisable but no review page asks for them (this project's reason for its User-Agent is in AGENTS.md). | `[Best-practice]` |
| X-11 | Files: `this.dir.get_child(name)` / `this.path` for bundled assets; `GLib.get_user_config_dir()`, `GLib.get_user_cache_dir()`, `GLib.build_filenamev([...])` for user paths. Decode with `TextDecoder`, never `ByteArray`. | `[Best-practice]` |
| X-12 | Reading other applications' files MUST be async, tolerant of absence, read-only, and MUST never write to them without explicit user action. | `[Project]` |
| X-13 | D-Bus: `Gio.DBusProxy.makeProxyWrapper(xml)` and construct the proxy asynchronously (callback form or `new_for_bus`); `connectSignal` / `disconnectSignal`; `Gio.bus_unown_name()` and `unexport()` in `disable()`. Always invoke the wrapper with `new` (required on 51, works on 50). | `[Best-practice]` `[Port-guide 51]` |
| X-14 | Secrets (tokens, passwords) SHOULD NOT be stored in GSettings (dconf is plaintext); prefer libsecret (`gi://Secret?version=1`, async `Secret.password_store` / `password_lookup`) or document the risk. This is platform convention, not an EGO rule. | `[Convention]` |

Reference (promisified Soup 3 and file read):

```js
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

// Module scope is allowed: this patches a prototype and creates no object.
Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');
Gio._promisify(Gio.File.prototype, 'load_contents_async', 'load_contents_finish');

async function fetchJson(session, url, cancellable) {
    const message = Soup.Message.new('GET', url);
    message.get_request_headers().append('Accept', 'application/json');

    const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, cancellable);
    if (message.get_status() !== Soup.Status.OK)
        throw new Error(`HTTP ${message.get_status()} ${message.get_reason_phrase()}`);

    return JSON.parse(new TextDecoder().decode(bytes.get_data()));
}

async function readBundledJson(dir, name, cancellable) {
    const file = dir.get_child(name);
    const [contents] = await file.load_contents_async(cancellable);
    return JSON.parse(new TextDecoder().decode(contents));
}
```

---

## 9. Shell UI

Sources: Best Practices ("UI Elements: Icons vs. Emojis"),
https://gjs.guide/extensions/topics/popup-menu.html,
https://gjs.guide/extensions/topics/notifications.html,
https://gjs.guide/extensions/development/accessibility.html, port guides 46–51,
HIG https://developer.gnome.org/hig/guidelines/ui-icons.html,
https://developer.gnome.org/hig/patterns/feedback/notifications.html.

| ID    | Rule | Origin |
|-------|------|--------|
| UI-1  | A panel indicator MUST be a `PanelMenu.Button` (`addToStatusArea` throws otherwise). `Main.panel.addToStatusArea(role, indicator, position = 0, box = 'right')`; use `this.uuid` as the role (a duplicate role throws). Remove it by `indicator.destroy()`; there is no `removeFromStatusArea`. | `[Best-practice]` |
| UI-2  | `new PanelMenu.Button(menuAlignment, nameText, dontCreateMenu)`: `nameText` becomes the accessible name. On GNOME 49/50 clicks are handled by `Clutter.ClickGesture` and keys by `Clutter.KeyController`; do not override `vfunc_event` / `vfunc_button_press_event` on it. | `[Port-guide 49]` |
| UI-3  | Icons: `St.Icon` (or `icon_name` properties) in the Shell, `Gtk.Image` in prefs. "Do not use Unicode emojis as icons." No text glyphs as icons either. Symbolic icons: 16 px, monochrome, `-symbolic` suffix, pixel-aligned. Bundled icon: `gicon: Gio.icon_new_for_string(\`${this.path}/name-symbolic.svg\`)` with `style_class: 'system-status-icon'`. | `[Best-practice]` `[HIG]` |
| UI-4  | Progress: "Use shell components such as ui.BarLevel or custom St.Bin widgets instead of ASCII progress strings (for example, █░░)." `BarLevel` is in `resource:///org/gnome/shell/ui/barLevel.js`; `Slider` gains `addMark()` / `clearMarks()` on 50. | `[Best-practice]` `[Port-guide 50]` |
| UI-5  | Layout API: `St.BoxLayout` MUST use `orientation: Clutter.Orientation.VERTICAL`, never `vertical: true` (deprecated 48, removed 51). `add_child` / `remove_child`, `child-added` / `child-removed` (46). `St.Bin` / `St.Button` expand via `x_expand` / `y_expand`, not `ActorAlign.FILL` (46). `St.Button` label is plain text, not Pango markup (46). | `[Port-guide 46]` `[Port-guide 48]` `[Port-guide 51]` |
| UI-6  | Colours: `Cogl.Color`, not `Clutter.Color` (47). Images: `St.ImageContent`, not `Clutter.Image` (48). Rectangles: `Mtk.Rectangle`, not `Meta.Rectangle` (49). Gestures: `Clutter.ClickGesture` / `LongPressGesture`, not `ClickAction` / `TapAction` (49). | `[Port-guide 47]` `[Port-guide 48]` `[Port-guide 49]` |
| UI-7  | Do not start using what 51 removes or deprecates: raw `button-press-event` / `key-press-event` signals (use `Clutter.ClickGesture`, `KeyController`, `ScrollController`, `MotionController` via `actor.add_action()`); `St.ButtonMask.ONE/TWO/THREE` (use `PRIMARY/MIDDLE/SECONDARY`); `menu.close(PopupAnimation.NONE)` (use `menu.close({animate: false})`); `Clutter.get_default_backend()` (use `global.stage.context.get_backend()`); `Shell.GLSLEffect`; `ui/pointerWatcher.js` (use `global.backend.get_cursor_tracker()`). | `[Port-guide 51]` |
| UI-8  | `global` accessors on 48+: `global.compositor.get_window_actors()` (not `Meta.get_window_actors`), `global.backend.get_cursor_tracker()` (not `Meta.CursorTracker.get_for_display`), `global.stage`, `global.display`, `global.settings`, `global.get_current_time()`. | `[Port-guide 48]` |
| UI-9  | Popup menus: `PopupMenu.PopupMenuItem`, `PopupSeparatorMenuItem`, `PopupSwitchMenuItem`, `PopupSubMenuMenuItem`, `PopupMenuSection`, `menu.addAction(title, cb, icon)`, `setOrnament(PopupMenu.Ornament.*)`. Many PopupMenu classes are plain `EventEmitter`s (no property bindings). A "Settings" entry calls `extension.openPreferences()` and is visible only when `Main.sessionMode.allowSettings`. | `[Reference]` |
| UI-10 | Styling goes through `style_class` and the stylesheet (selectors by `GTypeName` work). Use theme variables (`-st-accent-color`, `-st-accent-fg-color` on 47+) rather than hard-coded colours. | `[Port-guide 47]` |
| UI-11 | Animation: `actor.ease({duration, mode, onComplete})`; on 50 `actor.easeAsync({...})` returns a Promise that rejects with CANCELLED when interrupted. Respect reduced motion (`St.Settings.get().reducedMotion` on 51). | `[Port-guide 50]` `[Port-guide 51]` |
| UI-12 | Accessibility: set `accessible_name` on buttons and icon-only controls; link labels with `label-actor`; `can_focus` for keyboard reachability; every control reachable by keyboard; test with large text and high contrast. | `[Best-practice]` `[HIG]` |
| UI-13 | `GObject.registerClass` options: if `GTypeName` is set it MUST be unique process-wide (prefix with the extension name). Register at module scope; re-registering the same name throws. Property names kebab-case in strings (`'notify::use-markup'`). Emit `this.notify('prop')` in custom setters. | `[Best-practice]` |
| UI-14 | Notifications (46+): property-object constructors `new MessageTray.Source({title, iconName \| icon, policy})` and `new MessageTray.Notification({source, title, body, iconName \| gicon, urgency})`; `source.addNotification(n)`; `n.addAction(label, cb)` (max 3; 48 adds `removeAction()`); `Main.messageTray.add(source)`. Create the source lazily, re-create after its `destroy` signal, and destroy it in `disable()` (`this._source?.destroy(); this._source = null;`). `Main.notify()` / `Main.notifyError()` for the simple case. | `[Port-guide 46]` `[Port-guide 48]` |
| UI-15 | Notification content: short title in header capitalization; one-sentence body in sentence case; rate-limit (summaries, not per-event spam); let users disable them; remove stale ones; do not duplicate the default action as a button. | `[HIG]` |
| UI-16 | Cursor: on GNOME 50, set the cursor on the actor itself with `actor.set_cursor_type(Clutter.CursorType.POINTER)`. It applies only while the pointer is over that actor (Shell does this in `js/ui/messageList.js`). Do not change the cursor of `global.stage`: actors inherit their parent's cursor, so a stage cursor changes it everywhere. If that is ever unavoidable, reset it to `Clutter.CursorType.DEFAULT` when the pointer leaves and in `destroy()`. | `[Reference]` |

Reference custom-source notification:

```js
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

export class Notifier {
    constructor(metadata) {
        this._metadata = metadata;
        this._source = null;
    }

    _getSource() {
        if (!this._source) {
            this._source = new MessageTray.Source({
                title: this._metadata.name,
                iconName: 'dialog-information-symbolic',
                policy: new MessageTray.NotificationGenericPolicy(),
            });
            this._source.connect('destroy', () => (this._source = null));
            Main.messageTray.add(this._source);
        }
        return this._source;
    }

    notifyQuota(body) {
        const notification = new MessageTray.Notification({
            source: this._getSource(),
            title: _('Quota Warning'),
            body,
            iconName: 'dialog-warning-symbolic',
            urgency: MessageTray.Urgency.NORMAL,
        });
        this._getSource().addNotification(notification);
    }

    destroy() {
        this._source?.destroy();
        this._source = null;
    }
}
```

---

## 10. Preferences

Sources: https://gjs.guide/extensions/development/preferences.html, GNOME Shell 47 port guide,
Best Practices, HIG https://developer.gnome.org/hig/guidelines/writing-style.html and
https://developer.gnome.org/hig/patterns/containers/boxed-lists.html.

| ID    | Rule | Origin |
|-------|------|--------|
| PR-1  | Implement `fillPreferencesWindow(window)` on the default-exported `ExtensionPreferences` subclass. `getPreferencesWidget()` MUST NOT be used on 45+ (it is ignored when `fillPreferencesWindow` exists and is flagged). `fillPreferencesWindow` MAY be `async` (awaited since 47). | `[Best-practice]` `[Shexli EGO-C45-001]` `[Port-guide 47]` |
| PR-2  | The window is an `Adw.PreferencesWindow`. Structure: `Adw.PreferencesPage` → `Adw.PreferencesGroup` → rows (`Adw.SwitchRow`, `ActionRow`, `ComboRow`, `SpinRow`, `EntryRow`, `ExpanderRow`, `ButtonRow`). | `[Best-practice]` |
| PR-3  | Window-scoped objects MUST NOT be stored on `this` without cleanup. Keep per-window state on the window (`window._settings = settings`) or local, or connect `window.connect('close-request', () => { … clear fields … })`. | `[Shexli EGO-L-006]` |
| PR-4  | Custom CSS: the extension `stylesheet.css` does not apply to prefs. If CSS is truly needed, load it with `Gtk.CssProvider` + `Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)` and remove it on `close-request`. Prefer libadwaita style classes over custom CSS. | `[Best-practice]` |
| PR-5  | Bind settings with `settings.bind(key, widget, property, Gio.SettingsBindFlags.DEFAULT)`; for non-bindable state connect `changed::<key>` and disconnect on window close. | `[Best-practice]` |
| PR-6  | HIG writing: titles, buttons and menu labels in Header Capitalization ("Show Cost", "Add Account…"); subtitles and explanatory text in sentence case without trailing period; ellipsis (`…`) on actions that need further input; avoid "e.g." / "i.e."; US English. | `[HIG]` |
| PR-7  | Rows: one control (at most two) per row; the control, not the row, is focusable; navigation rows end with `go-next-symbolic`. Icons via `Gtk.Image` / `icon_name` with `-symbolic` names, never emoji. | `[HIG]` `[Best-practice]` |
| PR-8  | Prefs code MUST NOT import Shell libraries or reach Shell objects (I-4). Prefs-only helpers live in `prefs/` (I-6). | `[EGO-reject]` `[Best-practice]` |
| PR-9 | Shexli does not check synchronous I/O in the prefs process (its sync-I/O rule EGO-X-004 runs only on extension-process files), and no review page allows it either. Keep it small and triggered by a user action, because the prefs window is still a UI process; prefer the async API where it costs little. | `[Project]` |
| PR-10 | Prefs text and UI MUST work for LTR and RTL; never build sentences across controls. Follow the HIG for prefs ("recommended but not required for approval"; treated as MUST here). | `[HIG]` |

Reference:

```js
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ExamplePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;

        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        const group = new Adw.PreferencesGroup({
            title: _('Appearance'),
            description: _('Configure the appearance of the indicator'),
        });
        const row = new Adw.SwitchRow({
            title: _('Show Indicator'),
            subtitle: _('Whether to show the panel indicator'),
        });
        settings.bind('show-indicator', row, 'active', Gio.SettingsBindFlags.DEFAULT);

        group.add(row);
        page.add(group);
        window.add(page);
    }
}
```

---

## 11. GSettings and schemas

Sources: Review Guidelines ("GSettings Schemas"), Best Practices ("Keep the Settings Schema ID
in Metadata"), anatomy page, Shexli package rules.

| ID   | Rule | Origin |
|------|------|--------|
| S-1  | "Schema ID MUST use org.gnome.shell.extensions as a base ID." | `[EGO-reject]` `[Shexli EGO-P-001]` |
| S-2  | "Schema path MUST use /org/gnome/shell/extensions as a base path." | `[EGO-reject]` `[Shexli EGO-P-002]` |
| S-3  | "Schema XML file MUST be included in the extension ZIP file" whenever the code uses GSettings. | `[EGO-reject]` `[Shexli EGO-P-003]` |
| S-4  | "Schema XML filename MUST follow pattern of `<schema-id>.gschema.xml`." | `[EGO-reject]` `[Shexli EGO-P-004]` |
| S-5  | `schemas/gschemas.compiled` MUST NOT ship (compiled on install since GNOME 44). | `[Shexli EGO-P-006]` |
| S-6  | Declare `settings-schema` in `metadata.json` and call `this.getSettings()` with no arguments for the extension's own schema (Q-9). `getSettings()` builds a `Gio.SettingsSchemaSource` from `<ext>/schemas/` and throws if the schema is missing. Do not open the extension's own schema with `new Gio.Settings({schema_id})`; system schemas (for example `org.gnome.desktop.interface`) are read with `new Gio.Settings` as usual. | `[Best-practice]` |
| S-7  | One `Gio.Settings` instance per process: create in `enable()` / `fillPreferencesWindow()`, null in `disable()`. Never at module scope. | `[EGO-reject]` `[Shexli EGO-L-001/005]` |
| S-8  | Keys use kebab-case. Structured data as `s` (JSON string), `as` or `a{ss}`. No secrets in GSettings (X-14). | `[Best-practice]` |
| S-9  | Read with `get_boolean` / `get_int` / `get_string` / `get_strv`; write with `set_*`; observe with `changed::<key>` or `bind()`. | `[Best-practice]` |

---

## 12. Logging

Sources: Review Guidelines ("No excessive logging"),
https://gjs.guide/extensions/development/debugging.html, GNOME Shell 48 port guide, Shexli.

| ID   | Rule | Origin |
|------|------|--------|
| LG-1 | "Extension MUST NOT print excessively to the log. The log should only be used for important messages and errors. If a reviewer determines that an extension is writing excessively to the log, the extension will be rejected." | `[EGO-reject]` `[Shexli EGO-A-002]` |
| LG-2 | No per-poll, per-render or per-event logging. Nothing logs on the happy path. | `[EGO-reject]` |
| LG-3 | Levels: `console.debug()` for development-only output, `console.warn()` for unexpected-but-handled conditions, `console.error()` for programmer errors, `logError(e, 'prefix')` for caught exceptions. `log()` is an alias of `console.log()`; do not use it. | `[Best-practice]` |
| LG-4 | Use `this.getLogger()` (48+) so messages are prefixed with the extension name; filtering journald by uuid no longer works on 45+. | `[Port-guide 48]` |
| LG-5 | Shexli warns at more than 5 `console.log/warn/error` calls per file that are not guarded by an identifier named `debug`, `_debug`, `verbose` or `_verbose` (`logError` / `log` are not counted). Stay well under; do not add a debug flag just to game the count. | `[Shexli EGO-A-004]` |
| LG-6 | Shipped code MUST NOT drop or strip console calls at build time to hide logging; it must simply not log. | `[Project]` |

Reading logs: `journalctl -f -o cat /usr/bin/gnome-shell` (Shell) and
`journalctl -f -o cat /usr/bin/gjs` (prefs). For more detail set
`SHELL_DEBUG=backtrace-warnings|backtrace-segfaults|all` and `G_MESSAGES_DEBUG=all`.

---

## 13. TypeScript and transpiled output

Sources: https://gjs.guide/extensions/development/typescript.html, Review Guidelines ("Code must
not be obfuscated", "Use a linter"), Best Practices ("Modules are Better Than a Single File",
"Keep the Default Entry Point as Small as Possible"), review threads and Discourse cited in the
Appendix.

| ID    | Rule | Origin |
|-------|------|--------|
| TS-1  | "JavaScript code must be readable and reasonably structured; must not be minified or obfuscated; TypeScript must be transpiled to well-formatted JavaScript." No `minify`, no identifier mangling, no whitespace stripping. Shexli flags files where 55 % or more of identifiers are 1–2 characters, or ≤ 4 non-empty lines at ≥ 2000 bytes. | `[EGO-reject]` `[Shexli EGO-A-001]` |
| TS-2  | "If the codebase of an extension is too messy to properly review it MAY be rejected. This includes obfuscators and transpilers used with TypeScript." Reviewers have refused minified bundles ("I won't review minified code") and a single ~10,000-line bundle. | `[EGO-reject]` |
| TS-3  | Prefer per-file emission that mirrors the source tree (`tsc`, or esbuild without `--bundle`), so the shipped `.js` tree keeps module boundaries, original import names, `const`/`let`, comments and a small `extension.js`. Avoid giant bundles. | `[Best-practice]` |
| TS-4  | Transpiler artifacts MUST NOT appear in shipped code: top-level `const` → `var`, renamed duplicate imports (`Gio2`, `GLib8`), imports scattered mid-file, helper shims (`__defProp`, `__publicField`), polyfills. Set `target` ≥ ES2022 (SpiderMonkey 140 on GNOME 49/50 supports ES2023), `useDefineForClassFields` consistent with no shims, no decorators. | `[EGO-reject]` |
| TS-5  | If esbuild is used: `--format=esm --platform=neutral --target=es2023 --external:gi://* --external:resource://*`, no `--minify*`, `--keep-names` is unnecessary when nothing is mangled, no `--drop:console`, keep comments. Then format the output to GNOME style (4-space, single quotes, semicolons) and lint it. | `[Convention]` |
| TS-6  | No Node APIs in output: no `process`, `require`, `node:` imports, `import.meta.dirname`, `Buffer`. They crash at runtime in GJS. | `[Best-practice]` |
| TS-7  | Entry files (`extension.js`, `prefs.js`, `metadata.json`) at the zip root (P-2). The `url` field points at the repository containing the `.ts` source. | `[Best-practice]` |
| TS-8  | Lint what ships: ESLint with the GNOME Shell rules runs over the emitted `.js`, since that is what reviewers read. The Review Guidelines recommend a linter and add that "Following a specific code style is not a requirement for approval". | `[EGO-recommendation]` `[Project]` |
| TS-9  | Keep `.ts` sources, `.d.ts`, source maps, `tsconfig*` and `node_modules` out of the zip (`sourceMap: false`). Submissions "should not include files that are not necessary for it to function", and a reviewer "MAY decide to reject an extension which includes an unreasonable amount of unnecessary data". | `[EGO-recommendation]` `[Project]` |
| TS-10 | Recommended `tsconfig`: `module: NodeNext`, `target: ES2023`, `lib: ES2023`, `strict`, `skipLibCheck`, `sourceMap: false`, `outDir: dist`; ambient types `@girs/gjs`, `@girs/gjs/dom`, `@girs/gnome-shell/ambient`, `@girs/gnome-shell/extensions/global`. | `[Reference]` |
| TS-11 | `// @ts-nocheck` and `// @ts-ignore` defeat the point of TypeScript; GJS-facing files MUST be type-checked with the `@girs` typings for the targeted Shell version. | `[Project]` |
| TS-12 | Vendored dependencies in output MUST be minimal, readable, GPL-compatible and attributed (Section 15). | `[EGO-reject]` |

---

## 14. Version targeting and port-guide table

Sources: https://gjs.guide/extensions/upgrading/ (45–51), https://release.gnome.org/50/developers/.

| ID  | Rule | Origin |
|-----|------|--------|
| V-1 | Target exactly one GNOME Shell version (currently 50) and write code for that version only (Q-3). `shell-version` lists only what was tested (M-2). | `[Best-practice]` |
| V-2 | Do not start using anything a newer port guide removes or deprecates (UI-7, L-3). Write 50 code that is already 51-clean. | `[Port-guide 51]` |
| V-3 | When bumping the target, read the port guide for every intermediate version and apply each change; then re-run Shexli and the nested-shell test. | `[Convention]` |

| Version | Change | Action |
|---------|--------|--------|
| 45 | ESM only; `imports.*` gone; `Extension` / `ExtensionPreferences` base classes; `resource:///` imports; `this.getSettings()`, `this.path`, `this.metadata`; `fillPreferencesWindow`; gettext via resource modules | Baseline for everything in this file |
| 46 | `Clutter.Container` removed (`add_child` / `remove_child`, `child-added` / `child-removed`); `St.Bin` / `St.Button` expand via `x_expand` / `y_expand`; `St.Button` label plain text; property-object `MessageTray.Notification` / `Source`, `getSystemSource()`, `Notification.iconName`, `NotificationPolicy.newForApp()`; `ExtensionState.ENABLED` → `ACTIVE`; `Shell.BlurEffect.sigma` → `radius` | Use only the new forms |
| 47 | `fillPreferencesWindow` awaited; `Clutter.Color` → `Cogl.Color`; `-st-accent-color` / `-st-accent-fg-color`; `PopupBaseMenuItem` `:selected`; `Util.fixMarkup` | `async fillPreferencesWindow` allowed; use accent variables |
| 48 | `vertical` deprecated → `orientation`; `getLogger()`; `Clutter.Image` → `St.ImageContent` (takes `Cogl.Context` first); `Meta.get_window_actors` → `global.compositor.get_window_actors()`; `Meta.CursorTracker.get_for_display` → `global.backend.get_cursor_tracker()`; `Cogl.SnippetHook`; QuickMenuToggle style classes renamed; `Notification.removeAction()`; `MAX_NOTIFICATIONS_PER_SOURCE` = 10, grouped per app | `orientation` everywhere; `getLogger()` |
| 49 | X11 removed (`--nested` → `--devkit`); `Meta.Rectangle` → `Mtk.Rectangle`; `Clutter.ClickAction` / `TapAction` → `ClickGesture` / `LongPressGesture`; `AppMenuButton` removed; `DoNotDisturbSwitch` moved to quick settings; `Meta.Window.get_maximized` removed; `maximize(Meta.MaximizeFlags)` gone; `set_pointer_visible()` gone; `gnome-extensions upload --accept-tos`; `getScreenshotNotificationSource()`; GJS 1.86 / SpiderMonkey 140 | Testing instructions say `--devkit` |
| 50 | `easeAsync()`; `logErrorUnlessCancelled()` in `misc/errorUtils.js`; `GLib.timeout_add_once` / `timeout_add_seconds_once` / `idle_add_once`; `Slider.addMark` / `clearMarks`; `holdKeyboard` / `releaseKeyboard` removed; `global.display` `show-restart-message` / `restart` signals removed; `RunDialog._restart()` removed; `gnome-shell-test-tool --extension`; `gnome-extensions install --print-uuid`; libadwaita 1.9 (`AdwSidebar`, reduced motion respected); GTK 4.22; metadata/extension/prefs unchanged | Use new helpers freely; never reference removed restart APIs (Shexli EGO-C50-001/002) |
| 51 | `async disable()` throws; `vertical` removed; `St.ButtonMask.PRIMARY/MIDDLE/SECONDARY` (old names deprecated); `menu.open/close({animate, fadeOnly})`; raw Clutter event signals deprecated → controllers via `add_action()`; `Shell.GLSLEffect` removed → `Clutter.ShaderEffect` with `vfunc_get_static_snippet()`; `Clutter.get_default_backend()` removed; `makeProxyWrapper` returns a class (`new`); `St.ReducedMotion`; `ui/pointerWatcher.js` removed; `NoGrabPopup`, `SearchEntry`, `QrCode` added | Do not start using the removed/deprecated forms now |

---

## 15. Legal and content

Sources: Review Guidelines ("Legal Restrictions", "Clipboard Access must be declared", "Do not use
telemetry tools"), https://gjs.guide/extensions/overview/anatomy.html,
https://conduct.gnome.org.

| ID   | Rule | Origin |
|------|------|--------|
| LE-1 | License: "GNOME Shell is licensed under the terms of the GPL-2.0-or-later, which means that derived works like extensions MUST be distributed under compatible terms (eg. GPL-2.0-or-later, GPL-3.0-or-later)." Permissive (MIT/BSD) code may be included, "you are still approving GNOME to distribute it under terms compatible with the GPL-2.0-or-later." | `[EGO-reject]` |
| LE-2 | Attribution: "If your extension contains code from another extension it MUST include attribution to the original author in the distributed files. Not doing so is a license violation and your extension will be rejected." The same applies to any copied snippet. | `[EGO-reject]` |
| LE-3 | Trademarks and logos (hard rule): "Extensions MUST NOT include copyrighted or trademarked content without proof of express permission from the owner." This covers brand names and phrases, logos and artwork, and audio/video/multimedia. Agents MUST NOT add any third-party logo, wordmark, artwork or media to the package or the UI, and MUST NOT copy or trace one. "Nominative use" or a brand-guidelines link is not proof of express permission. Use original symbolic icons and plain text labels. Follow the guideline faithfully; when in doubt, leave it out. | `[EGO-reject]` |
| LE-3a | Project waiver for service names: the names of the monitored services (for example "Codex", "Claude", "Kiro", "Antigravity") MAY appear as plain text labels, because the extension cannot identify an account without them and many approved extensions do the same. Names MUST NOT be styled as logos, and the description MUST NOT imply endorsement. Provider icons MUST be original symbolic drawings that are visibly different from the official marks. | `[Project]` |
| LE-4 | Code of Conduct: names, descriptions, "Text content, icons, emojis and other media" and screenshots MUST NOT violate https://conduct.gnome.org. | `[EGO-reject]` |
| LE-5 | "Extensions MUST NOT promote national or international political agendas." | `[EGO-reject]` |
| LE-6 | Clipboard: access MUST be declared in the description; data MUST NOT be shared with a third party without explicit user interaction; no default keyboard shortcuts for clipboard data. `St.Clipboard.get_default()` triggers manual review. | `[EGO-reject]` `[Shexli EGO-A-005]` |
| LE-7 | No telemetry (X-9). | `[EGO-reject]` |
| LE-8 | Translations: do not ship `po/`, `.po` or `.pot` (the Review Guidelines list ".po and .pot files" as unnecessary). Ship compiled `locale/<lang>/LC_MESSAGES/*.mo`; `gnome-extensions pack` builds them from `po/` (P-8). Use `gettext as _`, `ngettext`, `pgettext` from the resource modules; `String.prototype.format` only with gettext strings. | `[EGO-recommendation]` `[Best-practice]` |
| LE-9 | Extensions MUST be functional: "if an extension is tested and found to be fundamentally broken it will be rejected. Extensions which serve no purpose or have no functionality will also be rejected." | `[EGO-reject]` |

---

## 16. Tooling and verification

Sources: https://gjs.guide/extensions/development/debugging.html, GNOME Shell 49/50 port guides,
https://pypi.org/project/shexli/, `gnome-extensions(1)`, Review Guidelines ("Use a linter").

| ID   | Rule | Origin |
|------|------|--------|
| T-1  | ESLint with the GNOME Shell rules (https://gitlab.gnome.org/GNOME/gnome-shell/-/tree/main/lint) MUST pass on the shipped JavaScript before every release. | `[EGO-reject]` |
| T-2  | Shexli MUST report `clean` on both the built directory and the packed zip before every release. EGO runs the same tool on every submission and shows its output on the review page. | `[Shexli]` |
| T-3  | Every change touching Shell code MUST be verified in a nested shell (`gnome-shell --devkit --wayland`) with the extension enabled, and `gnome-extensions info <uuid>` MUST show `State: ACTIVE`. Then disable and re-enable, and lock/unlock, with the journal open to catch leaks and criticals. | `[Best-practice]` |
| T-4  | Pure logic (parsers, math) SHOULD have unit tests under a plain JS runner; UI is tested in the nested shell or with `gnome-shell-test-tool`. | `[Best-practice]` |

### 16.1 Shexli

- What it is: "Static analyzer for GNOME Shell extension reviews" (PyPI). Behind the "Shexli
  (experimental)" box on every EGO review page; the upload page recommends running it first.
  Written by Yuri Konotopov (nE0sIghT) in `Infrastructure/extensions-web` (MR !245, 2026-04-03),
  AGPL-3.0-or-later, Python ≥ 3.12, parses JavaScript with tree-sitter (no JS execution).
  Only usable release: 0.2.1 (2026-04-10; 0.1.0 and 0.2.0 are yanked). No README, no changelog,
  no rule docs; each finding links to a gjs.guide anchor.
- Install and run:

```sh
pip install shexli                      # or: uv tool install shexli
shexli /abs/path/to/uuid-dir            # text report
shexli --format json my.shell-extension.zip > report.json
# reproducible:
uvx --python 3.12 --from shexli==0.2.1 --with tree-sitter==0.25.2 shexli --format json "$PWD/dist/<uuid>"
```

- Quirks of 0.2.1 (all verified against the package):

| Quirk | Consequence |
|-------|-------------|
| Always exits 0, even with findings | CI MUST parse the summary (`finding_count`, `severity_counts`, `status`) or the JSON; the exit code means nothing. |
| Crashes on a relative directory path (`path.relative_to` ValueError) | Always pass an absolute directory path; zip paths work either way. |
| Needs `tree-sitter==0.25.x` | tree-sitter 0.26 breaks it; pin 0.25.2. |
| Any `shell-version` major > 50 is an "implausible future release" (hard-coded) | EGO-M-004 error. Do not list 51 until Shexli is updated. |
| Only two CLI flags: `--format {json,text}` and the path | No rule selection, no baseline, no suppression. Baselines and `shexli-ci:` comments belong to the third-party `3v1n0/shexli-ci` wrapper, not Shexli. |
| Limits | 5000 files, 10 MiB per file, 50 MiB total, zip ratio ≤ 1000, rejects symlinks and `..` paths. |

- Output: text header `shexli: <status> (<n> findings, <e> errors, <w> warnings)` then per finding
  `RULE-ID severity`, message, `--> path:line`, snippet, `= rule:`, `= help:` + URL. JSON has
  `spec_version`, `summary`, `findings[]` (`rule_id`, `title`, `severity`, `message`,
  `evidence[]`, `source_url`, `source_section`) and `artifacts` (`target_versions`, counts).
- Severities: `error`, `warning`, `manual_review`. `manual_review` cannot be "fixed", only
  justified to the reviewer; CI treats it as a failure that needs a human decision.
- File classification: `extension.js` → EXTENSION context, `prefs.js` → PREFERENCES context;
  other `.js` files inherit contexts through import-graph reachability (static imports plus a
  few dynamic-import patterns). Lifecycle rules skip prefs-only files. Resources are tracked
  only when stored on `this.<field>` inside `enable()` of the exported `Extension` class or in
  the constructor / `_init` of other classes. Forbidden-before-enable `new` prefixes: `Adw`,
  `Clutter`, `Gdk`, `Gio`, `Gtk`, `Meta`, `Secret`, `Shell`, `St`. Destroyable roots:
  `Clutter`, `PanelMenu`, `PopupMenu`, `QuickSettings`, `St`, `QuickToggle`,
  `SystemIndicator`. Fields whose class extends `PopupMenuSection`, `ChildMenu` or
  `CollapsibleGroup` are treated as framework-managed.

Full rule catalogue (0.2.1, spec 2026-04-02). Sev: E = error, W = warning, MR = manual_review.

| ID | Sev | Trigger | Fix |
|----|-----|---------|-----|
| EGO-M-001 | E | `metadata.json` missing | ship it |
| EGO-M-002 | E | not valid UTF-8 JSON object | fix JSON |
| EGO-M-003 | E | uuid not matching `[-a-zA-Z0-9@._]+` with `@` after position 0, or ending `.gnome.org` / `@gnome.org` | `name@yourdomain` |
| EGO-M-004 | E | `shell-version` empty / non-string entries, > 1 dev release, or any major > 50 | list only released majors, at most one dev release |
| EGO-M-005 | W | `session-modes` present with exactly `["user"]` | delete the key |
| EGO-M-006 | E | `session-modes` value other than `user` / `unlock-dialog` | remove it |
| EGO-M-007 | E | `donations` with unknown keys, > 3 values, non-strings, or `custom` not http(s) | fix or remove |
| EGO-M-008 | W | `unlock-dialog` declared but `disable()` has no comment | add explanatory comment inside `disable()` |
| EGO-P-001 | E | schema id not starting `org.gnome.shell.extensions` | rename |
| EGO-P-002 | E | schema path not starting `/org/gnome/shell/extensions` | fix path |
| EGO-P-003 | E | code uses GSettings but no `*.gschema.xml` in package | ship the XML |
| EGO-P-004 | E | file name ≠ `<schema-id>.gschema.xml` | rename |
| EGO-P-005 | E | binaries / libraries (ELF, `.so`, …) | remove |
| EGO-P-006 | W | unnecessary artifacts (`po/`, `.po`, `.pot`, `screenshots/`, `__MACOSX`, `.git*`, `.editorconfig`, `.eslintrc*`, `build\|compile\|deploy\|install\|release*.sh`, `Makefile`, `meson.build`, `package-lock.json`, `yarn.lock`, placeholder `stylesheet.css`, `gschemas.compiled` on 45+, `.sh` with non-shell shebang) | strip from package |
| EGO-P-007 | W | `.js` unreachable from `extension.js` / `prefs.js` | remove or import it |
| EGO-I-001 | E | `gi://ByteArray`, `imports.byteArray`, `Lang`, `Mainloop` | `TextDecoder` / classes / `GLib.timeout_add` |
| EGO-I-002 | E | `gi://Gtk\|Gdk\|Adw` in EXTENSION context | move to prefs-only module |
| EGO-I-003 | E | `gi://Clutter\|Meta\|St\|Shell` in PREFERENCES context | move to extension-only module |
| EGO-I-004 | W | `imports._gi` | use `InjectionManager` / public API |
| EGO-L-001 | W | `new <forbidden prefix>`, `.connect(`, or source creation at module top level or in the Extension constructor | move into `enable()` |
| EGO-L-002 | W | `this.f = new St/Clutter/PopupMenu/PanelMenu/QuickSettings…` without `this.f.destroy()` in a cleanup method | add `destroy()` |
| EGO-L-003 | W | `this.id = x.connect(...)` without `x.disconnect(this.id)` / `disconnectObject` in cleanup | disconnect |
| EGO-L-004 | W | `this.id = GLib.timeout_add…` / `setTimeout` without removal in cleanup | `GLib.Source.remove` |
| EGO-L-005 | W | cleaned object/ref (incl. `Gio.Settings`) not followed by `this.f = null` | null it |
| EGO-L-006 | W | `this.f = …` inside `fillPreferencesWindow()` with no `close-request` handler | avoid fields or clear on `close-request` |
| EGO-L-007 | W | same `this.f = <source add>` assigned twice without removal between | remove right before re-adding |
| EGO-L-008 | W | `this.f = new Soup.Session()` without `this.f.abort()` in cleanup | `abort()` |
| EGO-X-001 | W | spawn argv head in `sudo`, `su`, `doas`, `run0` | `pkexec` on non-user-writable targets |
| EGO-X-002 | W | `GLib.spawn_command_line_sync` / `GLib.spawn_sync` in EXTENSION context | `Gio.Subprocess` async |
| EGO-X-003 | W | any `run_dispose()` | remove |
| EGO-X-004 | W | `GLib.file_get_contents`, `.load_contents(`, `.load_bytes(` in EXTENSION context (sync `query_info` / `query_exists` / `enumerate_children` are not detected) | `_async` variants |
| EGO-X-005 | W | `load_stylesheet` / `unload_stylesheet` with `stylesheet.css` | delete; the Shell loads it |
| EGO-X-006 | W | `Extension.lookupByURL` / `lookupByUUID` / `ExtensionPreferences.…` | `this`, `this.getSettings()`, `this.path` |
| EGO-A-001 | MR | file ≥ 500 B and (≥ 55 % of ≥ 25 identifiers are 1–2 chars) or (≤ 4 non-empty lines and ≥ 2000 B) | readable output |
| EGO-A-002 | MR | excessive logging (not statically checked) | reviewer judgment |
| EGO-A-003 | MR | telemetry (not statically checked) | reviewer judgment |
| EGO-A-004 | W | > 5 ungated `console.log/warn/error` per file | gate or remove |
| EGO-A-005 | MR | `St.Clipboard.get_default()` | declare in description |
| EGO-C45-001 | W | `getPreferencesWidget()` with target ≥ 45 | `fillPreferencesWindow()` |
| EGO-C49-001 | E | import `DoNotDisturbSwitch` from `calendar.js` (49+) | remove |
| EGO-C49-002 | E | `new Clutter.ClickAction` / `TapAction` | `ClickGesture` / `LongPressGesture` |
| EGO-C49-003 | E | `maximize` / `unmaximize(Meta.MaximizeFlags…)` | new API |
| EGO-C49-004 | E | `get_maximized()` | new API |
| EGO-C49-005 | E | `set_pointer_visible()` | remove |
| EGO-C50-001 | E | `global.display.connect('restart' \| 'show-restart-message', …)` | drop |
| EGO-C50-002 | E | `_restart(` in a file importing `ui/runDialog.js` | drop |

What Shexli cannot detect (humans will): sync `query_info` / `query_exists` /
`enumerate_children`; cleanup done in inline arrow callbacks or helpers not called as
`helper(this)`; unnecessary try/catch; `?.` / `typeof` hedges; multi-version comments; prompt-like
comments; lines over 200 characters; duplicated code; oversized files; inconsistent style; stale
descriptions; trademarked assets; excessive logging; telemetry; imaginary APIs.

### 16.2 Nested shell, logs, Looking Glass, test tool

```sh
# Nested GNOME Shell (49+; --nested is gone with X11). Needs mutter-devkit / mutter-dev-bin.
dbus-run-session -- gnome-shell --devkit --wayland
# inside the nested session:
gnome-extensions enable <uuid>
gnome-extensions info <uuid>          # expect State: ACTIVE (enable does not report errors)

# Logs
journalctl -f -o cat /usr/bin/gnome-shell   # Shell process
journalctl -f -o cat /usr/bin/gjs           # preferences process
SHELL_DEBUG=all G_MESSAGES_DEBUG=all dbus-run-session -- gnome-shell --devkit --wayland

# Headless test (GNOME 50)
gnome-shell-test-tool --extension extension-package.zip tests/testMyExtension.js

# Packaging and install
gnome-extensions pack --force --podir=po --extra-source=lib --extra-source=icons <dir>
gnome-extensions install --force <uuid>.shell-extension.zip   # 50: --print-uuid
gnome-extensions prefs <uuid>
dconf watch /org/gnome/shell/extensions/<name>/

# Upload (49+); never pass a password on the command line
gnome-extensions upload --accept-tos --user <user> --password-file <file> <zip>
```

- Devkit on 50 can simulate HiDPI / fractional scaling, multiple virtual monitors and shares the
  clipboard. Unset `GDK_BACKEND` before launching if the host session sets it.
- On a Wayland host session, a changed extension is only reloaded after log out / log in
  (modules are cached: "A different version was loaded previously. You need to log out for
  changes to take effect").
- Looking Glass: Alt+F2, `lg`; the Extensions tab shows load/enable errors.

---

## 17. Review etiquette

| ID  | Rule | Origin |
|-----|------|--------|
| E-1 | Replies in the review thread are written by the human maintainer (AI-8). | `[Reviewer blog]` |
| E-2 | Be ready to explain any line a reviewer asks about, in your own words: developers "should be able to justify and explain the code they submit, within reason". Point to the gjs.guide page or the Shell source behind a choice. Do not point to this file; it is not an EGO source. | `[EGO-reject]` |
| E-3 | Fix every flagged item in the next upload; do not argue warnings that are cheap to fix. For `manual_review` findings, give the reviewer the real-world reason in one or two sentences. | `[Shexli]` |
| E-4 | `url` in `metadata.json` points to the public repository, so a reviewer can see where the code comes from: it "should be a link to a Github or GitLab repository where users can report problems and learn more about your extension". | `[EGO-recommendation]` |
| E-5 | Where to ask for help: Matrix https://matrix.to/#/#extensions:gnome.org, https://discourse.gnome.org (tag `extensions`), Stack Overflow (`gnome-shell-extensions`, `gjs`). | `[Best-practice]` |
| E-6 | Do not submit a new version while a previous one is still under review unless the reviewer asked for it. | `[Project]` |

---

## 18. Pre-submission checklist

Metadata and package

- [ ] `metadata.json`: only documented keys; `uuid` unchanged and not under `gnome.org`;
      `shell-version` lists only tested released majors (`["50"]`); no `version`;
      `session-modes` and `donations` absent unless truly used; description accurate,
      declares clipboard/hosts if applicable (M-1, M-2, table 3.2).
- [ ] Zip root has `extension.js`, `prefs.js`, `metadata.json`; everything else is read at
      runtime; no `gschemas.compiled`, `.ts`, maps, `po/`, scripts, lockfiles, manifests,
      screenshots, unused icons (P-1 … P-10).
- [ ] Every `.js` is reachable from an entry point (P-6).

Lifecycle

- [ ] No GObjects, signals or sources at module scope or in constructors (L-1, L-14).
- [ ] Every `enable()` resource has a `disable()` counterpart; `disable()` is sync, adjacent,
      callable any time, nulls every field (L-2 … L-7, L-12).
- [ ] No `_destroyed` / `_enabled` flags; `destroy()` order sources → signals → refs →
      `super.destroy()` (L-10, L-11).
- [ ] No stubs; small entry class; each class cleans its own resources (L-8, L-9, L-13).
- [ ] Session modes handled per L-16 / L-17.

Resources

- [ ] All handler ids disconnected; `Gio.Settings` signals released explicitly (R-1, R-2).
- [ ] All sources removed even if they return `SOURCE_REMOVE`; removal next to creation;
      a timeout that bounds an async call is removed when its cancellable fires (R-6 … R-9).
- [ ] One cancellable and one Soup session per enable, cancelled / aborted in disable
      (R-11, R-13).
- [ ] No `run_dispose()`, no `imports._gi`; injections via `InjectionManager` with `clear()`
      (R-17 … R-19).

Imports and processes

- [ ] No Gtk/Gdk/Adw in Shell code; no Clutter/Meta/St/Shell in prefs; shared modules import
      neither (I-3 … I-5).
- [ ] No deprecated modules, no legacy `imports`, no `lookupByURL/UUID` (I-1, I-2, I-11).
- [ ] `?version=` only on GI libraries the process does not already load (I-7).
- [ ] Prefs-only modules in `prefs/` (I-6).

Code quality

- [ ] No try/catch around non-throwing calls; no empty catches; no `?.` / `typeof` on
      guaranteed APIs; no multi-version hedges (Q-1 … Q-3).
- [ ] No prompt-like, model-addressed or AI-notice comments anywhere; no comments that
      restate code (AI-4, AI-5, Q-4).
- [ ] All lines ≤ 200 chars; no duplicated blocks; no oversized files; consistent style;
      no dead code or TODOs (Q-5 … Q-7, Q-11, Q-14).
- [ ] `this.getSettings()` with no args; `settings-schema` in metadata (Q-9, S-6).
- [ ] Every API used exists in the targeted Shell version (Q-15).

I/O and UI

- [ ] No sync I/O or sync spawn in the Shell process; all async with the cancellable (X-1, X-2).
- [ ] No subprocesses unless unavoidable; no binaries; no privileged helpers; no telemetry
      (X-3 … X-9).
- [ ] `PanelMenu.Button` indicator, symbolic icons, no emoji, `BarLevel` not ASCII bars,
      `orientation` not `vertical`, no 51-removed APIs (UI-1 … UI-7).
- [ ] Prefs via `fillPreferencesWindow`, Adw rows, window-scoped cleanup, HIG text
      (PR-1 … PR-7).
- [ ] Logging only for important messages and errors; nothing on the happy path (LG-1 … LG-5).

Build, legal, verification

- [ ] Shipped JS is unminified, per-module, GNOME-formatted, free of transpiler artifacts and
      Node APIs (TS-1 … TS-6).
- [ ] GPL-compatible license; every copied snippet attributed; no third-party brand names,
      logos or artwork without proof of express permission; CoC and no politics (LE-1 … LE-5).
- [ ] ESLint clean on shipped JS; Shexli `clean` on dir and zip (absolute path); nested shell
      shows `ACTIVE`, survives enable/disable cycles and lock/unlock with no criticals in the
      journal (T-1 … T-3).
- [ ] Best Practices and Review Guidelines pages re-read today and this file reconciled (H-5).
- [ ] The maintainer can explain every line (AI-2).

---

## Appendix: Sources

All fetched 2026-10-13 unless noted.

EGO policy and posts

- "AI and GNOME Shell Extensions", Javad Rahmatzadeh, 2025-12-06 (including comments):
  https://blogs.gnome.org/jrahmatzadeh/2025/12/06/ai-and-gnome-shell-extensions/
- "An Open Letter to AI for Generating GNOME Shell Extensions", 2026-07-27 (slug
  `ego-ai-reference`; now part of the official Best Practices page):
  https://blogs.gnome.org/jrahmatzadeh/2026/07/27/ego-ai-reference/
- "Help EGO team", 2026-10-12: https://blogs.gnome.org/jrahmatzadeh/2026/10/12/help-ego-team/
- EGO donations: https://jrahmatzadeh.pages.gitlab.gnome.org/ego-donations/
- Review Guidelines: https://gjs.guide/extensions/review-guidelines/review-guidelines.html
- GNOME Extension Best Practices:
  https://gjs.guide/extensions/review-guidelines/best-practices.html (raw Markdown at
  https://gitlab.gnome.org/World/javascript/gjs-guide/-/raw/main/docs/extensions/review-guidelines/best-practices.md)
- GNOME Code of Conduct: https://conduct.gnome.org
- Discourse thread on the open letter:
  https://discourse.gnome.org/t/javad-rahmatzadeh-an-open-letter-to-ai-for-generating-gnome-shell-extensions/37265
- EGO review threads cited for precedent: https://extensions.gnome.org/review/41976,
  /65091, /70564, /70964, /71488, /73196, /73355, /74261, /75298
- Discourse "Modern TypeScript support for GNOME Shell extensions":
  https://discourse.gnome.org/t/modern-typescript-support-for-gnome-shell-extensions/31311

gjs.guide technical pages

- Anatomy: https://gjs.guide/extensions/overview/anatomy.html
- Imports and modules: https://gjs.guide/extensions/overview/imports-and-modules.html
- Extension topic: https://gjs.guide/extensions/topics/extension.html
- Extension utils: https://gjs.guide/extensions/topics/extension-utils.html
- Session modes: https://gjs.guide/extensions/topics/session-modes.html
- Notifications: https://gjs.guide/extensions/topics/notifications.html
- Popup menu: https://gjs.guide/extensions/topics/popup-menu.html
- Quick settings: https://gjs.guide/extensions/topics/quick-settings.html
- Dialogs: https://gjs.guide/extensions/topics/dialogs.html
- Search provider: https://gjs.guide/extensions/topics/search-provider.html
- Creating: https://gjs.guide/extensions/development/creating.html
- Debugging: https://gjs.guide/extensions/development/debugging.html
- Preferences: https://gjs.guide/extensions/development/preferences.html
- Translations: https://gjs.guide/extensions/development/translations.html
- TypeScript: https://gjs.guide/extensions/development/typescript.html
- Accessibility: https://gjs.guide/extensions/development/accessibility.html
- Targeting older GNOME: https://gjs.guide/extensions/development/targeting-older-gnome.html
- Port guides: https://gjs.guide/extensions/upgrading/gnome-shell-45.html,
  …/gnome-shell-46.html, …/gnome-shell-47.html, …/gnome-shell-48.html,
  …/gnome-shell-49.html, …/gnome-shell-50.html, …/gnome-shell-51.html
- Asynchronous programming: https://gjs.guide/guides/gjs/asynchronous-programming.html
- Memory management: https://gjs.guide/guides/gjs/memory-management.html
- GJS intro: https://gjs.guide/guides/gjs/intro.html
- GIO file operations: https://gjs.guide/guides/gio/file-operations.html
- GIO subprocesses: https://gjs.guide/guides/gio/subprocesses.html
- GIO D-Bus: https://gjs.guide/guides/gio/dbus.html
- GObject basics / subclassing: https://gjs.guide/guides/gobject/basics.html,
  https://gjs.guide/guides/gobject/subclassing.html

GNOME Shell / GJS sources and release notes

- `js/extensions/sharedInternals.js`, `js/extensions/extension.js`, `js/ui/extensionSystem.js`,
  `js/ui/panel.js`, `js/ui/panelMenu.js`, `js/misc/signalTracker.js`,
  `docs/js-coding-style.md`, `NEWS` at https://gitlab.gnome.org/GNOME/gnome-shell
- GNOME Shell ESLint rules: https://gitlab.gnome.org/GNOME/gnome-shell/-/tree/main/lint
- GJS `NEWS` and `examples/http-client.js` at https://gitlab.gnome.org/GNOME/gjs
- GNOME 50 developer notes: https://release.gnome.org/50/developers/
- libsoup 3 migration: https://libsoup.gnome.org/libsoup-3.0/migrating-from-libsoup-2.html
- `gnome-extensions(1)`: https://man.archlinux.org/man/gnome-extensions.1.en

Re-check of 2026-11-04 (GNOME 50 branches)

- gjs.guide raw Markdown and sample files: https://gitlab.gnome.org/World/javascript/gjs-guide
  (`docs/`, `src/`)
- GNOME Shell `gnome-50`: `subprojects/extensions-tool/src/command-pack.c` (P-8),
  `js/misc/signalTracker.js` (R-2), `js/ui/messageList.js` (UI-16), `js/ui/extensionSystem.js`
  (P-2, L-5, L-15), `js/misc/dependencies.js` (preloaded GI libraries)
- mutter `gnome-50`: `clutter/clutter/clutter-actor.c` (cursor inheritance, UI-16)
- Shexli 0.2.1: `shexli/analyzer/rules/api_misuse.py` (EGO-X-004 scope, PR-9)
- "Help EGO team" post, raw HTML: the "real public repository" sentence is inside the
  `<blockquote>` of pasted LLM output (section 1, AI-9, E-4)

HIG

- UI icons: https://developer.gnome.org/hig/guidelines/ui-icons.html
- Writing style: https://developer.gnome.org/hig/guidelines/writing-style.html
- Accessibility: https://developer.gnome.org/hig/guidelines/accessibility.html
- Boxed lists: https://developer.gnome.org/hig/patterns/containers/boxed-lists.html
- Notifications: https://developer.gnome.org/hig/patterns/feedback/notifications.html

Shexli

- PyPI: https://pypi.org/project/shexli/ (0.2.1, 2026-04-10; spec 2026-04-02)
- Origin MR: https://gitlab.gnome.org/Infrastructure/extensions-web/-/merge_requests/245
- Third-party wrapper: https://github.com/3v1n0/shexli-ci
- VS Code extension:
  https://marketplace.visualstudio.com/items?itemName=niffirgkcaj.shexli-gnome-extension

Attribution

Code examples in this file are adapted from gjs.guide (MIT licensed, "GJS, A GNOME Project")
and from the jrahmatzadeh blog posts listed above. Rule wording in quotation marks is quoted
from those pages as they read on 2026-10-13, or on 2026-11-04 for the rules re-checked then.
