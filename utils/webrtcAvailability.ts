import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';

export const WEBRTC_UNAVAILABLE_MESSAGE =
  'In-app voice calls need a development build. Run npx expo run:ios or npx expo run:android (Expo Go does not support WebRTC).';

/** True only when react-native-webrtc native module is linked (dev/release build). */
export function isWebRtcNativeAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  if (Constants.appOwnership === 'expo') return false;
  return Boolean(NativeModules.WebRTCModule ?? (NativeModules as { WebRTC?: unknown }).WebRTC);
}

export type WebRtcModule = {
  RTCPeerConnection: new (config?: RTCConfiguration) => RTCPeerConnection;
  RTCSessionDescription: new (descriptionInitDict: RTCSessionDescriptionInit) => RTCSessionDescription;
  mediaDevices: { getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream> };
};

export async function loadWebRtcModule(): Promise<WebRtcModule | null> {
  if (!isWebRtcNativeAvailable()) return null;

  try {
    const mod = await import('react-native-webrtc');
    if (typeof mod.RTCPeerConnection !== 'function' || typeof mod.mediaDevices?.getUserMedia !== 'function') {
      return null;
    }
    /** The package's own types diverge structurally from our narrower surface. */
    return mod as unknown as WebRtcModule;
  } catch {
    return null;
  }
}

export function registerWebRtcGlobalsIfAvailable(): void {
  if (!isWebRtcNativeAvailable()) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-webrtc').registerGlobals();
  } catch {
    /* native build without webrtc — calls will show unavailable in UI */
  }
}
