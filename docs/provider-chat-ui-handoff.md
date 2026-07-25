# GHands Provider app — match Client **Chat / Messaging** UI (handoff for Cursor)

Use this in the **provider** repo so `ChatScreen` looks and behaves like the **client** app thread: soft sage background, grouped bubbles, clean header, floating composer — **not** a cramped grey box with wrong left/right alignment.

**Important:** The client app uses **one** `ChatScreen` for both roles. Provider mode = pass **`clientName`** in route params (no `providerName`). Copy the same components and layout; only labels, avatars, and identity logic flip.

**Client reference (source of truth):**

| Piece | Path in client repo |
|--------|---------------------|
| Full screen | `app/ChatScreen.tsx` |
| Message bubble row | `components/chat/ChatMessageRow.tsx` |
| Date pills | `components/chat/ChatDateSeparator.tsx` |
| Typing indicator | `components/chat/ChatTypingBubble.tsx` |
| Empty / loading | `components/chat/ChatThreadPlaceholder.tsx` |
| “New messages” chip | `components/chat/ChatNewMessagesChip.tsx` |
| Grouping + dates | `utils/chatListItems.ts`, `utils/chatFormatting.ts` |
| Open chat params | `utils/navigation.ts` → `buildChatScreenParams` |
| Call button in header | `components/call/CallIcons.tsx` → `CallIconOutline` |

---

## 1. Design goal (why client chat looks better)

**Do**

- **Thread background** `#F7F8F5` (warm light grey-green) — messages “float” on it; composer sits on **white**.
- **Header** white with hairline border `#EEF1E8` — not a thick colored bar.
- **Bubble grouping**: consecutive messages from same person stack with **2px** gap; **8px** between groups.
- **Max bubble width ~78%** — never full-width paragraphs touching screen edges.
- **Outgoing (you)** = sage green `#4F6739` bubble, **white text**, right-aligned.
- **Incoming (peer)** = **white** bubble, thin border, soft shadow, left-aligned + small avatar on **last** message in group only.
- **One composer row**: rounded pill input `#F7F8F5` + border `#E1E8D6`; send is **gradient green circle** only when text exists.
- **Poppins** everywhere; body **14.5px**, line height **19**.

**Don’t**

- Put every message in a box with heavy borders and no grouping.
- Show avatar on every line (clutter).
- Use dark theme or high-contrast blue/iMessage clone unless product asks — GHands is **sage + white**.
- Align all bubbles left because API `senderType` is wrong (see §7).

---

## 2. Screen structure (4 zones)

```
┌──────────────────────────────────────────┐
│ Zone A — Header (fixed)                  │
│  [←]  avatar + name + subtitle   [📞][⋮]  │
├──────────────────────────────────────────┤
│ Zone B — Optional sync banner (amber)    │
├──────────────────────────────────────────┤
│ Zone C — Message list (flex, #F7F8F5)    │
│  date pill → grouped bubbles → typing    │
│  empty state OR loading centered         │
│  [ New messages chip ] (if scrolled up)  │
├──────────────────────────────────────────┤
│ Zone D — Footer (fixed, moves w/ keyboard)│
│  [ Send quotation ] — provider only       │
│  [ Type a message...        (send) ]      │
└──────────────────────────────────────────┘
```

- **FlatList** `contentContainerStyle`: `paddingTop: 10`, `paddingBottom: footerHeight + 10`.
- Footer is **`position: 'absolute'`** bottom + `keyboardInset` so list doesn’t hide under composer.
- Measure footer with `onLayout` → pass height to list padding + new-messages chip offset.

---

## 3. Header spec (Zone A)

