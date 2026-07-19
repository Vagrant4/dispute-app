import * as FileSystem from "expo-file-system/legacy";

import { downloadGeneratedPdfToUserFolder } from "./reportDownload";

export async function downloadGeneratedPdfWithExpo(params: {
  filePath: string;
  fileName: string;
}) {
  return downloadGeneratedPdfToUserFolder({
    ...params,
    fileSystem: {
      EncodingType: FileSystem.EncodingType,
      readAsStringAsync: (uri, options) =>
        FileSystem.readAsStringAsync(uri, {
          encoding: options?.encoding as FileSystem.EncodingType | undefined,
        }),
      StorageAccessFramework: {
        requestDirectoryPermissionsAsync:
          FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync,
        createFileAsync: FileSystem.StorageAccessFramework.createFileAsync,
        writeAsStringAsync: (uri, contents, options) =>
          FileSystem.StorageAccessFramework.writeAsStringAsync(uri, contents, {
            encoding: options?.encoding as FileSystem.EncodingType | undefined,
          }),
      },
    },
  });
}
