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

**Summary: 11 fixed · 2 not real · 3 known · 2 open**

*#14 App Check is DONE — Firestore, Authentication and AI Logic all enforced
and verified live, 24-25 Aug 2026. The 2 Nov 2026 deadline is met early.*

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

**AI Logic is ENFORCED, 25 Aug 2026 — the 2 Nov deadline is met early.**
Enforcing it is not on the `⋮` menu the way it is for the other rows: open the
AI Logic row, then the **Set up** button under the graph → *Baseline protection*
→ **Enforced** → *Replay protection* → **Disabled**. Replay protection must stay
Disabled: it requires limited-use tokens, which this client does not mint, and
it burns the free assessment quota far faster.

Verified live in a real browser with all three enforced: the model starts, a
NORMAL mission is allowed, a harmful one is still blocked, Google answers 200 on
every call, and a real mission was created end to end and deleted again.
Checking that a *good* mission still passes is the test that matters — the
filter fails closed, so a broken token refuses everything, not nothing.

Beware the Console's "invalid" percentage while testing: the 20% AI Logic showed
before enforcement was 2 requests out of 10, and all 10 were from this project's
own test runs — the 2 were the headless ones. No real user was ever refused.

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
> **FIXED, with a stated limit.** Real. The Stats tab downloaded every user,
> mission, proof, safety block and report purely to read `.size` off each
> snapshot, and the Users tab downloaded every mission and every proof on top
> of that so each row could say "3 missions · 1 proof". Every one of them is
> capped now, and the two per-user numbers moved into the Details panel where
> they are counted for one person on demand.
>
> **Firestore's `count()` aggregation is not available here and that is worth
> knowing.** It was the obvious fix and it was written first — then the live
> site was opened in a real browser and every count came back through the error
> path, because on the Firebase **compat** SDK 9.22.2 that `index.html` loads,
> `Query.count` is simply undefined. The Stats tab rendered a row of em-dashes.
> Reading the code would never have shown this; opening the panel did.
> So counting still means reading documents, and `_countUpTo` puts a ceiling on
> it: at most cap+1 read, and the answer shows as "1000+" at the ceiling rather
> than a wrong exact number. Past the cap the figure is not true, and the
> comment in the code says so. An exact count at scale needs a newer Firebase
> SDK or a server keeping running totals.
>
> Verified live on `20260825b`: 8 Users · 4 Missions · 0 Proofs read correctly
> as a guest, the admin-only collections showed "—" (guest cannot read them,
> which is the rules working), and a deliberately tiny cap returned "1+".
> **Not verified: the panel as a real admin.** Nobody is known to hold the
> `admin: true` claim, so the tabs behind it were exercised by calling the
> function directly, not by opening the panel.

- **File**: `js/app.js` (Lines 1721, 1872)
- **Issue**: Admin panels fetch entire collections into memory (`db.collection('dares').get()`, `users`, `proofs`, etc. without a `limit()` or pagination).
- **Risk**: As the platform scales, downloading 100,000 users or dares at once will crash the browser tab (OOM), cause massive Firestore read billing spikes, and take a long time to load.
- **Fix**: Implement pagination for admin views or use server-side aggregation for stats.

### 16. Missing Feed Pagination (MODERATE)
> **FIXED.** Real: the `limit(60)` was a wall, not a page. The listener now
> starts at 60 and grows a page at a time behind a **Load older missions**
> button. The same live listener is widened rather than a second paged query
> being added, because everything downstream reads the one `dares` array and a
> second one would have to be merged and kept live by hand.
>
> The button also renders in the **empty** state, which is the case that would
> otherwise strand people: if all 60 newest missions happen to be finished or
> expired, the page says "No Active Missions" while live ones sit just outside
> the window, and without a button there is no way to reach them.
>
> Verified live on `20260825b` in a real browser: forced down to a one-mission
> window it reported that more existed, showed the button, and pressing it
> brought the rest in; with everything shown the button disappears.

- **File**: `js/app.js` (Line 2276)
- **Issue**: The main feed for dares hardcodes a `limit(60)`: `db.collection('dares').orderBy('createdAt', 'desc').limit(60)`. There is no "Load More" button or infinite scrolling logic.
- **Risk**: If there are 1,000 dares on the platform, 940 of them are permanently inaccessible from the main feed. Users can only see the 60 newest ones.
- **Fix**: Implement Firestore cursor pagination (`startAfter(lastVisible)`) combined with a "Load More" button or Intersection Observer.

### 17. Unauthenticated Cloudinary Uploads (HIGH)
> **STILL OPEN — narrowed, not closed.** Real, and the finding stands exactly
> as written: the cloud name and the unsigned preset are both in `js/app.js`,
> anyone can read them, and nothing in the browser can stop a script that skips
> the app and posts to Cloudinary directly. **Only a signed upload closes this**
> — a Cloud Function handing out a short-lived signature — and that needs the
> Blaze plan, the same blocker as #1.
>
> What was done is smaller and should not be mistaken for the fix: size and
> type are now checked **inside `uploadToCloudinary`**, not only at each file
> picker, so no call site can skip them and no oversized file leaves the app by
> accident. Verified live: a 6MB image and a 101MB video are both refused with
> the limit named, a PDF is refused, and a valid file still reaches the request.
>
> **The owner's console screenshots (25 Aug) narrow this further than the code
> could.** Two account-level facts, neither of them in the preset screen, which
> is why the max-file-size setting could not be found there:
>
> - **Allowed formats is set on the preset**: `mp4,mov,webm,jpg,jpeg,png`.
>   Anything else — zip, exe, svg, pdf — is refused by Cloudinary itself, not
>   by the app, so it holds even for a script that skips the app entirely.
> - **The plan already caps file size**, shown under *Settings → Account →
>   Usage Limits*: image **10 MB**, video **100 MB**, raw **10 MB**. Cloudinary
>   enforces these; no upload can exceed them by any route. The app's own caps
>   (5 MB image, 100 MB video) sit inside them, so the two agree.
>
> What is left of this finding after all that: someone can still upload **many
> valid, correctly-sized media files** using the preset name out of `app.js`.
> Each one is bounded, the storage is not. That is the part only a signed
> upload closes.
>
> ⚠️ **Watch the format list against real phones.** The mission thumbnail and
> the proof thumbnail both go through a canvas and come out jpg/png, so they
> are safe whatever the person picked. The **profile photo is uploaded exactly
> as picked** (`onProfilePhotoSelected` stores the raw File), so an Android
> `.webp` or an `.heic` that reaches the browser un-converted would now be
> refused by Cloudinary — a real user hitting a wall, not an attacker.
> `webp,heic,heif` are worth adding to the list, or the profile photo needs the
> same canvas conversion the thumbnails already get.

