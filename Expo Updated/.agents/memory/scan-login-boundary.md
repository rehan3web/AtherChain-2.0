---
name: Scan login scope
description: User-approved dummy dashboard scanner and web-login boundary.
---

The user requested a dashboard header Scan action opening a separate page, styled like the KYC face-scan screen. They explicitly called this a dummy flow for web-app login. They corrected the interaction to remove “Scan and Login”: open directly into full-screen real camera preview and automatically show “Login Completed” after two seconds.

**Why:** The requested interaction demonstrates web login; it is not authorization to authenticate an actual web session or verify a face.

**How to apply:** Request camera access on opening, with no manual scan button. Keep dummy timed completion usable if access is denied and make success honest about unchanged authentication. Do not add real QR authorization, biometric verification, or account/session changes without a new request.
