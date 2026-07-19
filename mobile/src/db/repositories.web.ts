/**
 * Metro resolves this module for browser previews so native Expo SQLite is not
 * pulled into the web bundle. Screens use dedicated localStorage adapters on web.
 */
export async function getLocalRepositories(): Promise<never> {
  throw new Error(
    "Native SQLite repositories are unavailable in the browser preview. Use the app on Android or iOS for device storage features.",
  );
}

export function resetLocalRepositoriesForTest(): void {
  // Browser preview uses dedicated in-memory/localStorage adapters.
}
