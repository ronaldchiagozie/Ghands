import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { Colors } from '@/lib/designSystem';
import { API_BASE_URL } from '@/lib/apiConfig';
import { useUserLocation } from '@/hooks/useUserLocation';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, MapPin, Plus, User } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
      Alert.alert('Permission required', 'Photo library access is required to upload images.');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
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
      Alert.alert('Permission required', 'Camera access is required to take photos.');
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

  return (
    <SafeAreaWrapper>
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
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          
          <View className="items-center mb-8">
            <TouchableOpacity 
              onPress={pickImage}
              className="border-2 border-gray-300 rounded-full items-center justify-center relative overflow-hidden"
              activeOpacity={0.8}
              style={{ 
                width: screenWidth * 0.32, 
                height: screenWidth * 0.32,
                minWidth: 120,
                minHeight: 120,
                maxWidth: 140,
                maxHeight: 140
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
              <View className="absolute -bottom-1 -right-1 w-8 h-8 bg-black rounded-full items-center justify-center">
                <Plus size={16} color="white" />
              </View>
            </TouchableOpacity>
            {profileImage && (
              <Text className="text-sm text-gray-600 mt-2" style={{ fontFamily: 'Poppins-Medium' }}>
                Image selected ✓
              </Text>
            )}
            {isUploading && (
              <Text className="text-xs text-gray-500 mt-1" style={{ fontFamily: 'Poppins-Regular' }}>
                Uploading...
              </Text>
            )}
          </View>

          
          <View 
            className="flex-row items-center mb-4"
            style={{ minHeight: screenHeight * 0.06 }}
          >
            <View 
              className="bg-[#4F6739] border-[0.5px] border-black rounded-xl items-center justify-center mr-4"
              style={{ 
                width: screenWidth * 0.12, 
                height: screenWidth * 0.08,
                minWidth: 48,
                minHeight: 48
              }}
            >
              <User size={20} color="white" />
            </View>
            <View 
              className="flex-1 bg-gray-100 rounded-xl px-4 py-3"
            >
              <TextInput
                placeholder="Full name"
                value={fullName}
                onChangeText={setFullName}
                className="text-black text-base"
                placeholderTextColor={Colors.placeholder}
                style={{ 
                  fontFamily: 'Poppins-Medium',
                  fontSize: screenWidth < 375 ? 14 : 16
                }}
              />
            </View>
          </View>

          
          <View 
            className="flex-row items-center mb-4"
            style={{ minHeight: screenHeight * 0.06 }}
          >
            <View 
              className="bg-[#4F6739] border-[0.5px] border-black rounded-xl items-center justify-center mr-4"
              style={{ 
                width: screenWidth * 0.12, 
                height: screenWidth * 0.12,
                minWidth: 48,
                minHeight: 48
              }}
            >
              <MapPin size={20} color="white" />
            </View>
            <TouchableOpacity
              onPress={handleAddHomeAddress}
              className="flex-1 bg-[#000000] rounded-xl py-3 px-4"
              activeOpacity={0.8}
              style={{ minHeight: 48 }}
            >
              <Text 
                className="text-white text-base text-center"
                style={{ 
                  fontFamily: 'Poppins-SemiBold',
                  fontSize: screenWidth < 375 ? 14 : 16
                }}
              >
                Add home address
              </Text>
            </TouchableOpacity>
          </View>

          
          <View 
            className="bg-gray-100 rounded-xl px-4 py-3 mb-6"
            style={{ minHeight: screenHeight * 0.06 }}
          >
            <TextInput
              placeholder="Location..."
              value={location}
              onChangeText={setLocation}
              className="text-black text-base"
              placeholderTextColor={Colors.placeholder}
              style={{ 
                fontFamily: 'Poppins-Medium',
                fontSize: screenWidth < 375 ? 14 : 16
              }}
            />
          </View>

          <View className="mb-8">
            <TextInput
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              className="bg-gray-100 rounded-xl px-4 py-3 text-black text-base"
              placeholderTextColor={Colors.placeholder}
              style={{ 
                fontFamily: 'Poppins-Medium',
                textAlignVertical: 'top',
                minHeight: screenHeight * 0.12,
                fontSize: screenWidth < 375 ? 14 : 16
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
            className={`rounded-xl py-4 px-6 ${
              isFormValid ? 'bg-[#4F6739]' : 'bg-gray-300'
            }`}
            activeOpacity={0.8}
            style={{ minHeight: 52 }}
          >
            <Text 
              className={`text-center text-lg font-semibold ${
                isFormValid ? 'text-white' : 'text-gray-500'
              }`}
              style={{ 
                fontFamily: 'Poppins-SemiBold',
                fontSize: screenWidth < 375 ? 16 : 18
              }}
            >
              Save Profile
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaWrapper>
  );
}
