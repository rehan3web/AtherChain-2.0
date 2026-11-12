# Centralized backend

The backend now uses internal database balances and account identifiers only. Supported financial operations are internal ATH transfers and AT-to-ATH conversions. No wallet signing credentials, RPC connection, contract deployment or wrapped-token exchange is required.

## Removed

- Both Solidity sources and all contract artifacts, compiler metadata and build-info files.
- `ethers` and its unused dependencies.
- RPC, chain ID, contract-address and blockchain signer/admin-key environment requirements.
- Key-rotation helpers, wrapped-token balances and fixed-pair swap stubs.
- Web3 wallet vault/pepper routes and controller.
- Bridge-fee claim/status routes, their model, and the mock admin gas-estimation endpoint.
- New-install schema creation for wallet signing credentials and Web3 vault storage.

The wallet API retains `/wallet/stats`, `/wallet/lookup` and `/wallet/send`. Swap execution accepts only `AT` to `ATH`; unsupported pairs fail before account reads or balance changes. WATH fields are no longer returned by wallet/profile endpoints. Existing account restrictions, KYC checks and cooldown checks remain. The app's unused bridge-claim API helpers were removed, and its recipient validator now accepts internal `ATH_` identifiers without changing the screen layout.

## Preserved

Account authentication, passkeys, KYC encryption, notification signing keys, SMTP, databases, mining, referrals, support, transaction history and internal ATH balances remain. These are not blockchain dependencies. Ledger identifiers keep the existing `ATH_` format but use cryptographically strong randomness.

No live tables, records, balances or saved secrets were deleted. Existing obsolete columns/tables are left untouched; no setup or database migration was executed for this cleanup. Fresh schema setup no longer creates them. Account deletion still erases historical claim records when a user explicitly deletes their account.

## Checks

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm run test:centralized
```

The new tests use isolated database/cache fixtures and a synthetic environment. They do not mutate connected user databases, trigger transfers or send notifications. The old `src/test/verify-centralized.ts` script mutates configured databases and is not used for this verification.

After code/package changes, restart the existing backend workflow. The app's same-origin API proxy does not need a new endpoint or UI redesign. Changes here are local until explicitly pushed to GitHub.
