import React from 'react';
import { Image, ImageSourcePropType, Text, View } from 'react-native';
import {
  AirConditioning,
  Bathroom,
  Catering,
  Ceilings,
  Construction,
  Fumigation,
  Furniture,
  GeneralRepair,
  Generator,
  GlassWork,
  Internet,
  Landscaping,
  Locksmith,
  Moving,
  Photography,
  Salon,
  Satellite,
  Tailoring,
  Tutoring,
  Waterproofing,
  Welding,
  type TradeGlyph,
} from '@/components/icons/TradeGlyphs';

import { Colors } from '@/lib/designSystem';

const ICON_SIZE = 40;

/** Metro requires static string literals for each image. */
const ASSETS = {
  applianceRepair: require('../assets/images/Category icons/Appliance_repair.png'),
  automotive: require('../assets/images/Category icons/Automotive.png'),
  blindsInstallation: require('../assets/images/Category icons/Blinds_installation.png'),
  borehole: require('../assets/images/Category icons/Borehole.png'),
  cctvCamera: require('../assets/images/Category icons/CCTV_camera.png'),
  carpentry: require('../assets/images/Category icons/Carpentry.png'),
  cleaning: require('../assets/images/Category icons/Cleaning.png'),
  curtains: require('../assets/images/Category icons/Curtains.png'),
  electricity: require('../assets/images/Category icons/Electricity.png'),
  flooring: require('../assets/images/Category icons/Flooring.png'),
  gateFabrication: require('../assets/images/Category icons/Gate_fabrication.png'),
  insulation: require('../assets/images/Category icons/Insulation.png'),
  mansory: require('../assets/images/Category icons/Mansory.png'),
  painting: require('../assets/images/Category icons/Painting.png'),
  pestControl: require('../assets/images/Category icons/Pest_control.png'),
  plumbing: require('../assets/images/Category icons/Plumbing.png'),
  pool: require('../assets/images/Category icons/Pool.png'),
  roofing: require('../assets/images/Category icons/Roofing.png'),
  security: require('../assets/images/Category icons/Security.png'),
  solarInstallation: require('../assets/images/Category icons/Solar_Installation.png'),
  technician: require('../assets/images/Category icons/Technician.png'),
  tiling: require('../assets/images/Category icons/Tiling.png'),
  upholstery: require('../assets/images/Category icons/Upholstery.png'),
  wasteDisposal: require('../assets/images/Category icons/Waste_disposal.png'),
} as const;

/** Normalized file stems ↔ asset (exact match on full label). */
const STEM_ASSET_ENTRIES: { stem: string; source: ImageSourcePropType }[] = [
  { stem: 'appliance repair', source: ASSETS.applianceRepair },
  { stem: 'automotive', source: ASSETS.automotive },
  { stem: 'blinds installation', source: ASSETS.blindsInstallation },
  { stem: 'borehole', source: ASSETS.borehole },
  { stem: 'cctv camera', source: ASSETS.cctvCamera },
  { stem: 'carpentry', source: ASSETS.carpentry },
  { stem: 'cleaning', source: ASSETS.cleaning },
  { stem: 'curtains', source: ASSETS.curtains },
  { stem: 'electricity', source: ASSETS.electricity },
  { stem: 'flooring', source: ASSETS.flooring },
  { stem: 'gate fabrication', source: ASSETS.gateFabrication },
  { stem: 'insulation', source: ASSETS.insulation },
  { stem: 'mansory', source: ASSETS.mansory },
  { stem: 'masonry', source: ASSETS.mansory },
  { stem: 'painting', source: ASSETS.painting },
  { stem: 'pest control', source: ASSETS.pestControl },
  { stem: 'plumbing', source: ASSETS.plumbing },
  { stem: 'pool', source: ASSETS.pool },
  { stem: 'roofing', source: ASSETS.roofing },
  { stem: 'security', source: ASSETS.security },
  { stem: 'solar installation', source: ASSETS.solarInstallation },
  { stem: 'solar_installation', source: ASSETS.solarInstallation },
  { stem: 'technician', source: ASSETS.technician },
  { stem: 'tiling', source: ASSETS.tiling },
  { stem: 'upholstery', source: ASSETS.upholstery },
  { stem: 'waste disposal', source: ASSETS.wasteDisposal },
  { stem: 'waste_disposal', source: ASSETS.wasteDisposal },
];

/**
 * Phrases are checked in array order; longer / more specific phrases first.
 * Rule order matters: first match wins.
 */
