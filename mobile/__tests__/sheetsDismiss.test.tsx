import { act, fireEvent, render } from "@testing-library/react-native";
import { Keyboard, Platform, StyleSheet, Text } from "react-native";

import { SwipeDownSheet } from "../src/components/SwipeDownSheet";

test("lifts above the Android keyboard and removes its listeners", () => {
  const platform = jest.replaceProperty(Platform, "OS", "android");
  const listeners = new Map<string, (event?: unknown) => void>();
  const removers: jest.Mock[] = [];
  const addListener = jest.spyOn(Keyboard, "addListener").mockImplementation((event, callback) => {
    listeners.set(event, callback as (event?: unknown) => void);
    const remove = jest.fn();
    removers.push(remove);
    return { remove };
  });

  const view = render(<SwipeDownSheet onClose={jest.fn()} testID="keyboard-sheet"><Text>Sheet</Text></SwipeDownSheet>);
  expect(addListener).toHaveBeenCalledWith("keyboardDidShow", expect.any(Function));
  expect(addListener).toHaveBeenCalledWith("keyboardDidHide", expect.any(Function));
  const initialMaxHeight = StyleSheet.flatten(view.getByTestId("keyboard-sheet").props.style).maxHeight;

  act(() => listeners.get("keyboardDidShow")?.({ endCoordinates: { height: 300 } }));
  const keyboardStyle = StyleSheet.flatten(view.getByTestId("keyboard-sheet").props.style);
  expect(keyboardStyle.marginBottom + keyboardStyle.paddingBottom).toBe(300);
  expect(keyboardStyle.maxHeight).toBe(initialMaxHeight - 300);

  act(() => listeners.get("keyboardDidHide")?.());
  expect(StyleSheet.flatten(view.getByTestId("keyboard-sheet").props.style)).toEqual(expect.objectContaining({ marginBottom: 0 }));

  view.unmount();
  expect(removers).not.toHaveLength(0);
  removers.forEach((remove) => expect(remove).toHaveBeenCalledTimes(1));
  addListener.mockRestore();
  platform.restore();
});

describe.each(["project-sheet", "photo-proof-sheet", "photo-detail-sheet", "project-detail-picker-sheet", "settings-pay-rate-project-sheet", "today-project-picker-sheet"])("%s", (sheetId) => {
  test("uses an edge-to-edge safe modal and a non-collapsing sheet", () => {
    const view = render(<SwipeDownSheet onClose={jest.fn()} testID={sheetId}><Text>Sheet</Text></SwipeDownSheet>);
    const modal = view.UNSAFE_getByType(require("react-native").Modal);
    expect(modal.props.statusBarTranslucent).toBe(true);
    expect(modal.props.navigationBarTranslucent).toBe(true);
    expect(view.getByTestId(sheetId).props.style).toEqual(expect.objectContaining({ flexShrink: 1 }));
  });

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
