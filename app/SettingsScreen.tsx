import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BorderRadius, Colors, Spacing } from '@/lib/designSystem';
import { resetOnboardingForTesting } from '@/utils/resetOnboardingForTesting';
import { useRouter } from 'expo-router';
import { ChevronRight, HelpCircle, Key, RotateCcw, Scale, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface SettingsOption {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  iconBgColor: string;
  onPress: () => void;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [isResettingOnboarding, setIsResettingOnboarding] = useState(false);

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset onboarding (testing)',
      'This signs you out and clears the onboarding flag, so the next launch replays the welcome carousel and signup from the start. For testing only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            if (isResettingOnboarding) return;
            setIsResettingOnboarding(true);
            resetOnboardingForTesting(router).catch(() => setIsResettingOnboarding(false));
          },
        },
      ],
    );
  };

  const settingsOptions: SettingsOption[] = [
    {
      id: '1',
      title: 'Account & Preferences',
      subtitle: 'personal info, Notification',
      icon: User,
      iconBgColor: Colors.backgroundGray,
      onPress: () => {
        // Navigate to account settings
        router.push('/AccountInformationScreen' as any);
      },
    },
    {
      id: '3',
      title: 'Support & Information',
      subtitle: 'Manage preferences',
      icon: HelpCircle,
      iconBgColor: Colors.sageTint,
      onPress: () => {
        // Navigate to support
        router.push('/HelpSupportScreen' as any);
      },
    },
    {
      id: '4',
      title: 'Legal & About',
      subtitle: 'Terms and Conditions',
      icon: Scale,
      iconBgColor: Colors.backgroundGray,
      onPress: () => {
        router.push('/LegalAboutScreen' as any);
      },
    },
    {
      id: '5',
      title: 'Security',
      subtitle: 'Account security settings',
      icon: Key,
      iconBgColor: Colors.backgroundGray,
      onPress: () => {
        router.push('/SecurityScreen' as any);
      },
    },
    {
      id: '6',
      title: 'Reset onboarding (testing)',
      subtitle: 'Signs out, replays the welcome flow from the start',
      icon: RotateCcw,
      iconBgColor: Colors.backgroundGray,
      onPress: handleResetOnboarding,
    },
  ];

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Settings" onBack={() => navigateBack(router, NAV_FALLBACK.clientHome)} backgroundColor={Colors.white} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 100,
          }}
        >
          {settingsOptions.map((option) => {
            const IconComponent = option.icon;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={option.onPress}
                style={{
                  backgroundColor: Colors.white,
                  borderRadius: BorderRadius.default,
                  padding: 16,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: Colors.border,
                  opacity: option.id === '6' && isResettingOnboarding ? 0.6 : 1,
                }}
                activeOpacity={0.7}
                disabled={option.id === '6' && isResettingOnboarding}
              >
                {/* Icon */}
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: BorderRadius.full,
                    backgroundColor: option.iconBgColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16,
                  }}
                >
                  <IconComponent size={24} color={Colors.textPrimary} />
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontFamily: 'Poppins-Bold',
                      color: Colors.textPrimary,
                      marginBottom: 4,
                      letterSpacing: -0.2,
                    }}
                  >
                    {option.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: 'Poppins-Regular',
                      color: Colors.textSecondaryDark,
                    }}
                  >
                    {option.subtitle}
                  </Text>
                </View>

                {/* Chevron */}
                {option.id === '6' && isResettingOnboarding ? (
                  <ActivityIndicator size="small" color={Colors.textSecondaryDark} />
                ) : (
                  <ChevronRight size={20} color={Colors.textSecondaryDark} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}
