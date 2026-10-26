export type StartNewProjectDraftResult =
  | {
      ok: true;
      selectedProjectId: null;
      projectName: "";
      projectDescription: "";
      message: string;
    }
  | { ok: false; message: string };

export function startNewProjectDraft(params: {
  hasCreateAccess: boolean;
  isClockRunning: boolean;
}): StartNewProjectDraftResult {
  if (!params.hasCreateAccess) {
    return {
      ok: false,
      message: "An active trial or subscription is required to create a new project.",
    };
  }
  if (params.isClockRunning) {
    return { ok: false, message: "Time Out before creating a new project." };
  }
  return {
    ok: true,
    selectedProjectId: null,
    projectName: "",
    projectDescription: "",
    message: "Enter the new project details, then tap Create Project.",
  };
}

export function getProjectSaveMode(
  selectedExistingProjectId: string | null | undefined,
): "create" | "update" {
  return selectedExistingProjectId ? "update" : "create";
}
