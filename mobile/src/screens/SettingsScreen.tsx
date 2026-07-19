import { useEffect, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

import type { LocalAccount } from "../auth/localAuth";
import { DEFAULT_APP_SETTINGS } from "../db/settingsValidation";
import { subscriptionContent } from "../screenContent";
import { styles } from "../styles";

type SettingsScreenProps = {
  account: LocalAccount;
  onLogout: () => void;
};

type SettingPanel = "profile" | "work_hours" | "subscription";
const subscriptionMode: "trial" | "active" = "trial";

export function SettingsScreen({ account, onLogout }: SettingsScreenProps) {
  const [panel, setPanel] = useState<SettingPanel>("profile");
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email);
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

  const options: Array<{ id: SettingPanel; label: string }> = [
    { id: "profile", label: "Profile" },
    { id: "work_hours", label: "Work hours" },
    { id: "subscription", label: "Subscription" },
  ];

  useEffect(() => {
    void loadWorkHours();
  }, []);

  async function loadWorkHours() {
    if (Platform.OS === "web") {
      return;
    }
    try {
      const repositories = await getNativeRepositories();
      const settings = await repositories.settings.getSettings();
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
      setNormalStart(settings.normalWorkStartTime);
      setNormalEnd(settings.normalWorkEndTime);
      setOvertimeMultiplier(String(settings.overtimeMultiplier));
      setOffDayMultiplier(String(settings.offDayMultiplier));
      setHolidayMultiplier(String(settings.holidayMultiplier));
      setWorkHoursStatus(
        `Saved. OT ${settings.overtimeMultiplier}x, off day ${settings.offDayMultiplier}x, holiday ${settings.holidayMultiplier}x.`,
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
          <Text style={styles.muted}>Trial mode. No payment collected.</Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>Trial</Text>
              <Text style={styles.metricLabel}>current plan</Text>
            </View>
            <View style={styles.metricTile}>
              <Text style={styles.metricValue}>Off</Text>
              <Text style={styles.metricLabel}>auto-renew</Text>
            </View>
          </View>
          {subscriptionMode === "trial" ? (
            <Pressable accessibilityRole="button" style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Subscribe</Text>
              <Text style={styles.actionButtonSubtext}>Appears during trial mode</Text>
            </Pressable>
          ) : null}
          <Text style={styles.muted}>{subscriptionContent.noCheckout}</Text>
        </View>
      ) : null}
    </>
  );
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Work hours action failed.";
}
