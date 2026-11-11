---
name: Statistics calendar
description: Dashboard entry point, claim-day verification, streak meaning and transaction-counter scope.
---

Statistics opens as its own page from the Dashboard's existing Statistics shortcut. Use the app's calendar boxes and verified badge, with plain KYC-status-style label/value rows underneath for Mining Streak, Total Swap and Total Transfer.

**Why:** The user explicitly selected the Dashboard Statistics button and requested the same app UI, including rows like KYC Approved/Rejected/Pending.

**How to apply:** Keep the calendar and three metrics together; show actual values rather than hardcoding the user's “10 Day” example.

Only successful, saved mining claims verify their device-local calendar day. Multiple claims on one day count as one streak day. The streak follows consecutive calendar days, including a streak ending yesterday while today is still available to claim.

**Why:** The user requested that claiming verifies the same day's calendar box. Counting 12-hour claim cycles as days would misrepresent a daily streak.

**How to apply:** Save claim dates together with the reward/cycle update, not as a separate best-effort write. For old mining records, show only the last known claim day; never infer historical dates from the total claim count.

Swap and Transfer statistics count completed actions, excluding sample payments, mining rewards and boosts. Their totals currently follow the session-only transaction feed; claimed days persist on the device.

**Why:** This keeps Statistics consistent with the existing simulated wallet instead of inventing lifetime totals that its transaction history cannot establish.

**How to apply:** Explain the difference in the page's small footer. Treat durable lifetime transaction statistics as a separate change if requested later.

The calendar must use explicit seven-cell week rows with equal, parent-sized flexible cells, including blank days. Do not calculate cell widths from the window and let them wrap.

**Why:** A real Android Expo Go screenshot showed Sunday and date cells wrapping after six columns, leaving unused space at the right and putting dates under the wrong weekdays. Browser-only checks had missed this native layout failure.

**How to apply:** Keep borders inside equal-width cell wrappers and size from the available parent, not assumed screen padding. Check all seven column positions, the right edge and month boundaries at phone, tablet and landscape sizes.
