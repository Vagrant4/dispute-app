export type ReportViewAdapter = {
  canOpenURL?: (url: string) => Promise<boolean>;
  openURL: (url: string) => Promise<void>;
  getViewableUri?: (filePath: string) => Promise<string>;
};

export type ViewGeneratedDocumentResult = {
  opened: boolean;
  filePath: string;
  message: string;
};

export async function viewGeneratedDocument(params: {
  filePath: string;
  viewer?: ReportViewAdapter | null;
}): Promise<ViewGeneratedDocumentResult> {
  if (!params.viewer) {
    return {
      opened: false,
      filePath: params.filePath,
      message:
        "Report viewer is unavailable in this runtime. Use Email / Share to open the file in another app.",
    };
  }

  const viewableUri = params.viewer.getViewableUri
    ? await params.viewer.getViewableUri(params.filePath)
    : params.filePath;
  const canOpen = params.viewer.canOpenURL
    ? await params.viewer.canOpenURL(viewableUri)
    : true;
  if (!canOpen) {
    return {
      opened: false,
      filePath: params.filePath,
      message:
        "This phone cannot open the report directly from the app. Use Email / Share to open it in a PDF viewer.",
    };
  }

  await params.viewer.openURL(viewableUri);

  return {
    opened: true,
    filePath: params.filePath,
    message: "Report opened for viewing.",
  };
}
