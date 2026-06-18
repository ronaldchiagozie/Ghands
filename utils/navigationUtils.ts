import { EMPTY_LABEL } from '@/utils/copy';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Estimate travel time in minutes based on distance
 * Assumes average driving speed of 40 km/h in urban areas
 */
export function estimateTravelTime(distanceKm: number, mode: 'driving' | 'walking' = 'driving'): number {
  if (mode === 'walking') {
    // Average walking speed: 5 km/h
    return Math.round((distanceKm / 5) * 60);
  }
  // Average driving speed: 40 km/h in urban areas
  return Math.round((distanceKm / 40) * 60);
}

/**
 * Format distance for display (meters under 1 km, otherwise km with up to one decimal).
 */
export function formatDistance(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    return EMPTY_LABEL;
  }
  if (distanceKm < 1) {
    const m = Math.max(0, Math.round(distanceKm * 1000));
    return `${m} m`;
  }
  const rounded = Math.round(distanceKm * 10) / 10;
  const s = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${s} km`;
}

/**
 * Format travel time for display (minutes rounded; hours when ≥ 60 min).
 */
export function formatTravelTime(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) {
    return EMPTY_LABEL;
  }
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) {
    return total <= 0 ? '< 1 min' : `~${total} min`;
  }
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (mins === 0) {
    return `~${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `~${hours}h ${mins}m`;
}

/**
 * One line for job / provider cards: distance and ETA, e.g. "250 m away, ~5 min".
 */
export function formatProviderProximitySubtitle(
  distanceKm?: number | null,
  minutesAway?: number | null
): string | null {
  const parts: string[] = [];
  if (distanceKm != null && Number.isFinite(distanceKm) && distanceKm >= 0) {
    parts.push(`${formatDistance(distanceKm)} away`);
  }
  if (minutesAway != null && Number.isFinite(minutesAway) && minutesAway >= 0) {
    const timeLabel = formatTravelTime(minutesAway);
    if (timeLabel !== EMPTY_LABEL) {
      parts.push(timeLabel);
    }
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Open navigation in native maps app
 * Supports Google Maps and Apple Maps
 */
export async function openNavigation(
  destinationLat: number,
  destinationLon: number,
  destinationName?: string
): Promise<void> {
  const destination = `${destinationLat},${destinationLon}`;
  const label = destinationName ? encodeURIComponent(destinationName) : 'Destination';

  if (Platform.OS === 'ios') {
    // Try Apple Maps first on iOS
    const appleMapsUrl = `http://maps.apple.com/?daddr=${destination}&dirflg=d`;
    
    try {
      const canOpen = await Linking.canOpenURL(appleMapsUrl);
      if (canOpen) {
        await Linking.openURL(appleMapsUrl);
        return;
      }
    } catch (error) {
      // Fall through to Google Maps
    }
  }

  // Use Google Maps (works on both iOS and Android)
  const googleMapsUrl = Platform.select({
    ios: `comgooglemaps://?daddr=${destination}&directionsmode=driving`,
    android: `google.navigation:q=${destination}`,
  });

  if (googleMapsUrl) {
    try {
      const canOpen = await Linking.canOpenURL(googleMapsUrl);
      if (canOpen) {
        await Linking.openURL(googleMapsUrl);
        return;
      }
    } catch (error) {
      // Fall through to web Google Maps
    }
  }

  // Fallback to web Google Maps
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}${destinationName ? `&destination_place_id=${label}` : ''}`;
  
  try {
    await Linking.openURL(webUrl);
  } catch (error) {
    Alert.alert(
      'Unable to Open Maps',
      'Please install Google Maps or Apple Maps to get directions.',
      [{ text: 'OK' }]
    );
  }
}

/**
 * Open maps app to view location (without navigation)
 */
export async function openMaps(
  latitude: number,
  longitude: number,
  label?: string
): Promise<void> {
  const location = `${latitude},${longitude}`;
  const name = label ? encodeURIComponent(label) : 'Location';

  if (Platform.OS === 'ios') {
    const appleMapsUrl = `http://maps.apple.com/?ll=${location}&q=${name}`;
    
    try {
      const canOpen = await Linking.canOpenURL(appleMapsUrl);
      if (canOpen) {
        await Linking.openURL(appleMapsUrl);
        return;
      }
    } catch (error) {
      // Fall through to Google Maps
    }
  }

  // Use Google Maps
  const googleMapsUrl = Platform.select({
    ios: `comgooglemaps://?center=${location}&q=${name}`,
    android: `geo:${location}?q=${location}(${name})`,
  });

  if (googleMapsUrl) {
    try {
      const canOpen = await Linking.canOpenURL(googleMapsUrl);
      if (canOpen) {
        await Linking.openURL(googleMapsUrl);
        return;
      }
    } catch (error) {
      // Fall through to web
    }
  }

  // Fallback to web Google Maps
  const webUrl = `https://www.google.com/maps/search/?api=1&query=${location}`;
  
  try {
    await Linking.openURL(webUrl);
  } catch (error) {
    Alert.alert(
      'Unable to Open Maps',
      'Please install Google Maps or Apple Maps to view the location.',
      [{ text: 'OK' }]
    );
  }
}
