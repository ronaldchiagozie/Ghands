import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { navigateBack, NAV_FALLBACK } from '@/utils/navigation';
import { ChevronRight, HelpCircle, MapPin, User } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/lib/designSystem';

const accountCards = [
  {
    id: '1',
    title: 'Personal Details',
    subtitle: 'Name, email, phone number',
    icon: User,
    iconColor: '#666',
    iconBgColor: '#F5F5F5',
  },
  {
    id: '2',
    title: 'Address Book',
    subtitle: 'Manage your saved addresses',
    icon: MapPin,
    iconColor: '#4F6739',
    iconBgColor: '#EEFFD9',
  }
];

export default function AccountInformationScreen() {
  const router = useRouter();

  const handleNavigation = (id: string) => {
    if (id === '1') {
      router.push('/EditProfileScreen' as any);
    } else if (id === '2') {
      router.push('/AddressBookScreen' as any);
    }
  };

  return (
    <SafeAreaWrapper backgroundColor="#F9FAFB">
        <ScreenHeader title="Account Information" onBack={() => router.back()} backgroundColor={Colors.white} />
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-4 pt-6">
          {accountCards.map((card) => {
            const IconComponent = card.icon;
            return (
              <TouchableOpacity
                key={card.id}
                onPress={() => handleNavigation(card.id)}
                className="bg-white rounded-2xl px-4 py-5 mb-4 flex-row items-center  border border-gray-200"
                activeOpacity={0.7}
              >
                <View 
                  style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: 24, 
                    backgroundColor: card.iconBgColor,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 16
                  }}
                >
                  <IconComponent size={24} color={card.iconColor} />
                </View>
                
                <View className="flex-1">
                  <Text 
                    className="text-base font-bold text-black mb-1" 
                    style={{ fontFamily: 'Poppins-Bold' }}
                  >
                    {card.title}
                  </Text>
                  <Text 
                    className="text-sm text-gray-500" 
                    style={{ fontFamily: 'Poppins-Medium' }}
                  >
                    {card.subtitle}
                  </Text>
                </View>

                <ChevronRight size={24} color="#666" />
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaWrapper>
  );
}
