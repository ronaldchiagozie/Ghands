import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { BorderRadius, Colors, Fonts, Spacing } from '@/lib/designSystem';
import { providerService } from '@/services/api';
import { formatSkillLabel } from '@/utils/formatSkillLabel';
import { buildReviewerDisplayName, reviewAvatarUrl } from '@/utils/reviewerDisplayName';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Star } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SKILLS_PREVIEW_COUNT = 7;

interface Review {
  id: string;
  reviewerName: string;
  reviewerImage: string;
  timeAgo: string;
  rating: number;
  reviewText: string;
}

interface ProviderDetail {
  id: string;
  name: string;
  role: string;
  image: string;
  rating: number;
  reviewCount: number;
  distance: string;
  jobsDone: number;
  responseTime: string;
  /** null = backend did not provide on-time rate */
  onTimePercentage: number | null;
  skills: string[];
  recentWork: string[];
  about: string;
  reviews: Review[];
  isOnline?: boolean;
}

const EMPTY_PROVIDER: ProviderDetail = {
  id: '',
  name: 'Service Provider',
  role: 'Service Provider',
  image: '',
  rating: 0,
  reviewCount: 0,
  distance: 'Distance unavailable',
  jobsDone: 0,
  responseTime: 'N/A',
  onTimePercentage: null,
  skills: [],
  recentWork: [],
  about: 'No profile details available yet.',
  reviews: [],
  isOnline: false,
};

function cleanNamePart(value: unknown): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (!t || /^null$/i.test(t) || /^undefined$/i.test(t)) return null;
  return t;
}

function mapApiReviewToUi(r: any, index: number): Review {
  const created = r.createdAt ?? r.created_at ?? r.reviewedAt ?? r.reviewed_at;
  let timeAgo = 'Recently';
  if (created) {
    try {
      const d = new Date(created);
      const diff = Date.now() - d.getTime();
      const days = Math.floor(diff / (86400000));
      if (days > 30) timeAgo = d.toLocaleDateString();
      else if (days > 0) timeAgo = `${days}d ago`;
      else if (diff > 3600000) timeAgo = `${Math.floor(diff / 3600000)}h ago`;
      else if (diff > 60000) timeAgo = `${Math.floor(diff / 60000)}m ago`;
    } catch {
      /* keep Recently */
    }
  }

  const rating = Math.min(5, Math.max(0, Number(r.rating ?? r.stars ?? 0) || 0));

  let reviewText = String(r.reviewText ?? r.comment ?? r.feedback ?? r.text ?? '').trim();
  if (!reviewText && rating > 0) {
    reviewText = 'Rated the service without a written comment.';
  }

  return {
    id: String(r.id ?? `review-${index}`),
    reviewerName: buildReviewerDisplayName(r),
    reviewerImage: reviewAvatarUrl(r) || '',
    timeAgo: cleanNamePart(r.timeAgo) || timeAgo,
    rating,
    reviewText,
  };
}

