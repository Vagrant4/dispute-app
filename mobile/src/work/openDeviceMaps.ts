import { Linking, Platform } from "react-native";

export type OpenDeviceMapsResult = { ok: true } | { ok: false; message: string };

type OpenDeviceMapsDeps = {
  openURL?: (url: string) => Promise<void>;
  canOpenURL?: (url: string) => Promise<boolean>;
  platform?: typeof Platform.OS;
};

/** Open the device maps app for a GPS point. Never throws — callers show the message in-app. */
export async function openDeviceMaps(
  params: { latitude: number; longitude: number; label?: string },
  deps: OpenDeviceMapsDeps = {},
): Promise<OpenDeviceMapsResult> {
  const openURL = deps.openURL ?? ((url: string) => Linking.openURL(url).then(() => undefined));
  const canOpenURL = deps.canOpenURL ?? ((url: string) => Linking.canOpenURL(url));
  const platform = deps.platform ?? Platform.OS;
  const label = encodeURIComponent(params.label?.trim() || "Current GPS reading");
  const { latitude, longitude } = params;
  const httpsMaps = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const candidates =
    platform === "ios"
      ? [
          `http://maps.apple.com/?ll=${latitude},${longitude}&q=${label}`,
          httpsMaps,
        ]
      : [
          httpsMaps,
          `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`,
        ];

  for (const url of candidates) {
    try {
      const supported = await canOpenURL(url).catch(() => false);
      if (!supported) continue;
      await openURL(url);
      return { ok: true };
    } catch {
      // Try the next candidate. Never let a maps intent kill the JS flow.
    }
  }

  try {
    await openURL(httpsMaps);
    return { ok: true };
  } catch {
    return { ok: false, message: "Couldn't open a maps app on this phone." };
  }
}
