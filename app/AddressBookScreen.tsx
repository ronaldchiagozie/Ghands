import SafeAreaWrapper from '@/components/SafeAreaWrapper';
import { NAV_FALLBACK, navigateBack } from '@/utils/navigation';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BorderRadius, Colors } from '@/lib/designSystem';
import { authService, locationService } from '@/services/api';
import type { SavedLocation } from '@/services/api';
import { loadAddressBookExtras, removeAddressBookExtra } from '@/utils/addressBookExtras';
import { MoreVertical } from 'lucide-react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAppAlert } from '@/components/AppAlertHost';
import { useUserLocation } from '@/hooks/useUserLocation';

function normalizeAddr(s: string | null | undefined): string {
  return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function formatCoords(lat?: number, lng?: number): string | undefined {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return undefined;
  if (lat === 0 && lng === 0) return undefined;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

type DisplayRow = {
  id: string;
  title: string;
  line1: string;
  line2?: string;
  isExtra: boolean;
};

export default function AddressBookScreen() {
  const router = useRouter();
  const { location: activeServiceLocation, setLocation, refreshLocation } = useUserLocation();
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAddresses = useCallback(async (activeOverride?: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const effectiveActive = activeOverride ?? activeServiceLocation;

      const userId = await authService.getUserId();
      let saved: SavedLocation | null = null;
      if (userId) {
        try {
          saved = await locationService.getUserLocation(userId);
        } catch {
          saved = null;
        }
      }

      const extras = await loadAddressBookExtras();
      const seen = new Set<string>();
      const next: DisplayRow[] = [];

      const pushRow = (r: DisplayRow, dedupeKey: string) => {
        const k = normalizeAddr(dedupeKey);
        if (!k || seen.has(k)) return;
        seen.add(k);
        next.push(r);
      };

      if (saved && (saved.fullAddress || saved.address)) {
        const line1 =
          (saved.fullAddress && saved.fullAddress.trim()) ||
          [saved.address, saved.city, saved.state, saved.country].filter(Boolean).join(', ') ||
          saved.placeName ||
          '';
        if (line1) {
          const coords = formatCoords(saved.latitude, saved.longitude);
          const activeNorm = normalizeAddr(effectiveActive);
          const isCurrent = activeNorm && activeNorm === normalizeAddr(line1);
          pushRow(
            {
              id: 'api-primary',
              title: isCurrent ? 'Current location' : 'Saved address',
              line1,
              line2: coords ? `Pin: ${coords}` : undefined,
              isExtra: false,
            },
            line1
          );
        }
      }

      for (const ex of extras) {
        const line1 = ex.fullAddress.trim();
        if (!line1) continue;
        const coords = formatCoords(ex.latitude, ex.longitude);
        pushRow(
          {
            id: ex.id,
            title: 'Saved address',
            line1,
            line2: coords ? `Pin: ${coords}` : undefined,
            isExtra: true,
          },
          line1
        );
      }

      if (next.length === 0 && effectiveActive?.trim()) {
        pushRow(
          {
            id: 'context-only',
            title: 'Current location',
            line1: effectiveActive.trim(),
            isExtra: false,
          },
          effectiveActive
        );
      }

      setRows(next);
    } catch (e: any) {
      setError(e?.message || 'Could not load addresses');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeServiceLocation]);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

  const isRowActive = (line1: string) => {
    const a = normalizeAddr(activeServiceLocation);
    const b = normalizeAddr(line1);
    return Boolean(a && b && a === b);
  };

  const handleSelectRow = async (row: DisplayRow) => {
    try {
      await setLocation(row.line1);
      await refreshLocation();
      await loadAddresses(row.line1);
    } catch {
      showAppAlert('Could not update', 'Please try again.');
    }
  };

  const openRowMenu = (row: DisplayRow) => {
    const options: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [
      {
        text: 'Use as service location',
        onPress: () => handleSelectRow(row),
      },
      {
        text: 'Update on map',
        onPress: () =>
          router.push({
            pathname: '/LocationSearchScreen' as any,
            params: { next: 'AddressBookScreen' },
          } as any),
      },
    ];
    if (row.isExtra) {
      options.push({
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          showAppAlert('Remove address?', 'This removes it from your list on this device.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                await removeAddressBookExtra(row.id);
                await loadAddresses();
              },
            },
          ]);
        },
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    showAppAlert(row.line1.slice(0, 40) + (row.line1.length > 40 ? '…' : ''), undefined, options);
  };

  return (
    <SafeAreaWrapper backgroundColor={Colors.white}>
      <ScreenHeader
        title="Address Book"
        onBack={() => navigateBack(router, NAV_FALLBACK.clientHome)}
        rightElement={
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/LocationSearchScreen' as any,
                params: { next: 'AddressBookScreen' },
              } as any)
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Add address"
            accessibilityHint="Opens location search to save a new address"
          >
            <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 14, color: Colors.accent }}>Add</Text>
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={{ marginTop: 12, fontFamily: 'Poppins-Medium', color: Colors.textSecondaryDark }}>
            Loading saved addresses…
          </Text>
        </View>
      ) : error ? (
        <View style={{ padding: 24 }}>
          <Text style={{ fontFamily: 'Poppins-Regular', color: Colors.textSecondaryDark, marginBottom: 16 }}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => loadAddresses()}>
            <Text style={{ fontFamily: 'Poppins-SemiBold', color: Colors.accent }}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
          <Text
            style={{
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              fontSize: 14,
              lineHeight: 22,
              marginBottom: 20,
            }}
          >
            No saved addresses yet. Add your service location so bookings use the right place on the map.
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/LocationSearchScreen' as any,
                params: { next: 'AddressBookScreen' },
              } as any)
            }
            style={{
              backgroundColor: Colors.accent,
              paddingVertical: 14,
              borderRadius: BorderRadius.default,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontFamily: 'Poppins-SemiBold', color: Colors.white, fontSize: 16 }}>
              Add address
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1 bg-white">
          <View className="px-4 pt-6">
            {rows.map((row) => {
              const active = isRowActive(row.line1);
              return (
                <TouchableOpacity
                  key={row.id}
                  activeOpacity={0.85}
                  onPress={() => handleSelectRow(row)}
                  style={{
                    backgroundColor: Colors.white,
                    borderRadius: BorderRadius.default,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: Colors.border,
                  }}
                >
                  <View className="mr-4">
                    {active ? (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: BorderRadius.full,
                          borderWidth: 2,
                          borderColor: Colors.accent,
                          backgroundColor: Colors.accent,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: BorderRadius.full,
                            backgroundColor: Colors.white,
                          }}
                        />
                      </View>
                    ) : (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: BorderRadius.full,
                          borderWidth: 2,
                          borderColor: Colors.borderStrong,
                          backgroundColor: Colors.white,
                        }}
                      />
                    )}
                  </View>

                  <View className="flex-1 pr-2">
                    {row.title ? (
                      <Text
                        style={{
                          fontFamily: 'Poppins-Bold',
                          fontSize: 14,
                          color: Colors.textPrimary,
                          marginBottom: 4,
                        }}
                      >
                        {row.title}
                      </Text>
                    ) : null}
                    <Text style={{ fontFamily: 'Poppins-Medium', fontSize: 13, color: Colors.textMuted }}>
                      {row.line1}
                    </Text>
                    {row.line2 ? (
                      <Text
                        style={{
                          fontFamily: 'Poppins-Regular',
                          fontSize: 12,
                          color: Colors.textTertiary,
                          marginTop: 4,
                        }}
                      >
                        {row.line2}
                      </Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    className="ml-1 p-2"
                    onPress={() => openRowMenu(row)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <MoreVertical size={20} color={Colors.textSecondaryDark} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaWrapper>
  );
}
