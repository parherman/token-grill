# Token Grill: notes for coding agents

Token Grill is a GNOME Shell extension in TypeScript. It shows the usage
limits of Codex, Claude, Kiro, Antigravity, and Cursor accounts in the top bar. It
operates with GNOME Shell 50 and 51. The target is extensions.gnome.org.

[PRACTICES.md](PRACTICES.md) is the set of rules. Each rule in it is a hard
rule. Before you change a file, read the sections that apply to that file.
[CONTRIBUTING.md](CONTRIBUTING.md) gives the procedures for persons.

## Architecture

Two processes load this code. A module of one process must not import the UI
modules of the other process.

**Shell process** (`extension.js` and all the modules that it imports):

- `src/extension.ts`: `enable()` creates a `Runtime`, and `disable()` stops it.
  This file contains nothing more.

- `src/runtime.ts`: owns all objects that `enable()` creates. These are the
  settings, the cancellable, the Soup session, the stores, the collectors, the
  scheduler, the indicator, and the notification store. `stop()` releases all
  of them.

- `src/core/scheduler.ts`: owns its one timeout. It selects the accounts for
  the next refresh.

- `src/providers/`: one collector for each service (`codex/`, `claude/`,
  `kiro/`, `antigravity/`, `cursor/`). `registry.ts` creates the collectors.

More modules of the Shell process:

- `src/providers/base.ts`: the HTTP client and the shared snapshot and history
  steps. The client uses a fixed list of hosts and only HTTPS. It accepts no
  redirects, stops after 1 MiB, and sends the single `USER_AGENT`.

- `src/providers/credentials.ts`: reads the credential files of other tools.

- `src/providers/history.ts`: reads the JSONL session logs.

- `src/storage/`: `atomicJson.ts` (limited reads, private atomic writes,
  `SerialWriter`), `aggregateStore.ts` (daily token totals),
  `checkpointStore.ts` (read offsets), and `jsonl.ts` (line reader).

- `src/shell/`: the panel button and the popup (`indicator.ts`,
  `providerCard.ts`, `accountChip.ts`, `toggleGroup.ts`), and the
  notifications.

**Preferences process** (`prefs.js`): `src/prefs.ts` makes the window from the
pages and dialogs in `src/prefs/`. To show the credential state, it also
imports the `auth.ts` modules of the services.

**Code for both processes and the unit tests**: `src/core/` does not import
Shell modules (`resource:///org/gnome/shell/...`) or GTK modules. Each
function in `src/core/` that makes text for the user gets a `Translator`
(`core/i18n.ts`). The unit tests give `UNTRANSLATED`. The Shell gives
`shell/translator.ts`.

The data flow:

1. The scheduler gives the due accounts to `Runtime._collect()`, one account
   at a time.

2. Each collector returns a new `ProviderSnapshot`. It reports the source
   phases and results through its `CollectorContext`.

3. The runtime keeps the snapshot and sends the milestone notifications. Then
   it updates the indicator.

## Commands

```bash
npm ci
npm run check          # tsc --noEmit, then ESLint (GNOME rules) on src/, tools/, tests/
npm test               # bundles pure modules into build/tests/, then node --test
npm run build          # per-file tsc emit into dist/<uuid>/, then GNOME ESLint over dist/
npm run release:check  # metadata, package tree, development traces, line length
npm run review:check   # pack, then Shexli on dist/ and on the zip; must report zero findings
npm run test:cursor    # synthetic Cursor profiles and collector checks (no network)
npm run test:kiro-gda  # synthetic kiro-cli database through the real Gda code (no network)
npm run test:live -- <codex|claude|kiro|antigravity|cursor> [home] [auth-file]
                       # one real collection with the user's credentials; prints no secrets
npm run install:local  # replaces the user's installed copy: only after nested-shell checks
npm run dev:shell      # nested GNOME Shell with the installed copy
```

## Examine a change

1. Run `npm run check`, `npm test`, `npm run build`, `npm run release:check`,
   and `npm run review:check`. Each command must show 0 findings.

2. If you change a service or the network code, run `npm run test:live` for
   each service that the change touches. Keep only the response keys that you
   saw in a real response.

3. If you change the Shell code or the preferences, do a test in a nested
   shell. Do this test before you change the installed copy of the user.

4. Do not run `npm run install:local` on the real data directory before the
   user sees the results of the nested shell test.

The nested shell test:

1. Install into temporary directories:
   `XDG_DATA_HOME=/tmp/tg-data XDG_STATE_HOME=/tmp/tg-state npm run install:local`.

2. Run `dbus-run-session -- gnome-shell --devkit --wayland` with the same
   variables. Unset `GDK_BACKEND`.

3. Set `GSETTINGS_BACKEND=memory`, if you do not need the accounts of the
   user. Then enable the extension through the nested bus. Write
   `provider-instances-json` through Looking Glass or Eval.

4. Examine these items: `State: ACTIVE`, some disable and enable cycles, lock
   and unlock, the popup in the light style and the dark style, and the
   preferences window.

5. Make sure that the log shows no criticals, no warnings, and no "already
   disposed" messages.

CAUTION: Without `GSETTINGS_BACKEND=memory`, the nested shell uses the dconf
database of the real session. If you enable an extension in the nested shell,
it also changes on the desktop of the user. The same applies if you disable it.

