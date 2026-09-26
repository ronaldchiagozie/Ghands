import { NativeModules } from 'react-native';

type InCallManagerApi = {
  start(options: { media: 'audio'; ringback?: string }): void;
  stop(): void;
  stopRingback(): void;
  setForceSpeakerphoneOn(on: boolean): void;
};

let cached: InCallManagerApi | null | undefined;

/** Null where the native module is missing (Expo Go, a build from before it was added). */
function manager(): InCallManagerApi | null {
  if (cached !== undefined) return cached;
  if (!NativeModules.InCallManager) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-incall-manager');
    cached = (mod?.default ?? mod) as InCallManagerApi;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * The phone's call audio: earpiece by default with the proximity sensor on,
 * the speaker on request, and a ringback tone while the other phone rings.
 * Every call is a no-op without the native module, so a call still works -
 * just without speaker switching.
 */
export const callAudio = {
  get canSwitchSpeaker(): boolean {
    return manager() != null;
  },
  startRinging(): void {
    manager()?.start({ media: 'audio', ringback: '_DTMF_' });
  },
  start(): void {
    manager()?.start({ media: 'audio' });
  },
  stopRinging(): void {
    manager()?.stopRingback();
  },
  setSpeaker(on: boolean): void {
    manager()?.setForceSpeakerphoneOn(on);
  },
  stop(): void {
    manager()?.stop();
  },
};
