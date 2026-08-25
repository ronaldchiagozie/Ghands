import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { BorderRadius, Colors, MIN_TOUCH_TARGET, Spacing, useReducedMotion } from '@/lib/designSystem';
import { useNarrowOverlayMaxWidth } from '@/lib/tabletLayout';
import { handleAuthErrorRedirect } from '@/utils/authRedirect';
import { presentError, type ErrorPresentation } from '@/utils/errorPresentation';
import { useRouter } from 'expo-router';
import { Clock, KeyRound, RefreshCw, SearchX, ServerCrash, TriangleAlert, WifiOff } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './ui/Button';

export type ErrorSheetRequest = {
  error: unknown;
  /** What failed, in the user's words — "services", "your job activity". */
  subject?: string;
  /** Runs when the user taps the recovery button. Sheet closes if it resolves. */
  onRetry?: () => Promise<unknown> | unknown;
  /**
   * Identity of the failure. A second failure with the same key while the sheet
   * is open is ignored, so a retry loop never stacks sheets.
   */
  key?: string;
};

type Listener = (request: ErrorSheetRequest | null) => void;

let listener: Listener | null = null;

/**
 * Raises the app-wide error sheet.
 *
 * Screens keep rendering their real layout — this explains the failure over the
 * top of it, instead of a section collapsing into a red card.
 *
 * Requires `<ErrorSheetHost />` mounted once at the app root.
 */
export function showErrorSheet(request: ErrorSheetRequest): void {
  listener?.(request);
}

export function hideErrorSheet(): void {
  listener?.(null);
}

const TONE_STYLES = {
  error: { fill: Colors.errorLight, ring: Colors.errorBorder, ink: Colors.error },
  warning: { fill: Colors.warningLight, ring: Colors.warningBadge, ink: Colors.warningForeground },
  neutral: { fill: Colors.backgroundGray, ring: Colors.border, ink: Colors.textSecondaryDark },
} as const;

function ToneIcon({ presentation, color }: { presentation: ErrorPresentation; color: string }) {
  const props = { size: 24, color, strokeWidth: 2.2 };
  switch (presentation.kind) {
    case 'offline':
      return <WifiOff {...props} />;
    case 'timeout':
      return <Clock {...props} />;
    case 'session':
      return <KeyRound {...props} />;
    case 'notFound':
      return <SearchX {...props} />;
    case 'server':
      return <ServerCrash {...props} />;
    default:
      return <TriangleAlert {...props} />;
  }
}

