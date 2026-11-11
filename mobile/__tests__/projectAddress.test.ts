import { projectAddressLabel } from "../src/work/projectAddress";

test("displayed project addresses always include the Address label", () => {
  expect(projectAddressLabel(" 531377 ")).toBe("Address: 531377");
  expect(projectAddressLabel(null)).toBe("Address: None");
  expect(projectAddressLabel("   ")).toBe("Address: None");
});
