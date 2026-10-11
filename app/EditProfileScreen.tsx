import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BorderRadius, Colors, useKeyboardAvoidingOffset, useScrollViewKeyboardAssist } from '@/lib/designSystem';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, Mail, Phone, User } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { haptics } from '@/hooks/useHaptics';
import { AvatarCircle } from '@/components/AvatarCircle';
import { uploadImageUri } from '@/utils/aiImageUpload';
import { InputField } from '../components/InputField';
import { useCurrentUserProfile, useUpdateProfile } from '../hooks/useProfile';
import { ProfileFormData, profileFormSchema } from '../lib/validation';
import {
  logClientProfilePhoto,
  writeLocalClientProfileImageUri,
} from '../utils/clientProfilePhoto';

export default function EditProfileScreen() {
  const router = useRouter();
  const [profileImageUri, setProfileImageUri] = useState<string | undefined>();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  /**
   * Whether the photo has been changed on this visit.
   *
   * Save is gated on the form being valid and dirty, and a photo is not a
   * form field - so picking one left Save greyed out, and the photo could
   * not be saved at all unless you also happened to edit your name. Which
   * is the whole reason "adding an image doesn't work".
   */
  const [photoChanged, setPhotoChanged] = useState(false);
  const { toast, showError, showSuccess, hideToast } = useToast();

  const { data: profile, isLoading: isLoadingProfile } = useCurrentUserProfile();
  
  const updateProfileMutation = useUpdateProfile();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    setValue,
    watch,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      email: '',
      phone: '',
    },
  });

  const name = watch('name');
  const email = watch('email');
  const phone = watch('phone');

  useEffect(() => {
    if (profile) {
      setValue('name', profile.name);
      setValue('email', profile.email);
      setValue('phone', profile.phone);
      if (profile.profileImageUri) {
        setProfileImageUri(profile.profileImageUri);
      }
    }
  }, [profile, setValue]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      if (profileImageUri?.trim()) {
        await writeLocalClientProfileImageUri(profileImageUri);
        logClientProfilePhoto('edit_profile_save', {
          persistedLocalImage: true,
          sentImageToCompleteSignup: false,
        });
      } else {
        logClientProfilePhoto('edit_profile_save', { persistedLocalImage: false });
      }

      await updateProfileMutation.mutateAsync({
        userId: 'current',
        payload: {
          ...data,
          profileImageUri,
        },
      });

      /**
       * A toast, then out. Saving used to raise a modal reading "Success /
       * Profile updated" with an OK button - a dialog whose only purpose was
       * to be dismissed, in front of a screen that was already finished.
       */
      setPhotoChanged(false);
      haptics.success();
      showSuccess('Profile updated');
      setTimeout(() => router.back(), 700);
    } catch (error) {
      haptics.error();
      showError(
        error instanceof Error ? error.message : 'Could not save your profile. Please try again.',
      );
    }
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAppAlert('Permission required', 'Photo library access is required to upload images.');
      return false;
    }
    return true;
  };

  const handleImagePicker = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    showAppAlert(
      'Select Image',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: openCamera,
        },
        {
          text: 'Gallery',
          onPress: openGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAppAlert('Permission required', 'Camera access is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await handleImageUpload(result.assets[0].uri);
    }
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await handleImageUpload(result.assets[0].uri);
    }
  };

  /**
   * Sends the photo up, and shows it either way.
   *
   * It used to roll its own upload: a POST with `Content-Type:
   * multipart/form-data` set by hand - which omits the boundary, so the
   * server cannot parse the body - and no Authorization header. Both
   * guarantee failure. uploadImageUri is the call the booking photos and
   * Handy already use: it attaches the bearer token and lets fetch set the
   * content type with its boundary, and returns the local URI unchanged if
   * the server will not take it.
   */
  const handleImageUpload = async (imageUri: string) => {
    setIsUploadingImage(true);
    logClientProfilePhoto('pick_image', { localUriPreview: `${imageUri.slice(0, 40)}…` });
    try {
      const resolved = await uploadImageUri(imageUri);
      const reachedServer = resolved !== imageUri;
      logClientProfilePhoto('upload_done', { usedRemoteUrl: reachedServer });

      setProfileImageUri(resolved);
      setPhotoChanged(true);
      await writeLocalClientProfileImageUri(resolved);
      haptics.light();

      /**
       * Said plainly, because it decides whether the photo survives a
       * reinstall. The old code failed silently and left somebody looking at
       * a picture they had every reason to think was saved.
       */
      if (!reachedServer) {
        showError('Photo saved on this device only. We could not upload it.');
      }
    } catch (error) {
      logClientProfilePhoto('upload_error', {
        message: error instanceof Error ? error.message : String(error),
        fallback: 'using_local_file_uri_only',
      });
      setProfileImageUri(imageUri);
      setPhotoChanged(true);
      await writeLocalClientProfileImageUri(imageUri);
      showError('Photo saved on this device only. We could not upload it.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const isSaveDisabled =
    isSubmitting || !isValid || isUploadingImage || updateProfileMutation.isPending;
  const showHeaderLoader = isLoadingProfile;
  const keyboardOffset = useKeyboardAvoidingOffset();
  const phoneSectionY = useRef(0);
  const { scrollRef, scrollBottomPad, scrollFieldIntoView } = useScrollViewKeyboardAssist({
    baseBottomPad: 100,
  });

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundGray}>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Edit your profile"
          onBack={() => navigateBack(router, NAV_FALLBACK.clientHome)}
          backgroundColor={Colors.white}
          showBottomBorder
          rightElement={
            showHeaderLoader ? <ActivityIndicator size="small" color={Colors.accent} /> : undefined
          }
        />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: scrollBottomPad }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {/**
            * The photo, with something that says it can be changed.
            *
            * This was a white circle floating on grey with a camera badge
            * clipped to its corner, and nothing else - no label, no words,
            * and the fields below it sitting loose on the background with
            * neither grouping nor names. The whole screen read as three
            * stray rows and a disabled button on an empty page.
            */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <TouchableOpacity
              onPress={handleImagePicker}
              activeOpacity={0.85}
              disabled={isUploadingImage}
              accessibilityRole="button"
              accessibilityLabel={profileImageUri ? 'Change your photo' : 'Add a photo'}
            >
              <View>
                <AvatarCircle
                  uri={profileImageUri}
                  name={name}
                  size={112}
                  borderWidth={3}
                  borderColor={Colors.white}
                  backgroundColor={Colors.successLight}
                />
                {isUploadingImage ? (
                  <View
                    style={{
                      position: 'absolute',
                      width: 112,
                      height: 112,
                      borderRadius: 56,
                      backgroundColor: 'rgba(17, 24, 39, 0.45)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ActivityIndicator color={Colors.white} />
                  </View>
                ) : (
                  <View
                    style={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: Colors.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 3,
                      borderColor: Colors.backgroundGray,
                    }}
                  >
                    <Camera size={16} color={Colors.white} />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleImagePicker}
              disabled={isUploadingImage}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              style={{ marginTop: 12 }}
            >
              <Text style={{ fontSize: 14, fontFamily: 'Poppins-SemiBold', color: Colors.accent }}>
                {isUploadingImage
                  ? 'Uploading…'
                  : profileImageUri
                    ? 'Change photo'
                    : 'Add a photo'}
              </Text>
            </TouchableOpacity>
          </View>

          {/** One card, labelled fields, so the form reads as a form. */}
          <View
            style={{
              backgroundColor: Colors.white,
              borderRadius: BorderRadius.xl,
              borderWidth: 1,
              borderColor: Colors.border,
              paddingHorizontal: 16,
              paddingTop: 18,
              paddingBottom: 6,
            }}
          >
            <View style={{ marginBottom: 18 }}>
              <Text style={styles.fieldLabel}>Full name</Text>
              <InputField
                placeholder="Your full name"
                icon={<User size={20} color="white" />}
                value={name}
                onChangeText={(text) => setValue('name', text, { shouldValidate: true })}
                keyboardType="default"
                autoCapitalize="words"
                error={!!errors.name}
                errorMessage={errors.name?.message}
              />
            </View>

            <View style={{ marginBottom: 18 }}>
              <Text style={styles.fieldLabel}>Email</Text>
              <InputField
                placeholder="you@example.com"
                icon={<Mail size={20} color="white" />}
                value={email}
                onChangeText={(text) => setValue('email', text, { shouldValidate: true })}
                keyboardType="email-address"
                autoCapitalize="none"
                error={!!errors.email}
                errorMessage={errors.email?.message}
              />
            </View>

            <View
              style={{ marginBottom: 18 }}
              onLayout={(event) => {
                phoneSectionY.current = event.nativeEvent.layout.y;
              }}
            >
              <Text style={styles.fieldLabel}>Phone number</Text>
              <InputField
                placeholder="08012345678"
                icon={<Phone size={20} color="white" />}
                value={phone}
                onChangeText={(text) => setValue('phone', text, { shouldValidate: true })}
                keyboardType="phone-pad"
                error={!!errors.phone}
                errorMessage={errors.phone?.message}
                onFocus={() => scrollFieldIntoView(phoneSectionY.current, true)}
              />
            </View>
          </View>

          <Text
            style={{
              fontSize: 12,
              lineHeight: 17,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginTop: 12,
              paddingHorizontal: 2,
            }}
          >
            Your name and phone are what a provider sees when they take your job.
          </Text>
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/**
        * Pinned, not floating two thirds up an empty page. The action that
        * finishes a form belongs at the bottom edge of it.
        */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 12,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.white,
        }}
      >
        <TouchableOpacity
          style={{
            borderRadius: BorderRadius.default,
            paddingVertical: 16,
            alignItems: 'center',
            backgroundColor: isSaveDisabled ? Colors.backgroundGray : Colors.accent,
          }}
          onPress={handleSubmit(onSubmit)}
          disabled={isSaveDisabled}
          activeOpacity={0.85}
        >
          {updateProfileMutation.isPending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text
              style={{
                fontFamily: 'Poppins-SemiBold',
                fontSize: 16,
                color: isSaveDisabled ? Colors.textTertiary : Colors.white,
              }}
            >
              Save changes
            </Text>
          )}
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
      </View>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} onClose={hideToast} />
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 7,
  },
});
