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
import { styles } from "../styles";
import { getSubscriptionManagementUrl } from "../subscription/subscriptionClient";

type DeleteAccountScreenProps = {
  account: LocalAccount;
  onAccountDeleted: (message: string) => void;
};

export function DeleteAccountScreen({
  account,
  onAccountDeleted,
}: DeleteAccountScreenProps) {
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
        `Your server account was deleted. Clear DISPUTE app storage in phone Settings to finish local cleanup. Request ID: ${result.requestId}`,
      );
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Danger zone</Text>
      <Text style={styles.heading}>Delete account and data</Text>
      <Text style={styles.body}>
        Permanently deletes {account.email}, projects, time entries, locations,
        evidence, reports and login tokens. This cannot be recovered.
      </Text>
      <View style={styles.deletionWarningCard}>
        <Text style={styles.warningText}>
          Deleting DISPUTE does not cancel an active Google Play or App Store
          subscription. Manage the subscription separately before deletion.
        </Text>
      </View>
      <Pressable
        accessibilityRole="link"
        disabled={deleting}
        onPress={() => void openSubscriptionManagement()}
        style={styles.actionButtonSecondary}
      >
        <Text style={styles.actionButtonSecondaryText}>Manage subscription</Text>
      </Pressable>
      <Text style={styles.inputLabel}>Current password</Text>
      <TextInput
        accessibilityLabel="Account deletion current password"
        autoCapitalize="none"
        editable={!deleting}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.textInput}
        value={password}
      />
      <Text style={styles.inputLabel}>Type {ACCOUNT_DELETION_CONFIRMATION} to confirm</Text>
      <TextInput
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
          style={styles.dangerButtonSecondary}
        >
          <Text style={styles.dangerButtonSecondaryText}>Review permanent deletion</Text>
        </Pressable>
      ) : (
        <View style={styles.deletionWarningCard}>
          <Text style={styles.warningText}>
            Final confirmation: delete this account and all associated data now.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: deleting }}
            disabled={deleting}
            onPress={() => void permanentlyDeleteAccount()}
            style={styles.dangerButton}
          >
            <Text style={styles.dangerButtonText}>
              {deleting ? "Deleting permanently..." : "Delete account permanently"}
            </Text>
          </Pressable>
        </View>
      )}
      <Text style={styles.statusMessage}>{status}</Text>
    </View>
  );
}
