# GHands Provider app — match Client **Call** UI (handoff for Cursor)

Use this doc in the **provider** repo to rebuild `CallScreen` so it looks and feels like the **client** app call experience: calm, spaced out, one focal point, no crowded toolbars.

**Client reference (source of truth):**

| Piece | Path in client repo |
|--------|---------------------|
| Screen layout & states | `app/CallScreen.tsx` |
| Reusable UI | `components/call/CallUiParts.tsx` |
| Icons (SVG) | `components/call/CallIcons.tsx` |
| WebRTC hook | `hooks/useVoiceCallWebRtc.ts` |
| API | `communicationService.initiateCall`, `updateCallStatus` |

Provider should pass `isProvider: 'true'` into call params; peer label becomes **Client** instead of **Provider**.

---

## 1. Design goal (why client looks “good” vs “ugly”)

**Do**

- **Light background** (`#F8FAF7` / `Colors.backgroundLight`) — not dark full-screen green or grey slabs.
- **One vertical story**: status → avatar → name → role → short status line → optional job chip → actions at bottom.
- **Generous whitespace** between sections (`Spacing.lg` / `Spacing.xl` = 16–24px), not everything stacked with 4px gaps.
- **Large touch targets**: primary/danger actions **68×68** circles; secondary **56×56**.
- **Few colors**: sage green accent, white cards, soft borders — no rainbow row of equal-weight buttons.
- **Typography hierarchy**: one **24px Bold** name, **14px Medium** role, **15px Regular** status (max width ~300px, centered).

**Don’t**

- Cram job details, timer, mute, speaker, end, and chat on one dense row.
- Use tiny icon-only buttons with no labels under them.
- Use heavy drop shadows on every element.
- Show duplicate titles (nav bar + huge “CALLING” + banner).

---

## 2. Screen structure (3 zones)

```
┌─────────────────────────────────────┐
│  Zone A — Header (contextual)       │  Incoming/Active: centered title only
│  Outgoing/Ended: ScreenHeader back  │  “Incoming call” / “On call” / “Calling”
├─────────────────────────────────────┤
│  Zone B — Scrollable hero (flex)    │  Status pill
│                                     │  Avatar + pulse rings (when ringing)
│                                     │  Caller name (2 lines max)
│                                     │  Peer role (“Client” on provider app)
│                                     │  Status line (1–2 lines)
│                                     │  Compact job pill (optional)
│                                     │  Job summary card (ended only)
├─────────────────────────────────────┤
│  Zone C — Fixed footer (actions)    │  State-specific button row
│                                     │  Trust line (shield + legal copy)
└─────────────────────────────────────┘
```

- **Zone B** uses `ScrollView` with `flexGrow: 1` so short phones still scroll if job card appears.
- **Zone C** is **outside** the scroll view so Answer/End never jump off-screen.

Horizontal padding: **`Spacing.lg` (16)** on hero, **`Spacing.xl` (20)** on footer.

---

## 3. Core components (copy or port 1:1)

### 3.1 `CallStatusPill`

Small capsule under the header — not a full-width banner.

| Tone | Background | Text | Use |
|------|------------|------|-----|
| `warning` | `#FFF7DF` | amber/brown | Ringing / Connecting |
| `active` | `#ECFDF3` | `#047857` | Live timer `MM:SS` |
| `error` | `#FEF2F2` | red | Failed / unavailable |
| `neutral` | white + border | grey | Call ended |

- Padding: `12×6`, `borderRadius: 999`, `Poppins-SemiBold` 13px.

### 3.2 Avatar block

- Outer box: **140×140** centered (room for animation).
- **Avatar circle: 112×112**, white fill, **3px border**
  - Ringing/outgoing: `rgba(79, 103, 57, 0.2)` (sage at 20%)
  - Active: solid **`Colors.accent`** (`#4F6739`)
- Photo: full-bleed in circle; fallback inner **72×72** on **`Colors.sageTint`** with `User` icon 34px accent.

### 3.3 `CallPulseRing` (ringing only)

- Two animated rings behind avatar, sage border `rgba(79, 103, 57, 0.28)`.
- 1400ms loop, scale ~1.0 → 1.22, fade out.
- Respect **reduced motion** → hide rings.

### 3.4 `CallActionButton`

Vertical stack: **circle + label under** (12px `Poppins-Medium`, grey).

| Variant | Size | Fill | Icon color |
|---------|------|------|------------|
| `primary` | 68 | `#4F6739` accent | white |
| `danger` | 68 | `#EF4444` (errorBright) | white |
| `secondary` | 56 | white | dark grey or accent |

- Gap between **Answer** and **Decline**: **48px** (incoming).
- Active row (Mute / End / Speaker): **28px** gap, End stays center emphasis (danger 68).

Icons: custom SVG in `CallIcons.tsx` (handset answer/end, mic, speaker, message) — not mixed Lucide sizes in one row.

### 3.5 Compact job pill (during call)

Only when `requestId` present and call **not** ended:

- White card, `borderRadius: 12`, padding `14×10`.
- Border: `rgba(79, 103, 57, 0.12)`.
- Single line: **`{jobTitle} · #{requestId}`**, 13px Medium, accent color, max 2 lines.

