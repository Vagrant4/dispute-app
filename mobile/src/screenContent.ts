export const tabs = [
  { id: "home", label: "Today", title: "Today" },
  { id: "evidence", label: "Photos", title: "Photos" },
  { id: "reports", label: "Projects", title: "Projects" },
  { id: "settings", label: "Settings", title: "Settings" },
] as const;

export type TabId = (typeof tabs)[number]["id"];

export const backupWarning =
  "Your records are kept on this phone. Save a copy before you change phone or delete the app.";

export const privacyContent = {
  heading: "Local-first work evidence",
  body:
    "DISPUTE stores account and subscription status securely on the server. " +
    "Work logs, evidence photos, location details and generated reports stay " +
    "on this device unless you choose to export, back up or share them.",
  analyticsHeading: "No advertising trackers",
  analyticsBody:
    "The current mobile release does not include advertising trackers, cloud " +
    "work-record sync or background evidence uploads. Google Play and our payment partner " +
    "handle your subscription.",
};

export const subscriptionContent = {
  heading: "30-day trial",
  billingPath: "DISPUTE Basic",
  noCheckout:
    "New users receive a 30-day no-card trial starting when they verify their email. No payment method is required. No charge starts automatically. After the trial, choose whether to subscribe to create new records and export premium PDF and CSV reports. Existing records remain readable.",
  expiredExport:
    "Trial ended. You can still see your records and save a copy. Subscribe to add new records or share reports.",
  checking:
    "Checking subscription status before export.",
};

export const photoEvidenceContent = {
  heading: "Photoshoot evidence",
  body:
    "Take a photo or choose one from the gallery. Attach it to the current project " +
    "so the claim has simple visual proof.",
  permissionDenied:
    "Photo permission was not granted. dispute can still keep existing " +
    "records, and you can enable camera or gallery access later in device settings.",
  localStorageBody:
    "Photos stay on your phone unless you share them.",
  gpsOptional:
    "GPS is optional. If location access is denied or unavailable, photo evidence " +
    "can still be saved without coordinates. Coordinates are not a verification " +
    "or authenticity claim.",
};

export const progressClaimReportContent = {
  heading: "Export claim",
  body:
    "Create a PDF claim from your time records and evidence. Use Share to send it when ready.",
  localStorage:
    "Reports are saved on your phone. Share sends them to any app.",
  noUpload:
    "dispute does not upload reports automatically. You choose when to email or share a file.",
};
