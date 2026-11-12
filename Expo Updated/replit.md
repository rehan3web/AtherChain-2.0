# Running AtherChain Updated

This is the standalone Expo SDK 58 / React Native app. Preserve its existing screens, navigation, themes, assets and styles. The user chose **“Preserve updated screens only”** rather than adding old-app-only screens. Approved exceptions: correct misleading demo notices and add the two mandatory KYC document fields.

## Development

- From this directory: `pnpm install --frozen-lockfile`.
- Replit's **AtherChain Updated** workflow runs `CI=1 pnpm exec expo start --web --host lan --port 5000` here.
- CI mode disables hot reload: restart the workflow after a coherent batch of changes.
- Web requests use the same-origin `/api` proxy configured in Metro and the existing Node server. The default upstream is the real endpoint used by Expo Old, `https://api.atherchain.com`.
- Native requests use that upstream directly. `EXPO_PUBLIC_API_URL` can explicitly override the client URL. `BACKEND_API_URL` can override the proxy upstream. Never embed private backend secrets in public client configuration.
- For the current local-backend test setup, the **AtherChain Backend** workflow runs the original backend on port 3001. Development-only `BACKEND_API_URL` points the proxy to it, and development-only `EXPO_PUBLIC_API_URL` points web/native clients to the preview's HTTPS `/api` URL. Production defaults are unchanged.
- PostgreSQL, MongoDB and Redis connectivity and the backend typecheck passed before startup. No database setup/migrations or test-account mutations were run. The user explicitly chose to run normal scheduled reminder jobs for this testing session, so they are not disabled.
- Native session tokens use SecureStore; web tokens use the existing AsyncStorage approach. Authentication requires a real token and successful `/user/me`, never a local practice preference.
- These screens now perform real account and financial operations. Do not create accounts, send money, swap, change security settings, approve QR logins or submit KYC against real users for automated verification.

## Checks

- TypeScript: `pnpm run typecheck`
- Backend contracts, failure cases and controlled screen/resource tests: `pnpm run test:backend`
- Existing style-expression preservation: `pnpm run audit:ui`
- All legacy and new tests: `node --test scripts/test-*.mjs`
- Cross-platform JavaScript export: `CI=1 pnpm exec expo export --platform all --output-dir generated-artifacts/verification-build`
- Outputs in `generated-artifacts/` are excluded from Git and the target's deployment ignore file.

The dedicated app checks now include 55 tests, including persisted payment-key recovery and actual API-proxy header forwarding. The backend has 37 isolated ledger/HTTP/failure-injection checks. During the initial migration, the style audit preserved original style expressions in 36 changed TSX files and Android/iOS/web JavaScript exports passed. Native-device operation remains unverified. The last combined legacy run before backend cleanup was **not green**: 130 of 193 tests passed; 63 failed, primarily because old harnesses reject new API imports or assert retired demo outcomes. One imported palette contrast failure remained unchanged. Do not hide or describe those failures as passing.

## Scope and limitations

The initial UI migration used `Backend` and `Expo Old` as read-only references. The user subsequently authorized removing blockchain functionality from `Backend`; that newer request supersedes the earlier backend read-only boundary. `Expo Old` remains unchanged. The root managed workflow configuration is only for preview startup.

Native app identifiers, associated domain and public EAS project ID were carried over from Expo Old. Passkeys require a native development/release build and correct domain/signing associations; native push requires the corresponding platform credentials and permission. Native-device operation was not verified. Signed-in screens were not visually verified through the public screenshot browser.

Backend support accepts one image per ticket/reply, not videos or multiple attachments. KYC uses actual document uploads and prompted camera frames; review results come only from the backend, not timers. No automated biometric liveness verdict is claimed. Missing backend features such as saved items and total-strike rewards are shown as unsupported/unavailable rather than populated with fake values.

The backend now supports persisted idempotency keys for user send/swap/mining/boost operations. The app retains a pending key across uncertain responses and app restarts; retry the same details, never replace an uncertain key to force another debit. PostgreSQL commits balances and recovery requests together, then a worker delivers transaction/mining logs to MongoDB idempotently. Swap receipts no longer depend on immediate history availability. See `../Backend/LEDGER_RELIABILITY.md`. Rates are still not reserved atomically between review and execution.

The backend is now centralized-only: Solidity/artifacts, chain dependencies/configuration, Web3 vaults, wrapped-token swap stubs, bridge-fee claims and gas-estimation endpoints were removed. The app no longer exposes unused bridge-claim API helpers. See `../Backend/BLOCKCHAIN_REMOVAL.md` for supported endpoints and verification commands. No live database tables, records, balances or saved secrets were deleted.

See `BACKEND_MIGRATION_REPORT.html` for the API inventory, changed files, verification results and remaining limitations. No publishing was performed.
