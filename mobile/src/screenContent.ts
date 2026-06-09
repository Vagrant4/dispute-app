export const tabs = [
  { id: "home", label: "Home", title: "ClaimProof SG" },
  { id: "backup", label: "Backup", title: "Settings / Backup" },
  { id: "privacy", label: "Privacy", title: "Privacy Notice" },
  { id: "storage", label: "Storage", title: "Storage Diagnostics" },
  { id: "photos", label: "Photos", title: "Photo Evidence" },
  { id: "reports", label: "Reports", title: "Progress Claim Reports" },
  { id: "subscription", label: "Plan", title: "Subscription Status" },
  { id: "lock", label: "Lock", title: "Evidence Lock" },
] as const;

export type TabId = (typeof tabs)[number]["id"];

export const backupWarning =
  "ClaimProof SG stores records locally on this device. If you delete the app, change phone, or lose the device, your records may be lost unless you export or back them up.";

export const privacyContent = {
  heading: "Local-first in V1",
  body:
    "ClaimProof SG V1 is designed around local-first records. Work logs, " +
    "evidence notes, and status information are intended to stay on this " +
    "device unless you choose an export or backup action in a later phase.",
  analyticsHeading: "No analytics in V1",
  analyticsBody:
    "This mobile foundation does not include analytics, tracking SDKs, cloud " +
    "sync, or background evidence uploads.",
};

export const subscriptionContent = {
  heading: "Status unavailable",
  billingPath: "Billing path",
  noCheckout:
    "Billing is not active in this mobile foundation. No direct Stripe " +
    "checkout button is provided in the app.",
  policyGated:
    "Future billing access is policy-gated and will be handled through the " +
    "approved path for the product phase that enables subscriptions.",
};

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
  heading: "Capture evidence for a project",
  body:
    "Use camera or gallery photos as local evidence for work progress, defects, " +
    "deliveries, variations, and completed work. Saving a photo evidence row " +
    "requires a project.",
  permissionDenied:
    "Photo permission was not granted. ClaimProof SG can still keep existing " +
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
  heading: "Generate progress claim reports",
  body:
    "Create PDF or CSV progress claim files from local profile, client, project, time, pay, and photo evidence records when available.",
  localStorage:
    "Generated documents are archived locally on this device. Use manual share/export when you need to send a file.",
  noUpload:
    "ClaimProof SG does not upload reports, email them automatically, or claim legal or MOM compliance.",
};
