import Skeleton from '@/components/LoadingSkeleton';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { SageHeroPanel } from '@/components/provider/SageHeroPanel';
import { useAuthRole } from '@/hooks/useAuth';
import { useCurrentUserProfile } from '@/hooks/useProfile';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import {
  BorderRadius,
  Colors,
  REFRESH_CONTROL,
  useTabScrollContentPaddingTop,
  useTabScreenScrollBottomPadding,
} from '@/lib/designSystem';
import { providerListCard } from '@/lib/providerSurfaceStyles';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { AuthError } from '@/utils/errors';
import { shareReferral } from '@/utils/referral';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CreditCard,
  HelpCircle,
  LogOut,
  MapPin,
  Settings,
  Star,
  Trash2,
  User,
  Wallet,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const DEFAULT_AVATAR = require('../../assets/images/userimg.jpg');

const formatNaira = (amount: number): string =>
  `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

function ClientProfileHeroSkeleton({ marginTop }: { marginTop: number }) {
  return (
    <SageHeroPanel
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop,
        marginBottom: 24,
      }}
    >
      <Skeleton width={80} height={80} borderRadius={40} variant="sage" style={{ marginRight: 18 }} />
      <View style={{ flex: 1 }}>
        <Skeleton width="72%" height={20} borderRadius={8} variant="sage" style={{ marginBottom: 8 }} />
        <Skeleton width="88%" height={14} borderRadius={6} variant="sage" style={{ marginBottom: 6 }} />
        <Skeleton width="48%" height={14} borderRadius={6} variant="sage" />
      </View>
    </SageHeroPanel>
  );
}

const ProfileScreen = () => {
  const headerTopPad = useTabScrollContentPaddingTop(16);
  const scrollBodyTopPad = useTabScrollContentPaddingTop(20);
  const scrollBottomPad = useTabScreenScrollBottomPadding(16);
  const router = useRouter();
  const { logout } = useAuthRole();
  const { location } = useUserLocation();
  const profileReadyRef = useRef(false);

  const {
    data: profile,
    isLoading: isProfileLoading,
    isFetching: isProfileFetching,
    refetch: refetchProfile,
    error: profileError,
  } = useCurrentUserProfile();

  const { balance, isLoading: isWalletLoading, refresh: refreshWallet } = useWalletBalance({
    refreshOnFocus: true,
  });

  const showHeroSkeleton = isProfileLoading && !profileReadyRef.current;

  useEffect(() => {
    if (!isProfileLoading && profile) {
      profileReadyRef.current = true;
    }
  }, [isProfileLoading, profile]);

  useEffect(() => {
    if (profileError instanceof AuthError) {
      void handleAuthErrorRedirect(router);
    }
  }, [profileError, router]);

  useFocusEffect(
    useCallback(() => {
      void refetchProfile();
      void refreshWallet({ silent: true });
    }, [refetchProfile, refreshWallet])
  );

  const displayName = profile?.name?.trim() || 'Your profile';
  const displayLocation = location?.trim() || 'Add your location';
  const hasRating = (profile?.rating ?? 0) > 0 || (profile?.reviewCount ?? 0) > 0;
  const avatarSource = profile?.profileImageUri
    ? { uri: profile.profileImageUri }
    : DEFAULT_AVATAR;

  const accountSettings = useMemo(
    () => [
      {
        id: 'account',
        title: 'Account & Preferences',
        subtitle: 'Personal info, notifications, and privacy',
        icon: User,
        bg: Colors.sageTint,
        color: Colors.accent,
      },
      {
        id: 'wallet',
        title: 'Wallet',
        subtitle:
          balance != null && !isWalletLoading
            ? `Balance: ${formatNaira(balance)}`
            : 'Balance, top-ups, and activity',
        icon: Wallet,
        bg: '#FAF4E8',
        color: '#8F5C12',
      },
      {
        id: 'billing',
        title: 'Payment methods',
        subtitle: 'Cards, banks & receipts',
        icon: CreditCard,
        bg: '#F7F8FA',
        color: Colors.textPrimary,
      },
      {
        id: 'support',
        title: 'Support & Information',
        subtitle: 'Help center, safety, and app information',
        icon: HelpCircle,
        bg: '#FFF7DF',
        color: Colors.warningForeground,
      },
    ],
    [balance, isWalletLoading]
  );

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchProfile(), refreshWallet({ silent: true })]);
  }, [refetchProfile, refreshWallet]);

  const handleOptionPress = useCallback(
    (id: string) => {
      switch (id) {
        case 'account':
          router.push('/AccountInformationScreen' as never);
          break;
        case 'wallet':
          router.push('/WalletScreen' as never);
          break;
        case 'billing':
          router.push('/PaymentMethodsScreen' as never);
          break;
        case 'support':
          router.push('/HelpSupportScreen' as never);
          break;
        default:
          break;
      }
    },
    [router]
  );

  const handleShareReferral = useCallback(async () => {
    await shareReferral({ role: 'client', code: profile?.referralCode ?? null });
  }, [profile?.referralCode]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  }, [logout]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Account Deletion', 'Account deletion feature coming soon.');
          },
        },
      ]
    );
  }, []);


  const openEditProfile = useCallback(() => {
    router.push('/EditProfileScreen' as never);
  }, [router]);

  const openLocation = useCallback(() => {
    router.push('/LocationSearchScreen' as never);
  }, [router]);

  return (
    <SafeAreaWrapper backgroundColor={Colors.backgroundLight} tabletShellTop>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
          paddingTop: headerTopPad,
          paddingBottom: 16,
          backgroundColor: Colors.backgroundLight,
        }}
      >
        <View style={{ flex: 1, alignItems: 'flex-start' }}>
          <TouchableOpacity
            onPress={() => router.push('/SettingsScreen' as never)}
            style={{
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 20,
              backgroundColor: Colors.white,
            }}
            activeOpacity={0.7}
          >
            <Settings size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text
          style={{
            fontSize: 20,
            fontFamily: 'Poppins-Bold',
            color: Colors.textPrimary,
            flex: 1,
            textAlign: 'center',
          }}
        >
          Profile
        </Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <TouchableOpacity
            onPress={() => router.push('/NotificationsScreen' as never)}
            style={{ position: 'relative', padding: 4, borderRadius: 20, backgroundColor: Colors.white }}
            activeOpacity={0.7}
          >
            <Bell size={22} color={Colors.textPrimary} />
            <View
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: Colors.accent,
              }}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isProfileFetching && profileReadyRef.current}
            onRefresh={onRefresh}
            tintColor={REFRESH_CONTROL.tintColor}
            colors={REFRESH_CONTROL.colors as unknown as string[]}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: CLIENT_HOME_SCROLL_GUTTER,
          paddingBottom: scrollBottomPad,
        }}
      >
        {showHeroSkeleton ? (
          <ClientProfileHeroSkeleton marginTop={scrollBodyTopPad} />
        ) : (
          <SageHeroPanel
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: scrollBodyTopPad,
              marginBottom: 24,
            }}
          >
            <TouchableOpacity onPress={openEditProfile} activeOpacity={0.85} style={{ marginRight: 18 }}>
              <Image
                source={avatarSource}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 3,
                  borderColor: 'rgba(255,255,255,0.38)',
                }}
                resizeMode="cover"
              />
            </TouchableOpacity>

            <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
              <TouchableOpacity onPress={openEditProfile} activeOpacity={0.85}>
                <Text
                  style={{
                    fontSize: 20,
                    fontFamily: 'Poppins-Bold',
                    color: Colors.white,
                    marginBottom: 8,
                    letterSpacing: -0.4,
                  }}
                  numberOfLines={2}
                >
                  {displayName}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={openLocation}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: hasRating ? 6 : 0 }}
              >
                  <MapPin size={14} color="rgba(255,255,255,0.62)" style={{ flexShrink: 0 }} />
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontFamily: 'Poppins-Regular',
                      color: location ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.92)',
                      marginLeft: 6,
                    }}
                    numberOfLines={2}
                  >
                    {displayLocation}
                  </Text>
                  <ChevronRight size={14} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>

                {hasRating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Star size={14} color="#FDE68A" fill="#FDE68A" />
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: 'Poppins-Medium',
                        color: Colors.white,
                        marginLeft: 4,
                      }}
                    >
                      {(profile?.rating ?? 0).toFixed(1)}
                    </Text>
                    <View
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: 1.5,
                        backgroundColor: 'rgba(255,255,255,0.35)',
                        marginHorizontal: 6,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: 'Poppins-Regular',
                        color: 'rgba(255,255,255,0.68)',
                      }}
                    >
                      {profile?.reviewCount ?? 0} reviews
                    </Text>
                  </View>
                ) : null}
              </View>
            </SageHeroPanel>
        )}

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Account settings
          </Text>
          <View style={{ ...providerListCard, padding: 0, overflow: 'hidden' }}>
            {accountSettings.map((setting, index) => {
              const IconComponent = setting.icon;
              return (
                <TouchableOpacity
                  key={setting.id}
                  onPress={() => handleOptionPress(setting.id)}
                  style={{
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderBottomWidth: index === accountSettings.length - 1 ? 0 : 1,
                    borderBottomColor: 'rgba(17, 24, 39, 0.06)',
                  }}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: setting.bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <IconComponent size={20} color={setting.color} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontFamily: 'Poppins-SemiBold',
                        color: Colors.textPrimary,
                        marginBottom: 2,
                      }}
                    >
                      {setting.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontFamily: 'Poppins-Regular',
                        color: Colors.textSecondaryDark,
                      }}
                    >
                      {setting.subtitle}
                    </Text>
                  </View>

                  <ChevronRight size={18} color={Colors.textSecondaryDark} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 6,
            }}
          >
            Refer Friends
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginBottom: 12,
            }}
          >
            Get rewards for each referral
          </Text>
          <View
            style={{
              ...providerListCard,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  marginBottom: 4,
                }}
              >
                Your code
              </Text>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-Bold',
                  color: Colors.textPrimary,
                }}
              >
                {profile?.referralCode ?? '—'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleShareReferral}
              style={{
                backgroundColor: Colors.accent,
                borderRadius: BorderRadius.default,
                paddingVertical: 8,
                paddingHorizontal: 16,
              }}
              activeOpacity={0.8}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.white,
                }}
              >
                Share
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginBottom: 24 }}>
          <View style={{ ...providerListCard, padding: 0, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textPrimary,
                }}
              >
                Account access
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  marginTop: 2,
                }}
              >
                Manage your session and account security.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleSignOut}
              style={{
                minHeight: 92,
                paddingHorizontal: 18,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
              }}
              activeOpacity={0.72}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  backgroundColor: '#FFF4ED',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 15,
                }}
              >
                <LogOut size={20} color="#C2413D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: 'Poppins-SemiBold',
                    color: Colors.textPrimary,
                  }}
                >
                  Sign out
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: Colors.textSecondaryDark,
                    marginTop: 5,
                    lineHeight: 18,
                  }}
                >
                  End this session and return to login.
                </Text>
              </View>
              <ChevronRight size={21} color="rgba(17, 24, 39, 0.28)" />
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: '#EEF1E8', marginLeft: 78, marginRight: 18 }} />

            <TouchableOpacity
              onPress={handleDeleteAccount}
              style={{
                minHeight: 94,
                paddingHorizontal: 18,
                paddingVertical: 16,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFBFA',
              }}
              activeOpacity={0.72}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  backgroundColor: Colors.errorBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 15,
                }}
              >
                <Trash2 size={20} color="#B42318" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontFamily: 'Poppins-SemiBold',
                    color: '#B42318',
                  }}
                >
                  Delete account
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontFamily: 'Poppins-Regular',
                    color: '#7F1D1D',
                    marginTop: 5,
                    lineHeight: 18,
                  }}
                >
                  Permanently remove your profile and data.
                </Text>
              </View>
              <ChevronRight size={21} color="rgba(180, 35, 24, 0.35)" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
};

export default ProfileScreen;
