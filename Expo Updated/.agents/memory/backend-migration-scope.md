---
name: Backend migration scope
description: Current integration requirements and the exception for misleading demo notices
---

Modify only Expo Updated. Backend is the API source of truth; Expo Old is a functional reference and must remain unchanged. Replace simulated business functionality with real backend integrations for every supported feature.

**Why:** The user explicitly requested a complete real-backend migration, superseding the earlier demo-only boundaries recorded in other memory topics.

**How to apply:** Preserve existing design, layout, styles, visible elements, animations, and navigation. Do not redesign screens or copy the old UI. When asked about the conflict between real operations and existing claims that nothing is sent, stored, or transferred, the user authorized using our judgment to correct those misleading demo/practice notices. This is a copy-only exception, not permission to redesign the UI. Never simulate success for an unsupported backend action.

The user also explicitly approved adding the document-number and document-expiry inputs required by the real KYC API, using the existing field style, and connecting the existing face step to actual camera capture.

**Why:** The updated form did not collect mandatory backend fields, and its timer could not satisfy real identity verification.

When asked whether to add old-app-only flows with no corresponding controls in Updated, the user chose “Preserve updated screens only.” Do not add password-recovery, account-deletion, vault-management, or other new feature screens as part of this migration.

**Why:** The user explicitly chose the existing updated-screen scope rather than expanding navigation.
