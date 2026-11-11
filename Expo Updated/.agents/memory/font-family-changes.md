---
name: Font family changes
description: Avoid stale loaded fonts when switching app-wide typefaces in Expo.
---

Use the replacement font's own family names throughout the UI rather than mapping new font files to previously loaded aliases.

**Why:** A font change using existing aliases was not visible to the user. Expo's font loader skips loading a family it already considers loaded, so hot reload can retain the previous face under that name.

**How to apply:** Update font registration and all text-family references together, restart once, and verify the rendered font rather than trusting a successful typecheck.
