/**
 * Shared GHands contract.
 *
 * Every module here is pure: no React, no network client, no platform imports.
 * That is deliberate — it is what lets the client, provider, and admin apps all
 * consume this without pulling each other's dependencies in.
 *
 * Nothing in here may import from `@/…`. If a rule needs app state, it belongs
 * in the app, not the contract.
 */
export * from './visitStatus';
export * from './walletTransactions';
export * from './walletSettlement';
export * from './quotationStatus';
