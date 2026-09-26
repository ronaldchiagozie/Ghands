import { Platform } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';

/**
 * Apple Maps on iOS, Google Maps on Android.
 *
 * Google on iOS needs a Maps SDK key built into the app and a Cloud project
 * with billing on. Builds made on EAS had neither - the key lived only in a
 * local .env - so TestFlight drew an empty map where the simulator, built
 * from this machine, drew a full one. Apple Maps needs no key at all.
 */
export const MAP_PROVIDER = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;
