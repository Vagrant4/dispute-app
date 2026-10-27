# DISPUTE (ClaimProof SG): simpler freelancer flow. PROPOSAL ONLY, NOT IMPLEMENTED

Prepared 27 Oct 2026 (SGT) for Shi Xiong, via CEO. This is for approval only. Nothing has been changed in the real code, nothing has been uploaded, and nothing has been published.

## 0. What was tested

| Item | Finding |
|---|---|
| Google Play listing | **Live and public.** https://play.google.com/store/apps/details?id=sg.claimproof.mobile&hl=en&gl=SG returns the listing "DISPUTE: Work Hours & Records". It was last updated 14 Oct 2026. Its "What's new" mentions the country picker and the phone-number validation. |
| Play track config (repo) | `mobile/eas.json` has `appVersionSource: remote` and `autoIncrement: true`. `submit.production.android.track` is set to `internal` (releaseStatus completed). The public listing shows the app is also on a production track. The local `app.json`/`build.gradle` versionCode (3) does not matter, because EAS sets the code remotely. |
| Installed from Play on the Fold3 | `sg.claimproof.mobile` 0.3.2, **versionCode 20**, installer `com.android.vending` (Google Play). Installed 8 Oct 2026 11:05 SGT. |
| Other copies on the phone (untouched) | `.qa20261014` (vc22) and `.qa20261014b` (vc23), both "0.3.2-country-report-qa", sideloaded 14 Oct. `.test` (vc3, redesign-qa, 10 Sep). `.sopkit` (vc3, 27 Oct). |
| Build used for this test | The Play copy (vc20, 8 Oct) is older than the latest code: the country picker from 14 Oct and the rate-report fix from 18 Oct are missing. So the latest code (box commit `9699122` = PC `task-3\dispute-reconcile`) was built as a debug-signed APK, **`sg.claimproof.mobile.latest`**, 0.3.2-latest-flowtest (vc3, arm64). It is installed side by side, and nothing was uninstalled. |
| Sign-up | The release build always calls the live server (`dispute-api-live.onrender.com`). To avoid creating a real account and sending email from the production SMTP, this test build adds one build-only module, `mobile/src/dev/flowTestMock.ts` (flag `EXPO_PUBLIC_FLOW_TEST_MOCK=1`). It answers register, verify, subscription status and sync locally. Every screen, field and tap is the real app. Only the server replies are simulated. Test identity: "Flow Test", flowtest@example.com, +65 8000 0000, code 123456. |
| GPS | Location services were OFF on the phone, so "Locate me" returned "Location unavailable". I did not change device settings. |
| Photo evidence | I opened the Evidence tab but took no photo, so nothing of your real surroundings was captured. Its tap count below is read from the UI and is not measured. |

## 1. Current flow map (measured on the Fold3 cover screen, 840×2289)

Screenshots are in `screens-before/` (numbers in brackets).

| # | Step / screen | Taps | Text fields | Scrolls | Notes |
|---|---|---|---|---|---|
| 1 | Launch the app icon → logo screen [01] | 1 | 0 | 0 | The only choices are Login or Create account. |
| 2 | Logo → Create account [02] | 1 | 0 | 0 | |
| 3 | Create account form [03, 04] | 6 (5 field focus + Create) | 5 (name, email, mobile, password, confirm) | 1 | Country defaults to SG. Referral code is optional. |
| 4 | Verify code [05] | 2 (+ ~2-3 to switch to Gmail and back) | 1 | 0 | You have to leave the app to fetch the code. |
| 5 | Home: create first project [06, 07, 10] | 3 (name, rate, Create Project) | 2 (name, hourly rate; description optional) | 0 | **The rate field shows a grey "25.00", but it is only a placeholder. Tapping Create without typing a rate fails silently. The error appears below the fold [08, 09].** |
| 6 | Scroll to Time In, then Time In [14] | 1 | 0 | 1-2 | Time In/Out sit under the project editor, location and day-type blocks, so they are not visible on first view. |
| | **Subtotal to first check-in** | **14** (+2-3 Gmail switch) | **8** | **2-3** | Using Locate me adds 2 taps (button + permission dialog) [11-13]. |
| 7 | Time Out [16, 17] | 1 | 0 | 1 | |
| 8 | Evidence photo (optional) [19] | ~6 (type chip, caption, Take photo, shutter, confirm, Save) | 1 | 0-1 | Estimated from the UI. |
| 9 | Export tab → Create PDF [20, 21] | 2 | 0 | 0 | The project is pre-selected only because there is one. |
| 10 | Scroll to file → Email / Share → target [23-25] | 2 | 0 | 1-2 | Download / View Report / Email-Share / Delete appear twice on the screen [21, 23]. |
| | **Total: install to pack shared (no photo)** | **19** (+Gmail switch) | **8** | **~5** | Each later day: scroll + Time In + scroll + Time Out = 2 taps + 2 scrolls. |

