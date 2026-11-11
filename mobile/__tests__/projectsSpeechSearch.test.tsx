import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { ProjectsScreen, voiceSearchErrorMessage } from "../src/screens/ProjectsScreen";

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockIsRecognitionAvailable = jest.fn();
const speechListeners: Record<string, (event?: any) => void> = {};

jest.mock("expo-speech-recognition", () => ({
  ExpoSpeechRecognitionModule: {
    isRecognitionAvailable: () => mockIsRecognitionAvailable(),
    requestPermissionsAsync: () => mockRequestPermissionsAsync(),
    start: (...args: unknown[]) => mockStart(...args),
    stop: () => mockStop(),
  },
  useSpeechRecognitionEvent: (name: string, listener: (event?: any) => void) => {
    speechListeners[name] = listener;
  },
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ granted: false }),
}));
jest.mock("../src/subscription/useSubscriptionAccess", () => ({
  useSubscriptionAccess: () => ({ canCreateRecords: true, message: "" }),
}));
jest.mock("../src/work/projectScreenStore", () => ({
  currentWeekStart: () => "2026-11-09",
  getProjectScreenStore: jest.fn().mockResolvedValue({
    listProjectSummaries: jest.fn().mockResolvedValue([]),
    listProjectGroups: jest.fn().mockResolvedValue([]),
  }),
}));
jest.mock("../src/screens/ProjectDetailScreen", () => ({ ProjectDetailScreen: () => null }));
jest.mock("../src/screens/ProjectNameSheet", () => ({ ProjectNameSheet: () => null }));
jest.mock("../src/components/SwipeDownSheet", () => ({ SwipeDownSheet: () => null }));

async function renderProjects() {
  const screen = render(
    <ProjectsScreen
      account={{ id: "u1", email: "worker@example.com" } as never}
      onCreateAccount={jest.fn()}
      onSeePhotos={jest.fn()}
    />,
  );
  await screen.findByText("No matching projects.");
  return screen;
}

beforeEach(() => {
  jest.clearAllMocks();
  for (const name of Object.keys(speechListeners)) delete speechListeners[name];
  mockIsRecognitionAvailable.mockReturnValue(true);
  mockRequestPermissionsAsync.mockResolvedValue({ granted: true });
});

test("mic requests permission, starts recognition, and fills search from a result", async () => {
  const screen = await renderProjects();

  fireEvent.press(screen.getByLabelText("Search projects by voice"));

  await waitFor(() => expect(mockRequestPermissionsAsync).toHaveBeenCalled());
  expect(mockStart).toHaveBeenCalledWith({ lang: "en-US", interimResults: true });

  act(() => speechListeners.result({ results: [{ transcript: "Marina renovation" }] }));
  expect(screen.getByLabelText("Search projects").props.value).toBe("Marina renovation");
});

test("permission denial shows a visible message", async () => {
  mockRequestPermissionsAsync.mockResolvedValue({ granted: false });
  const screen = await renderProjects();

  fireEvent.press(screen.getByLabelText("Search projects by voice"));

  expect(await screen.findByText("Microphone permission needed for voice search.")).toBeTruthy();
  expect(mockStart).not.toHaveBeenCalled();
});

test("native speech errors use calm app messages and never render raw text", async () => {
  const screen = await renderProjects();
  act(() => speechListeners.error({ error: "language-not-supported", message: "Requested language is supported, but not yet downloaded." }));
  expect(await screen.findByText("Voice search unavailable on this phone.")).toBeTruthy();
  expect(screen.queryByText(/Requested language/)).toBeNull();
  expect(voiceSearchErrorMessage("no-speech")).toBe("Didn't catch that. Try again.");
});

test("unavailable recognition hides the mic", async () => {
  mockIsRecognitionAvailable.mockReturnValue(false);
  const screen = await renderProjects();

  expect(screen.queryByLabelText("Search projects by voice")).toBeNull();
  expect(screen.getByText("Voice search is unavailable on this device.")).toBeTruthy();
});
