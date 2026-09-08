import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

/**
 * Shares the receipt somebody is looking at, not a description of it.
 *
 * Every receipt in this app was shared as four lines of plain text - an id, an
 * amount, a status. That arrives in somebody's WhatsApp as a message that could
 * have been typed by anyone, which is exactly what a receipt must not look
 * like. The point of a receipt is that it is evidence, and evidence has a face.
 *
 * So the card on screen is captured and sent as an image. It carries the
 * pattern, the amount set large, the provider, the date, the reference - the
 * whole document, the way a bank app does it.
 *
 * The text goes with it as a fallback rather than instead of it. Capture can
 * fail (a view laid out off screen, a device short of memory, a platform with
 * no share sheet for files), and the person tapping Share wants their
 * landlord to have something either way.
 */

type ShareableReceipt = {
  transactionId: string;
  totalAmount: string;
  statusLabel: string;
};

/** What a text-only share says. Kept close to the card so the two agree. */
function receiptText({ transactionId, totalAmount, statusLabel }: ShareableReceipt): string {
  return [
    `Payment receipt (${statusLabel})`,
    `Amount: ₦${totalAmount}`,
    `Transaction ID: ${transactionId}`,
  ].join('\n');
}

export type ShareReceiptResult = 'image' | 'text' | 'failed';

/**
 * @param viewRef the receipt card itself, not the screen around it - a capture
 *   of the whole screen would include the header and the buttons, which are
 *   controls rather than part of the document.
 */
export async function shareReceipt(
  viewRef: React.RefObject<unknown>,
  receipt: ShareableReceipt,
  /**
   * Hides the buttons and shows the brand mark for the length of the capture.
   * Called with true, awaited a frame, captured, then called with false - the
   * await matters, because capturing before the swap has painted would put the
   * Download button back in the image it was removed from.
   */
  setCapturing?: (capturing: boolean) => Promise<void> | void,
): Promise<ShareReceiptResult> {
  try {
    if (viewRef?.current && (await Sharing.isAvailableAsync())) {
      await setCapturing?.(true);

      const uri = await captureRef(viewRef as never, {
        format: 'png',
        /**
         * Full quality and two-times pixels. A receipt gets forwarded,
         * screenshotted and zoomed into by somebody checking a figure, and a
         * compressed one turns its own numbers to mush.
         */
        quality: 1,
        result: 'tmpfile',
      });

      /** Back before the sheet opens, so the screen never sits in capture dress. */
      await setCapturing?.(false);

      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share receipt',
        UTI: 'public.png',
      });
      return 'image';
    }
  } catch {
    /* falls through to text, which is better than nothing at all */
  } finally {
    /** Never leave the card without its buttons because a capture threw. */
    await setCapturing?.(false);
  }

  try {
    await Share.share({ message: receiptText(receipt), title: 'Payment receipt' });
    return 'text';
  } catch {
    return 'failed';
  }
}