What I actually tapped during the test was 21. That includes the silent rate failure and one retry, plus the 2 taps on Locate me.

## 2. Pain points (ranked)
1. **You can't log any time before creating an account and verifying your email.** That is 5 fields, a confirm-password field and a trip to Gmail for the code, all before you see any value.
2. **Creating a project is required before Time In, and the rate field is a trap.** The rate looks pre-filled but isn't, and the failure message shows below the fold [08-09].
3. **The Time In/Out buttons are below the fold.** Home is a long form: project picker, project editor, location, three day-type buttons, then Time In/Out.
4. **Location is a separate manual step and fails quietly.** "Locate me" is its own tap. When GPS is off, the record silently reads "No location recorded" [24], which makes it weaker evidence.
5. **The Export flow is split up and repeated.** Create PDF and Email/Share are separate, the share button is buried in the Files list, and View/Download appear twice.
6. **The tab bar is cut off on the Fold3 cover screen.** "Settings" is clipped at the right edge [06, 26].
7. **Form clutter stays on screen after setup.** The "Edit project detail" form and three big day-type buttons are always shown, even though most people never change them.

## 3. Proposed flow (mockups in `screens-after/`)
- **Start without an account** [after 01]: "Start tracking" opens the Time screen straight away. Records are written under the existing local default owner (`DEFAULT_USER_ID`). Sign-up moves to the first export.
- **One-tap Time In from home** [after 02]: a big TIME IN button sits at the top. Its defaults are a project "Job 1 · <date>" (auto-created, rename by tapping the chip), day type Normal (chip), and GPS taken automatically at Time In. Android asks for location permission once, on the first Time In.
- **The same button becomes TIME OUT** [after 03], with "+ Add photo" and "+ Site note" quick actions. If there's no GPS, a yellow "No GPS – add site note" chip appears. Time In is never blocked.
- **A day summary with a "Share dispute pack" button** [after 04].
- **One-tap "Share dispute pack"** [after 05]: the latest project and "This week" are pre-selected. It builds the PDF and opens the share sheet in one tap, and still archives a copy. The hourly rate is optional and only nudged ("Add hourly rate to show pay").
- **A deferred sign-up sheet at the first export** [after 06]: email, mobile and password with an eye toggle (the confirm field is removed). The name moves to Settings. Mobile stays, because the server uses it for trial abuse control (`normalizeSignupProfile` in `server/src/modules/auth/auth.service.ts`).
- **The verify screen auto-submits** [after 07] on the 6th digit and has an "Open Gmail" button.
- **The tabs fit the screen**: 4 equal flex tabs, no horizontal scroller.

## 4. Before / after tap counts

| Step | Before taps / fields | After taps / fields |
|---|---|---|
| Launch → first Time In | **14 taps / 8 fields** (+Gmail switch, 2-3 scrolls) | **3 taps / 0 fields** (icon, Start tracking, TIME IN) + 1 one-time permission tap |
| Time Out | 1 + scroll | 1, no scroll |
| Each later day (In + Out) | 2 + ~2 scrolls | 2, no scroll |
| First export (incl. deferred sign-up) | 4 (sign-up already done) | 9 taps / 4 fields (Export, Share pack, 3 sign-up fields + Send code, 1 code field, share target) |
| Later exports | 4 + 1-2 scrolls | 3 (Export tab, Share pack, target) |
| **Total: install → first pack shared** | **19 taps / 8 fields / ~5 scrolls** | **13 taps / 4 fields / 0 scrolls** |

Time to first value drops from 14 taps and 8 fields to 3 taps and no fields. Sign-up is still needed to export.

## 5. Incremental code changes (latest code at commit 9699122; no rewrite)

