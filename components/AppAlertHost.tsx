import { BorderRadius, Colors, MIN_TOUCH_TARGET, Spacing } from '@/lib/designSystem';
import { useNarrowOverlayMaxWidth } from '@/lib/tabletLayout';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react-native';

export type AppAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export type AppAlertButton = {
  text: string;
  style?: AppAlertButtonStyle;
  onPress?: () => void | Promise<void>;
};

export type AppAlertTone = 'success' | 'error' | 'warning' | 'info';

export type AppAlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
  /** Overrides the tone inferred from the title. */
  tone?: AppAlertTone;
};

type AppAlertRequest = {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
  options?: AppAlertOptions;
};

type Listener = (request: AppAlertRequest | null) => void;

let listener: Listener | null = null;

/**
 * Branded replacement for `Alert.alert`, with a deliberately identical signature
 * so call sites migrate without their copy or handlers changing.
 *
 * Requires `<AppAlertHost />` to be mounted once at the app root.
 */
export function showAppAlert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  options?: AppAlertOptions
): void {
  // Native `Alert.alert` with no buttons renders a lone dismissing "OK".
  const resolved = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  listener?.({ title, message, buttons: resolved, options });
}

/**
 * Inferred so the 35 existing call sites gain an icon without being touched.
 * Pass `options.tone` to override.
 */
function inferTone(title: string): AppAlertTone {
  const t = title.toLowerCase();
  if (/success|updated|saved|sent|complete|added/.test(t)) return 'success';
  if (/error|failed|unable|could not|couldn.t|invalid|denied|wrong/.test(t)) return 'error';
  if (/\?$|required|limit|remove|delete|discard|cancel/.test(t)) return 'warning';
  return 'info';
}

const TONE_PRESENTATION: Record<
  AppAlertTone,
  { Icon: typeof Info; color: string; background: string }
> = {
  success: { Icon: CheckCircle2, color: Colors.accent, background: Colors.successLight },
  error: { Icon: XCircle, color: Colors.error, background: 'rgba(220, 38, 38, 0.10)' },
  warning: { Icon: AlertTriangle, color: Colors.warningForeground, background: Colors.warningLight },
  info: { Icon: Info, color: Colors.accent, background: Colors.successLight },
};

function buttonColors(style: AppAlertButtonStyle | undefined, isOnly: boolean) {
  if (style === 'destructive') {
    return { background: Colors.error, label: Colors.white, border: 'transparent' };
  }
  if (style === 'cancel' && !isOnly) {
    return { background: Colors.backgroundGray, label: Colors.textPrimary, border: Colors.border };
  }
  return { background: Colors.accent, label: Colors.white, border: 'transparent' };
}

export default function AppAlertHost() {
  const [request, setRequest] = useState<AppAlertRequest | null>(null);
  const maxWidth = useNarrowOverlayMaxWidth(56);
  /** Guards against a double-tap firing two handlers before the modal unmounts. */
  const dismissingRef = useRef(false);

  useEffect(() => {
    listener = (next) => {
      dismissingRef.current = false;
      setRequest(next);
    };
    return () => {
      listener = null;
    };
  }, []);

  const handlePress = useCallback((button: AppAlertButton) => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    setRequest(null);
    // Let the modal finish dismissing before a handler pushes a route or opens
    // another alert — stacked native modals otherwise fail to present on iOS.
    setTimeout(() => {
      void button.onPress?.();
    }, 0);
  }, []);

  const handleBackdrop = useCallback(() => {
    if (!request) return;
    if (request.options?.cancelable === false) return;
    const cancel = request.buttons.find((b) => b.style === 'cancel');
    if (cancel) {
      handlePress(cancel);
      request.options?.onDismiss?.();
      return;
    }
    // Without an explicit `cancelable`, only a cancel affordance dismisses —
    // same as the native alert's default on Android.
    if (!request.options?.cancelable) return;
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    setRequest(null);
    request.options.onDismiss?.();
  }, [request, handlePress]);

  if (!request) return null;

  const { title, message, buttons } = request;
  const { Icon, color: toneColor, background: toneBackground } =
    TONE_PRESENTATION[request.options?.tone ?? inferTone(title)];
  // Two buttons sit side by side; three or more stack, same as the native alert.
  const isRow = buttons.length === 2;
  const ordered = isRow
    ? [...buttons].sort((a, b) => Number(b.style === 'cancel') - Number(a.style === 'cancel'))
    : buttons;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleBackdrop}>
      <Pressable
        onPress={handleBackdrop}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: Spacing.lg,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth,
            backgroundColor: Colors.white,
            borderRadius: BorderRadius.lg,
            borderWidth: 1,
            borderColor: Colors.border,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 20,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: toneBackground,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <Icon size={24} color={toneColor} strokeWidth={2.2} />
          </View>

          <Text
            accessibilityRole="header"
            style={{
              fontSize: 18,
              lineHeight: 25,
              fontFamily: 'Poppins-Bold',
              color: Colors.textPrimary,
              marginBottom: message ? 6 : 20,
            }}
          >
            {title}
          </Text>

          {message ? (
            <ScrollView
              /** flexGrow:0 — a maxHeight alone lets a one-line message claim all 220px,
                  leaving a void between the text and the buttons. */
              style={{ maxHeight: 220, flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ paddingBottom: 2 }}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text
                style={{
                  fontSize: 14,
                  lineHeight: 21,
                  fontFamily: 'Poppins-Regular',
                  color: Colors.textSecondaryDark,
                  marginBottom: 20,
                }}
              >
                {message}
              </Text>
            </ScrollView>
          ) : null}

          <View
            style={
              isRow
                ? { flexDirection: 'row', alignItems: 'stretch', gap: 10 }
                : { gap: 10 }
            }
          >
            {ordered.map((button, index) => {
              const tone = buttonColors(button.style, buttons.length === 1);
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => handlePress(button)}
                  accessibilityRole="button"
                  accessibilityLabel={button.text}
                  style={({ pressed }) => ({
                    flex: isRow ? 1 : undefined,
                    minHeight: MIN_TOUCH_TARGET,
                    paddingVertical: 13,
                    paddingHorizontal: 16,
                    borderRadius: BorderRadius.default,
                    borderWidth: 1,
                    borderColor: tone.border,
                    backgroundColor: tone.background,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 15,
                      lineHeight: 20,
                      fontFamily: 'Poppins-SemiBold',
                      color: tone.label,
                      textAlign: 'center',
                    }}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
