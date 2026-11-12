import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { escapeHtml } from '../../utils/html.js';
import { ACCOUNT_DELETION_CONFIRMATION } from '../auth/accountDeletion.constants.js';
import {
  deleteAccountWithCredentials,
  getAccountDeletionStatus
} from '../auth/accountDeletion.service.js';
import { AuthServiceError } from '../auth/auth.service.js';

export const complianceRouter = Router();

const deletionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  message: 'Too many deletion attempts. Wait 15 minutes and try again.'
});

complianceRouter.get('/privacy', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.type('html').send(renderPrivacyPolicy());
});

complianceRouter.get('/account-deletion', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('html').send(renderAccountDeletionForm(randomUUID()));
});

complianceRouter.get('/account-deletion/status/:requestId', deletionLimiter, async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try {
    const result = await getAccountDeletionStatus(String(req.params.requestId ?? ''));
    if (!result) {
      res.status(404).json({ deleted: false });
      return;
    }
    res.json({
      deleted: true,
      requestId: result.requestId,
      deletedAt: result.deletedAt,
      storageCleanupComplete: result.storageCleanupComplete
    });
  } catch (error) {
    next(error);
  }
});

complianceRouter.post('/account-deletion', deletionLimiter, async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const requestId = String(req.body?.requestId ?? '');
  if (String(req.body?.confirmation ?? '') !== ACCOUNT_DELETION_CONFIRMATION) {
    res.status(400).type('html').send(renderResultPage(
        'Not deleted yet',
        `Type ${ACCOUNT_DELETION_CONFIRMATION} exactly as shown to confirm.`
    ));
    return;
  }

  try {
    const result = await deleteAccountWithCredentials({
      email: String(req.body?.email ?? ''),
      password: String(req.body?.password ?? ''),
      requestId
    });
    res.type('html').send(renderResultPage(
      'Account deleted',
      result.storageCleanupComplete
          ? `Your DISPUTE account has been deleted. Records saved on your phone stay there until you clear DISPUTE's storage in your phone settings or uninstall DISPUTE. Request number: ${result.requestId}`
          : `Your account has been deleted. We're still clearing some files. Keep this request number in case you need help: ${result.requestId}`
    ));
  } catch (error) {
    if (error instanceof AuthServiceError && error.statusCode === 401) {
      res.status(401).type('html').send(renderResultPage(
          'Not deleted',
          'The email or password is wrong. Nothing was deleted.'
      ));
      return;
    }
    next(error);
  }
});

function renderPrivacyPolicy(): string {
  const contact = env.supportEmail
    ? `<a href="mailto:${escapeHtml(env.supportEmail)}">${escapeHtml(env.supportEmail)}</a>`
    : 'the support contact shown on the Google Play listing';

  return renderCompliancePage('Privacy Policy', `
    <p class="effective">Effective 1 August 2026</p>
    <p>DISPUTE is a work-evidence application published by Vagrant4. This policy explains how the app handles personal data.</p>
    <h2>Data processed</h2>
    <ul>
      <li>Account data: name, email address, mobile number, password hash, verification status and account timestamps.</li>
      <li>Subscription data: plan, trial and entitlement status, store product identifiers and provider subscription identifiers.</li>
      <li>Referral data: referral code, referring account, paid-period qualification count and earned reward status. A normalized mobile number is used to limit duplicate-account abuse.</li>
      <li>Work evidence: projects, time entries, optional location information, photos and generated reports are stored locally on the device by the current mobile release unless the user explicitly exports, backs up or shares them.</li>
    </ul>
    <h2>Why data is used</h2>
    <p>Data is used to create and secure accounts, verify email, restore access, provide subscriptions, operate the referral pilot, generate user-requested evidence and reports, and prevent abuse.</p>
    <h2>Service providers</h2>
    <p>Email delivery providers process verification and password-reset email. Google Play and RevenueCat process subscription and entitlement information. DISPUTE does not sell personal data. When a DISPUTE account is deleted, the server requests deletion of the matching RevenueCat customer profile.</p>
    <h2>Retention and deletion</h2>
    <p>Account data remains while the account is active. Users can permanently delete their account in Settings or through the <a href="/account-deletion">web deletion page</a>. Deletion removes associated server data and app-owned local data. DISPUTE retains only a random deletion request ID, deletion timestamp and storage-cleanup status. These records contain no name, email, phone, evidence or location data. Google Play and RevenueCat may retain transaction records under their own legal obligations.</p>
    <h2>User choices</h2>
    <p>Camera, photo-library and location permissions are requested only when their related features are used. Location is optional. Users choose when to export, back up, email or share files.</p>
    <h2>Security and contact</h2>
    <p>DISPUTE uses HTTPS for production network traffic, hashed passwords and restricted app storage. No system is perfectly secure. Questions or privacy requests can be sent to ${contact}.</p>
  `);
}

