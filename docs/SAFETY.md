# ChromeClaw Safety Model

ChromeClaw is a local operator. It can control a browser, so it treats sensitive actions as permissioned.

The v0 policy blocks or asks for confirmation before:

- Logging in or entering credentials.
- Sending emails, messages, comments, posts, or forms containing personal data.
- Purchases, payments, banking, trading, subscriptions, or checkout.
- Deleting, modifying, uploading, or downloading user data.
- Bypassing CAPTCHAs, paywalls, login walls, or security checks.
- Visiting sensitive local or browser-internal pages.

The implementation lives in `packages/agent/src/safety.ts` and is covered by tests.