- **File**: `js/app.js` (Line 886)
- **Issue**: Image and video uploads use Cloudinary's unsigned uploads via a public upload preset (`missionbook`) and cloud name.
- **Risk**: Any malicious user who inspects the frontend code can extract the cloud name and upload preset. They can then write a script to upload thousands of junk files directly to Cloudinary, exhausting your storage limits and running up your Cloudinary bill.
- **Fix**: Use signed uploads. Move the upload signing logic to a Firebase Cloud Function, so the client must authenticate with Firebase before receiving a temporary signature to upload.

### 18. The same unbounded reads on the path every visitor walks (HIGH)
> **FIXED — found while checking #15, not reported by anyone.**

#15 was written about the admin dashboard. The identical mistake was sitting in
the code every single visitor runs, which makes it the worse of the two: an
admin panel is opened twice a year, the home feed is opened every time anyone
starts the app.

- **File**: `js/app.js` — the home feed loader, `_ensureProofsLoaded`, the
  leaderboard, the comment recount, the follower/following counts, and the
  applicant's completed-mission count.
- **Issue**: `db.collection('proofs').where('status','==','approved').get()` —
  no `limit()`. Every approved video in the database, downloaded on every app
  open, and again for the leaderboard and the profile Videos tab. The comment
  recount pulled every comment on a video after each new comment posted, to
  learn one number. Follower counts pulled every follow row of the account to
  print two numbers.
- **Fix applied**: capped — 300 for the shared video pool, 500 for the
  leaderboard, 500 for the comment recount, 1000 for follows.

Two things said plainly:

- **The caps are deliberately NOT ordered.** Proofs carry `createdAtMs`, but
  older ones may pre-date that field, and Firestore silently drops any document
  missing the field it is told to sort by — ordering here would make those
  videos vanish. At today's size the caps change nothing at all; they exist so
  this cannot quietly become a full-database download. The day the pool is
  genuinely near 300, it needs real paging (an ordered query plus a composite
  index) and the field backfilled first.
- **The leaderboard is now approximate past 500 proofs.** It adds up every
  approved proof, so a cap makes it approximate the moment the platform passes
  the cap. An all-time leaderboard has to be totalled on a server and stored,
  not recomputed on every phone that opens the tab.

Verified live on `20260825b`: home, explore, leaderboard, a mission detail and
the missions page all still load, 0 page errors. Note the database currently
holds **0 approved proofs**, so the video paths were exercised with an empty
pool — the queries ran and returned cleanly, but no video was rendered through
them.

### 18. Proof Submission on Completed Missions (HIGH)
> **OPEN — new finding.**

- **File**: `firestore.rules` (Line 287)
- **Issue**: The `create` rule for `proofs` checks if the user is an `approvedTaker`, but it does NOT check if the mission is already `completed == true`.
- **Risk**: An approved taker can submit a proof even after the creator has already accepted someone else's proof and marked the mission as completed. This breaks the business logic where a mission should only have one winning proof.
- **Fix**: Add a condition in `firestore.rules` to check `get(/databases/$(database)/documents/dares/$(request.resource.data.dareId)).data.completed == false`.

### 19. Missing Referential Integrity Checks (MODERATE)
> **OPEN — new finding.**

- **File**: `firestore.rules` (Comments, Follows)
- **Issue**: When creating a comment or following a user, the security rules do not verify if the target `proofId`, `dareId`, or `targetUid` actually exists.
- **Risk**: A user can create a comment pointing to `proofId: "fake123"` or follow a user `targetUid: "fake456"`. This creates orphaned data in the database which consumes storage and can cause UI glitches.
- **Fix**: Use `exists()` in `firestore.rules` for comments and follows to ensure the parent entity is real.

### 20. Missing Social Sharing Meta Tags (LOW/UX)
> **OPEN — new finding.**

- **File**: `index.html`
- **Issue**: The `head` section lacks Open Graph (`og:title`, `og:image`, `og:url`) and Twitter Card (`twitter:card`) meta tags.
- **Risk**: When users share their missions or profiles on WhatsApp, iMessage, Twitter, or Facebook, the link will just show a generic "Misnivo" title with no image or description. This severely limits organic growth and social virality.
- **Fix**: Add dynamic or default `og:` and `twitter:` meta tags in the `<head>` of the `index.html`.

---

## Still open, in the order they are worth doing

1. **#17 Cloudinary signed uploads** — the only one that can cost real money
   today. Needs a Cloud Function, so needs Blaze.
2. **#1 / #13 wallet on the server** — blocked on the Blaze plan, same door.
3. **#4** — needs a specific flow named before anything can be done.

Everything above them is closed. Three separate things now wait on the same
Blaze plan; that is one decision, not three.
