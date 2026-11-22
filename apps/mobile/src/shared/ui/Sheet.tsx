import { type PropsWithChildren, useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { makeStyles } from '@/core/theme/theme';
import { motion, radii, sizes, spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';

type SheetProps = PropsWithChildren<{
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Etiqueta del fons, que tanca el full en tocar-lo (lectors de pantalla). */
  closeLabel: string;
  /** Permet arrossegar el full cap avall per tancar-lo. */
  swipeToClose?: boolean;
}>;

/** Opacitat del fons enfosquit darrere el full. */
const BACKDROP = 0.6;
const SWIPE_CLOSE_DISTANCE = sizes.button + spacing.md;
const SWIPE_CLOSE_VELOCITY = 700;

/**
 * Full inferior del design system: puja des de baix sobre un fons que s'enfosqueix i es tanca en
 * tocar fora o amb el botó enrere d'Android. Amb «reduir moviment», només una fosa.
 */
export function Sheet({
  visible,
  onClose,
  title,
  closeLabel,
  swipeToClose = false,
  children,
}: SheetProps) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [height, setHeight] = useState(0);
  const progress = useSharedValue(0);
  const dragY = useSharedValue(0);

  // Es manté muntat mentre fa l'animació de sortida.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      dragY.set(0);
      progress.set(withTiming(1, { duration: motion.slow, easing: motion.enter }));
    } else {
      progress.set(
        withTiming(0, { duration: motion.base, easing: motion.exit }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, progress, dragY]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.get() * BACKDROP }));
  const panel = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: progress.get(), transform: [{ translateY: dragY.get() }] }
      : { transform: [{ translateY: (1 - progress.get()) * (height || 400) + dragY.get() }] },
  );

  const pan = Gesture.Pan()
    .withTestId('sheet-swipe-down')
    .activeOffsetY([-spacing.sm, spacing.sm])
    .failOffsetX([-spacing.md, spacing.md])
    .onStart(() => cancelAnimation(dragY))
    .onUpdate((event) => dragY.set(Math.max(0, event.translationY)))
    .onEnd((event) => {
      if (dragY.get() >= SWIPE_CLOSE_DISTANCE || event.velocityY >= SWIPE_CLOSE_VELOCITY) {
        dragY.set(
          reduceMotion ? height || 400 : withTiming(height || 400, { duration: motion.fast }),
        );
        scheduleOnRN(onClose);
      } else {
        dragY.set(reduceMotion ? 0 : withSpring(0, { ...motion.spring, overshootClamping: true }));
      }
    })
    .onFinalize((_event, success) => {
      if (!success) {
        dragY.set(reduceMotion ? 0 : withSpring(0, { ...motion.spring, overshootClamping: true }));
      }
    });

  const panelView = (
    <Animated.View
      accessibilityViewIsModal
      onAccessibilityEscape={onClose}
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={[styles.panel, { paddingBottom: insets.bottom + spacing.md }, panel]}
    >
      <View style={styles.handle} />
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </Animated.View>
  );

  const content = (
    <>
      <Animated.View style={[styles.backdrop, backdrop]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={styles.fill}
        />
      </Animated.View>
      {/* Amb VoiceOver, el fons queda amagat: es tanca amb el gest d'escapament (dos dits en Z). */}
      {swipeToClose ? <GestureDetector gesture={pan}>{panelView}</GestureDetector> : panelView}
    </>
  );

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {swipeToClose ? (
        <GestureHandlerRootView style={styles.fill}>{content}</GestureHandlerRootView>
      ) : (
        content
      )}
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  fill: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.nit,
  },
  panel: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.ml,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.linia,
    backgroundColor: colors.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.vora,
  },
}));
