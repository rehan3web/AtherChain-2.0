---
name: 2FA demo and presentation
description: User-requested 2FA walkthrough behavior and keyboard constraints.
---

Keep 2FA as a dummy walkthrough matching KYC and the rest of the app, not real account protection.

**Why:** The user explicitly requested dummy validation: `123456` fails, while any other six-digit code succeeds.

**How to apply:** Keep the full onboarding → QR and copyable key → code flow. Use the wallet amount keypad, never the Android/system keyboard. OTP indicators must be circles, filling per digit; failure turns them red and shakes, success turns them green, merges into one circle and animates a tick before returning to the 2FA page. Do not silently replace these interactions with a real authenticator validation flow or claim real security without a new request.

Remove “Demo” / “DEMO” from visible 2FA headings and status labels, including Completed, Scan and Verified. The onboarding should include a 2FA vector illustration matching KYC and referral.

**Why:** The user explicitly requested these wording and illustration changes.

**How to apply:** Avoid reintroducing repeated demo labels. Keep the dummy behavior unchanged and communicate the unchanged real-account security status with a short practice-setup clarification instead.

Disabling 2FA uses dummy email OTP, not real email delivery. Remove the tick beside Completed; after setup, the bottom action is Disable 2FA, followed by the Sessions-style confirmation and the same circular code/keypad verification.

**Why:** The user explicitly chose “Dummy OTP, abhi jaisa” when asked whether disabling should send real email.

**How to apply:** Do not claim email was sent. Only disable after successful OTP animation; cancellation leaves the completed state unchanged. Preserve the enable flow so the user can add 2FA again.
