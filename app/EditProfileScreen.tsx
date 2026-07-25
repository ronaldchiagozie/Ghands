import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { zodResolver } from '@hookform/resolvers/zod';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, Mail, Phone, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { InputField } from '../components/InputField';
import { useCurrentUserProfile, useUpdateProfile } from '../hooks/useProfile';
import { API_BASE_URL } from '../lib/apiConfig';
import { ProfileFormData, profileFormSchema } from '../lib/validation';
import {
  logClientProfilePhoto,
  writeLocalClientProfileImageUri,
} from '../utils/clientProfilePhoto';

export default function EditProfileScreen() {
  const router = useRouter();
  const [profileImageUri, setProfileImageUri] = useState<string | undefined>();
  const [isUploadingImage, setIsUploadingImage] = useState(false);

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

      Alert.alert('Success', 'Your profile has been updated successfully!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Failed to update profile. Please try again.'
      );
    }
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Sorry, we need camera roll permissions to upload images!');
      return false;
    }
    return true;
  };

  const handleImagePicker = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    Alert.alert(
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
      Alert.alert('Permission Required', 'Sorry, we need camera permissions to take photos!');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await handleImageUpload(result.assets[0].uri);
    }
  };

  const openGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      await handleImageUpload(result.assets[0].uri);
    }
  };

  const handleImageUpload = async (imageUri: string) => {
    setIsUploadingImage(true);
    logClientProfilePhoto('pick_image', { localUriPreview: `${imageUri.slice(0, 40)}…` });
    try {
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('image', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      const uploadUrl = `${API_BASE_URL}/upload`;
      logClientProfilePhoto('upload_attempt', { uploadUrl });

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const remoteUrl = data.imageUrl || data.url || data.data?.url;
        const resolved = typeof remoteUrl === 'string' && remoteUrl.trim() ? remoteUrl : imageUri;
        logClientProfilePhoto('upload_ok', {
          status: response.status,
          usedRemoteUrl: resolved !== imageUri,
          resolvedPreview: `${String(resolved).slice(0, 48)}…`,
        });
        setProfileImageUri(resolved);
        await writeLocalClientProfileImageUri(resolved);
      } else {
        const bodyText = await response.text().catch(() => '');
        logClientProfilePhoto('upload_failed', {
          status: response.status,
          bodyPreview: bodyText.slice(0, 120),
          fallback: 'using_local_file_uri_only',
        });
        setProfileImageUri(imageUri);
        await writeLocalClientProfileImageUri(imageUri);
      }
    } catch (error) {
      logClientProfilePhoto('upload_error', {
        message: error instanceof Error ? error.message : String(error),
        fallback: 'using_local_file_uri_only',
      });
      setProfileImageUri(imageUri);
      await writeLocalClientProfileImageUri(imageUri);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const isSaveDisabled = isSubmitting || !isValid || updateProfileMutation.isPending;
  const showHeaderLoader = isLoadingProfile;

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundGray}>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Edit your profile"
          onBack={() => router.back()}
          backgroundColor={Colors.white}
          showBottomBorder
          rightElement={
            showHeaderLoader ? <ActivityIndicator size="small" color={Colors.accent} /> : undefined
          }
        />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-6 pt-8">
          
          <View className="items-center mb-8">
            <View className="relative">
              <View className="w-32 h-32 bg-white rounded-full items-center justify-center border-2 border-black overflow-hidden">
                {isUploadingImage ? (
                  <ActivityIndicator size="large" color="#4F6739" />
                ) : profileImageUri ? (
                  <Image
                    source={{ uri: profileImageUri }}
                    style={{ width: 128, height: 128, borderRadius: 64 }}
                    resizeMode="cover"
                  />
                ) : (
                  <User size={60} color="#4F6739" />
                )}
              </View>
              <TouchableOpacity
                className="absolute bottom-0 right-0 bg-black rounded-full p-3 border-2 border-black"
                onPress={handleImagePicker}
              >
                <Camera size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          
          <View className="space-y-4">
            <View>
              <InputField
                placeholder="Mike Plumbings"
                icon={<User size={20} color="white" />}
                value={name}
                onChangeText={(text) => setValue('name', text, { shouldValidate: true })}
                keyboardType="default"
              />
              {errors.name && (
                <Text className="text-red-500 text-xs mt-1 px-4" style={{ fontFamily: 'Poppins-Medium' }}>
                  {errors.name.message}
                </Text>
              )}
            </View>

            <View>
              <InputField
                placeholder="miketheplumber@gmail.com"
                icon={<Mail size={20} color="white" />}
                value={email}
                onChangeText={(text) => setValue('email', text, { shouldValidate: true })}
                keyboardType="email-address"
              />
              {errors.email && (
                <Text className="text-red-500 text-xs mt-1 px-4" style={{ fontFamily: 'Poppins-Medium' }}>
                  {errors.email.message}
                </Text>
              )}
            </View>

            <View>
              <InputField
                placeholder="08100055522"
                icon={<Phone size={20} color="white" />}
                value={phone}
                onChangeText={(text) => setValue('phone', text, { shouldValidate: true })}
                keyboardType="phone-pad"
              />
              {errors.phone && (
                <Text className="text-red-500 text-xs mt-1 px-4" style={{ fontFamily: 'Poppins-Medium' }}>
                  {errors.phone.message}
                </Text>
              )}
            </View>
          </View>

          
          <TouchableOpacity
            className={`rounded-xl py-4 px-6 mt-6 items-center ${
              isSaveDisabled ? 'bg-gray-400' : 'bg-black'
            }`}
            onPress={handleSubmit(onSubmit)}
            disabled={isSaveDisabled}
            activeOpacity={0.7}
          >
            {updateProfileMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text 
                className="text-white text-base font-semibold" 
                style={{ fontFamily: 'Poppins-SemiBold' }}
              >
                Save changes
              </Text>
            )}
          </TouchableOpacity>
        </View>

        
        <View style={{ height: 100 }} />
      </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}
