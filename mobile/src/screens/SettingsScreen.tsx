import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, Text, TextInput, View } from "react-native";

import type { LocalAccount } from "../auth/localAuth";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../db/settingsValidation";
import { saveWorkHours, loadWorkHours as loadSavedWorkHours, calculateNormalHours } from "../work/workHoursSettings";
import { styles, theme } from "../styles";
import { DeleteAccountScreen } from "./DeleteAccountScreen";
import { PlanBillingPanel } from "./PlanBillingPanel";
import { PrivacyScreen } from "./PrivacyScreen";
import { ProfileSettingsPanel } from "./ProfileSettingsPanel";
import { ReferralScreen } from "./ReferralScreen";
import { SettingsBackupScreen } from "./SettingsBackupScreen";
import {
  formatTrialCountdown,
  getSubscriptionManagementUrl,
  getSubscriptionSettingsAction,
  purchaseDisputeBasicSubscription,
} from "../subscription/subscriptionClient";
import { useSubscriptionAccess } from "../subscription/useSubscriptionAccess";
import { useDisputeBasicStorePrice } from "../subscription/useDisputeBasicStorePrice";
import { isTrialDebugOverrideEnabled, rewriteGuestTrial } from "../subscription/guestTrial";
import { getDisputePackBillingNote } from "../subscription/recordAccess";

type SettingsScreenProps = {
  account: LocalAccount;
  onLogout: () => void;
  onAccountDeleted: (message: string) => void;
  initialPanel?: SettingPanel;
};

export type SettingPanel = "profile" | "work_hours" | "subscription" | "referrals" | "privacy_data";

type SettingsPage = "main" | "name" | "pay_rate" | "language" | "plan" | "support" | "more" | "referrals" | "privacy_data" | "backup";

