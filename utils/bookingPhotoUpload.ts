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

  /**
   * Says which half failed, when one does.
   *
   * Both halves of this were silent: a photo that never became an https URL
   * and a photo that did but was refused by the details endpoint produced
   * the same `complete: false`, and the screen showed the same sentence for
   * either. So "my photos do not reach the provider" was unanswerable
   * without a device in hand - and the two causes need completely different
   * fixes, one on the phone and one on the server.
   */
  if (__DEV__) {
    console.log('[BookingPhotos] upload', {
      requestId,
      picked: candidates.length,
      reachedServer: uploaded.length,
      /** The scheme matters: ph:// and assets-library:// cannot be posted as-is. */
      schemes: candidates.map((uri) => uri.split(':')[0]),
      failedToUpload: candidates.length - uploaded.length,
    });
  }

  if (uploaded.length === 0) {
    return { uploaded: [], complete: false };
  }

  try {
    await serviceRequestService.attachRequestImages(requestId, uploaded);
    if (__DEV__) console.log('[BookingPhotos] attached to request', requestId, uploaded.length);
  } catch (error: any) {
    if (__DEV__) {
      console.log('[BookingPhotos] attach REFUSED', {
        requestId,
        status: error?.status,
        code: error?.code,
        message: error?.message,
      });
    }
    /* the booking still stands; the photos just did not make it */
    return { uploaded, complete: false };
  }

  return { uploaded, complete: uploaded.length === candidates.length };
}
