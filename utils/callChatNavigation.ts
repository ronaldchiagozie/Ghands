/**
 * Moving between a job's call and its chat without stacking screens.
 *
 * Both used to push. Job -> Call -> Message -> Call -> Message left five
 * screens, so Back walked through every one of them, including calls that had
 * long ended - it looked as if the call was still going. Now each hop first
 * looks at the screen underneath: if it is the other half of the same job's
 * conversation, it goes back to it rather than opening another.
 *
 * This file is identical in the customer and provider apps.
 */

type Route = { name?: string; params?: object };
type NavigationLike = { getState?: () => { index?: number; routes?: readonly Route[] } | undefined };
type RouterLike = { back: () => void; push: (href: any) => void; replace: (href: any) => void };

/** The screen directly underneath this one, if any. */
export function previousRoute(navigation: NavigationLike | null | undefined): Route | null {
  const state = navigation?.getState?.();
  const routes = state?.routes;
  const index = typeof state?.index === 'number' ? state.index : (routes?.length ?? 0) - 1;
  if (!routes || index < 1) return null;
  return routes[index - 1] ?? null;
}

function isScreen(route: Route | null, name: string, requestId: unknown): boolean {
  if (!route?.name || route.name.replace(/^\//, '') !== name) return false;
  const params = (route.params ?? {}) as Record<string, unknown>;
  return String(params.requestId ?? '') === String(requestId ?? '');
}

/** The job whose call is ringing or connected, so a hop back knows not to redial it. */
let liveCallRequestId: string | null = null;
/** Set when the chat asks the ended call underneath it to ring again. */
let redialRequestId: string | null = null;

export function markCallLive(requestId: unknown, live: boolean): void {
  const id = requestId == null ? null : String(requestId);
  if (live) liveCallRequestId = id;
  else if (liveCallRequestId === id) liveCallRequestId = null;
}

export function isCallLive(requestId: unknown): boolean {
  return liveCallRequestId != null && liveCallRequestId === String(requestId ?? '');
}

/** True once, for the call screen the chat just sent the person back to. */
export function takeRedialRequest(requestId: unknown): boolean {
  if (redialRequestId == null || redialRequestId !== String(requestId ?? '')) return false;
  redialRequestId = null;
  return true;
}

/**
 * Message, from the call screen. Back to the chat if it is underneath. A live
 * call stays underneath the chat so it keeps running; an ended one is swapped
 * out, so Back from the chat goes to the job and not to a finished call.
 */
export function openChatFromCall(
  router: RouterLike,
  navigation: NavigationLike | null | undefined,
  requestId: unknown,
  chatParams: Record<string, unknown>,
  callIsLive: boolean,
): 'back' | 'push' | 'replace' {
  if (isScreen(previousRoute(navigation), 'ChatScreen', requestId)) {
    router.back();
    return 'back';
  }
  const href = { pathname: '/ChatScreen', params: chatParams };
  if (callIsLive) {
    router.push(href);
    return 'push';
  }
  router.replace(href);
  return 'replace';
}

/**
 * Call, from the chat. Back to the call if it is underneath - still going, or
 * ended and asked to ring again - rather than a second call screen on top.
 */
export function openCallFromChat(
  router: RouterLike,
  navigation: NavigationLike | null | undefined,
  requestId: unknown,
  callParams: Record<string, unknown>,
): 'back' | 'push' {
  if (isScreen(previousRoute(navigation), 'CallScreen', requestId)) {
    if (!isCallLive(requestId)) redialRequestId = String(requestId ?? '');
    router.back();
    return 'back';
  }
  router.push({ pathname: '/CallScreen', params: callParams });
  return 'push';
}
