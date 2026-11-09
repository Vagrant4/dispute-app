import { fireEvent, render } from "@testing-library/react-native";
import { Keyboard, TextInput } from "react-native";

import { KeyboardAwareScroll } from "../src/components/KeyboardAwareScroll";

const listedInputs = [
  "Project name",
  "Photo evidence caption",
  "Login email",
  "Login password",
  "Create account email",
  "Create account password",
  "Forgot password email",
  "Verification code",
  "Project hourly rate",
  "Base rate amount",
  "Normal work start time",
  "Normal work end time",
  "Overtime rate multiplier",
  "Off day rate multiplier",
  "Holiday rate multiplier",
];

test.each(listedInputs)("%s is inside the keyboard-aware container and focus scrolls it into view", (label) => {
  let keyboardDidShow: (() => void) | undefined;
  jest.spyOn(Keyboard, "addListener").mockImplementation((_, listener) => {
    keyboardDidShow = listener as () => void;
    return { remove: jest.fn() };
  });
  const onScrollToFocusedInput = jest.fn();
  const view = render(<KeyboardAwareScroll onScrollToFocusedInput={onScrollToFocusedInput}><TextInput accessibilityLabel={label} /></KeyboardAwareScroll>);
  jest.spyOn(TextInput.State, "currentlyFocusedInput").mockReturnValue(42 as never);
  expect(view.getByTestId("keyboard-avoiding-container")).toContainElement(view.getByLabelText(label));
  fireEvent(view.getByLabelText(label), "focus", { target: 42 });
  keyboardDidShow?.();
  expect(onScrollToFocusedInput).toHaveBeenCalled();
});
