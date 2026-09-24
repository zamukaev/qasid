import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  GestureResponderHandlers,
  LayoutChangeEvent,
  PanResponder,
} from "react-native";

const OPEN_DURATION_MS = 220;
const CLOSE_DURATION_MS = 180;
// Drag far enough (or fast enough) and the release closes instead of springing back.
const DISMISS_TRAVEL_RATIO = 0.25;
const DISMISS_VELOCITY = 0.6;
// A drag only starts once the finger has clearly committed to a vertical swipe.
const DRAG_ACTIVATION_PX = 6;
// Tall enough to cover the sheet before it is measured, so the first frame of the
// open animation starts off-screen rather than flashing the panel in place.
const INITIAL_PANEL_HEIGHT = 600;
const DIM_OPACITY = 0.7;
// iOS silently drops an Alert or a second Modal presented while this one is
// still being dismissed, so a follow-up action waits out the unmount commit.
const MODAL_HANDOFF_MS = 120;

type UseBottomSheetOptions = {
  visible: boolean;
  onClose: () => void;
};

export type BottomSheetControls = {
  /** Panel offset — drives the slide-in and follows the finger while dragging. */
  translateY: Animated.Value;
  backdropOpacity: Animated.Value;
  /** Spread onto whatever part of the panel should be draggable. */
  panHandlers: GestureResponderHandlers;
  /** Put on the panel so the close animation knows how far to travel. */
  onPanelLayout: (event: LayoutChangeEvent) => void;
  animateClose: () => void;
  /**
   * Closes first, then runs `action`. For anything that presents another modal
   * or an Alert, which iOS drops while this sheet is still dismissing.
   */
  closeThen: (action: () => void) => void;
};

/**
 * The slide-up, backdrop fade and drag-to-dismiss shared by the app's bottom
 * sheets, so a second sheet behaves exactly like the first rather than
 * approximating it.
 *
 * Core RN rather than react-native-gesture-handler: no GestureHandlerRootView
 * is mounted in this app, so its gestures would silently never fire.
 */
export function useBottomSheet({
  visible,
  onClose,
}: UseBottomSheetOptions): BottomSheetControls {
  /** Action to run once the sheet is fully gone — see MODAL_HANDOFF_MS. */
  const pendingActionRef = useRef<(() => void) | null>(null);
  const translateY = useRef(new Animated.Value(INITIAL_PANEL_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelHeightRef = useRef(INITIAL_PANEL_HEIGHT);

  const animateClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: panelHeightRef.current,
        duration: CLOSE_DURATION_MS,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: CLOSE_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) return;
      onClose();
      const pending = pendingActionRef.current;
      pendingActionRef.current = null;
      if (pending) setTimeout(pending, MODAL_HANDOFF_MS);
    });
  }, [translateY, backdropOpacity, onClose]);

  const closeThen = useCallback(
    (action: () => void) => {
      pendingActionRef.current = action;
      animateClose();
    },
    [animateClose],
  );

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(panelHeightRef.current);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: OPEN_DURATION_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: DIM_OPACITY,
        duration: OPEN_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateY, backdropOpacity]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          gesture.dy > DRAG_ACTIVATION_PX &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_evt, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_evt, gesture) => {
          const past =
            gesture.dy > panelHeightRef.current * DISMISS_TRAVEL_RATIO;
          if (past || gesture.vy > DISMISS_VELOCITY) {
            animateClose();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [translateY, animateClose],
  );

  const onPanelLayout = useCallback((event: LayoutChangeEvent) => {
    panelHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  return {
    translateY,
    backdropOpacity,
    panHandlers: panResponder.panHandlers,
    onPanelLayout,
    animateClose,
    closeThen,
  };
}