const INITIAL_PANEL_PAGES: Record<SettingPanel, SettingsPage> = {
  profile: "name",
  work_hours: "pay_rate",
  subscription: "plan",
  referrals: "referrals",
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
  const [subscriptionActionStatus, setSubscriptionActionStatus] = useState("");
  const {
    subscription,
    canCreateRecords: hasFullAccess,
    refresh: loadSubscriptionStatus,
  } = useSubscriptionAccess(account);
  const storePrice = useDisputeBasicStorePrice(account);
  const subscriptionAction = getSubscriptionSettingsAction(subscription);
  const exportNote = getDisputePackBillingNote(account.isGuest === true, subscriptionAction, subscription?.trialEndsAt ?? null);

  useEffect(() => {
    setPanel(initialPanel ? INITIAL_PANEL_PAGES[initialPanel] : "main");
  }, [initialPanel]);

  const mainRows: { id: SettingsPage; label: string; value: string }[] = [
    { id: "name", label: "Name", value: account.name?.trim() || "Not set" },
    { id: "pay_rate", label: "Pay rate", value: Number(baseRate) > 0 ? `${currency} ${baseRate} / ${rateBasis === "monthly" ? "month" : "day"}` : "Not set" },
    { id: "language", label: "Language", value: "English" },
    { id: "plan", label: "Plan", value: subscription?.status === "TRIALING" ? `Free trial · ${formatTrialCountdown(subscription)}` : subscription?.planName || "Checking plan…" },
    { id: "support", label: "Support", value: "Help and policies" },
    { id: "more", label: "More", value: "Referrals, privacy, backup" },
  ];
  const moreRows: { id: SettingsPage; label: string; value: string }[] = [
    { id: "referrals", label: "Refer a friend", value: "Invite another worker" },
    { id: "privacy_data", label: "Privacy & data", value: "Your privacy and account" },
    { id: "backup", label: "Keep a copy", value: "Save or restore your records" },
  ];
  const insideMore = panel === "referrals" || panel === "privacy_data" || panel === "backup";

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
    try {
      const { settings } = await loadSavedWorkHours(userId);
      setCurrency(settings.currency);
      setRateBasis(settings.rateBasis);
      setBaseRate(formatRateAmount(settings.baseRateCents));
      setNormalStart(settings.normalWorkStartTime);
      setNormalEnd(settings.normalWorkEndTime);
      setOvertimeMultiplier(String(settings.overtimeMultiplier));
      setOffDayMultiplier(String(settings.offDayMultiplier));
      setHolidayMultiplier(String(settings.holidayMultiplier));
      setWorkHoursStatus("");
    } catch (error) {
      setWorkHoursStatus(getErrorMessage(error));
    }
  }, [userId]);

  useEffect(() => {
    const initialLoad = setTimeout(() => void loadWorkHours(), 0);
    return () => clearTimeout(initialLoad);
  }, [loadWorkHours]);

  async function handleSaveWorkHours() {
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
      setWorkHoursStatus(getErrorMessage(error));
    }
  }

  return (
    <>
      {panel === "main" ? <Text style={styles.screenTitle}>Settings</Text> : null}
      {panel !== "main" ? (
        <Pressable accessibilityRole="button" onPress={() => setPanel(insideMore ? "more" : "main")} style={styles.settingsBackRow}>
          <Text style={styles.settingsRowLabel}>{insideMore ? "‹ More" : "‹ Settings"}</Text>
        </Pressable>
      ) : null}
      {panel === "main" || panel === "more" ? (
        <View style={styles.settingsList}>
          {panel === "more" ? <Text style={styles.heading}>More</Text> : null}
          {(panel === "main" ? mainRows : moreRows).map((item) => (
            <Pressable accessibilityRole="button" key={item.id} onPress={() => setPanel(item.id)} style={styles.settingsRow}>
              <View style={styles.settingsRowContent}>
                <Text style={styles.settingsRowLabel}>{item.label}</Text>
                <Text style={styles.muted}>{item.value}</Text>
              </View>
              <Text style={styles.settingsChevron}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {panel === "language" ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Language</Text>
          <Text style={styles.body}>English is the only language for now.</Text>
        </View>
      ) : null}
      {panel === "support" ? <PrivacyScreen supportOnly /> : null}
      {panel === "more" ? (
        <>
        {isTrialDebugOverrideEnabled() && account.isGuest ? (
          <View style={[styles.card, styles.warningCard]}>
            <Text style={styles.rowLabel}>Debug: trial clock</Text>
            {[["Set trial start to 31 days ago", 31], ["Set trial start to 25 days ago", 25], ["Reset to now", 0]].map(([label, days]) => (
              <Pressable key={String(label)} accessibilityRole="button" onPress={() => void rewriteGuestTrial(Date.now() - Number(days) * 86400000).then(loadSubscriptionStatus)} style={styles.actionButtonSecondary}>
                <Text style={styles.actionButtonSecondaryText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        </>
      ) : null}

      {panel === "name" ? (
        <ProfileSettingsPanel account={account} onLogout={onLogout} />
      ) : null}

      {panel === "pay_rate" ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Pay rate</Text>
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
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Base rate amount"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setBaseRate}
            placeholder={rateBasis === "monthly" ? "3000" : "150"}
            style={styles.textInput}
            value={baseRate}
          />
          <Text style={styles.inputLabel}>Normal start (HH:MM)</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Normal work start time"
            inputMode="numeric"
            keyboardType="numbers-and-punctuation"
            onChangeText={setNormalStart}
            placeholder="08:00"
            style={styles.textInput}
            value={normalStart}
          />
          <Text style={styles.inputLabel}>Normal end (HH:MM)</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Normal work end time"
            inputMode="numeric"
            keyboardType="numbers-and-punctuation"
            onChangeText={setNormalEnd}
            placeholder="17:00"
            style={styles.textInput}
            value={normalEnd}
          />
          <Text style={styles.inputLabel}>OT rate multiplier</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Overtime rate multiplier"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setOvertimeMultiplier}
            placeholder="1.5"
            style={styles.textInput}
            value={overtimeMultiplier}
          />
          <Text style={styles.inputLabel}>Off day rate multiplier</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
            accessibilityLabel="Off day rate multiplier"
            inputMode="decimal"
            keyboardType="decimal-pad"
            onChangeText={setOffDayMultiplier}
            placeholder="2"
            style={styles.textInput}
            value={offDayMultiplier}
          />
          <Text style={styles.inputLabel}>Holiday rate multiplier</Text>
          <TextInput placeholderTextColor={theme.colors.placeholder}
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
            <Text style={styles.actionButtonText}>Save</Text>
          </Pressable>
          <Text style={styles.statusMessage}>{workHoursStatus}</Text>
        </View>
      ) : null}

      {panel === "plan" ? (
        <PlanBillingPanel
          action={subscriptionAction}
          actionStatus={subscriptionActionStatus}
          localizedStorePrice={storePrice}
          onManageSubscription={() => void handleManageSubscription()}
          onSubscribe={() => void handleSubscribe()}
          exportNote={exportNote}
        />
      ) : null}

      {panel === "referrals" ? <ReferralScreen /> : null}

      {panel === "backup" ? <SettingsBackupScreen account={account} exportOnly={!hasFullAccess} /> : null}

      {panel === "privacy_data" ? (
        <>
          <PrivacyScreen />
          <DeleteAccountScreen
            embedded
            account={account}
            onAccountDeleted={onAccountDeleted}
          />
        </>
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

const RATE_BASIS_OPTIONS: { id: AppSettings["rateBasis"]; label: string }[] = [
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

function getErrorMessage(error: unknown): string {
  return "Something went wrong. Please try again.";
}
