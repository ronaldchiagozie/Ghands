const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
module.exports = {
  expo: {
    name: 'GHands',
    slug: 'GHands',
    version: '1.0.3',
    orientation: 'portrait',
    /**
     * app-icon.png, not icon.png.
     *
     * icon.png is 250x260 with transparent rounded corners - a black plate
     * drawn into the artwork itself. Two things wrong with that as an app
     * icon. iOS forbids transparency and flattens it, which is where the
     * white ring around the icon on the home screen came from; and at 250px
     * it was being upscaled past four times its size for a 180pt slot, so it
     * was soft as well. app-icon.png is 1024x1024, fully opaque, black to
     * the edges, with no corner rounding - the OS applies its own mask.
     */
    icon: './assets/images/app-icon.png',
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
      icon: './assets/images/app-icon.png',
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
        /** Keeps call audio going when the screen locks or the app goes to the background. */
        UIBackgroundModes: ['audio'],
      },
      usesAppleSignIn: false,
    },
    android: {
      adaptiveIcon: {
        /**
         * Transparent foreground over a black plate, which is how an
         * adaptive icon is meant to be built: the launcher crops this to a
         * circle or a squircle depending on the device, so the artwork is
         * drawn smaller to survive the trim and the colour is the layer
         * underneath rather than part of the picture.
         */
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#000000',
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
          // Android draws this as a white mask; the full-colour app icon came out as a blank square.
          icon: './assets/images/notification-icon.png',
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
      'expo-web-browser',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  },
};
