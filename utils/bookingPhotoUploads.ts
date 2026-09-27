/**
 * Booking photos uploading in the background while the customer moves on.
 *
 * Add photos used to hold the customer on a "Finding providers" pop-up until
 * every photo had uploaded, then hand over to the map, which showed two more
 * loading pages of its own - four loaders in a row for one tap. Now Continue
 * goes straight to the map and the upload finishes behind it. The booking is
 * only sent to a provider after the upload settles (see
 * {@link waitForBookingPhotoUpload}), so the provider still gets the photos.
 */

export type BookingPhotoUploadResult = { complete: boolean; uploaded: string[] };

const pending = new Map<string, Promise<BookingPhotoUploadResult>>();

export function trackBookingPhotoUpload(
  requestId: number | string,
  upload: Promise<BookingPhotoUploadResult>,
): Promise<BookingPhotoUploadResult> {
  const key = String(requestId);
  const settled = upload.catch(() => ({ complete: false, uploaded: [] as string[] }));
  pending.set(key, settled);
  void settled.finally(() => {
    if (pending.get(key) === settled) pending.delete(key);
  });
  return settled;
}

/** The upload still running for this booking, if any. */
export function pendingBookingPhotoUpload(requestId: number | string): Promise<BookingPhotoUploadResult> | null {
  return pending.get(String(requestId)) ?? null;
}

/**
 * Waits for this booking's photos before it is sent, up to `timeoutMs`. A slow
 * upload does not hold the booking hostage: past the limit it goes without
 * them, and the photos still attach to the job when the upload lands.
 */
export async function waitForBookingPhotoUpload(requestId: number | string, timeoutMs = 20000): Promise<void> {
  const upload = pendingBookingPhotoUpload(requestId);
  if (!upload) return;
  await Promise.race([upload, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}
