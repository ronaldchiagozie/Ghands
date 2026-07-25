import { UpdateProfilePayload, UserProfile } from '../../types';
import { logClientProfilePhoto } from '../../utils/clientProfilePhoto';
import { deriveUserName, readProfileSignupFields, splitFullName } from '../../utils/profileName';
import { apiClient, extractResponseData } from './client';

export type CompleteClientSignupPayload = {
  fullName: string;
  phoneNumber: string;
  gender: string;
  email?: string;
  userName?: string;
};

export const profileService = {
  getCurrentUserProfile: async (): Promise<any> => {
    try {
      const response = await apiClient.get<any>('/api/user/profile');
      return extractResponseData<any>(response);
    } catch (error) {
      throw error;
    }
  },

  getProfile: async (userId: string): Promise<UserProfile> => {
    return apiClient.get<UserProfile>(`/users/${userId}/profile`);
  },

  updateProfile: async (userId: string, payload: UpdateProfilePayload): Promise<UserProfile> => {
    return apiClient.put<UserProfile>(`/users/${userId}/profile`, payload);
  },

  /** PUT /api/user/complete-signup — official client profile completion. */
  completeClientSignup: async (payload: CompleteClientSignupPayload): Promise<any> => {
    const { firstName, lastName } = splitFullName(payload.fullName);
    const body = {
      phoneNumber: payload.phoneNumber,
      firstName,
      lastName,
      userName: payload.userName ?? deriveUserName(payload.fullName, payload.email),
      gender: payload.gender.trim().toLowerCase(),
    };

    const response = await apiClient.put<any>('/api/user/complete-signup', body);
    return extractResponseData<any>(response);
  },

  /** Edit Profile + any name/phone update — same PUT as first-time completion. */
  updateCurrentUserProfile: async (payload: UpdateProfilePayload): Promise<any> => {
    if (payload.profileImageUri?.trim()) {
      logClientProfilePhoto('save_profile_image_skipped_on_api', {
        reason: 'complete_signup_body_has_no_image_field',
        uriPreview: `${payload.profileImageUri.trim().slice(0, 40)}…`,
        hint: 'Image should be saved via writeLocalClientProfileImageUri until backend supports upload',
      });
    }

    const phoneDigits = payload.phone.replace(/\D/g, '');
    let gender = 'other';
    let userName: string | undefined;
    try {
      const raw = await profileService.getCurrentUserProfile();
      const extras = readProfileSignupFields(raw);
      gender = extras.gender;
      userName = extras.userName;
    } catch {
      /* use defaults */
    }

    return profileService.completeClientSignup({
      fullName: payload.name,
      phoneNumber: phoneDigits,
      gender,
      email: payload.email,
      userName,
    });
  },

  uploadProfileImage: async (userId: string, imageUri: string): Promise<{ imageUrl: string }> => {
    return Promise.resolve({ imageUrl: imageUri });
  },
};
