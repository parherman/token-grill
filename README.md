# Token Grill

Token Grill shows the usage limits of your AI accounts in the GNOME top bar.

Token Grill monitors more than one account at the same time. From the top bar,
you can see the remaining usage of each account and the reset times.

![Token Grill open on the GNOME desktop](docs/screenshots/usage-dashboard.png)

## Functions

These are the functions of the top bar and the popup:

- Token Grill monitors Codex, Claude, Kiro, Antigravity, GitHub Copilot,
  OpenCode Go, Kimi Code, and Cursor accounts, and the DeepSeek balance. You can add
  more than one account for each service.
- The top bar shows one entry for each service. Each entry shows the limits
  that you checked for each account, as text, as rings, or as bars.
- The popup shows the limits of each account and their reset times in your
  local time zone. To show a limit in the top bar, check it in the popup.
- If a refresh gets an error, the popup keeps the last good values and shows
  the error.

These are the other functions:

- Token Grill can send a notification when the usage of a limit becomes more
  than a usage step. Only the limits that the top bar shows send notifications.
  The notification shows the service, the account, the limit, the percentage,
  and the reset time.
- For Codex and Claude accounts, Token Grill can read the local session
  history. It keeps only token totals. It does not keep prompts or responses.
- For Codex accounts, the popup shows the number of available reset credits.
  Token Grill does not use a reset credit.

