import { useEffect, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

import type { LocalAccount } from "../auth/localAuth";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../db/settingsValidation";
import { subscriptionContent } from "../screenContent";
import { styles } from "../styles";
import {
  fetchSubscriptionStatus,
  formatSubscriptionPrice,
  formatTrialCountdown,
  purchaseDisputeBasicSubscription,
  type SubscriptionEntitlement,
} from "../subscription/subscriptionClient";

type SettingsScreenProps = {
  account: LocalAccount;
  onLogout: () => void;
};

type SettingPanel = "profile" | "work_hours" | "subscription";

export function SettingsScreen({ account, onLogout }: SettingsScreenProps) {
  const [panel, setPanel] = useState<SettingPanel>("profile");
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
  const [currency, setCurrency] = useState(DEFAULT_APP_SETTINGS.currency);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);
  const [rateBasis, setRateBasis] = useState<AppSettings["rateBasis"]>(
    DEFAULT_APP_SETTINGS.rateBasis,
  );
  const [rateBasisDropdownOpen, setRateBasisDropdownOpen] = useState(false);
  const [baseRate, setBaseRate] = useState(
    formatRateAmount(DEFAULT_APP_SETTINGS.baseRateCents),
  );
  const [normalStart, setNormalStart] = useState(DEFAULT_APP_SETTINGS.normalWorkStartTime);
  const [normalEnd, setNormalEnd] = useState(DEFAULT_APP_SETTINGS.normalWorkEndTime);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(
    String(DEFAULT_APP_SETTINGS.overtimeMultiplier),
  );
  const [offDayMultiplier, setOffDayMultiplier] = useState(
    String(DEFAULT_APP_SETTINGS.offDayMultiplier),
  );
  const [holidayMultiplier, setHolidayMultiplier] = useState(
    String(DEFAULT_APP_SETTINGS.holidayMultiplier),
  );
  const [workHoursStatus, setWorkHoursStatus] = useState(
    "Normal hours decide when OT starts in reports.",
  );
  const [subscription, setSubscription] = useState<SubscriptionEntitlement | null>(
    null,
  );
  const [subscriptionStatus, setSubscriptionStatus] = useState(
    "Checking subscription status...",
  );

  const options: Array<{ id: SettingPanel; label: string }> = [
    { id: "profile", label: "Profile" },
    { id: "work_hours", label: "Work hours" },
    { id: "subscription", label: "Subscription" },
  ];

  useEffect(() => {
    void loadWorkHours();
    void loadSubscriptionStatus();
  }, []);

  async function loadSubscriptionStatus() {
    const result = await fetchSubscriptionStatus();
    if (!result.ok) {
      setSubscription(null);
      setSubscriptionStatus(result.message);
      return;
    }

    setSubscription(result.subscription);
    setSubscriptionStatus(
      formatTrialCountdown(result.subscription) || result.subscription.message,
    );
  }

  async function handleSubscribe() {
    setSubscriptionStatus("Opening store subscription...");
    const purchase = await purchaseDisputeBasicSubscription(account);
    if (!purchase.ok) {
      setSubscriptionStatus(purchase.message);
      return;
    }

    setSubscriptionStatus(purchase.message);
    await loadSubscriptionStatus();
  }

  async function loadWorkHours() {
    if (Platform.OS === "web") {
      return;
    }
    try {
      const repositories = await getNativeRepositories();
      const settings = await repositories.settings.getSettings();
      setCurrency(settings.currency);
      setRateBasis(settings.rateBasis);
      setBaseRate(formatRateAmount(settings.baseRateCents));
      setNormalStart(settings.normalWorkStartTime);
      setNormalEnd(settings.normalWorkEndTime);
      setOvertimeMultiplier(String(settings.overtimeMultiplier));
      setOffDayMultiplier(String(settings.offDayMultiplier));
      setHolidayMultiplier(String(settings.holidayMultiplier));
      setWorkHoursStatus("Work hours loaded from this phone.");
    } catch (error) {
      setWorkHoursStatus(getErrorMessage(error));
    }
  }

  async function handleSaveWorkHours() {
    try {
      const multiplier = Number.parseFloat(overtimeMultiplier);
      const offDayRate = Number.parseFloat(offDayMultiplier);
      const holidayRate = Number.parseFloat(holidayMultiplier);
      if (Platform.OS === "web") {
        setWorkHoursStatus("Work hours are saved in the native phone app build.");
        return;
      }
      const repositories = await getNativeRepositories();
      const settings = await repositories.settings.updateSettings({
        currency,
        rateBasis,
        baseRateCents: parseRateAmountCents(baseRate),
        normalWorkStartTime: normalStart,
        normalWorkEndTime: normalEnd,
        dailyHours: calculateNormalHours(normalStart, normalEnd),
        weeklyHours: Math.max(
          DEFAULT_APP_SETTINGS.weeklyHours,
          calculateNormalHours(normalStart, normalEnd),
        ),
        overtimeMultiplier: multiplier,
        offDayMultiplier: offDayRate,
        holidayMultiplier: holidayRate,
      });
      setCurrency(settings.currency);
      setRateBasis(settings.rateBasis);
      setBaseRate(formatRateAmount(settings.baseRateCents));
      setNormalStart(settings.normalWorkStartTime);
      setNormalEnd(settings.normalWorkEndTime);
      setOvertimeMultiplier(String(settings.overtimeMultiplier));
      setOffDayMultiplier(String(settings.offDayMultiplier));
      setHolidayMultiplier(String(settings.holidayMultiplier));
      setWorkHoursStatus(
        `Saved. ${settings.currency} ${formatRateAmount(settings.baseRateCents)} ${settings.rateBasis} rate. OT ${settings.overtimeMultiplier}x, off day ${settings.offDayMultiplier}x, holiday ${settings.holidayMultiplier}x.`,
      );
    } catch (error) {
      setWorkHoursStatus(getErrorMessage(error));
    }
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Settings</Text>
        <Text style={styles.heading}>Account</Text>
        <View style={styles.actionRow}>
          {options.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => setPanel(item.id)}
              style={
                item.id === panel ? styles.actionButton : styles.actionButtonSecondary
              }
            >
              <Text
                style={
                  item.id === panel
                    ? styles.actionButtonText
                    : styles.actionButtonSecondaryText
                }
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onLogout}
          style={styles.clockSecondaryButton}
        >
          <Text style={styles.clockSecondaryButtonText}>Logout</Text>
        </Pressable>
      </View>

      {panel === "profile" ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Profile</Text>
          <Text style={styles.inputLabel}>Name</Text>
          <TextInput
            accessibilityLabel="Profile name"
            autoCapitalize="words"
            onChangeText={setName}
            style={styles.textInput}
            value={name}
          />
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            accessibilityLabel="Profile email"
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            style={styles.textInput}
            value={email}
          />
          <Text style={styles.statusMessage}>
            Profile changes are local to this phone in this simplified version.
          </Text>
        </View>
      ) : null}

      {panel === "work_hours" ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Work hours</Text>
          <Text style={styles.body}>
            Set the normal working time. Normal hours are based on this start/end
            range. OT applies after the normal end time; off day and holiday
            rates apply to entries marked with those day types.
          </Text>
          <Text style={styles.inputLabel}>Currency</Text>
          <View style={styles.dropdownContainer}>
            <Pressable
              accessibilityLabel="Currency dropdown"
              accessibilityRole="button"
              accessibilityState={{ expanded: currencyDropdownOpen }}
              onPress={() => setCurrencyDropdownOpen((current) => !current)}
              style={styles.dropdownBox}
            >
              <Text style={styles.dropdownValue}>{getCurrencyLabel(currency)}</Text>
              <Text style={styles.dropdownChevron}>
                {currencyDropdownOpen ? "▲" : "▼"}
              </Text>
            </Pressable>
            {currencyDropdownOpen ? (
              <View style={styles.dropdownMenu}>
                {CURRENCY_OPTIONS.map((option) => {
                  const selected = option.code === currency;
                  return (
                    <Pressable
                      accessibilityLabel={`Currency ${option.code}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={option.code}
                      onPress={() => {
                        setCurrency(option.code);
                        setCurrencyDropdownOpen(false);
                      }}
                      style={
                        selected ? styles.dropdownOptionActive : styles.dropdownOption
                      }
                    >
                      <Text
                        style={
                          selected
                            ? styles.dropdownOptionActiveText
                            : styles.dropdownOptionText
                        }
                      >
                        {option.code} — {option.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
          <Text style={styles.inputLabel}>Rate entry type</Text>
          <View style={styles.dropdownContainer}>
            <Pressable
              accessibilityLabel="Rate entry type dropdown"
              accessibilityRole="button"
              accessibilityState={{ expanded: rateBasisDropdownOpen }}
              onPress={() => setRateBasisDropdownOpen((current) => !current)}
              style={styles.dropdownBox}
            >
              <Text style={styles.dropdownValue}>
                {getRateBasisLabel(rateBasis)}
              </Text>
              <Text style={styles.dropdownChevron}>
                {rateBasisDropdownOpen ? "▲" : "▼"}
              </Text>
            </Pressable>
            {rateBasisDropdownOpen ? (
              <View style={styles.dropdownMenu}>
                {RATE_BASIS_OPTIONS.map((option) => {
                  const selected = option.id === rateBasis;
                  return (
                    <Pressable
                      accessibilityLabel={`Rate entry ${option.label}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      key={option.id}
                      onPress={() => {
                        setRateBasis(option.id);
                        setRateBasisDropdownOpen(false);
                      }}
                      style={
                        selected ? styles.dropdownOptionActive : styles.dropdownOption
                      }
                    >
                      <Text
                        style={
                          selected
                            ? styles.dropdownOptionActiveText
                            : styles.dropdownOptionText
                        }
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
          <Text style={styles.inputLabel}>
            {rateBasis === "monthly" ? "Monthly rate" : "Daily rate"} ({currency})
          </Text>
          <TextInput
            accessibilityLabel="Base rate amount"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setBaseRate}
            placeholder={rateBasis === "monthly" ? "3000" : "150"}
            style={styles.textInput}
            value={baseRate}
          />
          <Text style={styles.inputLabel}>Normal start (HH:MM)</Text>
          <TextInput
            accessibilityLabel="Normal work start time"
            inputMode="numeric"
            keyboardType="numbers-and-punctuation"
            onChangeText={setNormalStart}
            placeholder="08:00"
            style={styles.textInput}
            value={normalStart}
          />
          <Text style={styles.inputLabel}>Normal end (HH:MM)</Text>
          <TextInput
            accessibilityLabel="Normal work end time"
            inputMode="numeric"
            keyboardType="numbers-and-punctuation"
            onChangeText={setNormalEnd}
            placeholder="17:00"
            style={styles.textInput}
            value={normalEnd}
          />
          <Text style={styles.inputLabel}>OT rate multiplier</Text>
          <TextInput
            accessibilityLabel="Overtime rate multiplier"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setOvertimeMultiplier}
            placeholder="1.5"
            style={styles.textInput}
            value={overtimeMultiplier}
          />
          <Text style={styles.inputLabel}>Off day rate multiplier</Text>
          <TextInput
            accessibilityLabel="Off day rate multiplier"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setOffDayMultiplier}
            placeholder="2"
            style={styles.textInput}
            value={offDayMultiplier}
          />
          <Text style={styles.inputLabel}>Holiday rate multiplier</Text>
          <TextInput
            accessibilityLabel="Holiday rate multiplier"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setHolidayMultiplier}
            placeholder="2"
            style={styles.textInput}
            value={holidayMultiplier}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleSaveWorkHours()}
            style={styles.actionButton}
          >
            <Text style={styles.actionButtonText}>Save Work Hours</Text>
          </Pressable>
          <Text style={styles.statusMessage}>{workHoursStatus}</Text>
        </View>
      ) : null}

      {panel === "subscription" ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Subscription</Text>
          <Text style={styles.muted}>{subscriptionContent.noCheckout}</Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>
                {subscription?.status ?? "Check"}
              </Text>
              <Text style={styles.metricLabel}>current plan</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>
                {subscription ? formatSubscriptionPrice(subscription) : "SGD 4.99/month"}
              </Text>
              <Text style={styles.metricLabel}>price</Text>
            </View>
          </View>
          {subscription?.status !== "ACTIVE" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleSubscribe()}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>Subscribe</Text>
              <Text style={styles.actionButtonSubtext}>
                DISPUTE Basic - SGD 4.99/month
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => void loadSubscriptionStatus()}
            style={styles.actionButtonSecondary}
          >
            <Text style={styles.actionButtonSecondaryText}>Refresh status</Text>
          </Pressable>
          <Text style={styles.statusMessage}>{subscriptionStatus}</Text>
          <Text style={styles.muted}>{subscriptionContent.policyGated}</Text>
        </View>
      ) : null}
    </>
  );
}

