/**
 * Which side of the thread a chat message belongs on.
 *
 * Shared because the two apps are the two sides of the same conversation, and a
 * disagreement here is visible to both people at once: the same message sits on
 * the right for one of them and on the left for the other.
 *
 * The rule the UI wants is the ordinary one — mine on the right, theirs on the
 * left — and everything below exists because the API does not answer "is this
 * mine" directly, and each of the signals it does give is unreliable on its own.
 */

export type ChatViewer = 'client' | 'provider';

export type MessageOwnershipInput = {
  /** Which app is asking. */
  viewer: ChatViewer;
  /** `senderType` from the API, lowercased. Frequently absent. */
  senderType?: string | null;
  /** Numeric sender id, when the API sent a usable one. */
  senderId?: number | null;
  /** The logged-in party's id: a user id in the client app, a company id in the provider app. */
  currentUserId?: number | null;
  /** The API's own view, when it sends one. */
  direction?: 'incoming' | 'outgoing' | null;
  /** What we decided for this message last time, for optimistic sends. */
  remembered?: boolean;
  /** The other party's provider id, where the client app knows it. */
  peerProviderId?: number | null;
};

export type MessageOwnershipBranch =
  | 'identity'
  | 'direction'
  | 'senderType'
  | 'remembered'
  | 'peerProvider'
  | 'unknown';

export type MessageOwnership = {
  isFromCurrentUser: boolean;
  /** Which rule decided it — logged in dev builds, and asserted in tests. */
  branch: MessageOwnershipBranch;
};

const CLIENT_TYPES = new Set(['user', 'client', 'customer']);
const PROVIDER_TYPES = new Set(['provider', 'company']);

function usableId(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Decides whether a message was sent by the person looking at it.
 *
 * The signals, in the order they are trusted:
 *
 * 1. **Sender type plus id.** Only together. Comparing a raw `senderId` against
 *    the logged-in id on its own is the bug this module was written for: user
 *    ids and provider ids are separate sequences, so client #7 talking to
 *    provider #7 matched on every incoming message and the entire thread
 *    collapsed onto the right-hand side. The type says which sequence the id
 *    belongs to, and without it the comparison is meaningless.
 * 2. **The API's `direction`.** Unambiguous when present.
 * 3. **Sender type alone**, when no id came with it.
 * 4. **What we decided before**, which carries an optimistic send through its
 *    first refresh.
 * 5. **The peer's provider id**, a client-app-only guess: anyone who is not the
 *    provider in this thread must be us. Last because it shares the id-space
 *    weakness above, and is only reached when nothing better exists.
 *
 * Defaults to "theirs". An incoming message misplaced on the left is a cosmetic
 * error; your own words appearing as though the other person said them is not.
 */
export function resolveMessageOwnership(input: MessageOwnershipInput): MessageOwnership {
  const { viewer, senderId, currentUserId, direction, remembered, peerProviderId } = input;

  const type = (input.senderType ?? '').toString().trim().toLowerCase();
  const isClientType = CLIENT_TYPES.has(type);
  const isProviderType = PROVIDER_TYPES.has(type);
  const typeKnown = isClientType || isProviderType;
  const senderIsViewerSide = viewer === 'provider' ? isProviderType : isClientType;

  if (typeKnown && usableId(senderId) && usableId(currentUserId)) {
    /**
     * A sender on the other side is the peer whatever their id says, so the
     * comparison only runs when both ids name the same kind of account.
     */
    return {
      isFromCurrentUser: senderIsViewerSide && senderId === currentUserId,
      branch: 'identity',
    };
  }

  if (direction === 'outgoing') return { isFromCurrentUser: true, branch: 'direction' };
  if (direction === 'incoming') return { isFromCurrentUser: false, branch: 'direction' };

  if (typeKnown) {
    return { isFromCurrentUser: senderIsViewerSide, branch: 'senderType' };
  }

  if (typeof remembered === 'boolean') {
    return { isFromCurrentUser: remembered, branch: 'remembered' };
  }

  if (viewer === 'client' && usableId(peerProviderId) && usableId(senderId)) {
    return { isFromCurrentUser: senderId !== peerProviderId, branch: 'peerProvider' };
  }

  return { isFromCurrentUser: false, branch: 'unknown' };
}
