/**
 * Getting a customer's job photos to the provider.
 *
 * They were not getting there at all. The photos step collected local file://
 * URIs, wrote them to AsyncStorage so the booking summary could preview them on
 * the same device, and stopped. Nothing uploaded, nothing attached to the
 * request - while the screen promised "help providers understand the problem
 * better" and the provider app probed eight field names looking for images that
 * were never sent.
 */
const mockUploadImageUris = jest.fn();
jest.mock('@/utils/aiImageUpload', () => ({
  uploadImageUris: (...args: any[]) => mockUploadImageUris(...args),
}));

const mockAttach = jest.fn();
jest.mock('@/services/api', () => ({
  serviceRequestService: { attachRequestImages: (...args: any[]) => mockAttach(...args) },
}));

import { attachBookingPhotos } from '@/utils/bookingPhotoUpload';

describe('attachBookingPhotos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uploads the photos and attaches the urls to the request', async () => {
    mockUploadImageUris.mockResolvedValue([
      'https://cdn.test/a.jpg',
      'https://cdn.test/b.jpg',
    ]);
    mockAttach.mockResolvedValue(undefined);

    const result = await attachBookingPhotos(418, ['file:///tmp/a.jpg', 'file:///tmp/b.jpg']);

    expect(result).toEqual({
      uploaded: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'],
      complete: true,
    });
    expect(mockAttach).toHaveBeenCalledWith(418, [
      'https://cdn.test/a.jpg',
      'https://cdn.test/b.jpg',
    ]);
  });

  /**
   * uploadImageUri returns the original local URI when an upload fails, so a
   * value that still looks local is a failure wearing the shape of a result.
   * Sending one on would store a path that exists only on that handset.
   */
  it('never sends a local uri to the server', async () => {
    mockUploadImageUris.mockResolvedValue([
      'https://cdn.test/a.jpg',
      'file:///tmp/b.jpg',
      'content://media/c.jpg',
    ]);
    mockAttach.mockResolvedValue(undefined);

    const result = await attachBookingPhotos(418, ['a', 'b', 'c']);

    expect(mockAttach).toHaveBeenCalledWith(418, ['https://cdn.test/a.jpg']);
    expect(result.complete).toBe(false);
  });

  it('reports incomplete when nothing uploaded', async () => {
    mockUploadImageUris.mockResolvedValue(['file:///tmp/a.jpg']);

    const result = await attachBookingPhotos(418, ['file:///tmp/a.jpg']);

    expect(result).toEqual({ uploaded: [], complete: false });
    expect(mockAttach).not.toHaveBeenCalled();
  });

  /** The booking still stands; the photos just did not make it. */
  it('reports incomplete when the attach is rejected', async () => {
    mockUploadImageUris.mockResolvedValue(['https://cdn.test/a.jpg']);
    mockAttach.mockRejectedValue(new Error('images is not an allowed field'));

    const result = await attachBookingPhotos(418, ['file:///tmp/a.jpg']);

    expect(result).toEqual({ uploaded: ['https://cdn.test/a.jpg'], complete: false });
  });

  it('does nothing at all when there are no photos', async () => {
    const result = await attachBookingPhotos(418, []);
    expect(result).toEqual({ uploaded: [], complete: true });
    expect(mockUploadImageUris).not.toHaveBeenCalled();
    expect(mockAttach).not.toHaveBeenCalled();
  });

  it('ignores blank entries rather than uploading them', async () => {
    const result = await attachBookingPhotos(418, ['', '   ']);
    expect(result.complete).toBe(true);
    expect(mockUploadImageUris).not.toHaveBeenCalled();
  });
});