/** Merge review arrays from profile + analytics + public list without obvious duplicates. */
function mergeRawReviews(...lists: (any[] | null | undefined)[]): any[] {
  const merged: any[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const r of list) {
      if (!r || typeof r !== 'object') continue;
      const id = String((r as any).id ?? '').trim();
      const created = String((r as any).createdAt ?? (r as any).created_at ?? '');
      const key = id ? `id:${id}` : `h:${buildReviewerDisplayName(r as any)}-${created}-${(r as any).rating}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(r);
    }
  }
  return merged;
}

export default function ProviderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    providerId?: string;
    providerName?: string;
    initialRating?: string;
    initialReviewCount?: string;
  }>();

  const parseInitialRating = () => {
    const v = parseFloat(String(params.initialRating ?? ''));
    return !Number.isNaN(v) && v > 0 ? v : 0;
  };
  const parseInitialReviewCount = () => {
    const v = parseInt(String(params.initialReviewCount ?? ''), 10);
    return !Number.isNaN(v) && v >= 0 ? v : 0;
  };

  const [provider, setProvider] = useState<ProviderDetail>(() => ({
    ...EMPTY_PROVIDER,
    name: params.providerName || EMPTY_PROVIDER.name,
    rating: parseInitialRating(),
    reviewCount: parseInitialReviewCount(),
  }));

  const [isLoading, setIsLoading] = useState(() => {
    const raw = String(params.providerId || '').trim();
    const stripped = raw.replace(/^provider-/i, '');
    const id = Number(stripped);
    return !!(id && !Number.isNaN(id));
  });
  const [showAllSkillsModal, setShowAllSkillsModal] = useState(false);

  useEffect(() => {
    const loadProviderProfile = async () => {
      const raw = String(params.providerId || '').trim();
      const stripped = raw.replace(/^provider-/i, '');
      const providerId = Number(stripped);
      const fallbackRating = parseInitialRating();
      const fallbackReviewCount = parseInitialReviewCount();

      if (!providerId || isNaN(providerId)) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [data, imageUrls, analyticsSnap, publicReviewsList] = await Promise.all([
          providerService.getPublicProfile(providerId),
          providerService.getProviderPublicImages(providerId),
          providerService.tryGetPublicProviderAnalytics(providerId),
          providerService.tryGetPublicProviderReviews(providerId, { limit: 25, offset: 0 }),
        ]);
        const p = data.provider;

        const profileWorkUrls = providerService.normalizeRecentWorkUrls(p.recentWork);
        const fromAnalyticsReviews = providerService.normalizeRecentWorkUrls(
          analyticsSnap?.latestReviews?.map((rev: any) => ({
            image: rev.jobImageUrl ?? rev.jobPhoto ?? rev.photoUrl ?? rev.imageUrl,
          }))
        );
        // Local demo profile image from provider setup (used only when API has no image yet)
        const localDemoImage = await AsyncStorage.getItem('@ghands:provider_profile_image_demo');

        const primaryAvatar = imageUrls[0] || localDemoImage || '';
        const galleryFromImageEndpoint = imageUrls.slice(1);
        const uniqueRecent = [
          ...new Set([...profileWorkUrls, ...fromAnalyticsReviews, ...galleryFromImageEndpoint]),
        ];

        const rawReviews = mergeRawReviews(
          data.reviews,
          analyticsSnap?.latestReviews,
          publicReviewsList
        );

        const ratingsFromAnalytics = analyticsSnap?.ratings;
        let rating = Number(p.rating || 0);
        let reviewCount = Number(p.totalReviews || 0);
        const ar = Number(ratingsFromAnalytics?.averageRating ?? NaN);
        const tr = Number(ratingsFromAnalytics?.totalReviews ?? NaN);
        if (!rating && !Number.isNaN(ar) && ar > 0) rating = ar;
        if (!reviewCount && !Number.isNaN(tr) && tr > 0) reviewCount = tr;
        if (!rating && fallbackRating > 0) rating = fallbackRating;
        if (!reviewCount && fallbackReviewCount > 0) reviewCount = fallbackReviewCount;

        const onTimeRaw = p.onTimeRate ?? (p as any).on_time_rate;
        const onTimePercentage =
          onTimeRaw != null && !Number.isNaN(Number(onTimeRaw)) ? Number(onTimeRaw) : null;

        const localAbout = (await AsyncStorage.getItem('@ghands:provider_about_demo')) || '';
        const aboutText =
          typeof p.about === 'string' && p.about.trim().length > 0
            ? p.about.trim()
            : localAbout.trim().length > 0
              ? localAbout.trim()
              : 'No bio yet.';

        const mapped: ProviderDetail = {
          ...EMPTY_PROVIDER,
          id: String(p.id || providerId),
          name: p.name || params.providerName || 'Service Provider',
          role: p.professionTitle || 'Professional Service Provider',
          image: primaryAvatar,
          rating,
          reviewCount,
          distance: p.milesAway != null ? `${p.milesAway} mi away` : 'Distance unavailable',
          jobsDone: Number(p.jobsDone || 0),
          responseTime:
            p.responseTimeMinutes != null ? `${p.responseTimeMinutes}m` : 'N/A',
          onTimePercentage,
          skills: Array.isArray(p.skills) ? p.skills.map((s) => formatSkillLabel(String(s))) : [],
          recentWork: uniqueRecent,
          about: aboutText,
          isOnline: !!p.isOnline,
          reviews: rawReviews.map((r: any, index: number) => mapApiReviewToUi(r, index)),
        };
        setProvider(mapped);
      } catch {
        setProvider((prev) => ({
          ...EMPTY_PROVIDER,
          ...prev,
          name: params.providerName || prev.name || EMPTY_PROVIDER.name,
          rating: fallbackRating || prev.rating,
          reviewCount: fallbackReviewCount || prev.reviewCount,
        }));
      } finally {
        setIsLoading(false);
      }
    };
    loadProviderProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.providerId, params.providerName, params.initialRating, params.initialReviewCount]);

  if (isLoading) {
    return (
      <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.7}
            style={{ position: 'absolute', top: 16, left: 16, zIndex: 2, padding: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text
            style={{
              marginTop: 20,
              fontFamily: 'Poppins-Medium',
              fontSize: 15,
              color: Colors.textSecondaryDark,
              textAlign: 'center',
            }}
          >
            Loading profile...
          </Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ 
          paddingBottom: 32,
          backgroundColor: Colors.backgroundLight,
        }}
      >
        {/* Header with Back Button */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 16,
          }}
        >
          <TouchableOpacity 
            onPress={() => router.back()} 
            activeOpacity={0.7}
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Profile Summary Section */}
        <View
          style={{
            paddingHorizontal: 20,
            marginBottom: 24,
          }}
        >
          <View
            style={{
              backgroundColor: Colors.white,
              borderRadius: BorderRadius.xl,
              padding: 20,
              borderWidth: 1,
              borderColor: Colors.border,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              {/* Profile Picture */}
              <View style={{ position: 'relative' }}>
                {provider.image ? (
                  <Image
                    source={{ uri: provider.image }}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      backgroundColor: Colors.backgroundGray,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 50,
                      backgroundColor: Colors.backgroundGray,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="person" size={42} color={Colors.textSecondaryDark} />
                  </View>
                )}
                {provider.isOnline && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: Colors.accent,
                      borderWidth: 3,
                      borderColor: Colors.white,
                    }}
                  />
                )}
              </View>

              {/* Profile Info */}
              <View
                style={{
                  flex: 1,
                  marginLeft: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 19,
                    fontFamily: 'Poppins-Bold',
                    color: Colors.textPrimary,
                    marginBottom: 4,
                    letterSpacing: -0.3,
                  }}
                >
                  {provider.name}
                </Text>
                <Text
                  style={{
                    fontSize: 16,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textSecondaryDark,
                    marginBottom: 12,
                  }}
                >
                  {provider.role}
                </Text>

                {/* Rating */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <Star size={18} color={Colors.star} fill={Colors.star} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Medium',
                      color: Colors.textSecondaryDark,
                      marginLeft: 6,
                    }}
                  >
                    {provider.reviewCount > 0
                      ? `${provider.rating.toFixed(1)} (${provider.reviewCount})`
                      : 'No ratings yet'}
                  </Text>
                </View>

                {/* Distance */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <MapPin size={16} color={Colors.textSecondaryDark} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontFamily: 'Poppins-Medium',
                      color: Colors.textSecondaryDark,
                      marginLeft: 4,
                    }}
                  >
                    {provider.distance}
                  </Text>
                </View>
              </View>
            </View>

            {/* Statistics Row */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 24,
                paddingTop: 24,
                borderTopWidth: 1,
                borderTopColor: Colors.border,
              }}
            >
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontFamily: 'Poppins-Bold',
                    color: Colors.textPrimary,
                    marginBottom: 4,
                    letterSpacing: -0.4,
                  }}
                >
                  {provider.jobsDone}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textSecondaryDark,
                  }}
                >
                  Jobs Done
                </Text>
              </View>

              <View
                style={{
                  width: 1,
                  backgroundColor: Colors.border,
                  marginHorizontal: 16,
                }}
              />

              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontFamily: 'Poppins-Bold',
                    color: Colors.textPrimary,
                    marginBottom: 4,
                    letterSpacing: -0.4,
                  }}
                >
                  {provider.responseTime}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textSecondaryDark,
                  }}
                >
                  Response Time
                </Text>
              </View>

              <View
                style={{
                  width: 1,
                  backgroundColor: Colors.border,
                  marginHorizontal: 16,
                }}
              />

              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text
                  style={{
                    fontSize: 22,
                    fontFamily: 'Poppins-Bold',
                    color: Colors.textPrimary,
                    marginBottom: 4,
                    letterSpacing: -0.4,
                  }}
                >
                  {provider.onTimePercentage === null ? 'N/A' : `${provider.onTimePercentage}%`}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textSecondaryDark,
                  }}
                >
                  On Time
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Skills Section */}
        <View
          style={{
            paddingHorizontal: 20,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 16,
            }}
          >
            Skills
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {provider.skills.slice(0, SKILLS_PREVIEW_COUNT).map((skill, index) => (
              <View
                key={`${skill}-${index}`}
                style={{
                  backgroundColor: Colors.backgroundLight,
                  borderRadius: BorderRadius.default,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: Colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: 'Poppins-Medium',
                    color: Colors.textPrimary,
                  }}
                >
                  {skill}
                </Text>
              </View>
            ))}
            {provider.skills.length === 0 && (
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                }}
              >
                No skills listed yet.
              </Text>
            )}
          </View>
          {provider.skills.length > SKILLS_PREVIEW_COUNT && (
            <TouchableOpacity
              onPress={() => setShowAllSkillsModal(true)}
              activeOpacity={0.85}
              style={{ marginTop: 14, alignSelf: 'flex-start' }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.accent,
                }}
              >
                View all skills ({provider.skills.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Work Section */}
        <View
          style={{
            paddingHorizontal: 20,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 16,
            }}
          >
            Recent Work
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 8 }}
          >
            {provider.recentWork.map((workImage, index) => (
              <Image
                key={`${workImage}-${index}`}
                source={{ uri: workImage }}
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: BorderRadius.lg,
                  backgroundColor: Colors.backgroundGray,
                }}
              />
            ))}
            {provider.recentWork.length === 0 &&
              [0, 1, 2].map((slot) => (
                <View
                  key={`work-placeholder-${slot}`}
                  style={{
                    width: 112,
                    height: 112,
                    borderRadius: BorderRadius.lg,
                    backgroundColor: Colors.backgroundGray,
                    borderWidth: 1,
                    borderColor: Colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 8,
                  }}
                >
                  <Ionicons name="images-outline" size={28} color={Colors.textTertiary} />
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      fontFamily: 'Poppins-Medium',
                      color: Colors.textSecondaryDark,
                      textAlign: 'center',
                    }}
                  >
                    Photos coming soon
                  </Text>
                </View>
              ))}
          </ScrollView>
          {provider.recentWork.length === 0 && (
            <Text
              style={{
                marginTop: 10,
                fontSize: 13,
                fontFamily: 'Poppins-Regular',
                color: Colors.textSecondaryDark,
                lineHeight: 18,
              }}
            >
              This provider has not uploaded a gallery yet. Profile and job photos will appear here when
              available.
            </Text>
          )}
        </View>

        {/* About Section */}
        <View
          style={{
            paddingHorizontal: 20,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 16,
            }}
          >
            About
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              lineHeight: 22,
            }}
          >
            {provider.about}
          </Text>
        </View>

        {/* Reviews Section */}
        <View
          style={{
            paddingHorizontal: 20,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 16,
            }}
          >
            Reviews
          </Text>
          {provider.reviews.length === 0 && (
            <View
              style={{
                backgroundColor: Colors.white,
                borderRadius: BorderRadius.xl,
                padding: 20,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.accent} />
                <Text
                  style={{
                    marginLeft: 10,
                    fontSize: 16,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textPrimary,
                  }}
                >
                  No reviews yet
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  lineHeight: 21,
                }}
              >
                Reviews from completed jobs will show here. Book this provider and share feedback after your
                service. It helps everyone choose with confidence.
              </Text>
            </View>
          )}
          {provider.reviews.map((review, index) => (
            <View
              key={review.id}
              style={{
                backgroundColor: Colors.white,
                borderRadius: BorderRadius.xl,
                padding: 20,
                marginBottom: index < provider.reviews.length - 1 ? 16 : 0,
                borderWidth: 1,
                borderColor: Colors.border,
              }}
            >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                {review.reviewerImage ? (
                  <Image
                    source={{ uri: review.reviewerImage }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: Colors.backgroundGray,
                      marginRight: 12,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: Colors.backgroundGray,
                      marginRight: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="person" size={24} color={Colors.textTertiary} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontFamily: 'Poppins-SemiBold',
                      color: Colors.textPrimary,
                      marginBottom: 2,
                    }}
                  >
                    {review.reviewerName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                    }}
                  >
                    {review.timeAgo}
                  </Text>
                </View>
              </View>

              {/* Star Rating */}
              <View
                style={{
                  flexDirection: 'row',
                  marginBottom: 12,
                }}
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    color={i < review.rating ? Colors.star : Colors.border}
                    fill={i < review.rating ? Colors.star : 'transparent'}
                    style={{ marginRight: 2 }}
                  />
                ))}
              </View>

              {/* Review Text */}
              <Text
                style={{
                  fontSize: 14,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  lineHeight: 20,
                }}
              >
                {review.reviewText}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={showAllSkillsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllSkillsModal(false)}
      >
        <View style={styles.skillsModalRoot}>
          <TouchableOpacity
            style={styles.skillsModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowAllSkillsModal(false)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View style={styles.skillsModalCard}>
            <View style={styles.skillsModalHeader}>
              <Text style={styles.skillsModalTitle}>All skills</Text>
              <TouchableOpacity onPress={() => setShowAllSkillsModal(false)} hitSlop={12}>
                <Ionicons name="close" size={26} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <View style={styles.skillsModalChips}>
                {provider.skills.map((skill, index) => (
                  <View key={`all-${skill}-${index}`} style={styles.skillsModalChip}>
                    <Text style={{ fontSize: 14, fontFamily: 'Poppins-Medium', color: Colors.textPrimary }}>
                      {skill}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  skillsModalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  skillsModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  skillsModalCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skillsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  skillsModalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
  },
  skillsModalChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skillsModalChip: {
    backgroundColor: Colors.backgroundLight,
    borderRadius: BorderRadius.default,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
