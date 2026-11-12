# Authentication feedback and session recovery

## User-visible behavior

- Signup asks for Email, then Username. The first email is also used for registration and OTP verification; the duplicate verification-email input is gone.
- Registration, login, passkey confirmation, OTP verification and resend actions use pending spinners. Busy refs prevent repeated taps and pending state clears on completion or failure.
- Authentication validation/API errors use the existing red toast system. Field borders and OTP red shake remain; inline error paragraphs and error-driven Retry/Opening labels are removed. Existing neutral instructions and placeholders remain.
- Signup OTP verification starts automatically at six digits and also has a normal Verify email action. Invalid codes shake and return to editable entry. A failed local completion after verified OTP can Continue using the verified token instead of consuming the OTP again.
- Resend code has a 60-second client cooldown and spinner. Backend validation/rate limits remain authoritative.

## Session limit

At the backend's two-session limit, the login screen opens an Updated-style bottom sheet. Removing one chosen session automatically resumes the pending authentication branch. Password login still requests any required 2FA/email code; passkey recovery requests a fresh challenge and signed credential.

The scoped management credential is held only in component memory and sent only as the explicit bearer for session deletion. It is never saved as the normal login token. Cancellation clears pending credentials; an expired management token closes recovery and allows a fresh login.

Backend session metadata no longer includes stored full-session tokens. Management tokens are restricted to listing sessions and deleting one owned session, and still undergo blocked-account checks. Session deletion verifies membership before touching Redis. Valid verification codes remain unconsumed while session recovery is needed. Passkey logins now create individually tracked sessions rather than overwriting the legacy per-user key.

The existing count-then-create session policy is not an atomic reservation against simultaneous logins; this work does not claim to solve that older concurrency limitation or retroactively migrate legacy passkey sessions.

## Verification

```sh
pnpm run typecheck
pnpm run test:backend
pnpm run test:auth
```

The backend's `test:centralized` includes scoped-token, ownership, OTP, passkey and session-recovery regressions alongside financial checks. All fixtures are isolated; they do not send real email/OTP, remove actual sessions or mutate user balances.

`scripts/browser-auth-recovery.mjs` runs against an isolated Chromium on port 9222. It intercepts **all** `/api/` requests, exercises actual rendered signup/login/session-sheet behavior, and never forwards account mutations to the real backend. Historical browser scripts that assume demo accounts must not be used against the configured user backend.

KYC capture/upload and wallet balance-loading fixes are separate work and are not implemented by this authentication change.
