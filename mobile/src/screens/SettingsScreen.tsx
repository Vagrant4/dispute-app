import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Image, Linking, Platform, Pressable, Text, TextInput, View } from "react-native";

import type { LocalAccount } from "../auth/localAuth";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../db/settingsValidation";
import { saveWorkHours, loadWorkHours as loadSavedWorkHours, calculateNormalHours } from "../work/workHoursSettings";
import { styles, theme } from "../styles";
import { DeleteAccountScreen } from "./DeleteAccountScreen";
import { PlanBillingPanel } from "./PlanBillingPanel";
import { PrivacyScreen } from "./PrivacyScreen";
import { ProfileSettingsPanel } from "./ProfileSettingsPanel";
import { SettingsBackupScreen } from "./SettingsBackupScreen";
import {
  planTrialLine,
  getSubscriptionManagementUrl,
  getSubscriptionSettingsAction,
  purchaseDisputeBasicSubscription,
} from "../subscription/subscriptionClient";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import { useDisputeBasicStorePrice } from "../subscription/useDisputeBasicStorePrice";
import { getDisputePackBillingNote } from "../subscription/recordAccess";
import { loadReportPeriod, saveReportPeriod, type ReportPeriod } from "../reports/reportPeriodSettings";
import { SwipeDownSheet } from "../components/SwipeDownSheet";

type SettingsScreenProps = {
  account: LocalAccount;
  onLogout: () => void;
  onAccountDeleted: (message: string) => void;
  initialPanel?: SettingPanel;
};

export type SettingPanel = "profile" | "work_hours" | "subscription" | "privacy_data";

type SettingsPage = "main" | "name" | "pay_rate" | "language" | "plan" | "support" | "more" | "privacy_data" | "backup" | "delete_account";

const INITIAL_PANEL_PAGES: Record<SettingPanel, SettingsPage> = {
  profile: "name",
  work_hours: "pay_rate",
  subscription: "plan",
  privacy_data: "privacy_data",
};