const CURRENCY_OPTIONS = [
  { code: "SGD", name: "Singapore Dollar" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "INR", name: "Indian Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "MMK", name: "Myanmar Kyat" },
  { code: "USD", name: "US Dollar" },
] as const;

const RATE_BASIS_OPTIONS: Array<{ id: AppSettings["rateBasis"]; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "monthly", label: "Monthly" },
];

function getCurrencyLabel(currency: string): string {
  const option = CURRENCY_OPTIONS.find((item) => item.code === currency);
  return option ? `${option.code} — ${option.name}` : currency;
}

function getRateBasisLabel(rateBasis: AppSettings["rateBasis"]): string {
  const option = RATE_BASIS_OPTIONS.find((item) => item.id === rateBasis);
  return option?.label ?? rateBasis;
}

async function getNativeRepositories() {
  const { getLocalRepositories } = await import("../db/repositories");
  return getLocalRepositories();
}

function calculateNormalHours(startTime: string, endTime: string): number {
  const start = minutesOfDay(startTime);
  let end = minutesOfDay(endTime);
  if (end <= start) {
    end += 24 * 60;
  }
  return Number(((end - start) / 60).toFixed(2));
}

function minutesOfDay(value: string): number {
  const [hourText, minuteText] = value.split(":");
  const hour = Number.parseInt(hourText, 10);
  const minute = Number.parseInt(minuteText, 10);
  return hour * 60 + minute;
}

function parseRateAmountCents(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

function formatRateAmount(cents: number): string {
  if (!Number.isFinite(cents) || cents <= 0) {
    return "";
  }
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Work hours action failed.";
}
