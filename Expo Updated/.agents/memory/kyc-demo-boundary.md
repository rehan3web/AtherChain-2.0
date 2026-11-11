---
name: KYC demo boundary
description: Product scope and privacy boundaries for the user-approved KYC demo.
---

The user chose “Demo KYC flow” when asked to distinguish a walkthrough from real identity verification.

**Why:** Completing document uploads and guided face photos alone cannot verify a person or detect liveness.

**How to apply:** Keep completion explicitly demo-only and never mark the account genuinely verified. Do not persist or transmit KYC form details/photos without a new explicit request and appropriate real verification integration. Selecting a preferred language does not translate the app; flags represent example regions, not exclusive ownership of languages.

The user requested a plain “Start” button, no demo-only boxes on the introduction or face-photo screens, and no representative-region explanatory note in the language picker. They also requested no Help link on the face screen, the completion title “Verification Complete”, and no “No checks were…” box.

**Why:** The user wants less repeated explanatory text in the flow; this does not change the agreed demo scope.

**How to apply:** Preserve the simplified steps without reintroducing those banners. Keep the completion screen honest with a brief subtitle explaining the demo walkthrough and unchanged account verification status.

The user explicitly wants the face walkthrough to advance automatically: two seconds left, two seconds right, two seconds open mouth, then automatic completion even if no human is present. They do not want separate face-photo captures.

**Why:** The user requested dummy timed behavior, not biometric detection.

**How to apply:** Keep camera preview optional and do not gate the demo on a detected face. Automatic completion is local demo progress, not a verified identity or a real submission.

The user wants no generic “Start again” action and wants submitted KYC to reopen on its current result page after leaving. On the Rejected result only, replace Done with “Resubmit KYC” and allow a fresh walkthrough.

**Why:** Reopening a completed walkthrough should not restart onboarding; the user later explicitly requested resubmission specifically for rejected KYC.

**How to apply:** Remember the outcome and document for the current app session only. Pending/Approved retain Done. Resubmit opens a clean form, clears the prior review and cancels its deadlines; a new submission gets its own timeline. Do not retain personal entries or photos.

After submission, the simulated outcome must be Pending for 30 seconds, Rejected for the next 30 seconds, then Approved. All three screens retain the same Document Type and Status rows; Rejected uses a red cross and Pending a clock.

**Why:** The user explicitly requested this timed sequence and matching row presentation.

**How to apply:** Measure from the original submission time, not time spent viewing the page. Leaving/reopening or backgrounding must not restart the timeline. Preserve session-only outcome metadata, clear identity entries/photos after submission, and never represent these timed statuses as a real identity decision.
