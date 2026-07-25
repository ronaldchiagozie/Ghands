import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/lib/designSystem';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { useRouter } from 'expo-router';
import { ChevronRight, MapPin, User } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  },
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
    <SafeAreaWrapper backgroundColor={Colors.backgroundGray}>
      <View style={styles.root}>
        <ScreenHeader
          title="Account Information"
          onBack={() => router.back()}
          backgroundColor={Colors.white}
          showBottomBorder
        />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scroll}
        >
          {accountCards.map((card) => {
            const IconComponent = card.icon;
            return (
              <TouchableOpacity
                key={card.id}
                onPress={() => handleNavigation(card.id)}
                style={styles.card}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: card.iconBgColor }]}>
                  <IconComponent size={24} color={card.iconColor} />
                </View>

                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                </View>

                <ChevronRight size={22} color={Colors.textSecondaryDark} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
    paddingTop: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: 'Poppins-Medium',
    color: Colors.textSecondaryDark,
  },
});
