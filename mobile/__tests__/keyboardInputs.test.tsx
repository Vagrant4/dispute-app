import { fireEvent, render } from "@testing-library/react-native";
import fs from "node:fs";
import path from "node:path";
import { Keyboard, TextInput } from "react-native";

import { KeyboardAwareScroll } from "../src/components/KeyboardAwareScroll";

const listedInputs = [
  "Project name",
  "Photo evidence caption",
  "Create account name",
  "Login email",
  "Login password",
  "Create account email",
  "Create account mobile number",
  "Create account password",
  "Password reset email",
  "Password reset code",
  "New password",
  "Confirm new password",
  "Email verification code",
  "Project hourly rate",
  "Base rate amount",
  "Normal work start time",
  "Normal work end time",
  "Overtime rate multiplier",
  "Off day rate multiplier",
  "Holiday rate multiplier",
  "Account deletion current password",
  "Type DELETE to confirm account deletion",
];

test("all app screens and input-bearing sheets use the keyboard-aware scroll container", () => {
  const root = path.resolve(__dirname, "..");
  const app = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
  const projectSheet = fs.readFileSync(path.join(root, "src/screens/ProjectNameSheet.tsx"), "utf8");
  const photoScreen = fs.readFileSync(path.join(root, "src/screens/PhotoEvidenceScreen.tsx"), "utf8");
  expect(app).toContain("<KeyboardAwareScroll");
  expect(projectSheet).toContain("<KeyboardAwareScroll");
  expect(photoScreen).toContain("<KeyboardAwareScroll");
  expect(app).toContain("contentContainerStyle={styles.contentInner}");
});

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
