import type { ServiceRequest } from '@/services/api';

const TECH = require('../assets/images/Category icons/Technician.png');
/**
 * The neutral stand-in for a step with no better art. Was plumbericon2.png,
 * so an unmatched category rendered its whole timeline as plumbing.
 */
const DEFAULT_ICON = TECH;

/** First photo URL from common API shapes (`images`, `photos`, etc.). */
export function extractFirstRemoteImageUrl(req: any): string | null {
  if (!req || typeof req !== 'object') return null;
  const raw = req.images ?? req.photos ?? req.media ?? req.attachments ?? req.imageUrls;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0];
  if (typeof first === 'string' && (first.startsWith('http') || first.startsWith('file'))) return first;
  if (first && typeof first === 'object') {
    const u = (first as any).url ?? (first as any).uri ?? (first as any).path;
    if (typeof u === 'string' && (u.startsWith('http') || u.startsWith('file'))) return u;
  }
  return null;
}

function headshotFromPerson(p: any): string | null {
  if (!p) return null;
  for (const key of ['image', 'avatar', 'profileImage', 'photoUrl']) {
    const v = p[key];
    if (typeof v === 'string' && (v.startsWith('http') || v.startsWith('https') || v.startsWith('file'))) return v;
  }
  return null;
}

export function getProviderHeadshotUrl(acceptedProviders: any[], request: ServiceRequest | null): string | null {
  const fromList = acceptedProviders?.[0]?.provider;
  const h = headshotFromPerson(fromList);
  if (h) return h;
  return headshotFromPerson(request?.selectedProvider);
}

export function pickCategoryPlaceholderImage(categoryName?: string): number {
  const c = (categoryName || '').toLowerCase().replace(/\s+/g, ' ');
  const pairs: Array<[string, number]> = [
    ['plumb', require('../assets/images/Category icons/Plumbing.png')],
    ['electric', require('../assets/images/Category icons/Electricity.png')],
    ['paint', require('../assets/images/Category icons/Painting.png')],
    ['clean', require('../assets/images/Category icons/Cleaning.png')],
    ['carpent', require('../assets/images/Category icons/Carpentry.png')],
    ['air', require('../assets/images/Category icons/Appliance_repair.png')],
    ['condition', require('../assets/images/Category icons/Appliance_repair.png')],
    ['til', require('../assets/images/Category icons/Tiling.png')],
    ['roof', require('../assets/images/Category icons/Roofing.png')],
    ['pest', require('../assets/images/Category icons/Pest_control.png')],
    ['security', require('../assets/images/Category icons/Security.png')],
    ['cctv', require('../assets/images/Category icons/CCTV_camera.png')],
    ['solar', require('../assets/images/Category icons/Solar_Installation.png')],
    ['appliance', require('../assets/images/Category icons/Appliance_repair.png')],
    ['automotive', require('../assets/images/Category icons/Automotive.png')],
    ['pool', require('../assets/images/Category icons/Pool.png')],
    ['floor', require('../assets/images/Category icons/Flooring.png')],
    ['waste', require('../assets/images/Category icons/Waste_disposal.png')],
    ['borehole', require('../assets/images/Category icons/Borehole.png')],
    ['insulation', require('../assets/images/Category icons/Insulation.png')],
    ['curtain', require('../assets/images/Category icons/Curtains.png')],
    ['blind', require('../assets/images/Category icons/Blinds_installation.png')],
    ['upholstery', require('../assets/images/Category icons/Upholstery.png')],
    ['gate', require('../assets/images/Category icons/Gate_fabrication.png')],
    ['mason', require('../assets/images/Category icons/Mansory.png')],
  ];
  for (const [needle, img] of pairs) {
    if (c.includes(needle)) return img;
  }
  return DEFAULT_ICON;
}

/**
 * Add `imageUrl` (remote) and/or `localImageRequire` (Metro asset) for each timeline row on the client job screen.
 */
export function enrichClientTimelineSteps(steps: any[], request: ServiceRequest, acceptedProviders: any[]): any[] {
  const remoteJobImage = extractFirstRemoteImageUrl(request);
  const categoryImg = pickCategoryPlaceholderImage(request.categoryName);
  const providerImg = getProviderHeadshotUrl(acceptedProviders, request);

  return steps.map((step) => {
    const out = { ...step };
    switch (step.id) {
      case 'step-1':
        out.imageUrl = remoteJobImage || undefined;
        out.localImageRequire = remoteJobImage ? undefined : categoryImg;
        break;
      case 'step-1.5': {
        const url = headshotFromPerson(request.selectedProvider) || providerImg || null;
        out.imageUrl = url || undefined;
        out.localImageRequire = url ? undefined : DEFAULT_ICON;
        break;
      }
      case 'step-2':
        if (step.title === 'Provider Accepted' || step.isCompleted) {
          out.imageUrl = providerImg || undefined;
          out.localImageRequire = providerImg ? undefined : TECH;
        } else {
          out.localImageRequire = TECH;
        }
        break;
      case 'step-3':
        out.imageUrl = remoteJobImage || undefined;
        out.localImageRequire = remoteJobImage ? undefined : TECH;
        break;
      case 'step-3b':
        out.localImageRequire = categoryImg;
        break;
      case 'step-4':
        out.imageUrl = providerImg || undefined;
        out.localImageRequire = providerImg ? undefined : categoryImg;
        break;
      case 'step-5':
        out.imageUrl = providerImg || undefined;
        out.localImageRequire = providerImg ? undefined : TECH;
        break;
      case 'step-6':
        out.imageUrl = providerImg || undefined;
        out.localImageRequire = providerImg ? undefined : categoryImg;
        break;
      default:
        out.localImageRequire = categoryImg;
    }
    return out;
  });
}
