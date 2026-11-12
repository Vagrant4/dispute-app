import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  View,
  useWindowDimensions,
  type KeyboardEvent,
  type ModalProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DISMISS_DISTANCE = 80;
const DISMISS_VELOCITY = 0.8;

type SwipeDownSheetProps = {
  children: ReactNode;
  onClose: () => void;
  sheetStyle?: StyleProp<ViewStyle>;
  testID?: string;
  transparent?: boolean;
  visible?: boolean;
  backdropStyle?: StyleProp<ViewStyle>;
  animationType?: ModalProps["animationType"];
};

export function SwipeDownSheet({
  animationType = "slide",
  backdropStyle,
  children,
  onClose,
  sheetStyle,
  testID,
  transparent = true,
  visible = true,
}: SwipeDownSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const translateY = useRef(new Animated.Value(0)).current;
  const startY = useRef(0);
  const startTime = useRef(0);
  const latestDistance = useRef(0);
  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const show = (event: KeyboardEvent) => setKeyboardHeight(event.endCoordinates.height);
    const hide = () => setKeyboardHeight(0);
    const subscriptions = [
      Keyboard.addListener("keyboardDidShow", show),
      Keyboard.addListener("keyboardDidHide", hide),
    ];
    if (Platform.OS === "ios") {
      subscriptions.push(Keyboard.addListener("keyboardWillShow", show));
      subscriptions.push(Keyboard.addListener("keyboardWillHide", hide));
    }

    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [visible]);

  const keyboardOffset = Platform.OS === "android" ? Math.max(0, keyboardHeight - insets.bottom) : 0;
  const maxSheetHeight = Math.max(0, windowHeight - keyboardHeight - insets.top);
  const gestureHandlers = {
    onStartShouldSetResponder: () => true,
    onResponderGrant: (event: { nativeEvent: { pageY: number; timestamp: number } }) => {
      startY.current = event.nativeEvent.pageY;
      startTime.current = event.nativeEvent.timestamp;
      latestDistance.current = 0;
    },
    onResponderMove: (event: { nativeEvent: { pageY: number } }) => {
      latestDistance.current = Math.max(0, event.nativeEvent.pageY - startY.current);
      translateY.setValue(latestDistance.current);
    },
    onResponderRelease: (event: { nativeEvent: { pageY: number; timestamp: number } }) => {
      const distance = Math.max(latestDistance.current, event.nativeEvent.pageY - startY.current);
      const elapsedSeconds = Math.max(1, event.nativeEvent.timestamp - startTime.current) / 1000;
      const velocity = distance / elapsedSeconds / 1000;
      if (distance > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
        translateY.setValue(0);
        onClose();
        return;
      }
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
    onResponderTerminate: () => {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
  };

  return (
    <Modal animationType={animationType} navigationBarTranslucent onRequestClose={onClose} statusBarTranslucent transparent={transparent} visible={visible}>
      <View style={backdropStyle}>
        <Animated.View
          style={[sheetStyle, { flexShrink: 1, marginBottom: keyboardOffset, maxHeight: maxSheetHeight, paddingBottom: insets.bottom, transform: [{ translateY }] }]}
          testID={testID}
        >
          <Animated.View
            accessibilityLabel="Drag down to close"
            accessible
            {...gestureHandlers}
            style={{ alignItems: "center", paddingBottom: 10, paddingTop: 10 }}
            testID={`${testID}-grab-handle`}
          >
            <View style={{ backgroundColor: "#777", borderRadius: 2, height: 4, width: 42 }} />
          </Animated.View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
