import { confirmSent, mergeServerMessages, rowKeyOf, type SyncedMessage } from '@/utils/chatMessageSync';

const at = (s: number) => new Date(Date.UTC(2026, 8, 26, 10, 0, s)).toISOString();

const theirs = (id: string, s: number, text = 'hello'): SyncedMessage => ({
  id,
  text,
  timestamp: at(s),
  isFromCurrentUser: false,
});
const mine = (id: string, s: number, text: string, status: SyncedMessage['status'] = 'sent'): SyncedMessage => ({
  id,
  text,
  timestamp: at(s),
  isFromCurrentUser: true,
  status,
});

describe('a refresh while a message is sending', () => {
  it('keeps the message that is still on its way', () => {
    const sending = mine('temp-1', 10, 'On my way', 'sending');
    const merged = mergeServerMessages([theirs('1', 0), sending], [theirs('1', 0)]);
    expect(merged.map((m) => m.id)).toEqual(['1', 'temp-1']);
  });

  it('keeps a failed message so it can be retried', () => {
    const failed = mine('temp-2', 10, 'Are you there?', 'failed');
    expect(mergeServerMessages([failed], [])).toEqual([failed]);
  });

  it('shows a message once when the server already has it', () => {
    const sending = mine('temp-1', 10, 'On my way', 'sending');
    const merged = mergeServerMessages([sending], [mine('55', 11, 'On my way')]);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('55');
    expect(rowKeyOf(merged[0])).toBe('temp-1');
  });

  it('keeps sending two identical messages as two', () => {
    const a = mine('temp-1', 10, 'ok', 'sending');
    const b = mine('temp-2', 11, 'ok', 'sending');
    const merged = mergeServerMessages([a, b], [mine('60', 10, 'ok')]);
    expect(merged.map((m) => m.id)).toEqual(['60', 'temp-2']);
  });
});

describe('the send coming back', () => {
  it('turns the temporary row into the real message without a new identity', () => {
    const sending = mine('temp-1', 10, 'On my way', 'sending');
    const [confirmed] = confirmSent([sending], 'temp-1', mine('55', 10, 'On my way'));
    expect(confirmed.id).toBe('55');
    expect(confirmed.status).toBe('sent');
    expect(rowKeyOf(confirmed)).toBe('temp-1');
  });

  it('drops the temporary row if a refresh already brought the real one', () => {
    const list = [mine('55', 10, 'On my way'), mine('temp-1', 10, 'On my way', 'sending')];
    const next = confirmSent(list, 'temp-1', mine('55', 10, 'On my way'));
    expect(next.map((m) => m.id)).toEqual(['55']);
    expect(rowKeyOf(next[0])).toBe('temp-1');
  });

  it('keeps the row identity through later refreshes', () => {
    const [confirmed] = confirmSent([mine('temp-1', 10, 'hi', 'sending')], 'temp-1', mine('55', 10, 'hi'));
    const [refreshed] = mergeServerMessages([confirmed], [mine('55', 10, 'hi', 'read')]);
    expect(refreshed.status).toBe('read');
    expect(rowKeyOf(refreshed)).toBe('temp-1');
  });
});
