import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { useRouter } from 'expo-router';
import { ChevronRight, FileText, Info, Shield } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface LegalOption {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  iconBgColor: string;
  onPress: () => void;
}

export default function LegalAboutScreen() {
  const router = useRouter();

  const legalOptions: LegalOption[] = [
    {
      id: '1',
      title: 'Terms of Service',
      subtitle: 'Read our terms and conditions',
      icon: FileText,
      iconBgColor: '#F5F5F5',
      onPress: () => {
        router.push('/TermsOfServiceScreen' as any);
      },
    },
    {
      id: '2',
      title: 'Privacy Policy',
      subtitle: 'How we protect your data',
      icon: Shield,
      iconBgColor: '#F5F5F5',
      onPress: () => {
        router.push('/PrivacyPolicyScreen' as any);
      },
    },
    {
      id: '3',
      title: 'About G-Hands',
      subtitle: 'Version 1.2.3. Learn more about us.',
      icon: Info,
      iconBgColor: '#F5F5F5',
      onPress: () => {
        router.push('/AboutGHandsScreen' as any);
      },
    },
  ];

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Legal & About" onBack={() => router.back()} backgroundColor={Colors.white} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 100,
          }}
        >
          {legalOptions.map((option) => {
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
