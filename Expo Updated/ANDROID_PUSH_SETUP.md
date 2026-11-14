# Android push notifications

## What is connected

- On native startup, the gate requests notification permission once if the OS permits. Allow continues to login/app; denial shows the gate. Its Allow button opens Settings without another popup. Returning from Settings checks the OS once per lifecycle event; there is no polling or automatic retry. Token registration runs after sign-in at authenticated `POST /user/push-token`, using Android channel `default`.
- Foreground notifications show a banner and sound. Receiving a push invalidates relevant cached data; this does not poll.
- Tapping a mining push opens Mining. Tapping a Help reply opens its ticket, including when starting a closed app.
- The backend hourly cron sends mining reminders only for opted-in, non-blocked, non-paused users whose cycle and Redis cooldown expired. Existing hourly repeat behavior is unchanged.
- Admin Help replies notify the ticket owner. A user's own sent message does not notify that same user.
- The shared backend sender accepts both Expo token prefixes, validates Expo tickets and removes tokens rejected as `DeviceNotRegistered`. An accepted ticket is **not proof of delivery**; inspect Expo push receipts when diagnosing device delivery.

## Required credentials and build

Run these steps from **Expo Updated**, not the Backend folder. No paid build or credential changes have been run automatically.

1. Confirm the EAS project ID in app.json belongs to the Expo project/account that will build this app.
2. In Firebase, register Android package `com.atherchain.app`. Provide its google-services.json through the EAS **file** environment variable `GOOGLE_SERVICES_JSON`, or keep a local google-services.json in this folder. Do not commit credentials.
   The local app configuration is ignored by Git but included in EAS uploads by .easignore. Fresh checkouts must supply this file again or configure the EAS file variable. Never place a service-account private-key JSON in the app folder.
3. Upload the matching Firebase FCM v1 service-account credential to that Expo project's Android push credentials using `eas credentials --platform android`. Keep service-account JSON out of chat, source control and the app bundle.
4. Set `EXPO_PUBLIC_API_URL` in the EAS build environment to the full HTTPS backend API base URL. `/api` is only suitable for the same-origin web preview, not an APK.
5. Build an APK with `eas build --platform android --profile preview` and install it on a supported Android device. Expo Go is not a remote push delivery test.
6. Sign in, allow notifications, and confirm `/user/push-token` succeeds. Check receipt status using Expo's push tooling without publishing device tokens.
7. On a test account, verify an admin Help reply while the app is foregrounded, backgrounded and closed; tapping must open that ticket. Verify a due mining reminder and that reminders OFF prevents mining pushes.

The external backend must run the updated code and remain running for cron. Starting only Expo does not run the backend cron.

References:
- https://docs.expo.dev/push-notifications/push-notifications-setup/
- https://docs.expo.dev/push-notifications/fcm-credentials/
- https://docs.expo.dev/push-notifications/sending-notifications/

## Known limits

The existing schema stores one Expo token per user (the latest device). Multi-device delivery and a durable retry/receipt worker are not implemented here. The cron remains hourly, so a newly completed cycle may wait up to the next hourly run. Real FCM delivery requires credentials plus the installed APK and cannot be proven by web preview or mocked tests.
