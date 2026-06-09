import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { photoEvidenceContent } from "../screenContent";
import {
  buildEvidencePhotoPath,
  importEvidencePhotoFile,
} from "../photos/photoFileStorage";
import { getOptionalPhotoGps } from "../photos/photoGps";
import { styles } from "../styles";

type PhotoAction = "camera" | "gallery";

export function PhotoEvidenceScreen() {
  const [status, setStatus] = useState(photoEvidenceContent.localStorageBody);
  const [lastLocalUri, setLastLocalUri] = useState<string | null>(null);

  async function handlePhotoAction(action: PhotoAction) {
    try {
      const permission =
        action === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setStatus(photoEvidenceContent.permissionDenied);
        return;
      }

      const result =
        action === "camera"
          ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });

      if (result.canceled || result.assets.length === 0) {
        setStatus("No photo selected. You can try again when ready.");
        return;
      }

      const selected = result.assets[0];
      const photoId = `photo-${Date.now()}`;
      const destinationUri = buildEvidencePhotoPath({
        userId: "local-user",
        projectId: "project-required-before-save",
        photoId,
        extension: getExtension(selected.uri),
      });
      const imported = await importEvidencePhotoFile({
        sourceUri: selected.uri,
        destinationUri,
      });
      const gps = await getOptionalPhotoGps();

      setLastLocalUri(imported.localUri);
      setStatus(`${imported.message} ${gps.message}`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Photo evidence action failed. Local records were not changed.",
      );
    }
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Photo evidence</Text>
        <Text style={styles.heading}>{photoEvidenceContent.heading}</Text>
        <Text style={styles.body}>{photoEvidenceContent.body}</Text>

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handlePhotoAction("camera")}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Take photo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handlePhotoAction("gallery")}
            style={styles.actionButtonSecondary}
          >
            <Text style={styles.actionButtonSecondaryText}>Pick from gallery</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, styles.warningCard]}>
        <Text style={styles.heading}>Permissions and local storage</Text>
        <Text style={styles.body}>{status}</Text>
        <Text style={styles.muted}>{photoEvidenceContent.gpsOptional}</Text>
        {lastLocalUri ? <Text style={styles.codePreview}>{lastLocalUri}</Text> : null}
      </View>
    </>
  );
}

function getExtension(uri: string): string {
  const withoutQuery = uri.split("?")[0] ?? uri;
  const extension = withoutQuery.split(".").pop();
  return extension && extension.length <= 5 ? extension : "jpg";
}
