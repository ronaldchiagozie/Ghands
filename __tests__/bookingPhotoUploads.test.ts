import {
  pendingBookingPhotoUpload,
  trackBookingPhotoUpload,
  waitForBookingPhotoUpload,
} from '@/utils/bookingPhotoUploads';

describe('booking photos uploading behind the map', () => {
  it('is waited on before the booking is sent, then forgotten', async () => {
    let finish!: (v: { complete: boolean; uploaded: string[] }) => void;
    trackBookingPhotoUpload(42, new Promise((resolve) => (finish = resolve)));
    expect(pendingBookingPhotoUpload(42)).not.toBeNull();

    let sent = false;
    const send = waitForBookingPhotoUpload(42).then(() => (sent = true));
    await Promise.resolve();
    expect(sent).toBe(false);

    finish({ complete: true, uploaded: ['https://x/a.jpg'] });
    await send;
    expect(sent).toBe(true);
    await Promise.resolve();
    expect(pendingBookingPhotoUpload(42)).toBeNull();
  });

  it('never holds the booking past its limit', async () => {
    jest.useFakeTimers();
    trackBookingPhotoUpload(7, new Promise(() => undefined));
    const send = waitForBookingPhotoUpload(7, 5000);
    jest.advanceTimersByTime(5000);
    await expect(send).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it('turns a failed upload into an incomplete result instead of an error', async () => {
    const result = await trackBookingPhotoUpload(9, Promise.reject(new Error('upload failed')));
    expect(result).toEqual({ complete: false, uploaded: [] });
  });

  it('has nothing to wait for when no photos were chosen', async () => {
    await expect(waitForBookingPhotoUpload(1234)).resolves.toBeUndefined();
  });
});
