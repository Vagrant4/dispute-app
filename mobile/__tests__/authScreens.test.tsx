import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

jest.mock("../src/auth/localAuthStorageExpo", () => ({
  clearSavedLoginDetails: jest.fn(),
  loadSavedLoginDetails: jest.fn().mockResolvedValue(null),
  saveSavedLoginDetails: jest.fn(),
}));
jest.mock("../src/components/SocialAuthButtons", () => ({
  SocialAuthButtons: () => null,
}));
jest.mock("../src/subscription/guestTrial", () => ({
  saveGuestTrial: jest.fn(),
  startGuestTrial: jest.fn(),
}));

import { CreateAccountScreen } from "../src/screens/CreateAccountScreen";
import { LoginScreen } from "../src/screens/LoginScreen";
import { styles } from "../src/styles";

const loginProps = {
  onLogin: jest.fn(),
  onVerificationRequired: jest.fn(),
  onShowCreateAccount: jest.fn(),
  onForgotPassword: jest.fn(),
};

test("login uses an in-field eye control to reveal and conceal the password", () => {
  const screen = render(<LoginScreen {...loginProps} />);
  expect(screen.getByLabelText("Login password").props.secureTextEntry).toBe(true);
  fireEvent.press(screen.getByLabelText("Show password"));
  expect(screen.getByLabelText("Login password").props.secureTextEntry).toBe(false);
  expect(screen.queryByText("Show")).toBeNull();
});

test("create account requires a phone number with a country-code picker", () => {
  const screen = render(
    <CreateAccountScreen onLogin={jest.fn()} onShowLogin={jest.fn()} onVerificationRequired={jest.fn()} />,
  );
  expect(screen.getByLabelText("Create account name")).toBeTruthy();
  expect(screen.getByLabelText("Create account email")).toBeTruthy();
  expect(screen.getByLabelText("Create account password").props.secureTextEntry).toBe(true);
  expect(screen.getByLabelText("Country code dropdown")).toBeTruthy();
  expect(screen.getByLabelText("Create account mobile number")).toBeTruthy();
  fireEvent.press(screen.getByLabelText("Show password"));
  expect(screen.getByLabelText("Create account password").props.secureTextEntry).toBe(false);
});

test("auth controls use the larger centred review dimensions", () => {
  expect(StyleSheet.flatten(styles.socialAuthButton)).toMatchObject({
    alignItems: "center",
    height: 58,
    justifyContent: "center",
    paddingHorizontal: 18,
  });
  expect(StyleSheet.flatten(styles.socialAuthButtonContent)).toMatchObject({ gap: 12 });
  expect(StyleSheet.flatten(styles.socialAuthButtonText)).toMatchObject({ fontSize: 17, fontWeight: "600" });
  expect(StyleSheet.flatten(styles.authActionButtonText)).toMatchObject({ fontSize: 18, fontWeight: "700" });
  expect(StyleSheet.flatten(styles.authInputLabel)).toMatchObject({ fontSize: 16, fontWeight: "600" });
});