![Token Grill's compact panel indicator](docs/screenshots/panel-indicator.png)

## Install

Token Grill operates with **GNOME Shell 48, 49, 50, and 51**.

After GNOME Shell Extensions approves the first release, search for
**Token Grill** in [Extension Manager](https://mattjakeman.com/apps/extension-manager)
or on [GNOME Shell Extensions](https://extensions.gnome.org/). This method also
gives you the updates.

To install a release archive before the approval, do these steps:

1. Run this command:

    ```sh
    gnome-extensions install --force tokengrill@sh02sahil.github.io.shell-extension.zip
    ```

2. Log out and log in again.
3. Enable Token Grill in Extension Manager or in the Extensions app.

### Try a release without logging out

[`tools/try.sh`](tools/try.sh) opens a release archive in a nested GNOME Shell
window. The nested shell has its own settings, extensions and keyring. Your
session does not change. The script needs the Mutter devkit. On Debian or
Ubuntu, the package is `mutter-dev-bin`.

```sh
bash try.sh tokengrill@sh02sahil.github.io.shell-extension.zip
```

The nested shell reads the sign-ins of your apps, but not the keys in your
keyring. To try an API key, paste it again in the nested shell. The first key
asks for a password for a new test keyring. When you close the window, the
script deletes the test settings and the test keyring.

## Add an account

1. Sign in to the service with the app of that service. Token Grill does not
   sign in for you.
2. Open the preferences of Token Grill.
3. Go to the **Accounts** page.
4. Select **Add Account…**, and then select the app that you sign in with.
   Token Grill shows the signed-in accounts of that app.
5. Check the accounts to add, and then select **Add**.

To find the accounts of all the supported apps, select **Discover…**. Token
Grill adds the accounts that you check and shows them in the top bar.

These are the apps that Token Grill reads:

| Service        | Apps                                                     |
| -------------- | -------------------------------------------------------- |
| Codex          | Codex CLI, OpenCode                                      |
| Claude         | Claude Code, OpenCode                                    |
| Cursor         | Cursor IDE, Cursor Agent                                |
| Kiro           | Kiro CLI                                                 |
| Antigravity    | Antigravity, Antigravity CLI                             |
| GitHub Copilot | GitHub CLI, Copilot CLI, OpenCode                        |
| OpenCode Go    | OpenCode                                                 |
| DeepSeek       | OpenCode, Claude Code settings, or a key that you paste  |
| Kimi Code      | Kimi CLI, OpenCode                                       |

Each home directory is a different account. For example, `~/.codex` and
`~/.codex2` are two Codex accounts. Token Grill does not read the Copilot
sign-in of VS Code, because VS Code encrypts it.

To select a name, a color, or the local history of an account, select the
account on the **Accounts** page.

## Optional system libraries

Some services must have a GObject introspection library from your Linux
distribution:

| Service                                       | Library                          | Debian or Ubuntu package |
| --------------------------------------------- | -------------------------------- | ------------------------ |
| Kiro and Cursor IDE                           | Gda 5.0 with the SQLite provider | `gir1.2-gda-5.0`         |
| Cursor IDE (encrypted sign-in)                | libsecret 1                      | `gir1.2-secret-1`        |
| Antigravity CLI (keyring sign-in)             | libsecret 1                      | `gir1.2-secret-1`        |
| GitHub Copilot (keyring sign-in)              | libsecret 1                      | `gir1.2-secret-1`        |
| DeepSeek (a key that you paste)               | libsecret 1                      | `gir1.2-secret-1`        |

Token Grill loads a library with a dynamic `import()` only when an account
uses it. If a library is missing, only that account shows an error. All other
accounts continue to operate.

## Privacy and network access

Token Grill reads the credentials that the apps and CLIs stored on this
computer. It sends these credentials only to that service. Token Grill
connects only to these hosts:

| Service     | Host                                                                                                          | Purpose                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Codex       | `chatgpt.com`                                                                                                 | Usage limits and reset credits          |
| Claude      | `api.anthropic.com`                                                                                           | Usage limits                            |
| Kiro        | `codewhisperer.us-east-1.amazonaws.com`, `q.<region>.amazonaws.com`, or the AWS ISO `q.*` host of your region | Usage limits                            |
| Kiro        | `oidc.<region>.amazonaws.com`                                                                                 | A new token when the sign-in is expired |
| Antigravity | `cloudcode-pa.googleapis.com`                                                                                 | Plan and usage limits                   |
| Antigravity | `oauth2.googleapis.com`                                                                                       | A new token when the sign-in is expired |
| Cursor      | `api2.cursor.sh`                                                                                              | Usage limits                            |
| Copilot     | `api.github.com`                                                                                              | Monthly allowances                      |
| OpenCode Go | `opencode.ai`                                                                                                 | Usage limits                            |
| DeepSeek    | `api.deepseek.com`                                                                                            | Prepaid balance                         |
| Kimi Code   | `api.kimi.com`, or `api.kimi.ai` when Kimi Code is set to that region                                         | Usage limits                            |

Each request obeys these limits:

- The request goes only to a host on a fixed list.
- The request uses only HTTPS.
- Token Grill does not accept redirects.
- Token Grill stops after 1 MiB of response data.

Each request uses this User-Agent:

```text
TokenGrill (+https://github.com/sh02sahil/token-grill; usage monitor for Codex, Claude, Kiro, Antigravity, Copilot, OpenCode Go, DeepSeek, Kimi Code and Cursor)
```

The Antigravity quota service gives data only when the User-Agent contains
the word Antigravity. Thus, the User-Agent names all the services that Token Grill
monitors.

Token Grill does not start other programs. It does not collect telemetry. It
does not read or send prompts or responses.

The Kiro usage request gets the e-mail address of the account. The popup shows
this address. Thus, you can see which account `kiro-cli` uses. Token Grill does not
write the address to a file.

### Local files that Token Grill reads

Each account has a home directory. For each account, you can set a different
credential file and a different sessions directory.

For Codex and Claude accounts, Token Grill reads these files:

- Codex: `<home>/auth.json`. The default home is `~/.codex`. With local
  history, Token Grill also reads `<home>/sessions/` and
  `<home>/archived_sessions/`.
- Claude: `<home>/.credentials.json`. The default home is `~/.claude`. With
  local history, Token Grill also reads `<home>/projects/`.

For Kiro and Antigravity accounts, Token Grill reads these files:

- Kiro: `<home>/data.sqlite3`. The default home is `$XDG_DATA_HOME/kiro-cli`.
  Token Grill opens the database read-only, with the SQLite `query_only` guard.
  It reads the database again only after its size or modification time
  changes.
- Antigravity: the first of `acp_token.json`, `oauth_creds.json`, and
  `credentials.json` in the home. The default home is
  `~/.gemini/antigravity-cli`. **Discover…** also finds `~/.gemini/antigravity`,
  `~/.antigravity`, and `~/.config/Antigravity`.

If Token Grill cannot use an Antigravity credential file, it reads the Secret
Service item of the Antigravity CLI (`service=gemini`, `username=antigravity`).
Token Grill does not unlock a locked keyring.

For the new services, Token Grill reads these files and keyring items:

- OpenCode: `$XDG_DATA_HOME/opencode/auth.json`. Token Grill does not refresh
  an OpenCode sign-in. If the sign-in is expired, open OpenCode and sign in
  again.
- GitHub CLI: `~/.config/gh/hosts.yml`, and the keyring item of the GitHub CLI
  (`service=gh:github.com`).
- Copilot CLI: the keyring item of the Copilot CLI (`service=copilot-cli`).
- Kimi CLI: `~/.kimi-code/credentials/kimi-code.json` and
  `~/.kimi-code/config.toml`.
- DeepSeek: the `env` of Claude Code `settings.json`, when Claude Code uses
  DeepSeek. A key that you paste is in the GNOME keyring, in an item of Token
  Grill (`org.gnome.shell.extensions.tokengrill.ApiKey`). When you remove the
  account, Token Grill removes the item.

If a Kiro or Antigravity access token is expired, Token Grill gets a new token.
It keeps the new token only in memory. It does not write the token to the files
or the keyring of the service.

### Cursor accounts

Cursor IDE credentials are read from `<home>/User/globalStorage/state.vscdb`.
The default home is `Cursor` in the system configuration directory
(`$XDG_CONFIG_HOME`, normally `~/.config`). Cursor Agent credentials are read
from `<home>/auth.json`; its default directory is lowercase `cursor` in the
same configuration directory. **Discover…** names them **Cursor IDE** and
**Cursor Agent**.

Discovery checks only the default directories. After adding a detected account,
set **Account Home** to its IDE user-data directory or Agent credential directory,
or use **Sign-In File Override** to select a `.vscdb` or `.json` file directly.
Each configured home is a separate account. For an IDE account, the
database takes precedence over a JSON fallback in that home. An Agent account
reads its own `auth.json` file. JWT access tokens use their
account identity; opaque `curs` tokens require a valid `authId` in the IDE
cached scoped profile. For encrypted IDE sign-ins that use Electron's Linux
`v11` format, Token Grill reads the Cursor key through libsecret and decrypts
the access token in memory. The keyring must already be unlocked. For other
encryption formats, run `agent login` and add a separate Cursor Agent account.
Token Grill does not switch accounts after a sign-in failure. Open Cursor and
sign in again, or run `agent login`, when a session expires.

Cursor shows the primary allowance and reset time. The current-period usage
endpoint supplies subscription usage; Enterprise accounts can use the personal
current overall budget from the usage summary when the current-period response
reports no billing period. Weekly and monthly labels follow the
reported period boundaries; other periods show **Current period**. A missing
usage allowance is reported as unavailable. Confirmed unlimited or disabled
allowances clear cached quotas; malformed responses retain the error state.

Cursor's read-only usage API is undocumented and can change. Cursor IDE accounts
use Gda 5.0 with SQLite, including database changes held in the WAL file.

### Files of Token Grill

- `$XDG_DATA_HOME/token-grill/` contains the usage totals.
- `$XDG_STATE_HOME/token-grill/` contains the history checkpoints, the
  notification state, the full DeepSeek balance after each top-up, and the
  diagnostics.

The diagnostics contain the latest 200 refresh steps: the host and path of each
request, the field names and types of each response, and the error codes.
Token Grill removes tokens, keys, e-mail addresses, and your home folder before
it writes a step.

These files do not contain credentials, service responses, prompts, or
responses.

### Diagnostics for testers

To save a report for a bug report, open the **Data** page in the preferences
and select **Save Diagnostics Report…**. The report does not contain tokens,
keys, e-mail addresses, account names, or your home folder.

To see each refresh step in the system journal, set the `diagnostics-journal`
setting:

```sh
gsettings --schemadir ~/.local/share/gnome-shell/extensions/tokengrill@sh02sahil.github.io/schemas \
    set org.gnome.shell.extensions.tokengrill diagnostics-journal true
journalctl -f -o cat /usr/bin/gnome-shell | grep 'Token Grill'
```

To stop the journal messages, set the setting to `false`.

## Test a development build

Use a nested GNOME Shell with a separate data directory and a separate state
directory. Do these steps:

1. Run these commands:

    ```sh
    export XDG_DATA_HOME="$(mktemp -d)" XDG_STATE_HOME="$(mktemp -d)"
    npm ci
    npm run install:local
    npm run dev:shell
    ```

    `npm run dev:shell` starts `dbus-run-session -- gnome-shell --devkit --wayland`.
    The script enables Token Grill, disables it, and enables it again. After
    each step, it shows the state of the extension.

2. In a different terminal, look at the log:

    ```sh
    journalctl -f -o cat /usr/bin/gnome-shell
    ```

3. Lock and unlock the nested session one time. The script shows the commands.

CAUTION: The nested shell uses the same dconf database as your desktop. If you
change a preference in the nested shell, the preference also changes on your
desktop.
If you enable or disable an extension in the nested shell, the extension also
changes on your desktop.

To try the build with separate settings and a separate keyring, run
`npm run pack && npm run try`.

For the full procedure, refer to [CONTRIBUTING.md](CONTRIBUTING.md).

## Why this exists

Token Grill started as a personal tool. I wanted one GNOME extension with these
functions:

- More than one account for each service.
- The services that I use when I write code.
- Small displays in the top bar.
- Clear reset times.
- Local history that keeps prompts and responses private.

I did not find an extension with all these functions. Thus, I made this
extension, and I share it.

The first release monitored Codex, Claude, Kiro, and Antigravity, because I use
these services. Version 0.4.0 adds GitHub Copilot, OpenCode Go, DeepSeek, and
Kimi Code. Token Grill can monitor more services in the future, if they
do not decrease the privacy or the reliability of the extension.

## AI development declaration

AI played a substantial role in Token Grill's development. The project was
created for personal use with **OpenAI GPT-5.6 Sol** for beginning, **Claude Opus 5.5** from then on. **T3 Code** served as the agentic coding environment and
orchestration interface.

AI assistance covered design exploration, implementation, refactoring, tests,
security review, and documentation. I directed that work, tested the resulting
extension, reviewed what is published, and remain responsible for maintaining
and explaining the code.

## Troubleshooting

- **Sign-in required:** Open the CLI of the service and sign in again.
- **Kiro database unreadable:** Install the Gda 5.0 SQLite library. Then close
  the preferences window and open it again.
- **System keyring or libsecret 1 unavailable:** Install the libsecret 1
  library. Then unlock the keyring. Token Grill does not unlock the keyring.
- **OpenCode sign-in expired:** Open OpenCode and sign in again.
- **Antigravity CLI sign-in expired:** Run an `agy` command. The Antigravity CLI
  then gets a new token.
- **No history:** Enable local history for the account. Make sure that the
  session directory of the account is present.
- **Changes do not show:** Disable the extension and enable it again. On
  Wayland, log out and log in again after you replace the extension files.
- **A service changed its API:** Open an issue with the error text. Do not
  attach credentials or a session log from your computer.

## Contributing

We accept bug reports and small pull requests. Before you share logs or account
data, read [CONTRIBUTING.md](CONTRIBUTING.md).

## Independence and license

Token Grill is an independent project. OpenAI, Anthropic, Amazon, and Google do
not endorse or sponsor Token Grill. Token Grill uses the service names only to
identify each service. The service icons are original symbolic drawings. Refer
to [NOTICE.md](NOTICE.md).

The license of Token Grill is GPL-3.0-or-later. Refer to [LICENSE](LICENSE).
