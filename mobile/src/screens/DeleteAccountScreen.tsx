import * as Crypto from "expo-crypto";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, Text, TextInput, View } from "react-native";

import {
  cancelPendingAccountDeletion,
  clearDeletedAccountLocalData,
  getPendingAccountDeletion,
  markAccountDeletionPending,
  markServerAccountDeleted,
} from "../account/accountDeletionExpo";
import type { LocalAccount } from "../auth/localAuth";
import {
  ACCOUNT_DELETION_CONFIRMATION,
  deleteRemoteAccount,
} from "../auth/remoteAuth";
import { styles, theme } from "../styles";
import { getSubscriptionManagementUrl } from "../subscription/subscriptionClient";

type DeleteAccountScreenProps = {
  account: LocalAccount;
  onAccountDeleted: (message: string) => void;
  embedded?: boolean;
};

export function DeleteAccountScreen({
  account,
  onAccountDeleted,
  embedded = false,
}: DeleteAccountScreenProps) {
  const isGuest = account.isGuest === true || !account.email.trim();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [finalConfirmationVisible, setFinalConfirmationVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletionSubmissionStarted = useRef(false);
  const [status, setStatus] = useState(
    "Deletion is permanent and cannot be undone.",
  );

  useEffect(() => {
    void getPendingAccountDeletion().then((pending) => {
      if (!pending) return;
      deletionSubmissionStarted.current = true;
      setDeleting(true);
      setStatus(
        "A previous deletion response was interrupted. Close and reopen DISPUTE to confirm deletion status and finish cleanup.",
      );
    });
  }, []);

  async function openSubscriptionManagement() {
    const url = getSubscriptionManagementUrl(Platform.OS);
    if (!url) {
      setStatus("Open your phone store and manage subscriptions before deletion.");
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      setStatus("Store subscription management opened.");
    } else {
      setStatus("Open your phone store and manage subscriptions before deletion.");
    }
  }

  function reviewDeletion() {
    if (!password) {
      setStatus("Enter your current password.");
      return;
    }
    if (confirmation !== ACCOUNT_DELETION_CONFIRMATION) {
      setStatus(`Type ${ACCOUNT_DELETION_CONFIRMATION} exactly to continue.`);
      return;
    }
    setFinalConfirmationVisible(true);
    setStatus("Review the final warning, then confirm permanent deletion.");
  }

  async function permanentlyDeleteAccount() {
    if (deletionSubmissionStarted.current) {
      setStatus(
        "A deletion request is already pending. Close and reopen DISPUTE to confirm its status.",
      );
      return;
    }
    deletionSubmissionStarted.current = true;
    const existing = await getPendingAccountDeletion();
    if (existing) {
      setDeleting(true);
      setStatus(
        "A previous deletion response was interrupted. Close and reopen DISPUTE to confirm deletion status and finish cleanup.",
      );
      return;
    }
    const generatedRequestId = Crypto.randomUUID();
    setDeleting(true);
    setStatus("Permanently deleting account and data...");
    const userId = account.id ?? account.email.trim().toLowerCase();
    const requestId = await markAccountDeletionPending({
      requestId: generatedRequestId,
      userId,
      email: account.email,
    });
    const result = await deleteRemoteAccount({
      password,
      confirmation,
      requestId,
    });
    if (!result.ok) {
      if (!result.outcomeUncertain) {
        await cancelPendingAccountDeletion();
        deletionSubmissionStarted.current = false;
        setDeleting(false);
      }
      setStatus(result.message);
      return;
    }

    await markServerAccountDeleted(result.requestId);
    try {
      await clearDeletedAccountLocalData({ userId, email: account.email });
      onAccountDeleted(result.message);
    } catch {
      onAccountDeleted(
        `Your account was deleted. Clear DISPUTE app storage in phone Settings to finish clearing this phone. Request ID: ${result.requestId}`,
      );
    }
  }

  return (
    <View style={embedded ? styles.settingsSection : styles.card}>
      <Text style={styles.todayTitle}>Delete account</Text>
      <Text style={styles.body}>
        {isGuest
          ? "You are using DISPUTE without an account. This form needs a signed-in account and password. To remove guest projects, time entries, places, photos, reports and settings from this phone, clear DISPUTE storage in phone Settings. You cannot get them back. Copies you saved or shared elsewhere are not removed."
          : `Permanently deletes the account for ${account.email}, projects, time entries, places, evidence, reports and saved sign-in access. This removes the account data DISPUTE keeps and its data on this phone. You cannot get it back.`}
      </Text>
      {!isGuest ? <Text style={styles.body}>
        DISPUTE keeps a short record with no personal details that a deletion was asked for: a request number, the time, and whether clean-up finished. Google Play or our payment partner may keep their own payment records.
      </Text> : null}
      <View style={embedded ? styles.settingsSection : styles.deletionWarningCard}>
        <Text style={styles.warningText}>
          Deleting DISPUTE does not cancel an active Google Play or App Store
          subscription. Manage it separately before deletion.
        </Text>
      </View>
      <Pressable
        accessibilityRole="link"
        disabled={deleting}
        onPress={() => void openSubscriptionManagement()}
        style={[styles.actionButtonSecondary, (deleting) && styles.disabledButton]}
      >
        <Text style={[styles.actionButtonSecondaryText, (deleting) && styles.disabledButtonText]}>Manage subscription</Text>
      </Pressable>
      <Text style={styles.inputLabel}>Current password</Text>
      <TextInput placeholderTextColor={theme.colors.placeholder}
        accessibilityLabel="Account deletion current password"
        autoCapitalize="none"
        editable={!deleting}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.textInput}
        value={password}
      />
      <Text style={styles.inputLabel}>Type {ACCOUNT_DELETION_CONFIRMATION} to confirm</Text>
      <TextInput placeholderTextColor={theme.colors.placeholder}
        accessibilityLabel={`Type ${ACCOUNT_DELETION_CONFIRMATION} to confirm account deletion`}
        autoCapitalize="characters"
        editable={!deleting}
        onChangeText={(value) => {
          setConfirmation(value);
          setFinalConfirmationVisible(false);
        }}
        style={styles.textInput}
        value={confirmation}
      />
      {!finalConfirmationVisible ? (
        <Pressable
          accessibilityRole="button"
          disabled={deleting}
          onPress={reviewDeletion}
          style={[styles.dangerButtonSecondary, (deleting) && styles.disabledButton]}
        >
          <Text style={[styles.dangerButtonSecondaryText, (deleting) && styles.disabledButtonText]}>Review permanent deletion</Text>
        </Pressable>
      ) : (
        <View style={embedded ? styles.settingsSection : styles.deletionWarningCard}>
          <Text style={styles.warningText}>
            Final confirmation: delete this account and all associated data now.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: deleting }}
            disabled={deleting}
            onPress={() => void permanentlyDeleteAccount()}
            style={[styles.accountDeletionConfirmButton, (deleting) && styles.disabledButton]}
          >
            <Text style={[styles.accountDeletionConfirmButtonText, (deleting) && styles.disabledButtonText]}>
              {deleting ? "Deleting permanently..." : "Delete account permanently"}
            </Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.statusMessage}>{status}</Text>
    </View>
  );
}
