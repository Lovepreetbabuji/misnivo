# Bugs and structural issues — with status

Findings raised by Gemini, each then checked against the code by Claude before
being acted on. **The status line is what matters** — the description below it is
the original report and is left as written.

Status meanings:

| | |
|---|---|
| **FIXED** | changed and verified against the live app |
| **NOT REAL** | checked and the problem is not present in this project |
| **KNOWN** | real, already understood, deliberately not fixed yet — reason given |
| **OPEN** | real, not fixed, needs a decision or work |

**Summary: 8 fixed · 2 not real · 3 known · 4 open**

*#14 App Check is DONE — enforced on Firestore and Authentication 24 Aug 2026,
and verified against the live site afterwards. AI Logic is the last switch.*

---

### 1. Client-Side Wallet Manipulation (CRITICAL)
> **KNOWN — needs a server, not a rule.** Real, and already written up at the top
> of `firestore.rules`. The wallet moved into `users/{uid}/private/main`, so it is
> no longer public, and `WALLET_ENABLED = false` has the whole feature paused —
> but the owner can still write their own balance, and no rule can tell a
> genuine debit from an invented one. Only a server knows what the balance
> should be. Waiting on Cloud Functions, which needs the Blaze plan.

- **File**: `firestore.rules`, `js/app.js`
- **Issue**: The `wallet.balance` is updated directly from the client.
- **Risk**: A user can set their wallet balance to any amount.
- **Fix**: Move financial logic to Cloud Functions.

### 2. Race Conditions on Views and Likes (MODERATE)
> **KNOWN — a documented trade-off.** The `stepped()` guard exists precisely
> because the alternative is letting anyone write `likeCount = 1000000`. Under
> heavy concurrency some counts will be lost; that is accepted until there is a
> server. The note is already in `firestore.rules`.

- **Issue**: Counters incremented directly by the client can collide.
- **Fix**: Distributed counters or Cloud Functions.

### 3. Dare/Mission Reward Modification (HIGH)
> **FIXED.** A mission's terms freeze the moment anyone accepts it. After that
> the creator may only touch the keys running a live mission needs
> (`approvedTakers`, `takers`, `proofCount`, `completed`, `refunded`, likes) —
> not the reward, not the task. The app refuses to open the edit form on a taken
> mission and says why, so nobody meets a silent failure.

### 4. Over-reliance on Client-side Rule Enforcement (MODERATE)
> **OPEN — but no specific instance was named.** Every critical transition found
> so far *is* enforced server-side: submitting proof, judging it, editing a
> taken mission, banning. If a particular flow is only guarded in the UI, point
> at it and it gets fixed.

### 5. Potential XSS / DOM Manipulation (LOW/MODERATE)
> **NOT REAL as described.** Checked the path named: comments render through
> `escHtml`, so user text is escaped before it reaches the DOM. Worth re-checking
> whenever a new surface starts printing user text.

### 6. Scam Vulnerability: Creator Deleting Proofs (CRITICAL)
> **FIXED.** This was the most serious finding. `posterId` could delete a proof,
> so a creator could ask for a video, wait for it, then delete it rather than
> pay — and it walked around the one-way judgement, since a deleted proof has no
> verdict at all. Only the taker who filmed it, or an admin, can delete now.
> Nothing in the app ever called proof delete, so the permission was open with
> no feature behind it.

### 7. Creators Cannot Moderate Comments (MODERATE)
> **FIXED.** A creator could pin a comment on their own mission but not delete
> it — so an abusive comment could not be removed by the person it was aimed at.
> Delete now uses the same ownership test the pin rule already used.

### 8. Counters Exploit: takers and proofCount (HIGH)
> **FIXED.** Both keys were in the public counter whitelist, but `steppedAll()`
> only ever checked `likeCount`, `dislikeCount` and `viewCount`. Anyone signed in
> could write `takers: 1000000` on any mission. Step-checked explicitly on that
> branch — not inside `steppedAll()`, which `/proofs` shares and where neither
> field exists. Verified live: `takers: 999999` returns `permission-denied`
> while a normal `+1` still succeeds.

