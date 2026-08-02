import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileService } from '../services/api';
import { authService } from '../services/authService';
import { ClientProfileView, UpdateProfilePayload, UserProfile } from '../types';
import {
  isDisplayableAvatarUri,
  logClientProfilePhoto,
  pickProfileImageUriFromApi,
  readLocalClientProfileImageUri,
  summarizeProfileImageFields,
} from '../utils/clientProfilePhoto';
import { unwrapProfilePayload } from '../utils/profilePayload';

export { unwrapProfilePayload } from '../utils/profilePayload';

const PROFILE_QUERY_KEY = 'profile';

/** Map `/api/user/profile` (and common wrappers) into {@link UserProfile} for forms. */
export function mapApiProfileToUserProfile(raw: unknown): UserProfile {
  if (!raw || typeof raw !== 'object') {
    return { name: '', email: '', phone: '' };
  }
  const d = unwrapProfilePayload(raw);

  const firstName = String(d.firstName ?? d.first_name ?? '').trim();
  const lastName = String(d.lastName ?? d.last_name ?? '').trim();
  const nameFromParts = firstName || lastName ? `${firstName} ${lastName}`.trim() : '';
  const companyName = String(d.companyName ?? d.company_name ?? '').trim();
  const name = String(
    companyName || d.name || d.fullName || nameFromParts || '',
  ).trim();

  const email = String(d.email ?? d.userEmail ?? d.companyEmail ?? d.company_email ?? '').trim();
  const phone = String(
    d.phone ??
      d.phoneNumber ??
      d.mobile ??
      d.telephone ??
      d.companyPhoneNumber ??
      d.company_phone ??
      '',
  ).trim();
  const profileImageUri = pickProfileImageUriFromApi(raw);

  if (__DEV__) {
    const imageFields = summarizeProfileImageFields(raw);
    logClientProfilePhoto('map_api_profile', {
      hasMappedImageUri: !!profileImageUri,
      imageFieldsFromApi: imageFields,
      nameLength: name.length,
      phoneDigits: phone.replace(/\D/g, '').length,
    });
  }

  return {
    name,
    email,
    phone,
    profileImageUri: typeof profileImageUri === 'string' ? profileImageUri : undefined,
  };
}

function readProfileRecord(raw: unknown): Record<string, unknown> {
  return unwrapProfilePayload(raw);
}

/** Map API profile into client tab view (name, avatar, referral, ratings). */
export function mapApiProfileToClientView(raw: unknown): ClientProfileView {
  const base = mapApiProfileToUserProfile(raw);
  const d = readProfileRecord(raw);

  const idRaw = d.id ?? d.userId ?? d.user_id;
  const referralRaw = d.referralCode ?? d.referral_code ?? d.referral;
  const ratingRaw = d.rating ?? d.averageRating ?? d.average_rating;
  const reviewsRaw = d.reviews ?? d.reviewCount ?? d.totalReviews ?? d.total_reviews;

  const rating = typeof ratingRaw === 'number' && Number.isFinite(ratingRaw) ? ratingRaw : undefined;
  const reviewCount =
    typeof reviewsRaw === 'number' && Number.isFinite(reviewsRaw) ? reviewsRaw : undefined;

  let referralCode =
    typeof referralRaw === 'string' && referralRaw.trim() ? referralRaw.trim() : undefined;

  if (!referralCode && typeof idRaw === 'string' && idRaw.length >= 4) {
    referralCode = idRaw.slice(0, 8).toUpperCase();
  } else if (!referralCode && typeof idRaw === 'number') {
    referralCode = String(idRaw).slice(0, 8).toUpperCase();
  }

  return {
    ...base,
    id: idRaw != null ? String(idRaw) : base.id,
    referralCode,
    rating,
    reviewCount,
  };
}

/** Logged-in user profile from `GET /api/user/profile` — avoids fake `/users/:id/profile` slowness. */
export function useCurrentUserProfile() {
  return useQuery({
    queryKey: [PROFILE_QUERY_KEY, 'current'],
    queryFn: async () => {
      const raw = await profileService.getCurrentUserProfile();
      const mapped = mapApiProfileToClientView(raw);
      const apiImage = mapped.profileImageUri;
      const localUri = await readLocalClientProfileImageUri(mapped.id);

      if (!apiImage && localUri && isDisplayableAvatarUri(localUri)) {
        logClientProfilePhoto('avatar_source', {
          source: 'local_cache',
          reason: 'api_had_no_image_uri',
        });
        return { ...mapped, profileImageUri: localUri };
      }

      logClientProfilePhoto('avatar_source', {
        source: apiImage ? 'api' : 'none',
        apiHadImage: !!apiImage,
        localHadImage: !!localUri,
      });
      return mapped;
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: [PROFILE_QUERY_KEY, userId],
    queryFn: () => profileService.getProfile(userId),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: string;
      payload: UpdateProfilePayload;
    }) => {
      try {
        return await profileService.updateCurrentUserProfile(payload);
      } catch {
        const id = await authService.getUserId();
        if (!id) throw new Error('Could not update profile');
        return profileService.updateProfile(String(id), payload);
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [PROFILE_QUERY_KEY, 'current'] });
      if (variables.userId && variables.userId !== 'current') {
        queryClient.invalidateQueries({
          queryKey: [PROFILE_QUERY_KEY, variables.userId],
        });
      }
    },
  });
}



export function useUploadProfileImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      imageUri,
    }: {
      userId: string;
      imageUri: string;
    }) => profileService.uploadProfileImage(userId, imageUri),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [PROFILE_QUERY_KEY, variables.userId],
      });
    },
  });
}

