/**
 * Which side a chat bubble lands on.
 *
 * The bug this exists for: ownership was decided by `senderId === currentUserId`
 * with no regard for what kind of account the id named. User ids and provider
 * ids are separate sequences, so a client whose user id is 7, talking to the
 * provider whose id is 7, matched on every single message — incoming and
 * outgoing alike — and the whole thread stacked up on the right.
 *
 * Low ids collide constantly early in a product's life, which is exactly when
 * people are forming an opinion of it.
 */
import { resolveMessageOwnership } from '@/contract/src/messageOwnership';

describe('resolveMessageOwnership', () => {
  describe('the id collision', () => {
    const collision = { senderId: 7, currentUserId: 7 } as const;

    it('does not claim the provider’s message because the ids happen to match', () => {
      const result = resolveMessageOwnership({
        viewer: 'client',
        senderType: 'provider',
        ...collision,
      });
      expect(result.isFromCurrentUser).toBe(false);
      expect(result.branch).toBe('identity');
    });

    it('still recognises the client’s own message at the same id', () => {
      const result = resolveMessageOwnership({
        viewer: 'client',
        senderType: 'user',
        ...collision,
      });
      expect(result.isFromCurrentUser).toBe(true);
    });

    /** The same collision seen from the other app. */
    it('holds from the provider side too', () => {
      expect(
        resolveMessageOwnership({ viewer: 'provider', senderType: 'user', ...collision })
          .isFromCurrentUser,
      ).toBe(false);
      expect(
        resolveMessageOwnership({ viewer: 'provider', senderType: 'company', ...collision })
          .isFromCurrentUser,
      ).toBe(true);
    });
  });

  describe('the two apps agree', () => {
    /**
     * The same message, read by both people. Exactly one of them must own it,
     * or it sits on the right for both and the thread reads as a monologue.
     */
    const message = { senderType: 'user', senderId: 12 } as const;

    it('is mine to the client and theirs to the provider', () => {
      const asClient = resolveMessageOwnership({ ...message, viewer: 'client', currentUserId: 12 });
      const asProvider = resolveMessageOwnership({ ...message, viewer: 'provider', currentUserId: 4 });
      expect(asClient.isFromCurrentUser).toBe(true);
      expect(asProvider.isFromCurrentUser).toBe(false);
    });
  });

  describe('falling back', () => {
    it('uses the API direction when the type is missing', () => {
      expect(
        resolveMessageOwnership({ viewer: 'client', direction: 'outgoing', senderId: 3, currentUserId: 9 }),
      ).toEqual({ isFromCurrentUser: true, branch: 'direction' });
      expect(
        resolveMessageOwnership({ viewer: 'client', direction: 'incoming', senderId: 9, currentUserId: 9 }),
      ).toEqual({ isFromCurrentUser: false, branch: 'direction' });
    });

    it('uses the sender type when no id came with it', () => {
      expect(
        resolveMessageOwnership({ viewer: 'client', senderType: 'customer' }),
      ).toEqual({ isFromCurrentUser: true, branch: 'senderType' });
      expect(
        resolveMessageOwnership({ viewer: 'client', senderType: 'company' }),
      ).toEqual({ isFromCurrentUser: false, branch: 'senderType' });
    });

    /** Keeps an optimistic bubble on the right through its first refresh. */
    it('remembers what it decided before', () => {
      expect(
        resolveMessageOwnership({ viewer: 'client', remembered: true }),
      ).toEqual({ isFromCurrentUser: true, branch: 'remembered' });
    });

    it('falls back to the peer provider id only when nothing better exists', () => {
      expect(
        resolveMessageOwnership({ viewer: 'client', senderId: 31, peerProviderId: 31 }),
      ).toEqual({ isFromCurrentUser: false, branch: 'peerProvider' });
      expect(
        resolveMessageOwnership({ viewer: 'client', senderId: 8, peerProviderId: 31 }),
      ).toEqual({ isFromCurrentUser: true, branch: 'peerProvider' });
    });

    /**
     * The safe direction to be wrong in. A message of theirs on the left when it
     * should be yours is cosmetic; your own words attributed to them is not.
     */
    it('treats a message with no usable signal as theirs', () => {
      expect(resolveMessageOwnership({ viewer: 'client' })).toEqual({
        isFromCurrentUser: false,
        branch: 'unknown',
      });
    });
  });

  describe('unusable values', () => {
    it('ignores an unknown sender type rather than guessing from it', () => {
      const result = resolveMessageOwnership({
        viewer: 'client',
        senderType: 'system',
        senderId: 7,
        currentUserId: 7,
      });
      expect(result.branch).not.toBe('identity');
    });

    it('ignores NaN and null ids', () => {
      expect(
        resolveMessageOwnership({
          viewer: 'client',
          senderType: 'user',
          senderId: NaN,
          currentUserId: 7,
          direction: 'outgoing',
        }).branch,
      ).toBe('direction');
      expect(
        resolveMessageOwnership({ viewer: 'client', senderType: 'user', senderId: 7, currentUserId: null }).branch,
      ).toBe('senderType');
    });

    it('is not confused by casing or padding on the type', () => {
      expect(
        resolveMessageOwnership({ viewer: 'client', senderType: '  Provider ', senderId: 7, currentUserId: 7 })
          .isFromCurrentUser,
      ).toBe(false);
    });
  });
});