function renderAccountDeletionForm(requestId: string): string {
  return renderCompliancePage('Delete your DISPUTE account', `
      <p>Use this page to delete your DISPUTE account if you can't use the app.</p>
      <div class="warning"><strong>This can't be undone.</strong> We will delete your DISPUTE account and everything DISPUTE keeps for it: your profile, sign-in details, plan and referral details. You can't get them back.</div>
      <p><strong>Records on your phone.</strong> Your projects, time entries, places, photos and reports are saved only on your phone. A web request can't reach your phone. To remove them, clear DISPUTE's storage in your phone settings, or uninstall DISPUTE. Copies you saved or shared elsewhere are not removed.</p>
      <p><strong>What we keep.</strong> We keep a short record with no personal details showing that a deletion was asked for: a request number, the time, and whether clean-up finished. Google Play or our payment partner may keep their own payment records.</p>
      <p>Deleting your account does not cancel a Google Play subscription. Cancel it first in <a href="https://play.google.com/store/account/subscriptions">Manage Google Play subscriptions</a>.</p>
    <form method="post" action="/account-deletion">
      <input type="hidden" name="requestId" value="${escapeHtml(requestId)}" />
      <label>Email<input autocomplete="email" inputmode="email" name="email" required type="email" /></label>
        <label>Password<input autocomplete="current-password" name="password" required type="password" /></label>
        <label>Type ${ACCOUNT_DELETION_CONFIRMATION} to confirm<input autocomplete="off" name="confirmation" pattern="${ACCOUNT_DELETION_CONFIRMATION}" required /></label>
        <button style="background:#D93F44;color:#fff" type="submit">Delete my account</button>
    </form>
      <p class="small">Forgot your password? Reset it in the DISPUTE app first. Read our <a href="/privacy">Privacy Policy</a>.</p>
  `);
}

function renderResultPage(title: string, message: string): string {
  return renderCompliancePage(title, `<p>${escapeHtml(message)}</p><p><a href="/account-deletion">Return to account deletion</a></p>`);
}

function renderCompliancePage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} | DISPUTE</title>
<style>
body{margin:0;background:#050805;color:#f5fff0;font-family:Arial,sans-serif}main{max-width:720px;margin:auto;padding:32px 20px 64px}.brand{color:#9cff16;font-weight:900;letter-spacing:.04em}h1{font-size:40px;line-height:1.05}h2{margin-top:30px}p,li,label{color:#c4cec0;font-size:17px;line-height:1.55}a{color:#9cff16}form{display:grid;gap:18px;margin-top:24px}label{display:grid;gap:7px;font-weight:700}input{background:#0c120d;border:1px solid #34452e;border-radius:12px;color:#fff;font-size:17px;padding:14px}button{background:#9cff16;border:0;border-radius:14px;color:#071000;font-size:17px;font-weight:900;padding:16px}.warning{background:#2a1c0a;border:1px solid #7a5420;border-radius:14px;color:#ffd27a;padding:16px;line-height:1.5}.effective,.small{font-size:14px;color:#9da898}
</style></head><body><main><div class="brand">DISPUTE</div><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`;
}
