import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";

jest.mock("../src/auth/localAuthStorageExpo", () => ({
  clearSavedLoginDetails: jest.fn(),
  loadSavedLoginDetails: jest.fn().mockResolvedValue(null),
  phoneLocalAccountStorage: {},
  saveSavedLoginDetails: jest.fn(),
}));
jest.mock("../src/auth/remoteAuth", () => ({
  normalizeEmailAddress: (value: string) => value.trim().toLowerCase(),
  resendRemoteVerificationCode: jest.fn(),
  verifyRemoteEmail: jest.fn(),
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
import { VerifyEmailScreen } from "../src/screens/VerifyEmailScreen";
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

test("Verify email omits registration editing and retains verification, resend, and login controls", () => {
  const screen = render(
    <VerifyEmailScreen
      pending={{ email: "worker@example.com", name: "Worker", phone: "+65 9000 0000", message: "Verification email sent." }}
      onShowLogin={jest.fn()}
      onVerified={jest.fn()}
    />,
  );

  expect(screen.getByRole("button", { name: "Verify code" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Resend verification code" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Already verified? Login" })).toBeTruthy();
  expect(screen.queryByText("Edit registration details")).toBeNull();
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
