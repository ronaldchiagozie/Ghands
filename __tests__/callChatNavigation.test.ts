import {
  markCallLive,
  openCallFromChat,
  openChatFromCall,
  takeRedialRequest,
} from '@/utils/callChatNavigation';

const fakeRouter = () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() });
const stack = (...routes: { name: string; params?: Record<string, unknown> }[]) => ({
  getState: () => ({ index: routes.length - 1, routes }),
});

describe('moving between a job call and its chat', () => {
  afterEach(() => markCallLive('5', false));

  it('goes back to the chat underneath instead of opening another', () => {
    const router = fakeRouter();
    const nav = stack({ name: 'JobDetails' }, { name: 'ChatScreen', params: { requestId: '5' } }, { name: 'CallScreen', params: { requestId: '5' } });
    expect(openChatFromCall(router, nav, '5', {}, true)).toBe('back');
    expect(router.back).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('keeps a live call underneath the chat, so it keeps running', () => {
    const router = fakeRouter();
    const nav = stack({ name: 'JobDetails' }, { name: 'CallScreen', params: { requestId: '5' } });
    expect(openChatFromCall(router, nav, '5', { requestId: '5' }, true)).toBe('push');
  });

  it('swaps an ended call for the chat, so Back does not return to it', () => {
    const router = fakeRouter();
    const nav = stack({ name: 'JobDetails' }, { name: 'CallScreen', params: { requestId: '5' } });
    expect(openChatFromCall(router, nav, '5', { requestId: '5' }, false)).toBe('replace');
    expect(router.replace).toHaveBeenCalled();
  });

  it('goes back to a live call underneath the chat without redialling', () => {
    const router = fakeRouter();
    markCallLive('5', true);
    const nav = stack({ name: 'CallScreen', params: { requestId: '5' } }, { name: 'ChatScreen', params: { requestId: '5' } });
    expect(openCallFromChat(router, nav, '5', {})).toBe('back');
    expect(takeRedialRequest('5')).toBe(false);
  });

  it('asks an ended call underneath to ring again, once', () => {
    const router = fakeRouter();
    const nav = stack({ name: 'CallScreen', params: { requestId: '5' } }, { name: 'ChatScreen', params: { requestId: '5' } });
    expect(openCallFromChat(router, nav, '5', {})).toBe('back');
    expect(takeRedialRequest('5')).toBe(true);
    expect(takeRedialRequest('5')).toBe(false);
  });

  it('opens a new call when none is underneath, or it is another job', () => {
    const router = fakeRouter();
    const nav = stack({ name: 'CallScreen', params: { requestId: '9' } }, { name: 'ChatScreen', params: { requestId: '5' } });
    expect(openCallFromChat(router, nav, '5', { requestId: '5' })).toBe('push');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/CallScreen', params: { requestId: '5' } });
  });
});
