import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import {
  createEvidenceLock,
  verifyEvidenceLock,
  type EvidenceLock,
} from "../evidence/evidenceLock";
import { evidenceLockStates } from "../screenContent";
import { styles } from "../styles";

const sampleEvidenceRecord = {
  id: "sample-time-entry",
  projectId: "demo-project",
  workDate: "2026-06-09",
  activity: "Installed kitchen cabinet frames",
  durationMinutes: 180,
};

const sampleLockedAt = "2026-06-09T09:00:00.000Z";

export function EvidenceLockScreen() {
  const [sampleLock, setSampleLock] = useState<EvidenceLock | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function buildSampleLock() {
      const lock = await createEvidenceLock(sampleEvidenceRecord, sampleLockedAt);
      const isVerified = await verifyEvidenceLock(sampleEvidenceRecord, lock.hash);

      if (!cancelled) {
        setSampleLock(lock);
        setVerified(isVerified);
      }
    }

    buildSampleLock().catch(() => {
      if (!cancelled) {
        setVerified(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Evidence Lock</Text>
        <Text style={styles.heading}>Sample locked record</Text>
        <Text style={styles.body}>
          This mobile utility creates a canonical evidence snapshot, a SHA-256
          hash, and a locked timestamp for local records.
        </Text>
        <Text style={styles.codePreview}>
          {sampleLock?.hash ?? "Generating sample evidence hash..."}
        </Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Locked at</Text>
          <Text style={styles.rowValue}>{sampleLock?.lockedAt ?? "Pending"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Verification</Text>
          <Text style={styles.rowValue}>
            {verified === null ? "Pending" : verified ? "Verified" : "Failed"}
          </Text>
        </View>
      </View>

      {evidenceLockStates.map((state) => (
        <View key={state.title} style={styles.card}>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{state.title}</Text>
          </View>
          <Text style={styles.body}>{state.description}</Text>
        </View>
      ))}
    </>
  );
}
