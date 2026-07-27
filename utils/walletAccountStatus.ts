export type WalletAccountStatus = {
  label: string;
  tone: 'active' | 'restricted' | 'inactive' | 'default';
  /** True when label came from a wallet API field (not client default). */
  fromApi: boolean;
};

function readStatusString(raw: Record<string, unknown>): string | null {
  const candidates = [
    raw.status,
    raw.walletStatus,
    raw.accountStatus,
    raw.state,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function labelFromStatusString(status: string): WalletAccountStatus {
  const normalized = status.toLowerCase();
  if (['active', 'enabled', 'open', 'verified'].includes(normalized)) {
    return { label: 'Active', tone: 'active', fromApi: true };
  }
  if (['frozen', 'suspended', 'blocked', 'locked', 'restricted'].includes(normalized)) {
    const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return { label, tone: 'restricted', fromApi: true };
  }
  if (['inactive', 'disabled', 'closed'].includes(normalized)) {
    const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return { label, tone: 'inactive', fromApi: true };
  }
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return { label, tone: 'default', fromApi: true };
}

/** Map GET /api/wallet payload to a display status when the backend provides one. */
export function mapWalletAccountStatus(walletData: Record<string, unknown>): WalletAccountStatus {
  const nested =
    walletData.wallet && typeof walletData.wallet === 'object'
      ? (walletData.wallet as Record<string, unknown>)
      : null;

  const statusStr = readStatusString(walletData) ?? (nested ? readStatusString(nested) : null);
  if (statusStr) {
    return labelFromStatusString(statusStr);
  }

  const isFrozen = walletData.isFrozen ?? nested?.isFrozen;
  if (isFrozen === true) {
    return { label: 'Frozen', tone: 'restricted', fromApi: true };
  }

  const isActive = walletData.isActive ?? nested?.isActive;
  if (typeof isActive === 'boolean') {
    return isActive
      ? { label: 'Active', tone: 'active', fromApi: true }
      : { label: 'Inactive', tone: 'inactive', fromApi: true };
  }

  return { label: 'Active', tone: 'active', fromApi: false };
}

export function walletStatusDotColor(tone: WalletAccountStatus['tone']): string {
  switch (tone) {
    case 'active':
      return 'rgba(255,255,255,0.55)';
    case 'restricted':
      return 'rgba(255, 196, 120, 0.95)';
    case 'inactive':
      return 'rgba(255, 255, 255, 0.35)';
    default:
      return 'rgba(255,255,255,0.45)';
  }
}
