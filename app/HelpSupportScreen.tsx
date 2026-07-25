import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, BorderRadius } from '@/lib/designSystem';
import { providerListCard } from '@/lib/providerSurfaceStyles';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { useRouter } from 'expo-router';
import { BookOpen, ChevronRight, MessageCircle } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const OPTIONS = [
  {
    id: 'faq',
    title: 'Help centre',
    subtitle: 'FAQs, contact options, and live chat',
    route: '/SupportScreen' as const,
    icon: MessageCircle,
    iconBg: Colors.sageTint,
    iconColor: Colors.accent,
  },
  {
    id: 'guide',
    title: 'User guide',
    subtitle: 'Step-by-step booking walkthrough',
    route: '/UserGuideScreen' as const,
    icon: BookOpen,
    iconBg: '#F7F8FA',
    iconColor: Colors.textPrimary,
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight}>
      <ScreenHeader title="Help & support" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.lead}>
          Get answers, talk to support, or follow the guide to book your first service.
        </Text>

        <View style={[styles.card, providerListCard]}>
          {OPTIONS.map((option, index) => {
            const Icon = option.icon;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => router.push(option.route as never)}
                activeOpacity={0.7}
                style={[
                  styles.row,
                  index < OPTIONS.length - 1 && styles.rowBorder,
                ]}
              >
                <View style={[styles.iconWrap, { backgroundColor: option.iconBg }]}>
                  <Icon size={20} color={option.iconColor} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{option.title}</Text>
                  <Text style={styles.rowSubtitle}>{option.subtitle}</Text>
                </View>
                <ChevronRight size={18} color={Colors.textSecondaryDark} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
    paddingTop: 20,
    paddingBottom: 40,
  },
  lead: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
    lineHeight: 21,
    marginBottom: 20,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(17, 24, 39, 0.06)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: 'Poppins-SemiBold',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: Colors.textSecondaryDark,
  },
});
