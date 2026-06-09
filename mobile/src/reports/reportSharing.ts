export type SharingAdapter = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (
    filePath: string,
    options?: {
      mimeType?: string;
      dialogTitle?: string;
      UTI?: string;
    },
  ) => Promise<void>;
};

export type ShareGeneratedDocumentResult = {
  shared: boolean;
  filePath: string;
  message: string;
};

export async function shareGeneratedDocument(params: {
  filePath: string;
  mimeType?: string;
  dialogTitle?: string;
  sharing?: SharingAdapter | null;
}): Promise<ShareGeneratedDocumentResult> {
  if (!params.sharing || !(await params.sharing.isAvailableAsync())) {
    return {
      shared: false,
      filePath: params.filePath,
      message:
        "Sharing is unavailable in this runtime. The file remains stored locally at the returned path.",
    };
  }

  await params.sharing.shareAsync(params.filePath, {
    mimeType: params.mimeType,
    dialogTitle: params.dialogTitle ?? "Share ClaimProof SG report",
  });

  return {
    shared: true,
    filePath: params.filePath,
    message: "Native share sheet opened for manual export.",
  };
}
