# Changelog

## 0.4.0 alpha 2

- Token Grill also operates with GNOME Shell 48, 49, and 51.
- Show the reset date and time below quotas in the popup, and identify reset times
  that have already passed.
- Align reset-credit expiry text with quota reset text.

## 0.4.0 alpha 1

This is a test release. It is available only on GitHub. Token Grill 0.4.0 goes
to GNOME Shell Extensions after testers confirm each new service.

New services:

- GitHub Copilot: the monthly allowance. Token Grill reads the GitHub sign-in
  of the GitHub CLI, the Copilot CLI, or OpenCode. On plans with AI Credits, the
  popup shows the credits used and the credits in the plan.
- OpenCode Go: the 5-hour, weekly, and monthly limits.
- DeepSeek: the prepaid balance. The top bar shows the balance as a meter. The
  meter is full after each top-up.
- Kimi Code: the 5-hour, weekly, and monthly limits.
- OpenCode is an app that you can add accounts from. A Codex or Claude sign-in
  in OpenCode joins the Codex or Claude service as an account "via OpenCode".

Top bar and popup:

- The top bar shows one entry for each service. Each entry shows all the
  accounts of the service that you selected for the top bar.
- Each account can show more than one limit. In the ring style, the rings of
  one account are inside each other.
- To select the limits for the top bar, check them in the popup. Use "Pick
  Automatically" to let Token Grill show the limit with the most usage.
- Click a service in the top bar to open the popup on that service.
- The popup can show the accounts of a service as buttons or as a list.
- Rings and bars use the text color of the top bar and the popup, so they are
  easy to read with all accent colors. A limit with less than 20% remaining
  turns yellow (amber in the light style). A limit with less than 5% remaining
  turns red. All the colors have a contrast of at least 4.5:1 in the light
  style and in the dark style.

Notifications:

- Only the limits that the top bar shows send alerts. Each limit has its own
  alert steps.
- An alert shows the service, the account, the limit, the remaining or used
  percentage, and the reset time.
- A DeepSeek account sends one alert when its balance drops below the warning
  amount that you set.

Preferences:

- **Add Account** starts with the app that you sign in with. Token Grill finds
  the signed-in accounts of that app.
- **Discover** finds the accounts of all the supported apps. You select the
  accounts to add and show in the top bar.
- If you add an account that you added before from a different app, Token
  Grill shows a warning.
- Each account has its own page. Changes apply immediately.
- You can select a custom color for an account.
- You can paste a DeepSeek API key. Token Grill keeps the key in the GNOME
  keyring, not in the settings.
- **Save Diagnostics Report** on the **Data** page saves a report for a bug
  report. The report does not contain tokens, keys, e-mail addresses, account
  names, or your home folder.

Changes in behavior:

- If you select an account in the popup, the top bar does not change. To change
  the top bar, check the limits in the popup.
- When you upgrade from 0.3, the account that the top bar showed keeps its
  limit in the top bar. If the service does not report that limit, the account
  uses Pick Automatically. The other accounts are not in the top bar until you
  check their limits.

Bug fixes:

- Token Grill does not ask you to unlock the keyring. Before this fix, a locked
  keyring could show an unlock prompt during the refresh of an Antigravity
  account.
- Claude alerts operate again. Before this fix, each refresh started the alert
  steps of a Claude limit again.
- Claude accounts show the weekly limit of each model, for example
  "Weekly · Fable". Before this fix, Token Grill did not show this limit when
  the account also had a weekly limit for all models.
- The Claude sign-in hint names the correct command: `claude auth login`.
- The **Local History** switch is near the top of the account page.

If you go back to 0.3, Token Grill 0.3 removes the accounts of the new
services. All the other accounts show in the top bar again.

## 0.3.1

Bug fixes:

- The Antigravity keyring check removes its timer as soon as Token Grill is disabled or the
  preferences window closes.

## 0.3.0

- The popup and the preferences window use the standard GNOME interface. They
  obey the light style, the dark style, and high contrast.
- New original symbolic icons replace the logos of the services.
- Notifications have a new layout.

Bug fixes:

- Antigravity accounts with an agy sign-in show their usage limits again.
- Kiro accounts in regions other than us-east-1 use the correct region.
- Token Grill does not cause delays to the desktop when it reads files.
- The history scan keeps a line that the service writes at the same time.
- Refresh All Accounts operates correctly when automatic updates are off.
- Rate limits show as a normal error.
- The expiry times of reset credits obey the 12-hour or 24-hour clock
  preference.

## 0.2.0

- Token Grill monitors Antigravity accounts.