const ICON_RULES: { source: ImageSourcePropType; phrases: string[] }[] = [
  {
    source: ASSETS.wasteDisposal,
    phrases: [
      'waste disposal',
      'waste management',
      'rubbish removal',
      'garbage disposal',
      'trash removal',
      'refuse',
      'septic',
      'landfill',
      'rubbish',
      'garbage',
      'trash',
      'waste',
    ],
  },
  {
    source: ASSETS.cctvCamera,
    phrases: [
      'cctv',
      'surveillance camera',
      'security camera',
      'ip camera',
      'dvr',
      'nvr',
    ],
  },
  {
    source: ASSETS.pestControl,
    phrases: [
      'pest control',
      'exterminat',
      'rodent',
      'termite',
      'fumigat',
      'insect',
      'cockroach',
      'rat ',
    ],
  },
  {
    source: ASSETS.solarInstallation,
    phrases: [
      'solar installation',
      'solar panel',
      'photovoltaic',
      'pv system',
      'solar power',
      'solar energy',
      'solar',
    ],
  },
  {
    source: ASSETS.gateFabrication,
    phrases: [
      'gate fabrication',
      'metal gate',
      'driveway gate',
      'security gate',
      'gate install',
      'gate repair',
      'welding gate',
      'gate',
    ],
  },
  {
    source: ASSETS.blindsInstallation,
    phrases: [
      'blinds installation',
      'window blinds',
      'venetian',
      'roller blind',
      'blinds',
      'shutter install',
    ],
  },
  {
    source: ASSETS.borehole,
    phrases: [
      'borehole',
      'water well',
      'well drilling',
      'drilling',
      'bore ',
    ],
  },
  {
    source: ASSETS.applianceRepair,
    phrases: [
      'appliance repair',
      'fridge repair',
      'refrigerator',
      'washing machine',
      'dishwasher',
      'oven repair',
      'appliance',
    ],
  },
  {
    source: ASSETS.pool,
    phrases: [
      'swimming pool',
      'pool maintenance',
      'pool cleaning',
      'pool',
    ],
  },
  {
    source: ASSETS.plumbing,
    phrases: [
      'plumbing',
      'plumber',
      'plumb',
      'pipework',
      'drainage',
      'drain ',
      'sewer',
      'leak repair',
      'toilet',
      'faucet',
      'tap ',
      'gutter',
      'water heater',
      'water tank',
      'water pipe',
    ],
  },
  {
    source: ASSETS.electricity,
    phrases: [
      'electricity',
      'electrical',
      'electrician',
      'electric',
      'wiring',
      'rewiring',
      'circuit',
      'lighting install',
      'power outlet',
      'generator',
    ],
  },
  {
    source: ASSETS.carpentry,
    phrases: [
      'carpentry',
      'carpenter',
      'woodwork',
      'cabinet',
      'furniture repair',
      'shelving',
      'decking',
    ],
  },
  {
    source: ASSETS.cleaning,
    phrases: [
      'house cleaning',
      'deep clean',
      'cleaning',
      'cleaner',
      'housekeep',
      'maid',
      'janitor',
      'sanitize',
    ],
  },
  {
    source: ASSETS.painting,
    phrases: [
      'painting',
      'painter',
      'paint job',
      'repaint',
      'wall paint',
    ],
  },
  {
    source: ASSETS.roofing,
    phrases: [
      'roofing',
      'roofer',
      'roof repair',
      'roof leak',
      'gutter install',
      'roof',
    ],
  },
  {
    source: ASSETS.tiling,
    phrases: [
      'tiling',
      'tile install',
      'ceramic tile',
      'porcelain',
      'grout',
      'tile',
    ],
  },
  {
    source: ASSETS.flooring,
    phrases: [
      'flooring',
      'floor install',
      'laminate',
      'hardwood',
      'vinyl floor',
      'floor ',
    ],
  },
  {
    source: ASSETS.insulation,
    phrases: [
      'insulation',
      'insulate',
      'thermal insulation',
      'ceiling insulation',
    ],
  },
  {
    source: ASSETS.mansory,
    phrases: [
      'masonry',
      'mansory',
      'brickwork',
      'brick layer',
      'stonework',
      'concrete wall',
      'blockwork',
    ],
  },
  {
    source: ASSETS.automotive,
    phrases: [
      'automotive',
      'auto repair',
      'car repair',
      'mechanic',
      'vehicle',
      'motor ',
      'car service',
      'car wash',
    ],
  },
  {
    source: ASSETS.security,
    phrases: [
      'security system',
      'alarm system',
      'access control',
      'burglar',
      'security',
      'armed response',
    ],
  },
  {
    source: ASSETS.technician,
    phrases: [
      'technician',
      'handyman',
      'general repair',
      'maintenance tech',
      'it support',
      'tech support',
    ],
  },
  {
    source: ASSETS.upholstery,
    phrases: [
      'upholstery',
      'reupholster',
      'sofa repair',
      'furniture fabric',
    ],
  },
  {
    source: ASSETS.curtains,
    phrases: [
      'curtains',
      'curtain install',
      'drapes',
      'drapery',
    ],
  },
];

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, '');
}

