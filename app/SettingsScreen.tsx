import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, Spacing } from '@/lib/designSystem';
import { useRouter } from 'expo-router';
import { ChevronRight, HelpCircle, Key, Scale, User } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

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

  const settingsOptions: SettingsOption[] = [
    {
      id: '1',
      title: 'Account & Preferences',
      subtitle: 'personal info, Notification',
      icon: User,
      iconBgColor: '#F5F5F5',
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
      iconBgColor: '#F3E8FF',
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
      iconBgColor: '#F5F5F5',
      onPress: () => {
        router.push('/LegalAboutScreen' as any);
      },
    },
    {
      id: '5',
      title: 'Security',
      subtitle: 'Account security settings',
      icon: Key,
      iconBgColor: '#F5F5F5',
      onPress: () => {
        router.push('/SecurityScreen' as any);
      },
    },
  ];

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Settings" onBack={() => router.back()} backgroundColor={Colors.white} />
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
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 0.76,
                }}
                activeOpacity={0.7}
              >
                {/* Icon */}
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
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
                      fontSize: 16,
                      fontFamily: 'Poppins-Bold',
                      color: Colors.textPrimary,
                      marginBottom: 4,
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
                <ChevronRight size={20} color={Colors.textSecondaryDark} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}
