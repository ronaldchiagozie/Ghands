# Follow-up prompt: report back after building

Send this alongside the specification link once the backend dev starts work. It asks for a
report in a fixed shape so the mobile side can act on it without another round of
questions.

Same convention as last time: paste everything below the line into Claude Code from the
root of the GHands backend repository.

---

You have the GHands mobile team's booking specification, "The booking contract", with
fifteen requirements numbered R1 to R15. You have already replied to R1 to R13 and agreed
to build them. R14 and R15 were added after your reply and you have not seen them yet, so
read those two first.

When you have finished the work, write a report to `BACKEND_BUILD_REPORT.md` in the root of
this repository and keep it updated as you go. It goes back to the mobile team, who cannot
see this codebase, so it has to stand on its own.

## The model you are building towards

State it back in your own words at the top of the report, so we can check we agree before
reading the detail:

- A request is created as `draft` and stays `draft` while the customer fills it in.
- Choosing a provider records that choice and changes nothing else. The request is still
  `draft`. Nobody is told.
- Pressing confirm is the only thing that publishes. It moves `draft` to `pending`, records
  the chosen provider, and notifies that provider.
- While the selection window is open, only the chosen provider can see the job. When the
  window closes without an acceptance, it opens to other qualifying providers nearby.

If any part of that is not what you are building, say so at the top rather than in a
footnote. A disagreement found early is cheap.

## One report block per requirement

Cover every id from R1 to R15, in order, including the ones that need no work so we can see
they were considered. Use exactly this shape:

```markdown
## R2 - /confirm becomes the publish action

**Status:** done | in progress | not started | not needed | disagreed
**Endpoint:** POST /api/request-service/requests/:requestId/confirm
**Where:** src/request-service/controller/request-controller.ts:266 - confirmRequest()

**What changed:**
Two or three sentences. What the endpoint did before, what it does now.

**Request:**
Body fields added, removed or now required. Say "unchanged" if it is.

**Response:**
The shape a success returns now, as a real example with real field names.
Say "unchanged" if it is.

**Errors:**
Status codes and `code` values this can now return, and what each means.

**Test:** test/request-service.spec.ts - "publishes a draft and notifies the selected provider"
**Mobile impact:** none | exactly what the apps must change, and whether it is required
                   on the same deploy or can follow later
```

## A single table of every endpoint you touched

At the end of the report, before the sections below. This is the part we will read first,
so it needs to be complete:

```markdown
| Method | Path | What changed | Breaking? |
|--------|------|--------------|-----------|
| POST | /api/request-service/requests/:id/confirm | Now publishes and notifies; takes providerId | Yes |
```

Breaking means an app on the current release behaves differently, or wrongly, after you
deploy. Be strict about this. If you are unsure, mark it breaking and explain why in the
requirement block.

## Then three short sections

```markdown
## Deploy order and coordination
Anything that must ship in a particular order relative to a mobile release, and what
breaks if it does not. If nothing needs coordinating, say so plainly.

## Where the spec was wrong
Anything we asked for that does not make sense against this codebase, or that you
built differently and why. Be blunt. This has been the most useful part of every
round so far, and it has twice stopped us building the wrong thing.

## Still open
Anything you need a decision on before you can finish, with the options as you see
them. One line each.
```

## Two specific things to include

**The notification in R2 is new work.** You said there is no notification call in the
current selection path to repurpose. Tell us what you built: what the provider receives,
through which channel, and whether the mobile app needs to do anything to receive it.

**R14 and R15 are about who can see a published job.** We need the two states
distinguishable in the response we already read: waiting for the selected provider, versus
the window has closed and it is open to others. Tell us the exact field and values. Do not
leave us to work it out from a timestamp and the current time, because a clock on the
device is not a fact about your data.

## What not to do

Do not change a response shape without listing it in the table. Two rounds ago an
undocumented change to response nesting cost a week of debugging on the mobile side, and it
was only cheap to fix because we happened to test both shapes.

Do not treat a requirement as done because the field exists. R10 is the example worth
remembering: the photos were being returned all along, nested under the customer object as
`user.image`, which is why an eight-key probe never found them. Existing and reachable are
different things.