/** First letter of first word + first letter of last word; single word → one letter. */
export function getCategoryInitials(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '?';

  const words = trimmed.split(/\s+/).filter(Boolean);
  const letter = (word: string) => {
    const m = word.match(/[a-zA-Z0-9]/);
    return m ? m[0].toUpperCase() : '';
  };

  if (words.length === 1) {
    const one = letter(words[0]);
    return one || '?';
  }

  const a = letter(words[0]);
  const b = letter(words[words.length - 1]);
  const pair = `${a}${b}`.trim();
  return pair || '?';
}

/** Match backend label to a known file stem without substring false positives (e.g. pool ⊄ whirlpool). */
function stemMatchesHaystack(haystack: string, stem: string): boolean {
  if (!haystack || !stem) return false;
  if (haystack === stem) return true;
  if (stem.includes(' ')) {
    return haystack.includes(stem);
  }
  const tokens = haystack.split(/\s+/).filter(Boolean);
  return tokens.includes(stem);
}

function matchStemInText(normalizedFull: string): ImageSourcePropType | null {
  for (const { stem, source } of STEM_ASSET_ENTRIES) {
    if (stemMatchesHaystack(normalizedFull, stem)) return source;
  }
  return null;
}

function matchPhrase(haystack: string): ImageSourcePropType | null {
  for (const { source, phrases } of ICON_RULES) {
    for (const phrase of phrases) {
      if (haystack.includes(phrase)) return source;
    }
  }
  return null;
}

export function resolveCategoryImageSource(
  name?: string,
  displayName?: string,
  description?: string
): ImageSourcePropType | null {
  const parts = [name, displayName, description].filter(Boolean) as string[];
  if (parts.length === 0) return null;

  for (const part of parts) {
    const n = normalizeKey(part);
    if (n) {
      const stemHit = matchStemInText(n);
      if (stemHit) return stemHit;
    }
  }

  const combined = normalizeKey(parts.join(' '));
  if (combined) {
    const stemHit = matchStemInText(combined);
    if (stemHit) return stemHit;
  }

  if (!combined) return null;
  return matchPhrase(combined);
}


/**
 * A drawn icon for a trade with no artwork.
 *
 * Twenty-four categories have a painted PNG. Everything else - and the server
 * can add a category any day, without an app release - fell through to two
 * letters in a box. Initials are what a contact list shows when it has nothing
 * else; on a row of illustrated trades they read as the one that is broken.
 *
 * So a name that matches nothing painted still gets a picture of the work:
 * line art, in the same weight as the illustrations, on the same tinted tile
 * the initials used. Generator repair gets a battery, waterproofing a drop of
 * water, a tailor a shirt. Initials remain, but as the third answer rather
 * than the second - for a genuinely unrecognisable name, which is the only
 * case where two letters are the honest thing to show.
 *
 * Keywords rather than exact names on purpose: the server's spelling is not
 * ours to control, and "generatorRepair", "Generator Repair" and "generator
 * servicing" are all the same trade. Order matters - the first match wins, so
 * the more specific phrase is listed above the word it contains.
 */
