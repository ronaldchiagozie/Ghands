import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '@/lib/apiConfig';
import { authService } from '@/services/authService';

/**
 * A wallet transaction id the receipt endpoint can look up. Some receipts are
 * opened with a payment reference, or with nothing real at all, and asking
 * the server for a PDF of those can only 404.
 */
export function isReceiptTransactionId(id: string | null | undefined): id is string {
  return typeof id === 'string' && /^\d+$/.test(id.trim());
}

/**
 * Downloads the server's PDF receipt (GET /api/wallet/transactions/:id/receipt)
 * and opens the share sheet with it, which offers Save to Files.
 *
 * Returns false when it could not - no session, no share sheet, or the server
 * refused - so the caller can fall back to sharing the on-screen receipt.
 * A non-2xx response is rejected by the download itself, so an error body can
 * never be handed on as a PDF.
 */
export async function shareReceiptPdf(transactionId: string): Promise<boolean> {
  try {
    const token = await authService.getAuthToken();
    if (!token || !(await Sharing.isAvailableAsync())) return false;

    const destination = new File(Paths.cache, `ghands-receipt-${transactionId}.pdf`);
    const pdf = await File.downloadFileAsync(
      `${API_BASE_URL}/api/wallet/transactions/${encodeURIComponent(transactionId)}/receipt`,
      destination,
      { headers: { Authorization: `Bearer ${token}` }, idempotent: true }
    );

    await Sharing.shareAsync(pdf.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Receipt' });
    return true;
  } catch {
    return false;
  }
}
