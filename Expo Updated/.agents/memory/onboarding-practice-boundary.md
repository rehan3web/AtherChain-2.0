---
name: Onboarding practice boundary
description: Dummy signup/login scope, first-launch/logout rules, privacy and navigation constraint.
---

The user explicitly requested dummy signup and chose a dummy Login form. Onboarding must appear when opening the app for the first time and again after Log out; completed entry can be remembered between launches.

**Why:** The user said “app kholte hi first time then logout pr clcik krne se aagina whi” and selected “Dummy login form”.

**How to apply:** Treat entry as a device-local screen preference, not real authentication. Persist only whether to show the app or welcome; never save signup passwords, identifiers, personal details, phone numbers or OTPs. Do not overwrite the independently saved wallet/profile/ticket data on dummy logout.

Signup order is email-or-username, username, password/confirm, first/last name, country, optional referral with Skip, phone/calling-code list like KYC, then OTP with the existing 2FA circles and wallet keypad.

**Why:** This sequence and reuse were explicitly requested.

**How to apply:** Keep the code entry free of the OS keyboard, including 2FA-style dummy rejection and success animation. No SMS/email or real account creation is implied.

Signup OTP is email-based, not phone-based. Login and signup fields must have visible borders in white mode, and the OTP keypad must remain visible and usable like 2FA.

**Why:** The user corrected the phone OTP destination and reported that inputs blended into the body and the OTP keypad did not display correctly.

**How to apply:** Keep phone collection separate from verification. If signup starts with a username, collect an email as well; do not invent an address from the username. Keep dummy-email messaging honest. Signup must use the actual wallet send-amount/2FA keypad, not a recreated keyboard. Verify its rendered three-column layout at narrow phone widths, not just shared component imports.

Protected-route fallback must specify its destination explicitly in this Expo Router setup.

**Why:** On a guarded root URL the default fallback selected Login alphabetically. This Expo Stack does not support an initialRouteName prop; an explicit protected redirect selected the requested welcome page.

**How to apply:** Verify first-launch root and post-logout destinations, not just direct onboarding URLs, whenever changing entry routing. Do not rely on screen declaration order or initialRouteName alone.

Login should be split like signup: email or username first, with Next and Login with passkey at the bottom; Next opens a separate password screen, then successful entry opens the dashboard.

**Why:** The user explicitly requested this sequence rather than an identifier/password form on one screen.

**How to apply:** Back from password returns to the identifier step. Keep passkey login within the existing dummy boundary, clearly distinguish it from real biometric authentication, and allow cancellation without entering the app.

The explicit dummy login `ban@test.com` shows an Account Banned screen with reason “Abuse of App”, not the wallet. This applies to password and practice-passkey entry.

**Why:** The user chose this test identifier and exact reason when defining the banned-account screen.

**How to apply:** Keep other dummy logins unchanged. Match the full onboarding/KYC illustration and KYC result rows; show a cross with Banned, and place Login left and Help right. Help and its ticket flow must remain accessible before login. Do not turn this UI example into real account enforcement or persist credentials.
