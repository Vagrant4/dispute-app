import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type KeyboardAwareScrollProps = ScrollViewProps & {
  children: ReactNode;
  bottomPadding?: number;
  fill?: boolean;
  onScrollToFocusedInput?: (target: unknown) => void;
};

export function KeyboardAwareScroll({
  children,
  bottomPadding = 24,
  contentContainerStyle,
  fill = true,
  onScrollToFocusedInput,
  style,
  ...scrollProps
}: KeyboardAwareScrollProps) {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardDidShow", () => {
      const focusedInput = TextInput.State.currentlyFocusedInput();
      const target = focusedInput;
      if (target == null) return;
      onScrollToFocusedInput?.(target);
      scrollRef.current
        ?.getScrollResponder()
        ?.scrollResponderScrollNativeHandleToKeyboard(target as never, 24, true);
    });
    return () => subscription.remove();
  }, [onScrollToFocusedInput]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={fill ? { flex: 1 } : { flexGrow: 0, flexShrink: 1 }}
      testID="keyboard-avoiding-container"
    >
      <ScrollView
        {...scrollProps}
        contentContainerStyle={[
          contentContainerStyle,
          { paddingBottom: Math.max(insets.bottom, bottomPadding) },
        ]}
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        style={[style, fill ? { flex: 1 } : { flexGrow: 0, flexShrink: 1 }]}
        testID={scrollProps.testID ?? "keyboard-aware-scroll"}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
