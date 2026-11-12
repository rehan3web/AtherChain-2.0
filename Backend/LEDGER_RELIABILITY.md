# Internal ledger reliability

## Storage stays the same

- PostgreSQL owns AT/ATH balances, account eligibility and cooldowns.
- MongoDB remains the transaction/mining history store.
- A new additive PostgreSQL `ledger_operations` table holds replay receipts and temporary MongoDB delivery requests. It is not a new transaction-history database. Delivery payloads are cleared after MongoDB acknowledges them; replay receipts remain so the same request cannot debit again.
- No historical transaction, balance or vault data is deleted or migrated.

## Fixed failure cases

1. Mining and boosts use one checked-out PostgreSQL connection, with locked account updates. They no longer use `pool.query` for individual transaction statements. Mining eligibility/cooldown survives Redis loss.
2. Every destination wallet credit must affect exactly one row. Missing wallets roll back deductions, cooldown changes and delivery requests together.
3. Balance changes and delivery requests commit together. A MongoDB outage does not turn a committed payment into an API failure. A background worker retries history delivery using stable MongoDB document IDs and `$setOnInsert`.
4. Successful swaps update `next_swap_at` in the same transaction. `swap.cooldown_enabled` defaults to enabled and `swap.cooldown_hours` defaults to 24. An explicitly disabled cooldown permits deliberate repeated swaps.
5. History cannot be published from a rolled-back financial transaction. Partial MongoDB batches replay without creating duplicate documents.

## Safe retry contract

User send, swap, mining and boost requests require an `Idempotency-Key` header (16–128 ASCII letters/digits/underscore/hyphen). Keys are scoped to account and operation type. Identical requests replay the committed receipt; different details under a used key return a conflict. A lost COMMIT acknowledgment must be retried with the original key.

The Expo app persists a key before sending. Unknown responses, proxy failures and auth failures retain it, including across app restarts. A different payment is blocked while that result is uncertain. Only a confirmed receipt or an explicit ledger `NOT_COMMITTED` result clears it. JWT refreshes keep the same account scope.

A newly validated mining entitlement clears an obsolete pending mining request; the locked database cooldown still prevents duplicate rewards during races.

Internal/legacy admin transfer callers can supply the same header for replay protection; legacy calls without it get a new operation key. Do not assume automatic idempotency for external clients that intentionally submit new keys, or legacy admin AT-adjustment endpoints.

## MongoDB recovery

The worker runs every two seconds, retries failed deliveries after ten seconds, and bounds each MongoDB operation. Stable document IDs, acknowledged majority/journal writes and idempotent upserts make restarts and partial batches safe. Pending delivery does not re-run the balance mutation.

Account deletion cascades recovery receipts. Delivery locks existing account references and skips deleted recipients to avoid recreating erased history.

Responses expose `historyPending` while delivery is outstanding. Swap responses include the committed final receipt so the UI does not need MongoDB history to confirm the conversion. The app shows a syncing notice and schedules follow-up data refreshes.

There is no retroactive repair of old mismatched history/balances: that requires a separate read-only reconciliation review and explicit approval before any correction.

## Setup and verification

Startup executes only the additive `CREATE TABLE/INDEX IF NOT EXISTS` initialization. It does **not** run the legacy full setup/reset scripts. The normal setup script includes the same table for fresh installations.

```sh
pnpm exec tsc --noEmit
pnpm run test:centralized
```

The financial tests run actual service/controller code against isolated transaction/cache/history fixtures and loopback-only HTTP servers. They never send payments or mining claims against the configured user databases. New coverage includes concurrent retries, missing credits, cooldown enforcement, lost commit acknowledgments, outbox persistence failures, MongoDB outages, partial history batches and account deletion.

These checks are not a claim that signed-in/native end-to-end UI or every failure mode has been verified. Quoted rates are still not reserved atomically between review and execution.
