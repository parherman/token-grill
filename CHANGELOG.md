# Changelog

## Unreleased

- Support GNOME Shell 51.
- Hide unavailable quotas in the popup.
- Show the reset date and time below quotas in the popup, and identify reset times
  that have already passed.
- Align reset-credit expiry text with quota reset text.

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
