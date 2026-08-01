import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Linking, Platform, Pressable, Text, TextInput, View } from "react-native";

import {
  cancelPendingAccountDeletion,
  clearDeletedAccountLocalData,
  markAccountDeletionPending,
  markServerAccountDeleted,
} from "../account/accountDeletionExpo";
import type { LocalAccount } from "../auth/localAuth";
import { deleteRemoteAccount } from "../auth/remoteAuth";
import { styles } from "../styles";

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
  const [status, setStatus] = useState(
    "Deletion is permanent and cannot be undone.",
  );

  async function openSubscriptionManagement() {
    const url = Platform.OS === "ios"
      ? "https://apps.apple.com/account/subscriptions"
      : "https://play.google.com/store/account/subscriptions?sku=dispute_basic_monthly&package=sg.claimproof.mobile";
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
    if (confirmation !== "DELETE") {
      setStatus("Type DELETE exactly to continue.");
      return;
    }
    setFinalConfirmationVisible(true);
    setStatus("Review the final warning, then confirm permanent deletion.");
  }

  async function permanentlyDeleteAccount() {
    const requestId = Crypto.randomUUID();
    setDeleting(true);
    setStatus("Permanently deleting account and data...");
    await markAccountDeletionPending(requestId);
    const result = await deleteRemoteAccount({
      password,
      confirmation,
      requestId,
    });
    if (!result.ok) {
      await cancelPendingAccountDeletion();
      setDeleting(false);
      setStatus(result.message);
      return;
    }

    await markServerAccountDeleted(result.requestId);
    try {
      await clearDeletedAccountLocalData();
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
      <Text style={styles.inputLabel}>Type DELETE to confirm</Text>
      <TextInput
        accessibilityLabel="Type DELETE to confirm account deletion"
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