export default function ErrorSheetHost() {
  const [request, setRequest] = useState<ErrorSheetRequest | null>(null);
  const [presentation, setPresentation] = useState<ErrorPresentation | null>(null);
  const [busy, setBusy] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const maxWidth = useNarrowOverlayMaxWidth(0);
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const { isOnline, isInitialized } = useNetworkConnectivity();
  const openKeyRef = useRef<string | null>(null);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    listener = (next) => {
      if (next === null) {
        openKeyRef.current = null;
        setRequest(null);
        return;
      }
      // A repeat of the failure already on screen must not stack another sheet.
      const key = next.key ?? next.subject ?? 'default';
      if (openKeyRef.current === key) return;
      openKeyRef.current = key;
      setBusy(false);
      setPresentation(presentError(next.error, next.subject ?? 'this'));
      setRequest(next);
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!request) return;
    if (reducedMotion) {
      slide.setValue(1);
      return;
    }
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [request, reducedMotion, slide]);

  const close = useCallback(() => {
    openKeyRef.current = null;
    setBusy(false);
    setRequest(null);
  }, []);

  const runRetry = useCallback(async () => {
    if (!request?.onRetry) {
      close();
      return;
    }
    setBusy(true);
    try {
      await request.onRetry();
      close();
    } catch (nextError) {
      // Still broken — update the explanation in place rather than closing on a lie.
      setPresentation(presentError(nextError, request.subject ?? 'this'));
      setBusy(false);
    }
  }, [request, close]);

  const handleAction = useCallback(async () => {
    if (!request || !presentation || busy) return;

    if (presentation.action.kind === 'dismiss') {
      close();
      return;
    }

    if (presentation.action.kind === 'signIn') {
      close();
      await handleAuthErrorRedirect(router);
      return;
    }

    await runRetry();
  }, [request, presentation, busy, close, router, runRetry]);

  // Connection came back while the failure was still unresolved: the help the
  // user needed has arrived, so take the action for them instead of waiting for
  // a tap on a button that would now succeed.
  useEffect(() => {
    if (!isInitialized) return;
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = !isOnline;
    if (!wasOffline || !isOnline) return;
    if (!request?.onRetry || busy) return;
    void runRetry();
  }, [isOnline, isInitialized, request, busy, runRetry]);

  // A hard-offline device already gets the full-screen offline gate. The pending
  // request is kept, not dropped, so the sheet resumes when the device is back.
  if (isInitialized && !isOnline) return null;
  if (!request || !presentation) return null;

  const tone = TONE_STYLES[presentation.tone];
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [460, 0] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }} accessibilityViewIsModal>
        <Pressable
          onPress={busy ? undefined : close}
          accessibilityLabel="Dismiss"
          style={{ flex: 1, backgroundColor: Colors.overlayScrim }}
        />

        <Animated.View
          style={{
            transform: [{ translateY }],
            width: '100%',
            maxWidth: maxWidth || undefined,
            alignSelf: 'center',
            backgroundColor: Colors.backgroundLight,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, Spacing.lg),
            ...Platform.select({
              ios: {
                shadowColor: Colors.black,
                shadowOpacity: 0.16,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: -6 },
              },
              android: { elevation: 24 },
            }),
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: Colors.borderStrong,
              marginBottom: 24,
            }}
          />

          {/* Icon and category sit on one line: what kind of problem, at a glance. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: BorderRadius.full,
                backgroundColor: tone.fill,
                borderWidth: 1,
                borderColor: tone.ring,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ToneIcon presentation={presentation} color={tone.ink} />
            </View>
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'Poppins-SemiBold',
                letterSpacing: 1.1,
                textTransform: 'uppercase',
                color: tone.ink,
              }}
            >
              {presentation.label}
            </Text>
          </View>

          <Text
            accessibilityRole="header"
            style={{
              fontSize: 22,
              lineHeight: 29,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              letterSpacing: -0.4,
              marginBottom: 8,
            }}
          >
            {presentation.title}
          </Text>

          <Text
            style={{
              fontSize: 15,
              lineHeight: 23,
              fontFamily: 'Poppins-Regular',
              color: Colors.textSecondaryDark,
              marginBottom: 28,
            }}
          >
            {presentation.message}
          </Text>

          {__DEV__ && presentation.debugMessage ? (
            <View
              style={{
                backgroundColor: Colors.surfaceSubtle,
                borderWidth: 1,
                borderColor: Colors.borderLight,
                borderRadius: BorderRadius.sm,
                paddingHorizontal: 12,
                paddingVertical: 10,
                marginTop: -16,
                marginBottom: 24,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontFamily: 'Poppins-SemiBold',
                  letterSpacing: 1,
                  color: Colors.textTertiary,
                  marginBottom: 3,
                }}
              >
                DEV ONLY
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  lineHeight: 16,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  color: Colors.textSecondaryDark,
                }}
              >
                {presentation.debugMessage}
              </Text>
            </View>
          ) : null}

          <Button
            title={presentation.action.label}
            onPress={() => {
              void handleAction();
            }}
            variant="primary"
            size="large"
            fullWidth
            loading={busy}
            disabled={busy}
            icon={
              presentation.action.kind === 'retry' && !busy ? (
                <RefreshCw size={18} color={Colors.white} />
              ) : undefined
            }
            iconPosition="left"
          />

          {presentation.action.kind !== 'dismiss' ? (
            <Pressable
              onPress={busy ? undefined : close}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{
                minHeight: MIN_TOUCH_TARGET,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
                opacity: busy ? 0.4 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: 'Poppins-SemiBold',
                  color: Colors.textSecondaryDark,
                }}
              >
                Not now
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}
