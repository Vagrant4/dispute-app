/** Shared address formatting for GPS reverse-geocode results. */

export function isHouseNumberOnly(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /^(?:(?:blk|block|no\.?|#)\s*)?\d+[a-z]?$/i.test(value.trim());
}

export function isUnitNumber(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /^#?(?:[a-z]\d?|\d{1,3})-\d{1,4}$/i.test(value.trim());
}

export function isCountryOnly(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /^(singapore|malaysia|indonesia|philippines|thailand|vietnam|india|bangladesh|china|australia|united states|usa|uk|united kingdom)$/i.test(
    value.trim(),
  );
}

export function formatCoordinateLabel(latitude: number, longitude: number): string {
  const ns = latitude >= 0 ? "N" : "S";
  const ew = longitude >= 0 ? "E" : "W";
  return `${Math.abs(latitude).toFixed(2)}° ${ns}, ${Math.abs(longitude).toFixed(2)}° ${ew}`;
}

export type AddressPartFields = {
  name?: string | null;
  streetNumber?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  formattedAddress?: string | null;
};

/** Build a stored/full address. Returns null when geocode is too sparse (e.g. "377, Singapore"). */
export function formatReadableAddress(parts: AddressPartFields): string | null {
  const rawName = parts.name?.trim() || "";
  const streetNumber =
    parts.streetNumber?.trim() || (isHouseNumberOnly(rawName) ? rawName : "") || "";
  const street = parts.street?.trim() || "";
  const placeName = rawName && !isHouseNumberOnly(rawName) && !isUnitNumber(rawName) ? rawName : "";
  const numberAndStreet = [streetNumber, street].filter(Boolean).join(" ").trim();
  const streetLine = placeName || (street ? numberAndStreet : "");
  const usableStreet = streetLine && !isHouseNumberOnly(streetLine) ? streetLine : "";

  const areaBits = [parts.district, parts.city, parts.region, parts.postalCode]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (usableStreet) {
    const line = [...new Set([usableStreet, ...areaBits, parts.country?.trim()].filter(Boolean))];
    return line.join(", ") || null;
  }

  const neighbourhood = areaBits.filter((value) => !isCountryOnly(value));
  if (neighbourhood.length) {
    const line = [...new Set([...neighbourhood, parts.country?.trim()].filter(Boolean))];
    return line.join(", ") || null;
  }

  return null;
}

export function shortAddress(
  reading: {
    address?: string | null;
    addressParts?: AddressPartFields | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null,
): string | null {
  const parts = reading?.addressParts;
  const rawName = parts?.name?.trim() || "";
  const streetNumber =
    parts?.streetNumber?.trim() || (isHouseNumberOnly(rawName) ? rawName : "") || "";
  const street = parts?.street?.trim() || "";
  const placeName = rawName && !isHouseNumberOnly(rawName) && !isUnitNumber(rawName) ? rawName : "";
  const numberAndStreet = [streetNumber, street].filter(Boolean).join(" ").trim();
  const streetLine = placeName || (street ? numberAndStreet : "");
  const usableStreet = streetLine && !isHouseNumberOnly(streetLine) ? streetLine : "";
  const area = parts?.district?.trim() || parts?.city?.trim() || "";

  if (usableStreet) {
    const distinct = [...new Set([usableStreet, area].map((value) => value?.trim()).filter(Boolean))];
    return distinct.slice(0, 2).join(", ") || null;
  }

  if (area && !isCountryOnly(area)) {
    return area;
  }

  const fromAddress =
    reading?.address
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
  const withoutBareNumber = fromAddress.filter((part) => !isHouseNumberOnly(part));
  const useful = [...new Set(withoutBareNumber.filter((part) => !isCountryOnly(part)))];
  if (useful.length) {
    return useful.slice(0, 2).join(", ");
  }

  return null;
}
