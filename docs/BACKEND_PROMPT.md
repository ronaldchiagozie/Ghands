# Backend work — prompt for Claude Code

Paste everything below the line into Claude Code, from the root of the **GHands backend**
repository. Send the three links alongside it.

> **Before you send this:** the three documents are private by default. Open each one and use
> the page's **share menu** to make it accessible, or Claude Code will not be able to read them.
> If you would rather not share links, paste the contents of each document instead.

---

You are working on the GHands backend. Two mobile apps depend on it: a **client** app (customers
book home services) and a **provider** app (tradespeople accept and complete those jobs). Both are
in production testing right now, with real money moving through a Korapay wallet.

An audit of both mobile apps produced three documents. Read all three before you touch anything:

1. **Backend punch list** — twelve findings, each verified against the live API
   https://claude.ai/code/artifact/303f154e-80f9-4a31-a9e1-9e46a40a41e6
2. **Phantom pending jobs** — a `draft` status for service requests
   https://claude.ai/code/artifact/e1330756-d0fd-40ab-90d4-04a5ba98ad37
3. **Unverified providers** — identity verification must gate dispatch
   https://claude.ai/code/artifact/2d88c716-1edf-4dea-850d-95a1ace1add6

## How to work

**Verify before you change.** Every finding in those documents was tested against the live API
from outside, without a valid auth token. That means some conclusions are inferences. Your first
job on each item is to confirm it against the actual source, and **tell me if a finding is wrong**
— that is more useful than a fix built on a bad premise.

**Start by reporting, not coding.** For each item, tell me:
- whether it reproduces in this codebase
- the file and function where it lives
- what you propose to change
- anything the documents got wrong

Wait for my go-ahead before changing money-handling code.

**Do not break the mobile apps.** They are live. If a change alters a response shape, a status
value, or an error format, say so explicitly and list every endpoint affected, so we can ship the
app update alongside it. Assume the apps are strict about nothing and defensive about everything —
they already carry a lot of unwrapping code to cope with inconsistent responses, and I would like
to delete it, not add more.

**Write a test for each fix.** Especially the money ones. Two of these were found only because
someone watched them happen.

## Priority order

Work in this order unless I say otherwise.

### 1. Crash reporting — do this first

`POST /crash-reports` and `POST /analytics/events` both return 404. The apps have been posting to
them all along, so **there is currently no crash visibility in production at all**. Every other
bug on this list is found by accident until this works.

Either implement both, or tell me the correct paths and we will point the apps at them.

### 2. The money items — punch list 01 to 04

- **01 — payment amounts.** Confirm whether `/api/wallet/pay` takes the amount from
  `req.body.amount` or from the accepted quotation. If it trusts the body, a modified client can
  underpay. Same for `/pay-logistics-fee`.
- **02 — double credit.** A ₦100 deposit was credited twice from a single bank debit. Verifying
  the same reference twice must credit once.
- **03 — idempotency keys** on `/pay`, `/pay-logistics-fee`, `/withdraw`, `/deposit`.
- **04 — withdrawals are failing.** Korapay returns "You are not authorized to access this
  resource". Likely a payout credential or merchant approval issue on this deployment.

### 3. Provider verification

See document 3. Unverified providers must not appear in `/api/provider/nearby` (the customer's
list) or `/api/provider/requests/available` (the provider's job feed), and
`POST /requests/:id/accept` must reject them. `pending` counts as unverified.

### 4. Draft service requests

See document 2. One new status value; no mobile app changes required.

### 5. Everything else on the punch list

## Questions I need you to ask me

Do not guess at these. Ask, and wait.

1. **`verified` on `/api/provider/nearby`** — does it mean identity-verified, or currently
   available to take work? The client app is currently using it as an availability flag. If both
   concepts are needed they need two fields.
2. **Face verification review time** — is it automated or manual, and how long does `pending`
   typically last? If it is manual and slow, we need to know before deciding how hard to gate.
3. **Signup tokens** — does `POST /api/user/signup` always return an auth token? The client has a
   fallback for a response with a user id and no token, which suggests it sometimes does not.
4. **Hosting tier** — is this on a paid Render instance? If it sleeps, cold starts of tens of
   seconds are being read as failures by users, and they are what triggers the deposit
   double-credit.
5. **Handy (the AI assistant)** — `/api/ai/status` returns `available: false` unconditionally.
   Is that a deliberate switch-off, a missing provider key on this deployment, or something else?
   The whole client side is built and waiting on that flag.

## Two cross-cutting things

**Response shapes.** Four different formats came back from the live API in one afternoon:

```
success       {"success":true,"message":"Success","data":{"data":{…}}}
validation    {"success":false,"message":"Failed","data":{"error":"…"}}
auth          {"error":"No authorization token"}        ← no envelope
unknown route an HTML error page                        ← not JSON at all
```

This is not cosmetic. A payment result read from the wrong nesting level has no `status` field,
and the payment screen treated that as a completed debit — a success receipt for a payment whose
outcome was unknown. One envelope for everything, errors included, and drop the double
`data.data`.

**Auth failures.** Four routes, four answers to a request with no token: 500, 500, 400, and a bare
JSON error. The 500s mean the handler is *crashing* rather than rejecting — probably reading
something off a user object before the auth check. Return 401 in the standard envelope everywhere.

## Error codes

Wherever you touch an error path, add a stable machine-readable `code` alongside the message:
`PIN_INVALID`, `INSUFFICIENT_BALANCE`, `PIN_NOT_SET`, `BANK_ACCOUNT_INVALID`,
`AUTH_TOKEN_MISSING`, `PROVIDER_NOT_VERIFIED`. The apps currently pattern-match English text,
which breaks whenever wording changes.

## Definition of done

For each item: it reproduces, it is fixed, there is a test, and you have told me whether any
mobile app change is needed to go with it.

Start by reading the three documents and giving me your report on items 1 and 2. Do not change
anything yet.
