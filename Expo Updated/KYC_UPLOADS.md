# Single-photo KYC and multipart uploads

The final step requires an explicit press on the centered camera icon. With permission already granted it captures once; otherwise it requests permission and waits for camera readiness before completing that user-started capture. Mounting/ready events alone never arm a capture. Closing, backgrounding or abandoning capture invalidates the outstanding attempt.

After one photo, the application automatically submits required identity/residence fields, the selected document's number/expiry, both document images and the selfie. There is no multi-prompt gate or additional Submit confirmation. It remains a manual-review application, not certified liveness or automatic approval.

## Upload contract

- The selfie remains the backend's supported `face_scan_frame` base64 text field with its actual JPEG/PNG/WEBP MIME prefix.
- Web document/profile/support images use real Blobs (including ImagePicker's original File when available).
- Native images use Expo File byte-readable parts with the original name and supported MIME type. SDK 58 global fetch's multipart converter rejects the old `{uri,name,type}` object. Native RN Blob creation from raw ArrayBuffer is also unsupported; it is not used.
- The transport supplies `Content-Type: multipart/form-data; boundary=…`. Callers must not set that header manually.
- Missing/unreadable/empty/unsupported images fail explicitly. KYC document and selfie size limits remain enforced; shared uploads do not receive a new blanket KYC limit.

Only one submit is allowed at a time. Failure keeps form details and both selected documents, displays a red toast and returns to a deliberate new photo action. A lost response checks actual backend status before allowing retry; it never sends an automatic second POST. A committed backend receipt explicitly reports `pending`; older responses require status confirmation. Review polling remains authoritative.

## Checks

`pnpm run test:kyc` exercises the actual installed Expo multipart converter, original failure reproduction, native/browser byte/MIME/name preservation, backend mandatory fields/eligibility/manual review, camera permissions/cancellation, duplicate actions, failure recovery and pending state.

`scripts/browser-kyc-single.mjs` (also exposed through the old `browser-kyc-review.mjs` entrypoint) exercises the complete rendered flow with intercepted API responses, synthetic document pixels and Chromium's synthetic camera. Start a separate browser with `--remote-debugging-port=9222 --use-fake-ui-for-media-stream --use-fake-device-for-media-stream`. Every API request is fulfilled by fixtures and never forwarded to the user backend.

Physical Android/iOS permission prompts, device camera capture and native filesystem access still require a real-device check. No real identity documents, live personal camera stream or connected user data are used by these checks.
