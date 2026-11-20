import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";

jest.mock("../src/auth/remoteAuth", () => ({
  normalizeEmailAddress: (value: string) => value.trim().toLowerCase(),
  registerRemoteAccount: jest.fn().mockResolvedValue({ ok: true, pending: { email: "worker@example.com", name: "Worker", phone: "+63 917 123 4567", message: "Verify" } }),
}));
jest.mock("../src/components/SocialAuthButtons", () => ({ SocialAuthButtons: () => null }));
jest.mock("../src/subscription/guestTrial", () => ({ saveGuestTrial: jest.fn().mockResolvedValue(undefined), startGuestTrial: jest.fn() }));

import { registerRemoteAccount } from "../src/auth/remoteAuth";
import { CreateAccountScreen } from "../src/screens/CreateAccountScreen";
import {
  COUNTRY_CALLING_CODE_OPTIONS,
  getDefaultCountryCallingCode,
  isValidInternationalPhone,
  searchCountryCallingCodeOptions,
} from "../src/phone/countryPickerData";

test("country calling-code data includes the complete international list with separate shared-code territories", () => {
  expect(COUNTRY_CALLING_CODE_OPTIONS.length).toBeGreaterThanOrEqual(230);
  expect(new Set(COUNTRY_CALLING_CODE_OPTIONS.map((option) => option.iso)).size).toBe(COUNTRY_CALLING_CODE_OPTIONS.length);
  for (const iso of ["PH", "SG", "MY", "US", "GB", "IN", "AU", "ZA", "BR", "NG", "CA", "GG", "JE", "IM", "RU", "KZ"]) {
    expect(COUNTRY_CALLING_CODE_OPTIONS.some((option) => option.iso === iso)).toBe(true);
  }
});

test("country search matches country name, ISO, and dial code", () => {
  expect(searchCountryCallingCodeOptions("phil").map((option) => option.iso)).toContain("PH");
  expect(searchCountryCallingCodeOptions("my").map((option) => option.iso)).toContain("MY");
  expect(searchCountryCallingCodeOptions("65").map((option) => option.iso)).toContain("SG");
  const nanp = searchCountryCallingCodeOptions("+1").map((option) => option.iso);
  expect(nanp).toEqual(expect.arrayContaining(["US", "CA"]));
});

test("device-region default uses the locale region and falls back to Singapore", () => {
  expect(getDefaultCountryCallingCode("en-PH")).toMatchObject({ iso: "PH", dialCode: "+63" });
  expect(getDefaultCountryCallingCode("ms-MY")).toMatchObject({ iso: "MY", dialCode: "+60" });
  expect(getDefaultCountryCallingCode("en")).toMatchObject({ iso: "SG", dialCode: "+65" });
});

test.each(["+639171234567", "+6590000000", "+60123456789", "+14155552671", "+447911123456", "+919876543210", "+61412345678", "+27821234567", "+5511987654321", "+2348031234567"])("accepts valid E.164 number %s", (phone) => {
  expect(isValidInternationalPhone(phone)).toBe(true);
});

test("Create account picker search selects Philippines and sends its calling code", async () => {
  const onVerificationRequired = jest.fn();
  const screen = render(<CreateAccountScreen onLogin={jest.fn()} onShowLogin={jest.fn()} onVerificationRequired={onVerificationRequired} />);
  fireEvent.press(screen.getByLabelText("Country code dropdown"));
  fireEvent.changeText(screen.getByLabelText("Search country code"), "phil");
  fireEvent.press(screen.getByLabelText("Country code Philippines +63"));
  fireEvent.changeText(screen.getByLabelText("Create account name"), "Worker");
  fireEvent.changeText(screen.getByLabelText("Create account email"), "worker@example.com");
  fireEvent.changeText(screen.getByLabelText("Create account mobile number"), "917 123 4567");
  fireEvent.changeText(screen.getByLabelText("Create account password"), "Password123!");
  fireEvent.press(screen.getByRole("button", { name: "Create account" }));
  await waitFor(() => expect(registerRemoteAccount).toHaveBeenCalledWith(expect.objectContaining({ phone: "+63 917 123 4567" })));
  expect(onVerificationRequired).toHaveBeenCalled();
});
