import { getCountries, getCountryCallingCode, isValidPhoneNumber, type CountryCode } from "libphonenumber-js";

import { COUNTRY_NAME_FALLBACK } from "./countryNames";

export type CountryCallingCodeOption = {
  iso: string;
  name: string;
  flag: string;
  dialCode: string;
};

function flagForIso(iso: string): string {
  return String.fromCodePoint(...iso.toUpperCase().split("").map((letter) => 127397 + letter.charCodeAt(0)));
}

function displayNameFor(iso: string): string {
  try {
    const DisplayNames = Intl.DisplayNames;
    const displayName = DisplayNames ? new DisplayNames(["en"], { type: "region" }).of(iso) : undefined;
    if (displayName && displayName !== iso) return displayName;
  } catch {
    // Hermes versions without Intl.DisplayNames use the bundled table below.
  }
  return COUNTRY_NAME_FALLBACK[iso] ?? iso;
}

export const COUNTRY_CALLING_CODE_OPTIONS: CountryCallingCodeOption[] = getCountries()
  .map((iso) => ({
    iso,
    name: displayNameFor(iso),
    flag: flagForIso(iso),
    dialCode: `+${getCountryCallingCode(iso as CountryCode)}`,
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

export function findCountryCallingCodeOption(iso: string | undefined): CountryCallingCodeOption | undefined {
  return COUNTRY_CALLING_CODE_OPTIONS.find((option) => option.iso === iso?.toUpperCase());
}

export function getDeviceRegion(locale = Intl.DateTimeFormat().resolvedOptions().locale): string | undefined {
  const match = locale.match(/[-_]([A-Za-z]{2})(?:[-_]|$)/);
  return match?.[1]?.toUpperCase();
}

export function getDefaultCountryCallingCode(locale?: string): CountryCallingCodeOption {
  return findCountryCallingCodeOption(getDeviceRegion(locale)) ?? findCountryCallingCodeOption("SG")!;
}

export function searchCountryCallingCodeOptions(query: string): CountryCallingCodeOption[] {
  const normalized = query.trim().toLowerCase();
  const dialQuery = normalized.replace(/^\+/, "").replace(/\D/g, "");
  if (!normalized) return COUNTRY_CALLING_CODE_OPTIONS;
  return COUNTRY_CALLING_CODE_OPTIONS.filter((option) => (
    option.name.toLowerCase().includes(normalized)
    || option.iso.toLowerCase().includes(normalized)
    || (dialQuery.length > 0 && option.dialCode.slice(1).includes(dialQuery))
  ));
}

export function formatPhoneWithCountry(option: CountryCallingCodeOption, nationalNumber: string): string {
  const trimmed = nationalNumber.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("+") ? trimmed : `${option.dialCode} ${trimmed}`;
}

export function isValidInternationalPhone(phone: string): boolean {
  return isValidPhoneNumber(phone.trim());
}
