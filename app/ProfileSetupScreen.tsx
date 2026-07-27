import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { BorderRadius, Colors, useKeyboardAvoidingOffset, useScrollViewKeyboardAssist } from '@/lib/designSystem';
import { API_BASE_URL } from '@/lib/apiConfig';
import { useUserLocation } from '@/hooks/useUserLocation';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, MapPin, Plus, User } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';
import { logClientProfilePhoto, writeLocalClientProfileImageUri } from '@/utils/clientProfilePhoto';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { location: savedLocation } = useUserLocation();
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Sync location field with the shared user location (from LocationSearchScreen)
  useEffect(() => {
    if (savedLocation && !location) {
      setLocation(savedLocation);
    }
  }, [savedLocation, location]);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAppAlert('Permission required', 'Photo library access is required to upload images.');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
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
    setIsUploading(true);
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
      logClientProfilePhoto('setup_upload_attempt', { uploadUrl });

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
        const resolved =
          typeof remoteUrl === 'string' && remoteUrl.trim() ? remoteUrl : imageUri;
        logClientProfilePhoto('setup_upload_ok', { status: response.status });
        setProfileImage(resolved);
        await writeLocalClientProfileImageUri(resolved);
      } else {
        logClientProfilePhoto('setup_upload_failed', { status: response.status });
        setProfileImage(imageUri);
        await writeLocalClientProfileImageUri(imageUri);
      }
    } catch (error) {
      logClientProfilePhoto('setup_upload_error', {
        message: error instanceof Error ? error.message : String(error),
      });
      setProfileImage(imageUri);
      await writeLocalClientProfileImageUri(imageUri);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBack = () => {
    // router.back();
  };

  const handleAddHomeAddress = () => {
    // Go to search screen specifically to choose a home address,
    // then come back here with the stored location.
    router.push('/LocationSearchScreen');
  };

  const handleSave = async () => {
    if (profileImage?.trim()) {
      await writeLocalClientProfileImageUri(profileImage);
      logClientProfilePhoto('setup_save', { savedLocalImage: true });
    }
    router.replace('/(tabs)/home');
  };

  const isFormValid = fullName.trim() && location.trim() && description.trim();
  const keyboardOffset = useKeyboardAvoidingOffset();
  const descriptionSectionY = useRef(0);
  const locationSectionY = useRef(0);
  const { scrollRef, scrollBottomPad, scrollFieldIntoView } = useScrollViewKeyboardAssist({
    footerClearance: 120,
    baseBottomPad: 20,
  });

  return (
    <SafeAreaWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
      <Animated.View 
        style={{ 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}
        className="flex-1"
      >
        
        <View 
          className="flex-row items-center justify-between px-4 py-4"
          style={{ minHeight: screenHeight * 0.02 }}
        >
          {/* Back button disabled during profile setup */}
          <View style={{ width: 24 }} />
          <Text 
            className="text-lg font-bold text-black"
            style={{ 
              fontFamily: 'Poppins-Bold',
              fontSize: screenWidth < 375 ? 16 : 18
            }}
          >
            Setup your Profile
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView 
          ref={scrollRef}
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: scrollBottomPad }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          
          <View className="items-center mb-8">
            <TouchableOpacity 
              onPress={pickImage}
              activeOpacity={0.8}
              style={{ 
                width: screenWidth * 0.32, 
                height: screenWidth * 0.32,
                minWidth: 120,
                minHeight: 120,
                maxWidth: 140,
                maxHeight: 140,
                borderWidth: 1,
                borderColor: Colors.borderStrong,
                borderRadius: BorderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {isUploading ? (
                <View className="items-center justify-center" style={{ width: screenWidth * 0.3, height: screenWidth * 0.3 }}>
                  <ActivityIndicator size="large" color={Colors.accent} />
                </View>
              ) : profileImage ? (
                <Image 
                  source={{ uri: profileImage }} 
                  style={{
                    width: screenWidth * 0.3,
                    height: screenWidth * 0.3,
                    borderRadius: (screenWidth * 0.3) / 2,
                    minWidth: 110,
                    minHeight: 110,
                    maxWidth: 130,
                    maxHeight: 130
                  }}
                  resizeMode="cover"
                />
              ) : (
                <Camera size={32} color={Colors.accent} />
              )}
              <View
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 32,
                  height: 32,
                  backgroundColor: Colors.accent,
                  borderRadius: BorderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={16} color={Colors.white} />
              </View>
            </TouchableOpacity>
            {profileImage && (
              <Text
                className="mt-2"
                style={{ fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textMuted }}
              >
                Image selected ✓
              </Text>
            )}
            {isUploading && (
              <Text
                className="mt-1"
                style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: Colors.iconMuted }}
              >
                Uploading...
              </Text>
            )}
          </View>

          
          <View 
            className="flex-row items-center mb-4"
            style={{ minHeight: screenHeight * 0.06 }}
          >
            <View 
              style={{
                backgroundColor: Colors.accent,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: BorderRadius.default,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
                width: screenWidth * 0.12, 
                height: screenWidth * 0.08,
                minWidth: 48,
                minHeight: 48,
              }}
            >
              <User size={20} color={Colors.white} />
            </View>
            <View 
              style={{
                flex: 1,
                backgroundColor: Colors.backgroundGray,
                borderRadius: BorderRadius.default,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <TextInput
                placeholder="Full name"
                value={fullName}
                onChangeText={setFullName}
                placeholderTextColor={Colors.placeholder}
                style={{ 
                  fontFamily: 'Poppins-Medium',
                  fontSize: 14,
                  color: Colors.textPrimary,
                }}
              />
            </View>
          </View>

          
          <View 
            className="flex-row items-center mb-4"
            style={{ minHeight: screenHeight * 0.06 }}
          >
            <View 
              style={{
                backgroundColor: Colors.accent,
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: BorderRadius.default,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16,
                width: screenWidth * 0.12, 
                height: screenWidth * 0.12,
                minWidth: 48,
                minHeight: 48,
              }}
            >
              <MapPin size={20} color={Colors.white} />
            </View>
            <TouchableOpacity
              onPress={handleAddHomeAddress}
              activeOpacity={0.8}
              style={{
                flex: 1,
                backgroundColor: Colors.accent,
                borderRadius: BorderRadius.default,
                paddingVertical: 12,
                paddingHorizontal: 16,
                minHeight: 48,
                justifyContent: 'center',
              }}
            >
              <Text 
                style={{ 
                  fontFamily: 'Poppins-SemiBold',
                  fontSize: 16,
                  color: Colors.white,
                  textAlign: 'center',
                }}
              >
                Add home address
              </Text>
            </TouchableOpacity>
          </View>

          
          <View 
            style={{
              backgroundColor: Colors.backgroundGray,
              borderRadius: BorderRadius.default,
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 24,
              minHeight: screenHeight * 0.06,
            }}
            onLayout={(event) => {
              locationSectionY.current = event.nativeEvent.layout.y;
            }}
          >
            <TextInput
              placeholder="Location..."
              value={location}
              onChangeText={setLocation}
              onFocus={() => scrollFieldIntoView(locationSectionY.current, true)}
              placeholderTextColor={Colors.placeholder}
              style={{ 
                fontFamily: 'Poppins-Medium',
                fontSize: 14,
                color: Colors.textPrimary,
              }}
            />
          </View>

          <View
            className="mb-8"
            onLayout={(event) => {
              descriptionSectionY.current = event.nativeEvent.layout.y;
            }}
          >
            <TextInput
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              onFocus={() => scrollFieldIntoView(descriptionSectionY.current, true)}
              multiline
              numberOfLines={4}
              placeholderTextColor={Colors.placeholder}
              style={{ 
                fontFamily: 'Poppins-Medium',
                textAlignVertical: 'top',
                minHeight: screenHeight * 0.12,
                fontSize: 14,
                color: Colors.textPrimary,
                backgroundColor: Colors.backgroundGray,
                borderRadius: BorderRadius.default,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            />
          </View>
        </ScrollView>

        
        <View 
          className="px-4 pb-4"
          style={{ minHeight: screenHeight * 0.08 }}
        >
          <TouchableOpacity
            onPress={handleSave}
            disabled={!isFormValid}
            activeOpacity={0.8}
            style={{
              minHeight: 52,
              borderRadius: BorderRadius.default,
              paddingVertical: 16,
              paddingHorizontal: 24,
              backgroundColor: isFormValid ? Colors.accent : Colors.borderStrong,
            }}
          >
            <Text 
              style={{ 
                fontFamily: 'Poppins-SemiBold',
                fontSize: 16,
                color: isFormValid ? Colors.white : Colors.iconMuted,
                textAlign: 'center',
              }}
            >
              Save Profile
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}
