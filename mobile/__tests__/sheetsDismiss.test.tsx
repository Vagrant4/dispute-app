import { fireEvent, render } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

import { SwipeDownSheet } from "../src/components/SwipeDownSheet";

describe.each(["project-sheet", "photo-proof-sheet", "photo-detail-sheet"])("%s", (sheetId) => {
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

test("Cancel and Android modal back still close a sheet", () => {
  const onClose = jest.fn();
  const view = render(<SwipeDownSheet onClose={onClose} testID="project-sheet"><Pressable onPress={onClose}><Text>Cancel</Text></Pressable></SwipeDownSheet>);
  fireEvent.press(view.getByText("Cancel"));
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent(view.UNSAFE_getByType(require("react-native").Modal), "requestClose");
  expect(onClose).toHaveBeenCalledTimes(2);
});
