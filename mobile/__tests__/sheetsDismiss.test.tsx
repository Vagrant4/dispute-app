import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

import { SwipeDownSheet } from "../src/components/SwipeDownSheet";

describe.each(["project-sheet", "photo-proof-sheet", "photo-detail-sheet", "project-detail-picker-sheet", "settings-pay-rate-project-sheet", "today-project-picker-sheet"])("%s", (sheetId) => {
  test("shows a grab handle and closes after a downward swipe", () => {
    const onClose = jest.fn();
    const view = render(<SwipeDownSheet onClose={onClose} testID={sheetId}><Text>Sheet</Text></SwipeDownSheet>);
    const handle = view.getByTestId(`${sheetId}-grab-handle`);
    expect(handle).toBeTruthy();
    fireEvent(handle, "responderGrant", { nativeEvent: { pageY: 0, timestamp: 0 } });
    fireEvent(handle, "responderMove", { nativeEvent: { pageY: 100, timestamp: 100 } });
    fireEvent(handle, "responderRelease", { nativeEvent: { pageY: 100, timestamp: 100 } });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("springs back after a small drag", () => {
    const onClose = jest.fn();
    const view = render(<SwipeDownSheet onClose={onClose} testID={sheetId}><Text>Sheet</Text></SwipeDownSheet>);
    const handle = view.getByTestId(`${sheetId}-grab-handle`);
    fireEvent(handle, "responderGrant", { nativeEvent: { pageY: 0, timestamp: 0 } });
    fireEvent(handle, "responderMove", { nativeEvent: { pageY: 40, timestamp: 1000 } });
    fireEvent(handle, "responderRelease", { nativeEvent: { pageY: 40, timestamp: 1000 } });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe.each(["project-detail-picker-sheet", "settings-pay-rate-project-sheet", "today-project-picker-sheet"])("%s Android back", (sheetId) => {
  test("closes the picker", () => {
    const onClose = jest.fn();
    const view = render(<SwipeDownSheet onClose={onClose} testID={sheetId}><Text>Sheet</Text></SwipeDownSheet>);
    fireEvent(view.UNSAFE_getByType(require("react-native").Modal), "requestClose");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