### 3.6 `CallJobSummaryCard` (ended state only)

- White card, 16px radius, 16px padding, light border.
- Eyebrow: `RELATED JOB` (11px uppercase, letter-spacing 0.4).
- Title 16px SemiBold, subtitle 13px Regular (location · time).
- Primary button: **View job** — accent fill, 12px radius.

---

## 4. Call states & copy (provider app)

Set `isProvider === true`. Swap peer naming:

| State | Header | Pill | Status line example |
|-------|--------|------|---------------------|
| `incoming` | Incoming call | Ringing | “Client is calling about your job” |
| `outgoing` | Calling (+ back) | Connecting / Ringing | “Setting up secure voice…” / “Calling {name}…” |
| `active` | On call | `MM:SS` (active tone) | “You are connected” / WebRTC status |
| `ended` | Call ended (+ back) | Ended · duration | “Call finished” |

**Footer actions**

- **Incoming**: Decline (danger) + Answer (primary), gap 48.
- **Outgoing**: Cancel (danger); if error → **Try again** (secondary below).
- **Active**: Mute | **End** | Speaker — End is red 68px center.
- **Ended**: Message + Call again (secondary 56px), gap 40.

**Trust footer** (always):

- Shield 14px + text 11px Regular, centered, max one line wrap:
  - “GHands secure voice · recorded for quality and disputes”

---

## 5. Spacing cheat sheet (no congestion)

| Between | Margin |
|---------|--------|
| Status pill → avatar block | `Spacing.xl` (24) |
| Avatar → name | `Spacing.lg` (16) |
| Name → role | 4px |
| Role → status line | `Spacing.md` (12) |
| Status → job pill | `Spacing.lg` |
| Action row → trust line | `Spacing.lg` |

**Max width** on status text: **300px**, `textAlign: 'center'`, `lineHeight: 22`.

---

## 6. Colors & fonts (align with client GHands)

```text
accent (brand green):     #4F6739
backgroundLight:            #F8FAF7  (screen)
sageTint:                   light green-grey (avatar placeholder)
textPrimary:                #111827
textSecondaryDark:          #6B7280
error / danger button:      #EF4444
white:                      #FFFFFF
```

Font family everywhere: **Poppins** (Bold / SemiBold / Medium / Regular as in client).

---

## 7. Navigation params (parity)

Provider should open the same screen with the same param names:

```typescript
{
  callState: 'incoming' | 'outgoing' | 'active' | 'ended',
  callerName: string,
  callerId?: string,
  callerImage?: string,
  requestId: string,
  jobTitle?: string,
  jobDescription?: string,
  location?: string,
  scheduledDate?: string,
  scheduledTime?: string,
  isProvider: 'true',
}
```

After end: **Message** → chat with client; **View job** → provider job hub for that `requestId`.

---

## 8. Implementation checklist for provider Cursor

1. [ ] Copy or symlink `components/call/CallUiParts.tsx` + `CallIcons.tsx`.
2. [ ] Rebuild screen using **3-zone layout** above; delete old cramped button rows.
3. [ ] Wire `useVoiceCallWebRtc` + same `communicationService` endpoints.
4. [ ] Pass real **client name + avatar** from job/chat (not literal “Client” when API has names).
5. [ ] Test 4 states on a small phone (SE) — footer buttons must not overlap trust line.
6. [ ] Test reduced motion — pulse rings off, layout unchanged.

---

## 13. Related

- **Messaging / chat UI parity:** `docs/provider-chat-ui-handoff.md`
- Review list on profiles: section 9 below + `utils/reviewerDisplayName.ts`

---

## 9. Optional: Reviews section parity (if provider profile looks “ugly”)

Your reviews list should match client **ProviderDetailScreen** reviews:

- Section title **Reviews** — 18px Bold, left aligned, margin above section.
- Each review: **white card**, border `rgba(17,24,39,0.06)`, radius **16**, padding **16**, **12–16px gap between cards**.
- Row: 40px avatar | name **15px SemiBold** | time **12px grey** on same row.
- Stars below name row (yellow `#F59E0B` / `#EAB308`), not cramped into header.
- Body **14px Regular**, line height **20–22**, grey `#374151`.

Client maps reviewer names via `utils/reviewerDisplayName.ts` — use the same helper logic so you don’t show placeholder “Client” for every row when API sends `firstName`/`lastName`.

---

## 10. One-line prompt for Provider Cursor

> Reimplement `CallScreen` to match GHands **client** call UI: light `#F8FAF7` background, 3-zone layout (header / scroll hero / fixed actions), `CallStatusPill` + 112px avatar with optional `CallPulseRing`, name + role + status, compact job pill, `CallActionButton` circles (68 primary/danger, 56 secondary) with labels, ended job card, shield trust footer. Port `CallUiParts.tsx` and `CallIcons.tsx`. Provider uses `isProvider: true` and peer label “Client”. No dense icon-only toolbars.

---

*Generated from GHands client app — keep in sync when `CallScreen.tsx` or `CallUiParts.tsx` changes.*
