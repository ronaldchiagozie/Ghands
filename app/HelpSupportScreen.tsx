import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HelpCircle, User } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/lib/designSystem';

const helpOptions = [
  {
    id: '1',
    title: 'FAQ & Help center',
    subtitle: '24/7 live chat and phone support',
    icon: User,
    iconBgColor: '#F5F5F5',
    route: '/SupportScreen',
  },
  {
    id: '2',
    title: 'User guide',
    subtitle: 'How it works',
    icon: HelpCircle,
    iconBgColor: '#F5F5F5',
    route: null, // Placeholder for later
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();

  const handleOptionPress = (route: string | null) => {
    if (route) {
      router.push(route as any);
    } else {
      // Navigate to User Guide
      router.push('/UserGuideScreen' as any);
    }
  };

  return (
    <SafeAreaWrapper>
      <ScreenHeader title="Help & Support" onBack={() => router.back()} />

      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-4 pt-6">
          {helpOptions.map((option) => {
            const IconComponent = option.icon;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleOptionPress(option.route)}
                activeOpacity={0.85}
                className="bg-white rounded-2xl px-4 py-5 mb-4 flex-row items-center border border-gray-200"
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: option.iconBgColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16,
                  }}
                >
                  <IconComponent size={24} color="#666" />
                </View>

                <View className="flex-1">
                  <Text className="text-base font-bold text-black mb-1" style={{ fontFamily: 'Poppins-Bold' }}>
                    {option.title}
                  </Text>
                  <Text
                    className={`text-sm ${option.id === '2' ? 'text-[#4F6739]' : 'text-gray-500'}`}
                    style={{ fontFamily: 'Poppins-Medium' }}
                  >
                    {option.subtitle}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={24} color="#000" />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaWrapper>
  );
}

