# Running this project

This is the imported AtherChain Expo / React Native app. Keep its existing root-level structure and Expo Router stack.

## Development

- Install dependencies with `npm ci` (the import is a standalone package, not a pnpm monorepo).
- Use Replit's **Run** button to start the configured `expo` workflow.
- The workflow runs `pnpm --filter @workspace/mobile run dev`. Its port and mobile preview routing are provided by `.replit-artifact/artifact.toml` (port 18115, preview path `/mobile/`).
- To start manually with the same port: `PORT=18115 pnpm run dev`.
- Use the mobile preview or the Expo Go QR code emitted by the workflow. Public Android and iOS manifests and their launch bundles were verified; physical-device operation has not been verified.
- The existing startup script uses Replit's managed Expo session secret when available. No manually supplied API keys are needed for the current demo screens.

## Checks

- Type check: `pnpm run typecheck`
- Existing unit tests: `node --test scripts/test-*.mjs`
- On the latest setup check, TypeScript passed and 72 of 73 unit tests passed. The existing palette contrast test fails at `Secondary ink on walletField`; this is an imported design issue, not an installation failure.

## Import notes

The archive contained catalog dependency references and an unused API-client workspace dependency / TypeScript project reference, but not their parent workspace. Catalog versions were made explicit and the unused missing API-client references were removed. No app structure or business behavior was changed.

Balances, mining, and wallet screens currently represent demo behavior, not a live financial service. Development startup and the rendered dashboard were verified; publishing and native-device builds were not.
