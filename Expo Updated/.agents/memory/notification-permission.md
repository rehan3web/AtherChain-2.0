---
name: Mobile notification permission
description: Real OS permission gate before app entry; mobile-only scope, Settings return and Expo Go limitations.
---

Require real notification permission before the native app's existing entry flow. Request it when the app opens if the OS permits asking. After denial, show “Please Allow Notifications” with a vector illustration and a bottom Allow Notifications button that opens phone app settings.

**Why:** The user explicitly requested this before onboarding and chose “Sirf mobile app” when asked about browser scope.

**How to apply:** Do not gate the web preview or fake a browser permission grant. On returning from Settings, reread the actual native permission and continue only if allowed. Keep the existing first-launch/logout onboarding and remembered-entry behavior; do not turn permission approval into login or erase saved app data.

This is a permission gate, not push-delivery infrastructure. Do not register push tokens or imply that a push backend already exists.

**Why:** The requested scope is the system permission popup, denial screen and Settings redirect; no notification sender was requested.

**How to apply:** Fail visibly on OS/API errors and allow retry. Do not persist a local “granted” flag as a substitute for checking system permission. Foreground checks must not trigger another popup.

Expo Go permissions and app settings belong to the Expo Go host, whereas an installed standalone build uses its own app settings. Remote push delivery on Android Expo Go is unavailable, but local notification permissions remain supported.

**Why:** Expo's official notification documentation distinguishes remote push support from local notifications; do not mistake that limitation for an inability to implement this gate.

**How to apply:** Keep these limitations explicit during verification. Native permission/settings behavior needs a real device or emulator; a browser rendering fixture checks appearance, not OS permission behavior.

Android Expo Go also scopes dangerous permissions per project. Turning on the host's system permission does not necessarily grant that project's scope.

**Why:** The user reported a blocked gate after enabling Expo Go notifications; Expo Go's permissions service checks both global and project grants.

**How to apply:** Recheck on active/focus and account for delayed native permission updates. Explicit Allow may request an askable project permission before sending the user to Settings. Do not silently treat host settings as a project grant or reprompt on background/foreground checks.

Match the complete onboarding illustration on the notification permission screen, not just its ring or icon. Use the same card, framing, gradient and proportions, with a notification bell.

**Why:** The user rejected the separate blue-ring notification vector and explicitly requested the full onboarding artwork style.

**How to apply:** Reuse the onboarding illustration rather than designing an unrelated notification scene. Keep permission behavior unchanged during artwork updates.
