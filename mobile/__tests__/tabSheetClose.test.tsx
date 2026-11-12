import React from "react";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import { SwipeDownSheet } from "../src/components/SwipeDownSheet";
import { TabScreenContent } from "../src/components/TabScreenContent";

test("an open sheet is removed when the active tab changes", () => {
  const screen = render(
    <TabScreenContent activeTab="reports"><SwipeDownSheet onClose={jest.fn()} testID="project-detail-picker-sheet"><Text>Choose project</Text></SwipeDownSheet></TabScreenContent>,
  );
  expect(screen.getByTestId("project-detail-picker-sheet")).toBeTruthy();
  screen.rerender(<TabScreenContent activeTab="settings"><Text>Pay rate</Text></TabScreenContent>);
  expect(screen.queryByTestId("project-detail-picker-sheet")).toBeNull();
  expect(screen.getByText("Pay rate")).toBeTruthy();
});