| Area | File(s) | Change |
|---|---|---|
| Guest start | `mobile/App.tsx`, `mobile/src/screens/LogoScreen.tsx`, `mobile/src/auth/localAuth.ts`, `mobile/src/auth/localAuthStorageExpo.ts` | Add a "Start tracking" button that sets a guest `LocalAccount` (`id = DEFAULT_USER_ID`, `emailVerified:false`) and remembers it. Header text "On this phone · no account yet". (The SOP kit's `localTestSession.ts` is a working precedent.) |
| Guest → account data move | `mobile/src/db/localDataOwnership.ts` (`claimLegacyLocalDataForUser`), `VerifyEmailScreen.tsx` / `LoginScreen.tsx` | Already moves `DEFAULT_USER_ID` rows to the signed-in user. Call it right after verify/login and show "N records moved". |
| Entitlement for guests | `mobile/src/subscription/useSubscriptionAccess.ts`, `subscriptionClient.ts` (`hasCurrentFullAccess`, `canExportProgressClaim`) | Let a guest create local records. Export stays gated behind a verified account + trial/subscription. **Owner decision needed:** see caveats. |
| One-tap Time In | `mobile/src/screens/HomeScreen.tsx` (`handleClockIn`, render order), `mobile/src/work/projectDraft.ts` | Move a big In/Out toggle to the top. If there's no project, auto-create "Job 1 · <date>" (reuse `createClient` "Local Client" + `createProject`). Collapse the project editor and day type into chips or a bottom sheet. |
| Optional rate | `mobile/src/work/projectRates.ts` (`parseSgdHourlyRateCents` throws when empty), `workRepository.ts`, `mobile/src/db/schema.ts` | Allow a null/0 rate (a schema migration, or store 0 and label it "rate not set"). Report shows hours only plus a nudge. Check `mobile/src/reports/progressClaimSnapshot.ts`/`progressClaimHtml.ts` for null-rate handling. |
| Auto GPS | `mobile/src/work/workLocation.ts` (`getOptionalWorkLocationAddress`), `HomeScreen.tsx` | Call it inside `handleClockIn` (non-blocking, ~5 s timeout). Show the "No GPS" chip when it fails. Also record GPS at Time Out. |
| Inline errors | `HomeScreen.tsx` | Show validation next to the field or button instead of in the status card below the fold. |
| One-tap share pack | `mobile/src/screens/ProgressClaimReportsScreen.tsx` (`handleGenerate` → `handleShare`), `reports/reportSharingExpo.ts` | Add a "Share dispute pack" action: generate the PDF and pass it straight to share. Pre-select the latest project and a "This week" range. Merge the duplicated Download/View blocks. |
| Deferred sign-up | `mobile/src/screens/CreateAccountScreen.tsx`, `mobile/src/auth/remoteAuth.ts` (`validateRegistrationInput`), `server/src/modules/auth/auth.service.ts` (`normalizeSignupProfile`) | Show the form as a sheet from Export. Drop confirm-password (keep the eye toggle). Make the name optional: the server currently requires `fullName`, so either default it to the email's local part on the client or relax the server check. Keep the mobile number. |
| Verify UX | `mobile/src/screens/VerifyEmailScreen.tsx` | 6-box code input with auto-submit and an "Open Gmail" intent. |
| Tabs | `mobile/App.tsx` (tab `ScrollView`), `mobile/src/styles.ts` (`tabRow`, `tabButton`) | Equal-width flex tabs, so "Settings" isn't clipped on the 840-px cover screen. |
| Tests | `mobile/tests/*.test.js` | Guest gate, data move on verify, null rate, share-pack action, auto-project naming. |

## 6. Effort estimate (one developer with Codex, incremental)

| Work | Days |
|---|---|
| Guest start + data move + entitlement rule | 2.0 |
| Home one-tap toggle, auto project, chips, inline errors | 2.0 |
| Optional rate (migration + reports) | 1.0 |
| Auto GPS at In/Out + no-GPS chip | 0.5 |
| One-tap share pack + Export cleanup | 1.0 |
| Sign-up sheet, verify auto-submit, server name tweak | 1.0 |
| Tabs fit + Fold3 inner/cover QA | 0.5 |
| Tests, device run on the Fold3, Play internal-track build | 1.5 |
| **Total** | **~9.5 dev days (about 2 weeks)** |

Releasing would also need an EAS production build and a Play review. That needs your approval and is not included.

## 7. Caveats
- Sign-up, verification and subscription replies were **simulated in the test build only** (`src/dev/flowTestMock.ts`, flag-gated). The production backend wasn't contacted for auth, no account was created, and no email was sent.
- The GPS path wasn't exercised because location services were off on the phone. The photo-evidence tap count is estimated.
- **Guest mode is a business decision.** Today the 30-day trial starts at email verification, and the server controls who can create records. Letting guests create local records before sign-up gives free unlimited local logging, but export stays gated. The alternative is a 7-day local-only grace period.
- The Play-installed vc20 isn't the newest Play release. The listing shows a 14 Oct update, and Play hasn't updated the phone (or that release went to a different track). Play Console wasn't checked, because that needs your login.
- The share-sheet screenshot [25] has your phone's suggested contacts blurred. The unblurred originals are only on your PC (`Documents\Codex\2026-10-27\dispute-simplify\shots\`).
