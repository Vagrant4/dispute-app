# Account deletion and privacy compliance

## Approved behavior

- Deletion is immediate and permanent.
- The user must enter the current password and type `DELETE` before a final confirmation.
- Deletion is not blocked by an active store subscription. The app warns the user and links to store subscription management.
- DISPUTE retains only an anonymous deletion request ID, deletion timestamp, and storage-cleanup status.
- No name, email, phone number, project, evidence, report, or location is retained in the deletion receipt.

## Implemented paths

- Authenticated mobile API: `DELETE /auth/account`
- Public privacy policy: `GET /privacy`
- Public web deletion form: `GET /account-deletion`
- Public credential-confirmed deletion: `POST /account-deletion`
- Mobile Settings path: **Settings > Privacy & data > Delete account and data**

## Deleted data

Server deletion removes the user and all Prisma relations configured with cascade deletion, including profile, verification/reset tokens, settings, companies, projects, time entries, photo metadata, pay summaries, reports, and subscriptions. User-specific server upload/export directories are staged before the database transaction and then removed.

Before local server deletion, the backend deletes the matching RevenueCat customer through RevenueCat's REST API. Production fails closed if `REVENUECAT_SECRET_API_KEY` is missing or RevenueCat does not confirm deletion. This secret is server-only.

Mobile cleanup removes local SQLite work data, subscription entitlements, saved login data in SecureStore, the local account file, evidence photos, generated documents, and backups. A SecureStore marker resumes cleanup after a crash when the server deletion already completed.

## External deployment requirements

1. Set `SUPPORT_EMAIL` on the production server to the public support address approved for the Play listing.
2. Set the server-only `REVENUECAT_SECRET_API_KEY`; never expose it as an `EXPO_PUBLIC` or mobile variable.
3. Deploy the migration `20260801090000_account_deletion_receipts` with the server release.
4. Verify the live HTTPS URLs return `200`:
   - `https://dispute-api-live.onrender.com/privacy`
   - `https://dispute-api-live.onrender.com/account-deletion`
5. Enter the same privacy and account-deletion URLs in Google Play Console.
6. Test deletion once with a disposable Internal Testing account and confirm RevenueCat, server data, local data, and session access are removed.

## Safety notes

- The web form is rate-limited and requires the current email and password.
- Production cookies remain HTTP-only, secure, and SameSite Lax.
- Store subscription cancellation remains controlled by Google Play or Apple; account deletion does not cancel it automatically.
- No RevenueCat secret, Google service-account credential, signing key, or password belongs in the mobile app or repository.
