---
name: Expo Go connectivity
description: Distinguish a healthy local preview from a working public Expo Go connection.
---

Verify native manifests and their launch-asset URLs through the public Expo domain, not only localhost or a browser screenshot.

**Why:** The imported app rendered correctly in the browser and produced native bundles locally, but its public Expo domain returned HTTP 200 with only `Running` for manifest and bundle requests. Expo Go showed a generic “Something went wrong” error, and server logs only showed no connected apps. After changing the server from localhost-only to LAN binding, the public domain served valid manifests, native bundles, and assets. An HTTP 200 alone was misleading.

**How to apply:** When Expo Go cannot connect, fetch the public endpoint using `expo-platform: android` or `ios` and `Accept: application/expo+json`, confirm the response is a manifest, and fetch its launch asset. Inspect response content and size before blaming app runtime code or asking the user to repeatedly reload.

Do not assume the public connection is healthy just because LAN binding is already correct.

**Why:** The same public `Running` response also occurred with Metro already listening on all interfaces. A single workflow restart restored valid public Android/iOS manifests and launch assets without code changes.

**How to apply:** Confirm the bind address and local manifest first, then restart the existing workflow once and recheck public content. If forwarding remains broken, diagnose routing rather than entering a restart loop or changing unrelated UI.