const GLYPH_RULES: { Glyph: TradeGlyph; keywords: string[] }[] = [
  { Glyph: AirConditioning, keywords: ['air condition', 'aircondition', 'ac repair', 'acrepair', 'ac installation', 'hvac', 'cooling', 'refrigerat', 'freezer', 'fridge', 'chiller', 'fan', 'ventilation'] },
  { Glyph: Generator, keywords: ['generator', 'inverter', 'battery', 'power backup'] },
  { Glyph: Waterproofing, keywords: ['waterproof', 'water proof', 'damp', 'drainage', 'soakaway', 'leak'] },
  { Glyph: GlassWork, keywords: ['glass', 'window', 'mirror', 'aluminium', 'aluminum', 'glazing'] },
  { Glyph: Welding, keywords: ['weld', 'metal', 'fabricat', 'iron work', 'steel', 'blacksmith'] },
  { Glyph: Moving, keywords: ['moving', 'relocat', 'haulage', 'logistics', 'delivery', 'dispatch', 'courier', 'mechanic', 'vehicle', 'tyre', 'tire'] },
  { Glyph: Furniture, keywords: ['furniture', 'sofa', 'interior', 'joinery'] },
  { Glyph: Landscaping, keywords: ['garden', 'landscap', 'lawn', 'horticultur', 'nursery', 'agric'] },
  { Glyph: Tailoring, keywords: ['tailor', 'sewing', 'fashion', 'laundry', 'dry clean', 'drycleaning', 'ironing', 'clothing'] },
  { Glyph: Catering, keywords: ['catering', 'chef', 'cook', 'food', 'kitchen'] },
  { Glyph: Tutoring, keywords: ['tutor', 'lesson', 'teacher', 'teaching', 'coaching'] },
  { Glyph: Photography, keywords: ['photograph', 'videograph', 'filming'] },
  { Glyph: Salon, keywords: ['hair', 'barber', 'salon', 'beauty', 'makeup', 'make up', 'nail', 'spa', 'massage'] },
  { Glyph: Locksmith, keywords: ['locksmith', 'lock', 'key', 'door'] },
  { Glyph: Satellite, keywords: ['satellite', 'dstv', 'gotv', 'antenna', 'aerial', 'decoder', 'cable'] },
  { Glyph: Internet, keywords: ['internet', 'wifi', 'wi fi', 'network', 'router', 'fibre', 'fiber'] },
  { Glyph: Ceilings, keywords: ['pop ', 'ceiling', 'screed', 'plaster', 'partition', 'drywall', 'wallpaper', 'wall paper'] },
  { Glyph: Fumigation, keywords: ['fumigat', 'termite', 'rodent', 'spray', 'coating'] },
  { Glyph: Bathroom, keywords: ['bathroom', 'toilet', 'sanitary', 'shower', 'washing machine', 'washer'] },
  { Glyph: Construction, keywords: ['construction', 'builder', 'building', 'contractor', 'renovat', 'civil', 'engineer'] },
  { Glyph: GeneralRepair, keywords: ['repair', 'fix', 'maintenance', 'handyman', 'servicing', 'installation', 'decorat', 'finishing'] },
];

function resolveCategoryGlyph(text: string): TradeGlyph | null {
  for (const { Glyph, keywords } of GLYPH_RULES) {
    for (const keyword of keywords) {
      if (text.includes(keyword.trim())) return Glyph;
    }
  }
  return null;
}

/** Returns the glyph a name would draw, or null. Exported for the coverage test. */
export function getCategoryGlyphName(
  name?: string,
  displayName?: string,
  description?: string,
): string | null {
  const combined = normalizeKey([name, displayName, description].filter(Boolean).join(' '));
  const Glyph = combined ? resolveCategoryGlyph(combined) : null;
  return Glyph ? (Glyph.name || 'glyph') : null;
}

/**
 * On nothing at all, exactly like the painted icons.
 *
 * The first version drew a tinted green box with a border around the glyph,
 * which was the other half of why it stood out: every painted icon sits
 * directly on the page, so a fallback in a box announced itself as a
 * different kind of object before anybody looked at the drawing inside it.
 */
const CategoryGlyphTile = ({ Glyph }: { Glyph: TradeGlyph }) => (
  <View style={{ width: ICON_SIZE, height: ICON_SIZE, alignItems: 'center', justifyContent: 'center' }}>
    <Glyph size={ICON_SIZE} />
  </View>
);

const CategoryInitialsAvatar = ({ label }: { label: string }) => {
  const initials = getCategoryInitials(label);
  return (
    <View
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: 10,
        backgroundColor: '#F0F7E6',
        borderWidth: 1,
        borderColor: '#E0ECC8',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: initials.length > 1 ? 14 : 16,
          fontFamily: 'Poppins-SemiBold',
          color: Colors.accent,
          letterSpacing: -0.3,
        }}
      >
        {initials}
      </Text>
    </View>
  );
};

const CategoryRasterIcon = ({ source }: { source: ImageSourcePropType }) => (
  <Image
    source={source}
    style={{ width: ICON_SIZE, height: ICON_SIZE }}
    resizeMode="contain"
  />
);

/**
 * Maps API category fields to a bundled category image when possible; otherwise initials (design-aligned).
 */
export const getCategoryIcon = (
  name?: string,
  displayName?: string,
  description?: string
): React.ComponentType => {
  const labelForInitials = (displayName || name || 'Service').trim() || 'Service';
  const source = resolveCategoryImageSource(name, displayName, description);

  if (source) {
    const Raster = () => <CategoryRasterIcon source={source} />;
    return Raster;
  }

  /**
   * Painted artwork first, then a drawn glyph, then initials. The middle step
   * is new: it used to fall straight from the twenty-four illustrated trades
   * to two letters in a box, which on a row of pictures reads as the broken
   * one rather than as a category nobody has drawn yet.
   */
  const combined = normalizeKey([name, displayName, description].filter(Boolean).join(' '));
  const Glyph = combined ? resolveCategoryGlyph(combined) : null;
  if (Glyph) {
    const Drawn = () => <CategoryGlyphTile Glyph={Glyph} />;
    return Drawn;
  }

  const Initials = () => <CategoryInitialsAvatar label={labelForInitials} />;
  return Initials;
};