## Invariants

Rules for the code:

- Do not use `@ts-nocheck`, `@ts-ignore`, `@ts-expect-error`, or `any`. Use
  `as` casts only where the GI typings are not sufficient.

- Each GObject subclass uses one style:
  `class X extends Base { static { GObject.registerClass({GTypeName: 'TokenGrillX'}, this); } constructor(...) { super(...); } }`.
  Use `_field` names with TS `private`.

- Do not use an empty `catch` or a `catch` with only a comment. Do not use
  `.catch(() => {})`. Do not use `?.` or `typeof` checks on values that are
  always present. Do not use boolean flags for the lifecycle.

- Each `src/**/*.ts` file goes into the release as its own `.js` file. If no
  module imports a file, delete the file.

- A comment tells why, not what. Do not write narration, step numbers,
  version hedges, TODOs, or AI or prompt text (PRACTICES section 2).

Rules for text:

- Each text for the user goes through `_()` or `ngettext()` with a literal
  msgid. Use `formatText()` or `.format()` for placeholders. Do not use template
  literals in `_()`.

- Service names ("Codex", "Claude", "Kiro", "Antigravity") stay as plain text
  (PRACTICES LE-3a).

- Errors of a service are `CollectorError(code, ({_}) => _('…'))`. The message
  tells only the problem. `errorText()` in `core/popupModel.ts` adds the
  correction for each service.

- In a collector, a failure is a `CollectorError` or a bug. A `CollectorError`
  becomes a stale snapshot or an error snapshot. A bug goes to the runtime,
  and the runtime writes it to the log. Do not catch all errors.

Rules for the network and data:

- Use only the hosts in `providers/base.ts` (`ALLOWED_HOSTS` and the Kiro OIDC
  pattern).

- Use one User-Agent (`USER_AGENT`). Set it on the session. Do not set a
  User-Agent on one request. Do not send the exact identity of a different
  client or browser headers.

- If you add a host, also add it to the host table in the README and to the
  description in `metadata.json`.

- Read the files and keyrings of other tools asynchronously and read-only. Do
  not write to them. Keep refreshed tokens only in memory. Do not unlock a
  keyring.

- Do not hardcode an account, an e-mail address, or a personal path (for
  example `~/.t3`). The data that the CLI of each service keeps is correct.
  Many accounts of one service must operate at the same time.

Other rules:

- Each service icon is an original image (`*-symbolic.svg`). Do not add
  logos or brand artwork.

- The totals of `providers/history.ts` add up. If you change `PARSER_VERSION`,
  Token Grill reads each history file again and counts it two times.

- The version in `package.json` and the `version-name` key in `metadata.json`
  must be the same. `CHANGELOG.md` lists the changes for users.

- Do not commit, make a branch, or open a pull request if the user does not
  ask for it.

## Accepted exceptions

These exceptions are intentional. Do not change them if the reason stays the
same.

- **Token Grill reads the Kiro and Cursor databases synchronously through libgda 5.**
  libgda 5 has no asynchronous API. Token Grill first examines the size and
  the modification time of the database and its `-wal` file asynchronously.
  It reads the database only after a change (`kiro/auth.ts`,
  `kiro/collector.ts`, `cursor/auth.ts`, and the shared `providers/sqlite.ts`).

- **`jsonl.ts` calls `input.seek()` synchronously.** No asynchronous seek
  exists, and lseek does no disk I/O.

- **The last flush in `Runtime.stop()` can complete after `disable()`.** It
  writes only the state files of Token Grill. It does not touch Shell objects
  and uses no cancellable (`SerialWriter`).

- **The scheduler starts every 15 s** and examines the due times in memory.

- **The preferences use synchronous `pathExists` and directory lists** in
  `core/paths.ts` and `prefs/discovery.ts`. This code operates only in the
  preferences process, and only after an action of the user.

- **`notification-test-request` is a settings key for IPC.** The preferences
  write a JSON request with a nonce. The extension uses each nonce one time.

- **The pricing catalog in the release is necessary.** If Token Grill cannot
  read `pricing-v1.json`, the start fails, as with a missing module.

- **The toggle colors of the popup are fixed rgba values** in
  `resources/stylesheet.css`. St has no `currentColor`. Thus, `indicator.ts`
  measures the text color of the menu and selects the dark or the
  `tokengrill-light` color set. The accent colors of the accounts are data
  from the user, not theme colors (UI-10).

- **`StayOpenMenuItem` overrides `activate()`.** Thus, the menu stays open
  after "Refresh All Accounts" and shows the progress. This is a subclass of a
  menu item, not a patch of Shell code (R-17).

- **`isCancellation()` finds cancellations, and errors go to `getLogger()`.**
  `logErrorUnlessCancelled()` has no typings and does not use the logger of
  the extension (R-12, LG-4).

- **The User-Agent names the monitored services.** The Antigravity quota API
  (`cloudcode-pa`) returns 403 if the User-Agent does not contain Antigravity.
  libsoup replaces the User-Agent of a request with the User-Agent of the
  session. Thus, the single `USER_AGENT` identifies Token Grill and names the
  services that it reads (X-10, Q-12). It does not claim to be the Antigravity
  app or the agy CLI.
