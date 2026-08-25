/**
 * Moved to the shared contract so the client and provider apps cannot drift.
 * Re-exported here so existing `@/utils/walletSettlement` imports keep working.
 *
 * New code should import from '@ghands/contract' directly.
 */
export * from '@ghands/contract/walletSettlement';
