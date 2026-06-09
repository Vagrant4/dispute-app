import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { getLocalRepositories } from "../db/repositories";
import type { RepositoryHealth } from "../db/settingsRepository";
import { styles } from "../styles";

export function StorageDiagnosticsScreen() {
  const [health, setHealth] = useState<RepositoryHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadHealth() {
      try {
        const repositories = await getLocalRepositories();
        const nextHealth = await repositories.getHealth();
        if (mounted) {
          setHealth(nextHealth);
          setError(null);
        }
      } catch (nextError) {
        if (mounted) {
          setError(nextError instanceof Error ? nextError.message : "Unknown error");
        }
      }
    }

    void loadHealth();

    return () => {
      mounted = false;
    };
  }, []);

  const rows = [
    ["Storage engine", "Expo SQLite"],
    ["Local database", error ? "Unavailable" : health ? "Ready" : "Checking"],
    ["Settings rows", health ? String(health.settingsCount) : "-"],
    [
      "Generated documents",
      health ? String(health.generatedDocumentsCount) : "-",
    ],
    ["Cloud sync", "Disabled"],
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Diagnostics</Text>
      <Text style={styles.heading}>Storage status</Text>
      <Text style={styles.body}>
        This screen checks the local SQLite repository used for mobile-only
        ClaimProof SG records.
      </Text>
      {error ? <Text style={styles.muted}>{error}</Text> : null}

      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowValue}>{value}</Text>
        </View>
      ))}
    </View>
  );
}
