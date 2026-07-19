export const tabs = [
  { id: "home", label: "Time", title: "Time in / out" },
  { id: "evidence", label: "Evidence", title: "Evidence" },
  { id: "reports", label: "Export", title: "Export" },
  { id: "settings", label: "Settings", title: "Settings" },
] as const;

export type TabId = (typeof tabs)[number]["id"];

export const backupWarning =
  "dispute stores records locally on this device. If you delete the app, change phone, or lose the device, your records may be lost unless you export or back them up.";

export const privacyContent = {
  heading: "Local-first in V1",
  body:
    "dispute V1 is designed around local-first records. Work logs, " +
    "evidence notes, and status information are intended to stay on this " +
    "device unless you choose an export or backup action in a later phase.",
  analyticsHeading: "No analytics in V1",
  analyticsBody:
    "This mobile foundation does not include analytics, tracking SDKs, cloud " +
    "sync, or background evidence uploads.",
};

export const subscriptionContent = {
  heading: "Foundation only",
  billingPath: "Future billing path",
  noCheckout:
    "dispute subscription billing is not active in V1. No payment is collected in this app. No Stripe checkout is available in the mobile app.",
  policyGated:
    "Pricing will be decided after the real-user trial. Future mobile digital subscriptions are policy-gated and must use an approved App Store or Google Play path unless policy and legal review confirms another allowed strategy.",
};

export const trialReadinessContent = {
  heading: "Real user trial before Stripe",
  warning:
    "V1 is for a 2-week trial with 5 freelancers, 3 subcontractors, and 2 site supervisors before subscription work.",
  backupReminder:
    "Export a backup before uninstalling, changing phone, clearing app data, or relying on important records.",
  localOnly:
    "Records stay local unless you export, back up, or share them. There is no cloud sync, analytics, account collection, or backend upload in this trial.",
  goals: [
    "Validate clock in/out and manual time entries.",
    "Check photo evidence quality, notes, and optional GPS denial.",
    "Generate and share PDF/CSV progress claim reports.",
    "Confirm pay summary and evidence lock are useful for disputes.",
  ],
  checklist: [
    "Create realistic projects and clients.",
    "Log daily time and project activity.",
    "Capture photo evidence with useful notes.",
    "Generate weekly PDF and CSV reports.",
    "Back up important records before device changes.",
  ],
  privacy:
    "Do not enter real FIN/NRIC unless comfortable. Use realistic non-sensitive names where possible.",
  limitations:
    "Known limits: no CPF/MOM automation, employer approval, cloud backup, subscription enforcement, GPS verification, Work Permit tracking, OCR, or photo analysis.",
} as const;

export const evidenceLockStates = [
  {
    title: "Draft",
    description: "The record can still be edited before it is used as evidence.",
  },
  {
    title: "Finalized",
    description: "The record is marked complete and ready for claim reporting.",
  },
  {
    title: "Locked",
    description: "The record is protected from later edits for dispute support.",
  },
] as const;

export const photoEvidenceContent = {
  heading: "Photoshoot evidence",
  body:
    "Take a photo or choose one from the gallery. Attach it to the current project " +
    "so the claim has simple visual proof.",
  permissionDenied:
    "Photo permission was not granted. dispute can still keep existing " +
    "records, and you can enable camera or gallery access later in device settings.",
  localStorageBody:
    "Photos imported here are copied into app-owned local storage when the " +
    "device runtime supports it. They are not uploaded or shared from this phase.",
  gpsOptional:
    "GPS is optional. If location access is denied or unavailable, photo evidence " +
    "can still be saved without coordinates. Coordinates are not a verification " +
    "or authenticity claim.",
};

export const progressClaimReportContent = {
  heading: "Export claim",
  body:
    "Create a PDF claim from your time records and evidence. Use Email / Share to send it when ready.",
  localStorage:
    "Generated PDF files are saved locally on this device. Email / Share opens your phone sharing options.",
  noUpload:
    "dispute does not upload reports automatically. You choose when to email or share a file.",
};
