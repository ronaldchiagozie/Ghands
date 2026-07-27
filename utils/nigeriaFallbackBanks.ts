/** Used when GET /api/wallet/banks is empty or fails — same list as provider onboarding. */
export const NIGERIA_FALLBACK_BANKS = [
  { code: '044', name: 'Access Bank' },
  { code: '014', name: 'Afrigo' },
  { code: '023', name: 'CitiBank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '058', name: 'GTBank' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '032', name: 'Union Bank' },
  { code: '033', name: 'UBA' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '232', name: 'Sterling Bank' },
] as const;
