import { serviceRequestService } from '@/services/api';
import { uploadImageUris } from '@/utils/aiImageUpload';

/**
 * Gets the customer's job photos to the provider.
 *
 * They were not getting there at all. AddPhotosScreen collected local
 * `file://` URIs from the picker, wrote them to AsyncStorage so the booking
 * summary could preview them on the same device, and that was the end of it.
 * Nothing was ever uploaded, and no image was attached to the request.
 *
 * Meanwhile the screen tells the customer "Help providers understand the
 * problem better" and "Clear, well-lit photos from a few angles help providers
 * quote accurately", and the provider app is fully built to display job images
 * - it probes eight different field names looking for them. So a customer
 * photographs a burst pipe, is told it will help, and the plumber quotes blind.
 */

/** Local picker URIs; anything already remote is passed through untouched. */
function isLocalUri(uri: string): boolean {
  return /^(file|content|ph|assets-library):/i.test(uri.trim());
}

export type BookingPhotoResult = {
  /** HTTPS URLs that reached the server. */
  uploaded: string[];
  /** True when every photo made it. */
  complete: boolean;
};

/**
 * Uploads the photos and attaches them to the request.
 *
 * Deliberately non-fatal in both halves. Photos are optional in this flow, and
 * a customer who has finished describing their job should not be blocked at the
 * last step because an image host was slow. What they must never get is the
 * current behaviour, where it silently does nothing and tells them it helped.
 */
export async function attachBookingPhotos(
  requestId: number,
  localUris: string[],
): Promise<BookingPhotoResult> {
  const candidates = localUris.map((uri) => uri.trim()).filter(Boolean);
  if (candidates.length === 0) return { uploaded: [], complete: true };

  /**
   * uploadImageUri returns the original local URI when the upload fails, so a
   * value that still looks local is a failure rather than a result. Sending one
   * to the server would store a path that only exists on this handset.
   */
  const results = await uploadImageUris(candidates);
  const uploaded = results.filter((uri) => typeof uri === 'string' && uri && !isLocalUri(uri));

  if (uploaded.length === 0) {
    return { uploaded: [], complete: false };
  }

  try {
    await serviceRequestService.attachRequestImages(requestId, uploaded);
  } catch {
    /* the booking still stands; the photos just did not make it */
    return { uploaded, complete: false };
  }

  return { uploaded, complete: uploaded.length === candidates.length };
}
