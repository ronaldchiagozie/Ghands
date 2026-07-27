import Skeleton from '@/components/LoadingSkeleton';
import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { SageHeroPanel } from '@/components/provider/SageHeroPanel';
import { useAuthRole } from '@/hooks/useAuth';
import { haptics } from '@/hooks/useHaptics';
import { useCurrentUserProfile } from '@/hooks/useProfile';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import {
    BorderRadius,
    Colors,
    REFRESH_CONTROL,
    useTabScreenScrollBottomPadding,
    useTabScrollContentPaddingTop,
} from '@/lib/designSystem';
import { providerListCard } from '@/lib/providerSurfaceStyles';
import { CLIENT_HOME_SCROLL_GUTTER } from '@/lib/tabletLayout';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { logClientProfilePhoto } from '@/utils/clientProfilePhoto';
import { NOT_SET_LABEL } from '@/utils/copy';
import { AuthError } from '@/utils/errors';
import { shareReferral } from '@/utils/referral';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import {
    Bell,
    ChevronRight,
    HelpCircle,
    LogOut,
    MapPin,
    Settings,
    Star,
    Trash2,
    User,
    Wallet,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const DEFAULT_AVATAR = require('../../assets/images/userimg.jpg');

const MODAL_ACTION_BTN = {
  flex: 1,
  minHeight: 48,
  paddingVertical: 14,
  paddingHorizontal: 12,
  borderRadius: BorderRadius.default,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

type ProfileConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  confirmBackgroundColor?: string;
  confirmTextColor?: string;
  loading?: boolean;
  /** Single full-width button (e.g. “OK” on info dialogs) */
  singleAction?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function ProfileConfirmModal({
  visible,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel,
  confirmBackgroundColor = Colors.accent,
  confirmTextColor = '#FFFFFF',
  loading = false,
  singleAction = false,
  onCancel,
  onConfirm,
}: ProfileConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          paddingHorizontal: 28,
        }}
        onPress={onCancel}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: Colors.white,
            borderRadius: BorderRadius.lg,
            padding: 24,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 8,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              lineHeight: 20,
              marginBottom: 24,
            }}
          >
            {message}
          </Text>
          <View
            style={
              singleAction
                ? { width: '100%' }
                : { flexDirection: 'row', alignItems: 'stretch', gap: 12 }
            }
          >
            {!singleAction ? (
              <TouchableOpacity
                onPress={onCancel}
                disabled={loading}
                style={[MODAL_ACTION_BTN, { backgroundColor: '#F3F4F6' }]}
                activeOpacity={0.8}
              >
                <Text style={{ fontFamily: 'Poppins-SemiBold', color: Colors.textPrimary }}>{cancelLabel}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading && !singleAction}
              style={[
                MODAL_ACTION_BTN,
                { backgroundColor: confirmBackgroundColor },
                singleAction ? null : { flex: 1 },
              ]}
              activeOpacity={0.8}
            >
              {loading && !singleAction ? (
                <ActivityIndicator color={confirmTextColor} size="small" />
              ) : (
                <Text style={{ fontFamily: 'Poppins-SemiBold', color: confirmTextColor }}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type ProfileMenuRowProps = {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBackgroundColor: string;
  onPress: () => void;
  titleColor?: string;
  showBorderBottom?: boolean;
};

/** Same row pattern as Account settings — one list language across Profile. */
function ProfileMenuRow({
  title,
  subtitle,
  icon,
  iconBackgroundColor,
  onPress,
  titleColor = Colors.textPrimary,
  showBorderBottom = true,
}: ProfileMenuRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: showBorderBottom ? 1 : 0,
        borderBottomColor: 'rgba(17, 24, 39, 0.06)',
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: iconBackgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          flexShrink: 0,
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
        <Text
          style={{
            fontSize: 15,
            fontFamily: 'Poppins-SemiBold',
            color: titleColor,
            marginBottom: subtitle ? 2 : 0,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontSize: 12,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={Colors.textSecondaryDark} />
    </TouchableOpacity>
  );
}

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
  const scrollBottomPad = useTabScreenScrollBottomPadding(32);
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuthRole();
  const [signOutVisible, setSignOutVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleteInfoVisible, setDeleteInfoVisible] = useState(false);
  const { location } = useUserLocation();
  const profileReadyRef = useRef(false);
  const [isUserRefreshing, setIsUserRefreshing] = useState(false);

  const {
    data: profile,
    isLoading: isProfileLoading,
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
      void handleAuthErrorRedirect(router, pathname);
    }
  }, [profileError, router, pathname]);

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

  useEffect(() => {
    logClientProfilePhoto('profile_tab_avatar', {
      usingDefaultAsset: !profile?.profileImageUri,
      profileImageUriPreview: profile?.profileImageUri
        ? `${profile.profileImageUri.slice(0, 48)}…`
        : null,
      displayName: displayName.slice(0, 24),
    });
  }, [profile?.profileImageUri, displayName]);

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
    setIsUserRefreshing(true);
    try {
      await Promise.all([refetchProfile(), refreshWallet({ silent: true })]);
    } finally {
      setIsUserRefreshing(false);
    }
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

  const handleSignOutPress = useCallback(() => {
    haptics.light();
    setSignOutVisible(true);
  }, []);

  const handleSignOutCancel = useCallback(() => {
    if (isSigningOut) return;
    setSignOutVisible(false);
  }, [isSigningOut]);

  const handleSignOutConfirm = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    haptics.selection();
    try {
      await logout();
      setSignOutVisible(false);
    } catch {
      setIsSigningOut(false);
      setSignOutVisible(false);
    }
  }, [isSigningOut, logout]);

  const handleDeletePress = useCallback(() => {
    haptics.light();
    setDeleteConfirmVisible(true);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmVisible(false);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    haptics.warning();
    setDeleteConfirmVisible(false);
    setDeleteInfoVisible(true);
  }, []);

  const handleDeleteInfoDismiss = useCallback(() => {
    setDeleteInfoVisible(false);
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
            refreshing={isUserRefreshing}
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
                <ProfileMenuRow
                  key={setting.id}
                  title={setting.title}
                  subtitle={setting.subtitle}
                  icon={<IconComponent size={20} color={setting.color} />}
                  iconBackgroundColor={setting.bg}
                  onPress={() => handleOptionPress(setting.id)}
                  showBorderBottom={index < accountSettings.length - 1}
                />
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
              marginBottom: 12,
            }}
          >
            Refer friends
          </Text>
          <View
            style={{
              ...providerListCard,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
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
                {profile?.referralCode ?? NOT_SET_LABEL}
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
          <Text
            style={{
              fontSize: 18,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: 12,
            }}
          >
            Session & account
          </Text>
          <View style={{ ...providerListCard, padding: 0, overflow: 'hidden' }}>
            <ProfileMenuRow
              title="Sign out"
              subtitle="Return to the login screen"
              icon={<LogOut size={20} color={Colors.accent} />}
              iconBackgroundColor={Colors.sageTint}
              onPress={handleSignOutPress}
              showBorderBottom
            />
            <ProfileMenuRow
              title="Delete account"
              subtitle="Remove your profile and data"
              icon={<Trash2 size={20} color="#B42318" />}
              iconBackgroundColor="#F7F8FA"
              onPress={handleDeletePress}
              titleColor="#B42318"
              showBorderBottom={false}
            />
          </View>
        </View>
      </ScrollView>

      <ProfileConfirmModal
        visible={signOutVisible}
        title="Sign out?"
        message="You will need to sign in again to access your jobs and wallet."
        confirmLabel="Sign out"
        confirmBackgroundColor={Colors.accent}
        loading={isSigningOut}
        onCancel={handleSignOutCancel}
        onConfirm={() => void handleSignOutConfirm()}
      />

      <ProfileConfirmModal
        visible={deleteConfirmVisible}
        title="Delete account?"
        message="This permanently removes your profile and data. This action cannot be undone."
        confirmLabel="Delete"
        confirmBackgroundColor="#B42318"
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />

      <ProfileConfirmModal
        visible={deleteInfoVisible}
        title="Account deletion"
        message="Account deletion is not available yet. Contact support if you need help closing your account."
        confirmLabel="OK"
        confirmBackgroundColor={Colors.accent}
        singleAction
        onCancel={handleDeleteInfoDismiss}
        onConfirm={handleDeleteInfoDismiss}
      />
    </SafeAreaWrapper>
  );
};

export default ProfileScreen;