### 9. Hijacking Applicant Documents (MODERATE)
> **FIXED.** `allow update: if isDareOwner()` had no field restriction, so a
> mission owner could rewrite an applicant's whole record including the `uid` it
> belongs to. Limited to `status`, which is the only field the app writes there.

### 10. Missing `type="button"` on Interactive Elements (LOW/UI)
> **NOT REAL today — no `<form>` exists in `index.html`.** A `<button>` only
> defaults to `submit` inside a form, and there are zero. Worth remembering if a
> real form is ever added; not worth touching 150 tags for a hypothetical.

### 11. Missing Data Type and Size Validation (HIGH)
> **FIXED.** This one mattered because `users/{uid}` and `dares` are
> world-readable: a 1 MB bio is downloaded by everyone who opens that profile and
> billed to the project each time. A shared `textOk()` helper now caps `name`
> (100), `username` (40), `bio` (300), `website` (300), `photoURL` (800), and
> mission `caption`/`title` (200) and `description` (4000), on create and on
> edit. Verified live: a 50,000-character bio and a 20,000-character mission are
> both refused, while a normal profile edit still succeeds.

### 12. Missing Client-Side Input Constraints (LOW/UI)
> **FIXED.** `maxlength` added to every box whose contents are stored: the post
> form's caption (120) and description (2000), sign-up name, KYC and bank fields,
> website, tag input, and the reject and report reasons. Sliders, the read-only
> date wheels and the search boxes are deliberately left alone — nothing is
> written from them.

### 13. Bypassable Client-Side Feature Flags (MODERATE)
> **KNOWN — same root cause as #1.** Flipping `WALLET_ENABLED` in the console
> only unhides UI; the exposure underneath is that the owner may write their own
> wallet document, which is #1 and needs a server. Note that `wallet` is not in
> the public `users` update whitelist — it lives in the owner-only private
> drawer — so this is not an open door for anyone *else*.

### 14. No Rate Limiting / API Abuse Protection (CRITICAL)
> **FIXED — enforced 24 Aug 2026.** Cloud Firestore and Authentication are both
> Enforced in the Console, and the live site was re-tested afterwards in a real
> browser window on a brand-new profile: a signed-out visitor still reads the
> feed, a brand-new person still signs up, a signed-in person still writes, the
> AI safety filter still blocks, 0 page errors.
>
> **A headless browser is now refused, and that is the feature working.** The
> test harness started getting `403` on the App Check token exchange and
> `auth/firebase-app-check-token-is-invalid` on sign-up the moment enforcement
> went on — reCAPTCHA Enterprise scores an automated browser as a bot and will
> not mint it a token. Any future test that needs to write must run with
> `headless:false`. Do not read that 403 as the app being broken; check a real
> window before concluding anything.

**As reported:**
- **File**: `js/app.js`, Firebase project config
- **Issue**: The app lacks Firebase App Check. Because it talks to Firestore and
  Auth directly from the browser, there is no rate limiting on document creation
  or sign-ups.
- **Risk**: A script can spam 10,000 sign-ups, or 10,000 missions/comments.
  Firebase will not fall over — it scales — but every write and every auth email
  is billed. Scraping the data is trivial too.
- **Fix**: Implement App Check (reCAPTCHA v3) and enforce it in the Console.
  Move high-volume writes into Cloud Functions for per-user limits.

**DECIDED 2026-08-21: reCAPTCHA Enterprise.** Cloudflare Turnstile was
considered and ruled out — App Check has no built-in Turnstile provider, so it
would need a custom provider, which needs a server, which needs Blaze, which is
the very thing blocked. Enterprise over classic v3 because its free tier applies
to projects **without billing enabled**, so no card is needed, and Firebase
recommends it for new integrations.

**Setup — steps 1-3 are the owner's, step 4 is code**

1. **Create the key** at the Google Cloud reCAPTCHA page
   (`console.cloud.google.com/security/recaptcha`). Enable the API if asked.
   Create a **Web** key. Leave **"Use checkbox challenge" UNSELECTED** — the
   score-based kind is invisible, and a checkbox in front of every visitor is
   not what this is for.
   Domains: `daremarket.pages.dev`. Add any custom domain later, when there is
   one. **Do not add localhost to this key** — that is what the separate debug
   token is for.
   The page then shows a **site key**. That is public and belongs in the code.
