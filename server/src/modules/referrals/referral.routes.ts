import { Router } from 'express';
import { requireUser } from '../../middleware/requireUser.js';
import { escapeHtml } from '../../utils/html.js';
import { getPublicReferral, getReferralSummary } from './referral.service.js';

export const referralRouter = Router();

referralRouter.get('/me', requireUser, async (req, res, next) => {
  try {
    res.json({ referral: await getReferralSummary(req.user!.id) });
  } catch (error) {
    next(error);
  }
});

referralRouter.get('/r/:code', async (req, res, next) => {
  try {
    const referral = await getPublicReferral(String(req.params.code ?? ''));
    if (!referral) {
      res.status(404).type('html').send(renderReferralPage(null));
      return;
    }
    res.type('html').send(renderReferralPage(referral));
  } catch (error) {
    next(error);
  }
});

function renderReferralPage(referral: { code: string; playUrl: string } | null): string {
  const title = referral ? 'Your DISPUTE invitation' : 'Referral not found';
  const body = referral
    ? `<p>Install DISPUTE, create your account and enter this referral code:</p>
       <div class="code">${escapeHtml(referral.code)}</div>
       <a href="${escapeHtml(referral.playUrl)}">Open DISPUTE in Google Play</a>`
    : '<p>This referral code is invalid or no longer available.</p>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>
body{margin:0;background:#050805;color:#f5fff0;font-family:Arial,sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}
section{max-width:520px;border:1px solid #263820;border-radius:28px;padding:32px;background:#0c120d}.brand{color:#9cff16;font-weight:800;margin-bottom:16px}
h1{font-size:34px;line-height:1.05;margin:0 0 16px}p{color:#b8c2b3;font-size:18px;line-height:1.5}.code{font-size:28px;font-weight:800;letter-spacing:.08em;margin:24px 0}
a{display:inline-block;background:#9cff16;color:#071000;text-decoration:none;font-weight:800;padding:16px 20px;border-radius:14px}</style></head>
<body><main><section><div class="brand">DISPUTE</div><h1>${escapeHtml(title)}</h1>${body}</section></main></body></html>`;
}
