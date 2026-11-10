const values = new Map<string, string>();
const validKey = /^[\w.-]+$/;

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

import * as SecureStore from "expo-secure-store";

import {
  getReportPeriodSecureStoreKey,
  loadReportPeriod,
  saveReportPeriod,
} from "../src/reports/reportPeriodSettings";

const mockGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const mockSetItemAsync = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;

beforeEach(() => {
  values.clear();
  mockGetItemAsync.mockClear();
  mockSetItemAsync.mockClear();
  mockGetItemAsync.mockImplementation(async (key: string) => {
    if (!validKey.test(key)) throw new Error("Invalid key provided to SecureStore");
    return values.get(key) ?? null;
  });
  mockSetItemAsync.mockImplementation(async (key: string, value: string) => {
    if (!validKey.test(key)) throw new Error("Invalid key provided to SecureStore");
    values.set(key, value);
  });
});

test.each(["u-demo", "76c8bd7c-1234-4abc-9876-123456789abc", "a.b@example.com"])(
  "uses a SecureStore-valid report period key for %s",
  (userId) => expect(getReportPeriodSecureStoreKey(userId)).toMatch(validKey),
);

test("load defaults to week when SecureStore throws", async () => {
  mockGetItemAsync.mockRejectedValueOnce(new Error("SecureStore unavailable"));
  await expect(loadReportPeriod("u-demo")).resolves.toBe("week");
});

test("month round-trips through regex-enforcing SecureStore", async () => {
  await saveReportPeriod("a.b@example.com", "month");
  await expect(loadReportPeriod("a.b@example.com")).resolves.toBe("month");
});
