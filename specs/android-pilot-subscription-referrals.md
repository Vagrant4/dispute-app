# Android pilot subscription and referrals

## Approved commercial flow

- A verified account receives a three-day DISPUTE trial without entering payment details.
- During the trial, the user can create work records, capture evidence and export premium PDF/CSV reports.
- The app must not initiate a store purchase or charge during the trial.
- After the trial, the user may subscribe to DISPUTE Basic through Google Play for the store-localized equivalent of S$6.99 per month.
- A canceled subscription keeps full access until the paid period ends.
- After entitlement expiry, existing local records remain readable and a basic JSON backup remains available. New work/evidence capture and premium PDF/CSV export require an active trial, subscription or fulfilled referral reward.

## Approved referral pilot

- Every account receives a unique referral code and HTTPS share link.
- A new user may enter a referral code during account creation. Attribution is locked on the server and activates only after email verification.
- Re-attribution and duplicate verified phone use are rejected. Other suspected self-referrals remain subject to manual reward review; the pilot does not claim identity-proof fraud detection.
- A referral qualifies after two distinct paid subscription periods are received from the store webhook.
- Five qualified referrals earn one reward month.
- Reward issuance is recorded on the server. Store billing must not be falsified or bypassed; fulfillment remains pending until a Google Play-compliant reward mechanism is connected.

## Pilot product claims

- Work evidence is described as dated and traceable, not tamper-proof or tamper-aware.
- Work records are local-first and are not represented as cloud-synced.
- The pilot is English-first. Other languages are roadmap items, not current capabilities.

## Out of scope for this change

- Google Play Console, RevenueCat or App Store configuration changes.
- A production build, upload or release.
- Price changes in live store dashboards.
- Automatic Google Play billing deferral for referral rewards.
