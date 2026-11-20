import { fireEvent, render } from "@testing-library/react-native";
import React from "react";

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

test("create account has only name, email and password fields", () => {
  const screen = render(
    <CreateAccountScreen onLogin={jest.fn()} onShowLogin={jest.fn()} onVerificationRequired={jest.fn()} />,
  );
  expect(screen.getByLabelText("Create account name")).toBeTruthy();
  expect(screen.getByLabelText("Create account email")).toBeTruthy();
  expect(screen.getByLabelText("Create account password").props.secureTextEntry).toBe(true);
  expect(screen.queryByLabelText("Create account mobile number")).toBeNull();
  fireEvent.press(screen.getByLabelText("Show password"));
  expect(screen.getByLabelText("Create account password").props.secureTextEntry).toBe(false);
});