| Element | Spec |
|---------|------|
| Horizontal padding | `Spacing.lg` (16) |
| Bottom border | 1px `#EEF1E8` |
| Back button | 38×38 min touch, radius 19, bg `#F6F8F1`, ArrowLeft 22px |
| Peer avatar | 42×42 circle, bg `#F6F8F1`, 1px subtle border |
| Active dot | 11×11 green `#22C55E`, white 2px ring, bottom-right of avatar when peer messaged within **2 min** |
| Name | 16px **Poppins-SemiBold**, `#111827` |
| Subtitle | 11.5px Regular — `Active now` / `Active 5m ago` / `3 unread` (join with ` · `) |
| Call | 38×38, bg `Colors.sageTint`, `CallIconOutline` 19px accent → `CallScreen` with `isProvider: 'true'` |
| Menu | 38×38, bg `#F6F8F1`, MoreVertical → bottom sheet “Chat options” |

**Provider:** `peerName = clientName` from params. Show **client** placeholder avatar (`userimg`) when provider view; show provider asset when client view.

---

## 4. Message bubbles (`ChatMessageRow`)

### Alignment

- `isFromCurrentUser === true` → **right** (`justifyContent: 'flex-end'`).
- Else → **left** + optional 28px avatar column.

### Grouping (from `buildChatListItems`)

- Same sender + same `isFromCurrentUser` → one group.
- **Corner radius** (iMessage-style tail on last in group):
  - Outgoing: bottom-right **5** on last bubble; middle bubbles tighter top-right **12**.
  - Incoming: bottom-left **5** on last; middle bubbles tighter top-left **12**.
- **Time + ticks** only on **`isLastInGroup`** (10px, color `#9AA19A`).

### Outgoing bubble

- Background: `Colors.accent` (`#4F6739`)
- Text: white, 14.5px Regular, lineHeight 19
- Padding: 14×7, borderRadius 18

### Incoming bubble

- Background: white
- Border: `rgba(17, 24, 39, 0.045)`
- Text: `Colors.textPrimary`
- Light shadow (iOS) / elevation 1 (Android)

### Status icons (outgoing only)

| Status | Icon |
|--------|------|
| sending | small spinner |
| sent | single check grey |
| delivered | double check grey |
| read | double check `#4F46E5` |
| failed | alert red — **tap to retry** |

### Avatar on incoming

- **28×28**, only when `isLastInGroup && !isFromCurrentUser`
- Spacer 28px width when not last (keeps alignment)

### Enter animation

- Fade + 10px spring up (220ms); skip if reduced motion.

---

## 5. Date separator

- Centered pill: bg `#E9EEE0`, radius 999, padding 12×4, margin vertical 8
- Text: 11px **Poppins-Medium**, `#64705A`
- Labels: **Today**, **Yesterday**, or `Jun 12` / `Jun 12, 2025`

---

## 6. Composer (Zone D)

**Quotation strip (provider only, if no quote yet)**

- White card, radius 18, border `#DCE8C9`, padding ~11×13
- Left: 34px circle sage tint + FileText icon
- Title: “Send quotation” 13.5px SemiBold
- Subtitle: “Share pricing without leaving the chat flow” 11px Regular
- Right: Send icon accent
- Navigates to `SendQuotationScreen` with `requestId`

**Input container**

- Outer: white bar, top border `#EEF1E8`, horizontal pad 14, bottom safe area
- Inner pill: bg `#F7F8F5`, border `#E1E8D6`, radius **26**, minHeight **52**
- Placeholder: “Type a message…” 15px, placeholder color from design tokens
- Multiline, max 500 chars
- **Send**: only if trimmed text && !sending — LinearGradient `[accent, #5D8700]`, 38×38 circle, Send icon white 18
- **Sending**: ActivityIndicator in send slot

---

## 7. Message ownership (critical — provider must copy logic)

Wrong alignment = “ugly” and broken UX. Port **`mapApiMessageToUI`** + **`extractSenderFieldsFromApiMessage`** from `ChatScreen.tsx`.

**Provider view detection:** `isProviderView = !!params.clientName`

**Current user id**

- Client app: `authService.getUserId()`
- **Provider app: `authService.getCompanyId()`** (company/provider party id)

**Decide `isFromCurrentUser` in order:**

