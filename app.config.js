const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
module.exports = {
  expo: {
    name: 'GHands',
    slug: 'GHands',
    version: '1.0.3',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'ghands',
    userInterfaceStyle: 'light',
    backgroundColor: '#4F6739',
    newArchEnabled: true,
    extra: {
      appRole: 'client',
      eas: {
        projectId: '82fb8167-b26b-4fcf-84c2-fb858f717a03',
      },
    },
    ios: {
      icon: './assets/images/icon.png',
      supportsTablet: true,
      bundleIdentifier: 'com.bendee.GHands',
      config: { googleMapsApiKey },
      infoPlist: {
        NSCameraUsageDescription:
          'This app needs access to camera to take profile photos.',
        NSPhotoLibraryUsageDescription:
          'This app needs access to photo library to select profile photos.',
        NSMicrophoneUsageDescription:
          'GHands uses the microphone for in-app voice calls with your service provider.',
      },
      usesAppleSignIn: false,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/icon.png',
        backgroundColor: '#4F6739',
      },
      edgeToEdgeEnabled: false,
      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: 'pan',
      package: 'com.bendee.GHands',
      permissions: [
        'android.permission.CAMERA',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.VIBRATE',
        'android.permission.RECORD_AUDIO',
        'android.permission.MODIFY_AUDIO_SETTINGS',
      ],
      config: { googleMaps: { apiKey: googleMapsApiKey } },
    },
    androidStatusBar: {
      backgroundColor: '#FFFFFF',
      barStyle: 'dark-content',
      translucent: false,
      hidden: false,
    },
    androidNavigationBar: {
      barStyle: 'light-content',
      backgroundColor: '#4F6739',
    },
    web: { bundler: 'metro' },
    plugins: [
      'expo-router',
      'expo-font',
      [
        'expo-notifications',
        {
          icon: './assets/images/icon.png',
          color: '#4F6739',
          sounds: [],
          mode: 'production',
        },
      ],
      [
        'expo-navigation-bar',
        {
          position: 'relative',
          visibility: 'visible',
          behavior: 'inset-swipe',
          backgroundColor: '#4F6739',
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/icon.png',
          imageWidth: 140,
          resizeMode: 'contain',
          backgroundColor: '#4F6739',
          dark: { backgroundColor: '#4F6739' },
        },
      ],
      'expo-asset',
      'expo-secure-store',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