2. **Firebase Console → Security → App Check → Apps** → register the web app
   with the reCAPTCHA Enterprise provider → paste **that same site key**.
   Enterprise needs only the site key here. (Classic v3 is the one that wants a
   secret key — different provider, different flow.)
3. **Leave enforcement OFF.** The Console shows how much traffic arrives with a
   valid token. Enforcing before the new client has reached everyone logs real
   people out mid-session.
4. **Code** — this project is on the Firebase **compat** SDK 9.22.2, so the
   documented `initializeAppCheck` import does not apply. It needs
   `firebase-app-check-compat.js` beside the other script tags in
   `index.html`, then after `firebase.initializeApp`:
   `firebase.appCheck().activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(SITE_KEY), true)`.
   About ten lines. Blocked only on the site key from step 1.
5. **Then enforce**, once almost all traffic carries a token.

**Two Firebase apps, two App Checks.** The safety filter runs on a SECOND
Firebase app (`initializeApp(config, 'ai')`, modular 12.10.0). App Check is per
app instance, so the compat activation does not cover it and it needed its own.
Firebase makes App Check enforcement REQUIRED for AI Logic on **2 November
2026** — without this the filter would have started failing that day, and it
fails closed, so every mission would have been refused. Done and verified.

**AI Logic is safe to enforce.** Watched on the wire in a real browser, 24 Aug
2026: both `generateContent` POSTs carry a 965-character `X-Firebase-AppCheck`
header. The third request in the trace is the CORS `OPTIONS` preflight, which by
specification never carries custom headers and is not what enforcement checks —
it is not a gap. The Console shows no percentage for AI Logic because that row
had received no traffic yet, so the wire is the evidence, not the table.

**Watch this later:** the free tier is 10,000 assessments a calendar month
across the whole organisation. Past that, with billing still off, requests come
back 429 rather than being charged — and with enforcement ON that means real
users are locked out. Roughly one assessment per person per day, so ~330 daily
users. Miles away today; worth a look at the Console once the app has an
audience.

Per-user rate limits on top of this still need Cloud Functions, and so still
need Blaze. App Check alone stops the scripted-abuse case and is worth doing on
its own.

### 15. Unbounded Queries in Admin Dashboard (HIGH)
> **OPEN — new finding.**

- **File**: `js/app.js` (Lines 1721, 1872)
- **Issue**: Admin panels fetch entire collections into memory (`db.collection('dares').get()`, `users`, `proofs`, etc. without a `limit()` or pagination).
- **Risk**: As the platform scales, downloading 100,000 users or dares at once will crash the browser tab (OOM), cause massive Firestore read billing spikes, and take a long time to load.
- **Fix**: Implement pagination for admin views or use server-side aggregation for stats.

### 16. Missing Feed Pagination (MODERATE)
> **OPEN — new finding.**

- **File**: `js/app.js` (Line 2276)
- **Issue**: The main feed for dares hardcodes a `limit(60)`: `db.collection('dares').orderBy('createdAt', 'desc').limit(60)`. There is no "Load More" button or infinite scrolling logic.
- **Risk**: If there are 1,000 dares on the platform, 940 of them are permanently inaccessible from the main feed. Users can only see the 60 newest ones.
- **Fix**: Implement Firestore cursor pagination (`startAfter(lastVisible)`) combined with a "Load More" button or Intersection Observer.

### 17. Unauthenticated Cloudinary Uploads (HIGH)
> **OPEN — new finding.**

- **File**: `js/app.js` (Line 886)
- **Issue**: Image and video uploads use Cloudinary's unsigned uploads via a public upload preset (`missionbook`) and cloud name.
- **Risk**: Any malicious user who inspects the frontend code can extract the cloud name and upload preset. They can then write a script to upload thousands of junk files directly to Cloudinary, exhausting your storage limits and running up your Cloudinary bill.
- **Fix**: Use signed uploads. Move the upload signing logic to a Firebase Cloud Function, so the client must authenticate with Firebase before receiving a temporary signature to upload.

---

## Still open, in the order they are worth doing

1. **#14 App Check** — the only one that can cost real money today.
2. **#1 / #13 wallet on the server** — blocked on the Blaze plan.
3. **#4** — needs a specific flow named before anything can be done.