1. Compare `senderId` from API to current user/company id  
2. (Client only) If known `providerId`, messages from that id are **not** mine  
3. API `direction`: `outgoing` / `incoming`  
4. Optimistic cache per message id  
5. Fallback `senderType` (`provider` / `user` / `client`)

**Outgoing on provider app** → right green bubbles. **Incoming client** → left white.

Poll messages every **2s** while screen focused; mark read on focus; pull-to-refresh.

---

## 8. Extra UX (match client)

| Feature | Behavior |
|---------|----------|
| Empty state | Icon well + “No messages yet” + “Say hello to {peerName}…” |
| Loading | Centered on `#F7F8F5`, “Loading messages” |
| Sync degraded | Amber bar: “Reconnecting messages…” |
| New messages chip | Dark pill above composer when user scrolled up and new inbound arrives |
| Typing | `ChatTypingBubble` — white bubble + three dots, peer avatar |
| Long press | Delete for me (local) |
| Menu sheet | View job details, Clear local cache, Close |
| Keyboard | Adjust footer `bottom` + scroll to end on show |

---

## 9. Route params (provider)

Open chat like client:

```typescript
buildChatScreenParams({
  requestId: jobId,
  clientName: 'Ada Okonkwo',      // required for provider view
  fromJobHub: true,
});
```

Do **not** pass `providerName` on provider app (that switches to client UI mode).

Optional: `providerId` on client app only for bubble alignment when API omits sender ids.

**Call from chat header:**

```typescript
router.push({
  pathname: '/CallScreen',
  params: {
    callState: 'outgoing',
    callerName: clientName,
    requestId: String(requestId),
    isProvider: 'true',
    // jobTitle, location, etc. when available
  },
});
```

---

## 10. Colors & spacing cheat sheet

```text
Thread background:     #F7F8F5
Header/composer bg:    #FFFFFF
Header border:         #EEF1E8
Icon well back/menu:   #F6F8F1
Accent / outgoing:     #4F6739
Send gradient end:     #5D8700
Input pill border:     #E1E8D6
Date pill bg:          #E9EEE0
Meta time text:        #9AA19A
Active green:          #16A34A / #22C55E
Unread in subtitle:    same row as last active label
Horizontal bubble pad: 16
Bubble internal pad:   14 × 7
Group gap:             2px inner / 8px between groups
```

Font: **Poppins** (Regular / Medium / SemiBold / Bold).

---

## 11. Implementation checklist (provider Cursor)

1. [ ] Copy `components/chat/*` and wire one `ChatScreen` matching zones A–D.
2. [ ] Copy `utils/chatListItems.ts` + `utils/chatFormatting.ts`.
3. [ ] Port `mapApiMessageToUI` using **`getCompanyId()`** on provider.
4. [ ] Pass real **`clientName`** + avatar URL when API provides (not literal “Client”).
5. [ ] Keep **Send quotation** strip above composer for open jobs without quote.
6. [ ] Use same API: `communicationService.getMessages`, `sendMessage`, `markMessagesAsRead`.
7. [ ] Test: send message stays **right**; client reply **left**; grouping + date pills; keyboard doesn’t cover input.

---

## 12. One-line prompt for Provider Cursor

> Rebuild ChatScreen to match GHands **client** messaging UI: white header with 42px peer avatar + active dot, `#F7F8F5` thread, grouped `ChatMessageRow` bubbles (green right / white left), date pills, typing bubble, gradient send button, provider “Send quotation” strip, fixed composer with keyboard inset. Port `buildChatListItems` and provider-aware `mapApiMessageToUI` with `getCompanyId()`. Pass `clientName` only. Match spacing and colors in `docs/provider-chat-ui-handoff.md`.

---

## 13. Related

- Voice UI parity: `docs/provider-call-ui-handoff.md`
- Review list on profiles: section 9 in call handoff doc + `utils/reviewerDisplayName.ts`

---

*Generated from GHands client app — keep in sync when `ChatScreen.tsx` or `components/chat/*` changes.*
