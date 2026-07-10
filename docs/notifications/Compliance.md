# Notification compliance controls

Trusted Introductions separates required service messages from optional reminders.

## Categories

- **Operational invite messages** are required transactional messages for invite creation, redemption, expiry, and revocation.
- **Introduction coordination** is required transactional communication for active trusted-introduction workflows.
- **Follow-up reminders** are optional and default off.
- **Outcome prompts** are optional and default off.
- Security-related messages are treated as essential transactional notices outside optional reminder consent.

## Defaults and privacy

Notification preferences preserve restrictive privacy defaults. Optional categories default to disabled, and required categories are constrained to remain enabled so invite and safety workflows continue to function.

## Unsubscribe controls

Unsubscribe links use opaque random tokens. The application stores only SHA-256 token hashes in `notification_unsubscribes`; plaintext unsubscribe tokens are never stored. Confirmation pages do not display email addresses, names, identity ids, or account details.

Processing an unsubscribe disables only optional notification categories by scope. Required transactional invite, introduction coordination, and security-related messages remain classified separately.
