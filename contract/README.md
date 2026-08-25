# @ghands/contract

Status vocabulary shared by **ghands (client)**, **ghands-provider**, and
**Ghands-admin-dashboard**.

## Why this exists

The client and provider apps kept the same rules as independent copies, and they
drifted. The costly example: the provider treated `paid | confirmed | completed |
success` as a settled visit fee while the client accepted only `paid`, so the
client kept offering "Pay visit fee" for a fee the provider already considered
paid — a double charge.

Vocabulary that both sides must agree on lives here, once.

## Rules

1. **Pure only.** No React, no `apiClient`, no `@/…` imports, no platform code.
   `npm run check:contract-pure` enforces this.
2. **Both apps import it.** Never copy a function out of here into an app.
3. **Changing a status set is a breaking change.** Both apps ship together.

## Consuming it

Client (already wired) — `tsconfig.json` maps `@ghands/contract` to
`./contract/src`. The old `utils/…` modules re-export from here, so existing
imports keep working.

Provider — not yet migrated. See *Migration* below.

## Migration

This currently lives inside the client repo so it could be adopted without a
release. To promote it to a real shared dependency:

```bash
cd contract && git init && git add -A && git commit -m "Extract GHands contract"
# push to your org, then in each app:
npm install github:<org>/ghands-contract
```

Then delete the `@ghands/contract` path alias from `tsconfig.json` — the package
resolves from `node_modules` instead. No source changes in either app.