export function SettingsScreen({ account, onLogout, onAccountDeleted, initialPanel }: SettingsScreenProps) {
  const userId = account.id ?? account.email.trim().toLowerCase();
  const [panel, setPanel] = useState<SettingsPage>(initialPanel ? INITIAL_PANEL_PAGES[initialPanel] : "main");
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
  const [workHoursStatus, setWorkHoursStatus] = useState("");
  const paySettingsLoaded = useRef(false);
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("week");
  const [reportPeriodPickerOpen, setReportPeriodPickerOpen] = useState(false);
  const [subscriptionActionStatus, setSubscriptionActionStatus] = useState("");
  const {
    subscription,
    canCreateRecords: hasFullAccess,
    refresh: loadSubscriptionStatus,
  } = useSubscriptionAccess(account);
  const storePrice = useDisputeBasicStorePrice(account);
  const subscriptionAction = getSubscriptionSettingsAction(subscription);
  const exportNote = getDisputePackBillingNote(false, subscriptionAction, subscription?.trialEndsAt ?? null);

  useEffect(() => {
    setPanel(initialPanel ? INITIAL_PANEL_PAGES[initialPanel] : "main");
  }, [initialPanel]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (currencyDropdownOpen) { setCurrencyDropdownOpen(false); return true; }
      if (rateBasisDropdownOpen) { setRateBasisDropdownOpen(false); return true; }
      if (reportPeriodPickerOpen) { setReportPeriodPickerOpen(false); return true; }
      if (panel !== "main") {
        setPanel(panel === "delete_account" ? "privacy_data" : (panel === "privacy_data" || panel === "backup") ? "more" : "main");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [currencyDropdownOpen, panel, rateBasisDropdownOpen, reportPeriodPickerOpen]);

  const mainRows: { id: SettingsPage; label: string; value: string }[] = [
    { id: "pay_rate", label: "Pay rate", value: Number(baseRate) > 0 ? `${currency} ${baseRate} / ${rateBasis === "monthly" ? "month" : rateBasis === "hourly" ? "hour" : "day"}` : "Not set" },
    { id: "language", label: "Language", value: "English" },
    { id: "plan", label: "Plan", value: planTrialLine(subscription) ?? (subscription?.planName || "Checking plan…") },
    { id: "support", label: "Support", value: "Help and policies" },
    { id: "more", label: "More", value: "Privacy and backup" },
  ];
  const moreRows: { id: SettingsPage; label: string; value: string }[] = [
    { id: "privacy_data", label: "Privacy & data", value: "Your privacy and account" },
    { id: "backup", label: "Keep a copy", value: "Save or restore your records" },
  ];
  const rowIcons = {
    name: require("../../assets/icons/set-name.png"),
    pay_rate: require("../../assets/icons/set-pay.png"),
    language: require("../../assets/icons/set-language.png"),
    plan: require("../../assets/icons/set-plan.png"),
    support: require("../../assets/icons/set-support.png"),
    more: require("../../assets/icons/set-more.png"),
    privacy_data: require("../../assets/icons/set-privacy.png"),
    backup: require("../../assets/icons/set-backup.png"),
  };
  const insideMore = panel === "privacy_data" || panel === "backup";

  async function handleSubscribe() {
    setSubscriptionActionStatus("Opening store subscription...");
    const purchase = await purchaseDisputeBasicSubscription(account, subscription);
    if (!purchase.ok) {
      setSubscriptionActionStatus(purchase.message);
      return;
    }

    setSubscriptionActionStatus("");
    await loadSubscriptionStatus();
  }

  async function handleManageSubscription() {
    const managementUrl = getSubscriptionManagementUrl(Platform.OS);
    if (!managementUrl) {
      setSubscriptionActionStatus("Manage this subscription from your phone's app store.");
      return;
    }
    try {
      await Linking.openURL(managementUrl);
      setSubscriptionActionStatus("");
    } catch {
      setSubscriptionActionStatus("Unable to open subscription management. Try again from Google Play.");
    }
  }

  const loadWorkHours = useCallback(async () => {
    const [workHoursResult, periodResult] = await Promise.allSettled([
      loadSavedWorkHours(userId),
      loadReportPeriod(userId),
    ]);
    if (workHoursResult.status === "fulfilled") {
      const { settings } = workHoursResult.value;
      setCurrency(settings.currency);
      setRateBasis(settings.rateBasis);
      setBaseRate(formatRateAmount(settings.baseRateCents));
      setNormalStart(settings.normalWorkStartTime);
      setNormalEnd(settings.normalWorkEndTime);
      setOvertimeMultiplier(String(settings.overtimeMultiplier));
      setOffDayMultiplier(String(settings.offDayMultiplier));
      setHolidayMultiplier(String(settings.holidayMultiplier));
    }
    if (periodResult.status === "fulfilled") setReportPeriod(periodResult.value);
    const loadError = workHoursResult.status === "rejected"
      ? "Couldn't load pay rate. Try again."
      : periodResult.status === "rejected"
          ? "Couldn't load report period. Try again."
          : "";
    setWorkHoursStatus(loadError);
    paySettingsLoaded.current = workHoursResult.status === "fulfilled";
  }, [userId]);

  useEffect(() => {
    const initialLoad = setTimeout(() => void loadWorkHours(), 0);
    return () => clearTimeout(initialLoad);
  }, [loadWorkHours]);

  async function handleSaveWorkHours() {
    if (!paySettingsLoaded.current) return;
    try {
      const multiplier = Number.parseFloat(overtimeMultiplier);
      const offDayRate = Number.parseFloat(offDayMultiplier);
      const holidayRate = Number.parseFloat(holidayMultiplier);
      const settings = await saveWorkHours(userId, {
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
      setWorkHoursStatus("Saved");
    } catch (error) {
      setWorkHoursStatus(getPayRateSaveErrorMessage(error));
    }
  }

  useEffect(() => {
    if (!paySettingsLoaded.current) return;
    const timer = setTimeout(() => void handleSaveWorkHours(), 600);
    return () => clearTimeout(timer);
  }, [baseRate, currency, rateBasis]);

  return (
    <View style={styles.todayScreen}>
      {panel === "main" ? (
        <><View style={styles.todayHeader}><Text style={styles.todayTitle}>Settings</Text><Text style={styles.todayWordmark}>DISPUTE</Text></View><Pressable accessibilityRole="button" onPress={() => setPanel("name")} style={styles.settingsProfile}><View style={styles.settingsProfileAvatar}><Text style={styles.settingsProfileInitial}>{(account.name?.trim() || account.email || "W")[0].toUpperCase()}</Text></View><View style={styles.settingsRowContent}><Text style={styles.heading}>{account.name?.trim() || "Worker"}</Text>{account.email ? <Text numberOfLines={2} style={[styles.muted, styles.settingsProfileEmail]}>{account.email}</Text> : null}</View><Text style={styles.settingsChevron}>›</Text></Pressable></>
      ) : null}
      {panel !== "main" ? (
        <Pressable accessibilityRole="button" onPress={() => setPanel(panel === "delete_account" ? "privacy_data" : insideMore ? "more" : "main")} style={styles.settingsBackRow}>
          <Text style={styles.settingsBackText}>{panel === "delete_account" ? "‹ Privacy & data" : insideMore ? "‹ More" : "‹ Settings"}</Text>
        </Pressable>
      ) : null}
      {panel === "more" ? <Text style={styles.todayTitle}>More</Text> : null}
      {panel === "main" || panel === "more" ? (
        <View style={styles.settingsList}>
          {(panel === "main" ? mainRows : moreRows).map((item) => (
            <Pressable accessibilityRole="button" key={item.id} onPress={() => setPanel(item.id)} style={styles.settingsRow}>
              <View style={styles.todayIconTile}>
                <Image accessible={false} source={rowIcons[item.id as keyof typeof rowIcons]} style={styles.todayRowIcon} />
              </View>
              <View style={styles.settingsRowContent}>
                <Text style={styles.settingsRowLabel}>{item.label}</Text>
                <Text style={styles.settingsRowSubtitle}>{item.value}</Text>
              </View>
              <Text style={styles.settingsChevron}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {panel === "main" ? <Pressable accessibilityRole="button" onPress={onLogout} style={styles.settingsLogout}><Text style={styles.settingsLogoutText}>Log out</Text></Pressable> : null}
      {panel === "language" ? (
        <View style={styles.settingsSection}>
          <Text style={styles.todayTitle}>Language</Text>
          <Text style={styles.body}>English is the only language for now.</Text>
        </View>
      ) : null}
      {panel === "support" ? <PrivacyScreen supportOnly /> : null}
      {panel === "more" ? (
        <>
        </>
      ) : null}

      {panel === "name" ? (
        <ProfileSettingsPanel account={account} onLogout={onLogout} />
      ) : null}

      {panel === "pay_rate" ? (
        <View style={styles.settingsSection}>
          <Text style={styles.todayTitle}>Pay rate</Text>
          <Text style={styles.body}>
            Set your normal hours and rates. Overtime, off-day and holiday rates apply automatically.
          </Text>
          <Text style={styles.inputLabel}>Report period</Text>
          <Pressable testID="settings-report-period" accessibilityRole="button" style={styles.dropdownBox} onPress={() => setReportPeriodPickerOpen(true)}>
            <Text style={styles.dropdownValue}>{reportPeriod === "week" ? "This week" : "This month"}</Text>
            <Text style={styles.settingsDropdownChevron}>▼</Text>
          </Pressable>
          {reportPeriodPickerOpen ? <SwipeDownSheet backdropStyle={styles.projectSheetBackdrop} onClose={() => setReportPeriodPickerOpen(false)} sheetStyle={styles.projectSheet} testID="settings-report-period-sheet">
            <Text style={styles.heading}>Report period</Text>
            {(["week", "month"] as const).map((period) => <Pressable accessibilityRole="button" key={period} onPress={() => { setReportPeriod(period); setReportPeriodPickerOpen(false); void saveReportPeriod(userId, period).then(() => setWorkHoursStatus("Saved")).catch(() => setWorkHoursStatus("Couldn't save. Try again.")); }} style={period === reportPeriod ? styles.settingsDropdownOptionSelected : styles.dropdownOption} testID={`settings-report-period-${period}`}>
              <Text style={styles.body}>{period === "week" ? "This week" : "This month"}{period === reportPeriod ? " ✓" : ""}</Text>
            </Pressable>)}
          </SwipeDownSheet> : null}
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
              <Text style={styles.settingsDropdownChevron}>
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
                        selected ? styles.settingsDropdownOptionSelected : styles.dropdownOption
                      }
                    >
                      <Text style={styles.dropdownOptionText}>
                        {option.code} — {option.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
          <Text style={styles.inputLabel}>Paid by</Text>
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
              <Text style={styles.settingsDropdownChevron}>
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
                        selected ? styles.settingsDropdownOptionSelected : styles.dropdownOption
                      }
                    >
                      <Text style={styles.dropdownOptionText}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
          <Text style={styles.inputLabel}>
            {rateBasis === "monthly" ? "Monthly rate" : rateBasis === "hourly" ? "Hourly rate" : "Daily rate"} ({currency})
          </Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Base rate amount"
            testID="pay-rate-own-rate"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setBaseRate}
            onBlur={() => void handleSaveWorkHours()}
            placeholder={rateBasis === "monthly" ? "3000" : rateBasis === "hourly" ? "15" : "150"}
            style={styles.textInput}
            value={baseRate}
          />
          <Text style={styles.inputLabel}>Start time</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Normal work start time"
            inputMode="numeric"
            keyboardType="numbers-and-punctuation"
            onChangeText={setNormalStart}
            placeholder="08:00"
            style={styles.textInput}
            value={normalStart}
          />
          <Text style={styles.inputLabel}>End time</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Normal work end time"
            inputMode="numeric"
            keyboardType="numbers-and-punctuation"
            onChangeText={setNormalEnd}
            placeholder="17:00"
            style={styles.textInput}
            value={normalEnd}
          />
          <Text style={styles.inputLabel}>Overtime ×</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Overtime rate multiplier"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setOvertimeMultiplier}
            placeholder="1.5"
            style={styles.textInput}
            value={overtimeMultiplier}
          />
          <Text style={styles.inputLabel}>Off day ×</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Off day rate multiplier"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setOffDayMultiplier}
            placeholder="2"
            style={styles.textInput}
            value={offDayMultiplier}
          />
          <Text style={styles.inputLabel}>Public holiday ×</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Holiday rate multiplier"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setHolidayMultiplier}
            placeholder="2"
            style={styles.textInput}
            value={holidayMultiplier}
          />
          <Text style={styles.statusMessage}>{workHoursStatus}</Text>
        </View>
      ) : null}

      {panel === "plan" ? (
        <PlanBillingPanel
          subscription={subscription}
          action={subscriptionAction}
          actionStatus={subscriptionActionStatus}
          localizedStorePrice={storePrice}
          onManageSubscription={() => void handleManageSubscription()}
          onSubscribe={() => void handleSubscribe()}
          exportNote={exportNote}
        />
      ) : null}

      {panel === "backup" ? <SettingsBackupScreen account={account} exportOnly={!hasFullAccess} /> : null}

      {panel === "privacy_data" ? (
        <>
          <PrivacyScreen />
          <Pressable accessibilityRole="button" onPress={() => setPanel("delete_account")} style={styles.settingsRow}>
            <View style={styles.settingsRowContent}>
              <Text style={styles.settingsRowLabel}>Delete account</Text>
            </View>
            <Text style={styles.settingsChevron}>›</Text>
          </Pressable>
        </>
      ) : null}
      {panel === "delete_account" ? (
          <DeleteAccountScreen
            embedded
            account={account}
            onAccountDeleted={onAccountDeleted}
          />
      ) : null}
    </View>
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

const RATE_BASIS_OPTIONS: { id: AppSettings["rateBasis"]; label: string }[] = [
  { id: "hourly", label: "Hourly" },
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

function getPayRateSaveErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("Invalid app settings: ")) {
    const reason = message.slice("Invalid app settings: ".length)
      .replace("normalWorkEndTime must be different from normalWorkStartTime", "End time must differ from start time")
      .replace("dailyHours", "Daily hours")
      .replace("weeklyHours", "Weekly hours")
      .replace("overtimeMultiplier", "Overtime multiplier")
      .replace("offDayMultiplier", "Off-day multiplier")
      .replace("holidayMultiplier", "Holiday multiplier")
      .replace("baseRateCents", "Pay rate")
      .replace("normalWorkStartTime", "Start time")
      .replace("normalWorkEndTime", "End time")
      .replace("rateBasis", "Rate basis");
    return `Couldn't save pay rate: ${reason}`;
  }
  return "Couldn't save pay rate. Your phone storage didn't respond — reopen the app and try again.";
}
