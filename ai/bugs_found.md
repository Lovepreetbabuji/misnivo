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

**Summary: 28 fixed · 2 closed by removal · 3 not real · 1 known · 4 open**

> ⏸️ **`ai/PARKED.md`** — everything the owner has deliberately put on hold,
> with the reason and what unblocks it. An entry marked PARKED below is a
> DECISION, not an oversight: do not implement it without being asked.

*#14 App Check is DONE — Firestore, Authentication and AI Logic all enforced
and verified live, 24-25 Aug 2026. The 2 Nov 2026 deadline is met early.*

---

### 1. Client-Side Wallet Manipulation (CRITICAL)
> **CLOSED 27 Aug 2026 — the wallet was removed.** Not guarded, not gated:
> deleted. The page, deposit, withdraw, KYC, bank methods, the transaction PIN,
> the history and the fake Rs.1,00,000 starting balance are all gone from the
> app. There is no balance left for anyone to write, which is the only thing
> that actually settles this — no rule ever could, because no rule can tell a
> real debit from an invented one.
>
> Existing accounts may still carry a leftover `wallet` field in their private
> drawer. Nothing writes one any more and the migration branch in the rules lets
> an account delete its own. Real payments, when they come, get built on a
> server first.
>
> The original finding, kept because it was right:
>
> **KNOWN — needed a server, not a rule.** Real, and already written up at the top
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
> ⏸️ **PARKED BY THE OWNER — see `ai/PARKED.md`.** Do not pick this up on your own.
>
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
> **CLOSED 27 Aug 2026 — same removal as #1.** The point of this finding was
> that flipping `WALLET_ENABLED` in the console unhid a wallet whose balance
> the account owner could write. There is no wallet behind the flag now. The
> constant itself stays defined and false because the project's ground rules
> list it as do-not-rename and a stray reference should evaluate rather than
> throw — but there is nothing left for it to switch on.
>
> The original finding:
>
> **KNOWN — same root cause as #1.** Flipping `WALLET_ENABLED` in the console
> only unhides UI; the exposure underneath is that the owner may write their own
> wallet document, which is #1 and needs a server. Note that `wallet` is not in
> the public `users` update whitelist — it lives in the owner-only private
> drawer — so this is not an open door for anyone *else*.

### 14. No Rate Limiting / API Abuse Protection (CRITICAL)
> ⚠️ **Read #30 before trusting the word FIXED in this heading.** What was fixed
> here is the SCRIPTED half — App Check refuses an automated browser. Per-user
> rate limiting was never done and is not possible without a server; it is its
> own finding now.
>
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
> ⏸️ **PARKED BY THE OWNER — see `ai/PARKED.md`.** Do not pick this up on your own.
>
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
> ✅ **The format list no longer depends on which phone someone owns.** It did
> for a few hours: both thumbnails already came out of a canvas as jpg/png, but
> the **profile photo was uploaded exactly as picked**, so an Android `.webp`
> or an un-converted `.heic` would have been refused by Cloudinary — a real
> person unable to set their own picture, not an attacker. Fixed 25 Aug:
> `onProfilePhotoSelected` now runs the file through a canvas and hands over
> `image/jpeg`, long edge capped at 512px. Cloudinary only ever sees jpeg from
> this path, so the tight list is safe to keep.
> Verified live on `20260825d`: a 1400px `.webp`, a 2400px `.png` and a normal
> `.jpg` all arrive as `image/jpeg`; a 3000×2000 PNG came down from 119KB to
> 2KB at 512×341; a file the browser cannot decode is refused with a message
> instead of failing later at the upload.

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

### 19. Proof Submission on Completed Missions (HIGH)
> **FIXED 25 Aug 2026, rules deployed + build `20260825e`.** Closed in three
> places, because each does a different job. `missionOpen()` in the proofs
> create rule is the actual gate — it reads `completed` off the mission, with
> `.get('completed', false)` so a mission written before the field existed
> still passes. `openProof()` refuses before anyone films, because a
> `permission-denied` arriving after someone has filmed, trimmed and uploaded a
> video is a cruel way to say no. `submitProof()` checks once more, because the
> creator can approve someone else while the modal is open and the live
> listener updates `dares` underneath it.
>
> Verified on the live site in a real browser, with a throwaway account, by
> doing the thing the rule should refuse — not by reading "Deploy complete":
> a proof on an OPEN mission was **allowed**, the mission was then closed, and
> the identical write came back **permission-denied**. The button was checked
> separately and says "This mission is already completed — no more proof can be
> sent" without opening the modal. Test mission and account deleted afterwards.
>
> The verdict that led here, kept because it is why this was worth doing first:


> Confirmed in both places. The `proofs` create rule tests signed-in, not
> banned, `takerId == uid()`, `status == 'submitted'`, that the mission exists,
> and `mayProve()` — and `mayProve` only asks about `takerSelectionMode` and
> `approvedTakers`. The word `completed` does not appear in it. `openProof()`
> in `js/app.js` checks the same two things and no more.
>
> **It is reachable by a normal person pressing a normal button, not only by a
> crafted request.** A completed mission drops out of the missions feed, but a
> taker who accepted it earlier still has it on their Accepted page with Submit
> Proof live on it.
>
> **Why it matters more than "one extra document".** `approveProof` writes
> `completed: true` on the mission and `status: 'approved'` on the proof. The
> proof update rule lets the mission owner judge any proof whose status is
> still `submitted` — it has no idea another proof on the same mission was
> already approved. So a creator can approve a second proof on a finished
> mission: two people recorded as having completed one bounty. Nothing is paid
> today only because `WALLET_ENABLED` is false, which makes this exactly the
> kind of thing to close **before** the wallet is switched on, not after.
>
> Fix is two lines in two places, and both are needed — the rule because it is
> the only real gate, the button because a silent `permission-denied` after
> someone has filmed and uploaded a video is a cruel way to say no:
> in `firestore.rules`, `mayProve` (or the create rule) also requires
> `get(.../dares/$(dareId)).data.get('completed', false) == false`; in
> `openProof()`, refuse with a message when `d.completed` is true.
> **Not done — a rules change is an immediate live change, so it is the
> owner's call.**

- **File**: `firestore.rules` (Line 287)
- **Issue**: The `create` rule for `proofs` checks if the user is an `approvedTaker`, but it does NOT check if the mission is already `completed == true`.
- **Risk**: An approved taker can submit a proof even after the creator has already accepted someone else's proof and marked the mission as completed. This breaks the business logic where a mission should only have one winning proof.
- **Fix**: Add a condition in `firestore.rules` to check `get(/databases/$(database)/documents/dares/$(request.resource.data.dareId)).data.completed == false`.

### 20. Missing Referential Integrity Checks (MODERATE)
> **FIXED 25 Aug 2026, rules deployed.** `commentTargetExists()` requires a
> comment's `proofId` to name a real proof **or** a real mission — the same
> both-collections dance the pin check already does, since one id field serves
> videos and missions. `follows` create now requires the target account to
> exist. Deliberately **not** extended to likes, which are far more frequent and
> carry no id of their own.
>
> Costs up to two document reads per comment posted and one per follow. That is
> the price of the check and it is worth it at this volume — but it is a real
> per-write cost, so it is written down rather than buried.
>
> Verified live, both directions, which is the half that is easy to skip: a
> comment on `totally_made_up_id_123` came back **permission-denied** while a
> comment on a real mission was still **allowed**; a follow of a made-up uid was
> **refused** while following a real account still **worked**.
>
> The verdict that led here:


> `firestore.rules`: `comments` create tests the author, the text and
> `likeCount`, and never asks whether `proofId` points at anything; `follows`
> create tests the follower, self-follow and the document id shape, and never
> asks whether `targetUid` is a real account.
>
> What it is **not**: a way to reach or corrupt anyone else's data. A comment
> carrying `proofId: "fake123"` is invisible — no screen ever queries that id,
> so it is junk sitting in storage, not a UI glitch. A follow pointing at a
> non-existent uid only inflates the *follower's own* "following" number; it
> cannot add a follower to a real person, because the rule already pins
> `followerUid` to the signed-in user and the document id to
> `uid_targetUid_type`.
>
> The fix is `exists()` in both rules, and it is not free: every `exists()` in
> a rule is a billed document read on **every** comment posted and every follow
> made — up to two for comments, which have to try `proofs` and then `dares`,
> since one collection serves both surfaces (see `pinnerOfProof`/`pinnerOfDare`
> already in the file). At this volume that is nothing. It is worth doing the
> next time the rules are opened; it does not deserve a deploy of its own,
> because a rules deploy is an immediate live change and this buys tidiness
> rather than safety.


- **File**: `firestore.rules` (Comments, Follows)
- **Issue**: When creating a comment or following a user, the security rules do not verify if the target `proofId`, `dareId`, or `targetUid` actually exists.
- **Risk**: A user can create a comment pointing to `proofId: "fake123"` or follow a user `targetUid: "fake456"`. This creates orphaned data in the database which consumes storage and can cause UI glitches.
- **Fix**: Use `exists()` in `firestore.rules` for comments and follows to ensure the parent entity is real.

### 21. Missing Social Sharing Meta Tags (LOW/UX)
> **DONE for the static half, build `20260825e`.** Open Graph and Twitter Card
> tags are in the `<head>`, with `og:image` absolute (a relative path is dropped
> by every scraper) pointing at `misnivo.png`, which is 1080×540 — near enough
> the 1.91:1 the scrapers want.
>
> Verified the way it actually gets consumed: `curl` on `/dare/anything` with no
> JavaScript at all returns the tags, and the image answers 200 as `image/png`.
> That matters more than seeing them in a browser, because the browser runs the
> app and a scraper never does.
>
> 🔴 **The words and the picture are a starting point, not a decision.** They
> say "Misnivo — missions with real rewards" and "Post a mission with a reward,
> or complete one and get paid for your video proof." over the logo. That is
> the owner's copy to overwrite; nothing else has to change to do it.
>
> **Still open underneath this: per-mission previews.** Every link shares the
> same card, because this is an SPA and every URL serves the same file. A card
> showing *that* mission's title and thumbnail needs the HTML rendered per URL
> before it is sent — on Cloudflare Pages a Pages Function for `/dare/:id`. That
> is a separate, larger job and it has not been started.
>
> The verdict that led here:


> `index.html` has `charset`, `viewport`, `theme-color`, the Apple PWA tags and
> a plain `<title>Misnivo</title>` — there is not one `og:` or `twitter:` tag.
> Every link shared to WhatsApp today is a bare URL with no picture.
>
> **The report's own suggested fix, "dynamic" tags, cannot work here and this
> is the thing to understand before anyone spends time on it.** WhatsApp,
> iMessage, Twitter and Facebook fetch the raw HTML and **never run
> JavaScript**. This is a single-page app: every URL serves the same
> `index.html`, and anything `app.js` writes into the head afterwards is
> invisible to them. So there are two different jobs wearing one number:
>
> - **Static tags — small, safe, `index.html` only.** One title, one
>   description, one image for every link. Turns a bare URL into a branded
>   card. It cannot show *this* mission's thumbnail, because the server sends
>   the same file whatever the path.
> - **Per-mission previews — a build change.** The HTML has to be rendered per
>   URL before it is sent, which on Cloudflare Pages means a Pages Function
>   reading `/dare/:id` and writing that mission's title and thumbnail into the
>   head. Real work, and it touches how the site is served.
>
> Not started: the static version still needs the owner's words and picture —
> what the card should say and which image it shows are product decisions, not
> code ones.


- **File**: `index.html`
- **Issue**: The `head` section lacks Open Graph (`og:title`, `og:image`, `og:url`) and Twitter Card (`twitter:card`) meta tags.
- **Risk**: When users share their missions or profiles on WhatsApp, iMessage, Twitter, or Facebook, the link will just show a generic "Misnivo" title with no image or description. This severely limits organic growth and social virality.
- **Fix**: Add dynamic or default `og:` and `twitter:` meta tags in the `<head>` of the `index.html`.


### 22. Two reads the sweep missed (MODERATE)
> **FIXED 25 Aug 2026, build `20260825c`.** Found while checking #15/#16 —
> same shape, two places the pass did not reach.
>
> **Applicants.** Opening the taker picker fetched every applicant on the
> mission with no ceiling. This is the one most exposed to a mission catching
> on, because the creator opens that sheet at exactly the moment it is popular.
> Capped at 200, oldest first — first to apply is who the creator should be
> choosing between. One extra document is fetched so the header can read "200+"
> instead of quietly presenting 200 as the whole list.
>
> **Own proofs.** `startMyProofsListener` held every proof by the signed-in
> person. Bounded by how much one person does, so it was never heading for the
> size of an open collection — but it had no ceiling at all, and "small because
> of how people behave" is not a limit. Capped at 500, newest first.
>
> 🔴 **That sort needs a composite index** (`takerId` + `createdAtMs`), now in
> `firestore.indexes.json` and deployed. Deploy the index BEFORE shipping code
> that sorts — without it the listener throws `failed-precondition` and the
> Accepted page stops updating proof statuses. **An empty collection does not
> mean an instant build:** the index was deployed first and still came back
> "currently building" on the first live check, so poll the real query in a
> browser rather than trusting the CLI, which reports no state field at all.
>
> Sorting is safe here only because `proofs` was empty when this went in —
> Firestore drops documents that lack the `orderBy` field out of the results
> entirely, so an older proof without `createdAtMs` would have silently
> vanished from someone's Accepted page. Worth remembering if that field is
> ever renamed.
Verified live: both caps present, the sorted query runs, all six pages open,
no index complaints, 0 page errors — and end to end with a real mission and a
real applicant, header exact at "1 applicant" and "1+ applicant" when capped.

### 23. Denial of Service (DoS) via Interaction Arrays (CRITICAL)
> **FIXED 25 Aug 2026, rules deployed. Gemini was right, and this was the most
> serious thing open.** `stepped()` guarded the counter beside these lists and
> nothing guarded the lists themselves — not their type, not their size, not
> what went into them. Any signed-in account could write
> `likedBy: ['<900KB of text>'], likeCount: <current+1>` on any mission and pass
> every check. Firestore caps a document at 1MB, so that bloats it until no
> further update fits, and because `/dares` and `/proofs` are world-readable and
> the feed pulls them, every visitor then downloads the payload.
>
> `selfOnlyList()` allows a list to gain or lose **only the caller's own uid**.
> Written as a set difference in both directions rather than a size cap, because
> a popular mission legitimately has a long list and a cap would eventually
> refuse honest likes. The size clause on top is not redundant: `hasOnly()` is
> happy with fifty thousand copies of one legitimate uid. Applied to `likedBy`
> and `dislikedBy` on dares and proofs, and `likedBy` on comments.
>
> **Two things the first attempt got wrong, both caught by testing rather than
> reading:**
> - `prev()/next()` default a missing field to `0`, which is right for a counter
>   and wrong for a list — on a mission never liked before, `.size()` on the
>   number 0 would have refused the very first like. `prevList()/nextList()`
>   default to `[]`.
> - The first test attacked a mission the test account had created, and passed
>   the attack — because the **owner** branch let a creator write anything. That
>   is a way straight past the public guard, on a mission everyone downloads.
>   `likeListsOk()` is on the owner branch too now.
>
> Verified live against the deployed rules: a 200KB string in `likedBy` →
> **permission-denied**; another account's uid → **permission-denied**; a normal
> like on a mission with no `likedBy` field yet → **allowed**; unlike →
> **allowed**. 7/8, the eighth being a stricter assertion than reality: 50,000
> array entries came back `invalid-argument` because Firestore rejects an array
> that size before rules are consulted at all — refused either way, and smaller
> multi-copy variants are caught by the size clause.
>
> It closes a smaller hole in passing: until now anyone could delete other
> people's uids out of these lists, or add somebody else's.


- **File**: `firestore.rules` (dares and proofs)
- **Issue**: The rules allow any signed-in user to update the `likedBy`, `dislikedBy`, and `approvedTakers` arrays as long as they also update the counters correctly (`steppedAll()`). There is no check on the size or contents of these arrays.
- **Risk**: A malicious user can append a massive string (e.g., 1MB of text) into the `likedBy` array of a popular mission. Since Firestore has a 1MB limit per document, this completely breaks the document. Nobody else will be able to like, view, or update that mission. Worse, every time a normal user views the feed, they will download that 1MB document, causing massive bandwidth costs (Economic DoS).
- **Fix**: Use `request.resource.data.likedBy.size()` and string length validation, or better, move likes to a separate subcollection instead of arrays on the main document.

### 24. Unverified Email Signup Spam (HIGH)
> ⏸️ **PARKED BY THE OWNER — see `ai/PARKED.md`.** Do not pick this up on your own.
>
> **OPEN — real as described, but the severity does not hold and the fix is a
> product decision, so it is left for the owner.** Confirmed in the code:
> `emailSignup()` creates the account, sets the display name and drops straight
> into the app. `sendEmailVerification` and `emailVerified` appear nowhere in
> `js/app.js`. So yes — a fake-but-well-formed address gets a working account
> immediately.
>
> **Why it is not HIGH any more:** the risk described is "attackers generate
> thousands of fake accounts", and that is scripted abuse, which is exactly what
> #14 closed. App Check with reCAPTCHA Enterprise is **enforced on
> Authentication**, and an automated browser is refused a token — verified more
> than once, it is why the test harness must run `headless:false`. What is left
> is a person signing up by hand with an address they do not own, one at a time.
>
> **Why it was not just done:** gating on `emailVerified` stops a new person
> doing anything until they find an email and click a link. On a platform with
> few users that is friction paid by every honest sign-up to stop an attack that
> App Check already makes expensive — and it does not stop a disposable inbox
> either. Firebase's verification emails also have a send quota on the free plan
> and land in spam often enough to matter.
>
> **The owner's call, and there are three answers, not two:** send the email but
> gate nothing (cheap, catches typos in a real address, changes no flow); gate
> only the actions that cost something — posting a mission, submitting proof —
> and leave browsing open; or gate everything at sign-up. Say which and it is a
> small change either way.


- **File**: `app.js` (Auth flow)
- **Issue**: The app allows users to sign up and immediately start creating missions and proofs without verifying their email address.
- **Risk**: Attackers can generate thousands of fake accounts using random/fake emails. These accounts can then spam the platform, bloating the database and ruining the user experience.
- **Fix**: Enforce `user.emailVerified` check before allowing creation of user profiles in the database, and send an email verification link upon signup.

### 25. Slow to load — reported by a real user (HIGH)
> **MOSTLY FIXED 25 Aug 2026, build `20260825i`.** The first finding on this
> list that came from an actual person using the app, not from a code read:
> *"takes a lot of time in loading. i explore as a guest."* — and the owner sees
> it signed in too.
>
> **Measured before touching anything**, because a load-time complaint is the
> easiest thing in the world to guess wrong about. Cold, fresh profile: 3.34s to
> the load event, 2.06s to the first feed content, **1100KB over 37 requests**.
> Three things accounted for most of it, and all three were the same mistake —
> work done for everybody that only some people need.
>
> 1. **Uploaded images were served at their original size.** `vidThumb` returned
>    `proofThumbnailURL` untouched, silently ignoring the width every caller
>    passes it, and four mission-card renderers used `d.thumbnailURL` raw. Four
>    images on the measured feed came to ~390KB between them — one a single
>    150KB file — to fill cards a few hundred pixels wide. The avatar path had
>    been doing this properly for a while and its images land at 1KB; nothing
>    else was. `_optImg` now applies `w/c_limit/q_auto/f_auto`. Those same four
>    images now weigh 18, 11, 10 and 7KB.
> 2. **The logo was 113KB**, preloaded at `fetchpriority="high"`, so it was the
>    first thing fetched and among the biggest. As WebP at 540px it is 5KB.
> 3. **A second reCAPTCHA Enterprise instance loaded for every visitor**, for
>    the AI safety filter's separate Firebase app. The two reCAPTCHA anchor
>    frames were the two slowest requests of the whole load at ~1.4s each, and
>    the second one exists for a check that only runs when somebody posts a
>    mission.
>
> **After: 2.59s to load, 650KB over 30 requests** — 41% fewer bytes, one
> reCAPTCHA instead of two. On a phone on mobile data the difference is larger
> than these desktop numbers make it look.
>
> 🔴 **I broke the safety filter doing this, and it is worth writing down.**
> Making the AI app lazy moved its App Check token fetch into the moment of use.
> That token is reCAPTCHA-backed and takes 5-6 seconds cold, which ate the 20s
> budget in `_aiAsk`, so the check timed out — and it fails CLOSED, so **every
> mission would have been refused**. Caught by testing the filter itself rather
> than just reloading the page. Fixed by waking the stack in `openPost()`:
> laziness kept, but it starts while the person is typing instead of when they
> press Submit. Verified end to end signed in: normal mission ALLOWED in 4.3s,
> harmful mission BLOCKED in 3.7s, page load still costs one reCAPTCHA.
> Lesson for the next person: a warm model answers in 1.4-3s; if an AI call is
> taking tens of seconds, suspect the App Check token, not the model.
>
> **What is still on the table and was not done:** `js/app.js` is 598KB raw
> (165KB over the wire) and is parsed on every load; the three separate Google
> Fonts requests cost ~300ms each; and Inter is pulled in five weights.

### 26. Home stuck on a loading skeleton (HIGH) — owner reported
> **FIXED 25 Aug 2026, build `20260825j`.** Described as: leave the app in the
> background and come back, or tap Missions and immediately tap Home, and the
> home page shows nothing but skeleton loading while every other page is fine.
>
> **Reproduced before fixing**, by holding Firestore at 6s latency on a 412px
> viewport: tap Missions, tap Home, and the grid was skeleton at 320ms and still
> skeleton twelve seconds later, with the mission cards wiped out underneath it.
> After the fix, same test: no skeleton at all, cards intact throughout.
>
> `renderHome()` had nowhere to record that the feed had already been fetched,
> so it read "no approved videos" as "not loaded yet". Every visit to Home
> therefore re-armed the loading skeleton, which 320ms later replaced the whole
> grid — mission cards included — and left it replaced for as long as the network
> took. Forever if the connection had gone stale in the background, because that
> read never returns and so never repaints. `_homeLoadedOnce` makes the loader a
> first-load-only thing: after that there is always something honest to show,
> even when that something is "no videos yet".
>
> Two more fell out of the same function: it re-read up to 300 documents from the
> server on every tab switch (now once per 45s at most), and a failed refresh
> could wipe a feed that was already on screen (now it leaves it alone).

### 27. Somebody else's profile left on screen (MODERATE) — owner reported
> **FIXED 25 Aug 2026, build `20260825m`.** Described as: reload, open the
> profile page, and another account's profile is sitting there.
>
> `_closeDetailOverlays()` — which `goPage()` calls on every navigation — closed
> the mission view, the video view and the shorts player, and never the public
> profile overlay. So tapping Profile brought your own page up underneath while
> their profile stayed on top of it. Worst after a reload on `/u/<someone>`,
> because `_bootRoute` reopens that view first and the next tap left it there.
> `_enterView` already closed it when a video or a mission opened, so the pattern
> existed; page navigation had simply never been given the same line.
>
> Verified live: opened a real stranger's profile, tapped Home — closed; same
> from any other tab. 4/4.

### 28. Reporting crashed for guests (HIGH) — found by hunting
> **FIXED 26 Aug 2026, build `20260826a`.** Nothing in the report flow checked
> for an account. `openReportModal` is reachable from six places — the menu on a
> mission card, the mission view, the video view, the clips menu, and under a
> comment — and every one of them is visible to a guest, which since the sign-up
> wall came down is **every first-time visitor**.
>
> `submitReport()` then read `user.uid`, `user.name` and `user.email` off a null
> user. The TypeError landed inside that function's own `try/catch`, so the
> person reporting abusive content was shown a toast reading
> **"Error: Cannot read properties of null (reading 'uid')"** — and their report
> went nowhere.
>
> Gated where the form opens, so the account is asked for before a reason is
> typed rather than after, with a plain `!user` refusal behind it because that
> function has no fallback for a null user. A `report` entry was added to
> `GUEST_ACTION_MSGS`; its `flag` icon is safe because the guest prompt draws in
> the full Material Icons Round face, not the subset the drawer uses.
>
> Verified live as a guest: tapping Report shows "Report this", the form does
> not open, nothing throws, and no raw JavaScript text reaches the screen.
>
> **How it was found, because the method is the point:** a scan for functions
> that read `user.*` with no guard nearby. It named nineteen; most were called
> from paths already gated, and checking which were genuinely reachable by a
> guest is what left this one standing.

### 29. Thirteen more amounts still said dollars (MODERATE) — my own miss
> **FIXED 26 Aug 2026, build `20260826a`.** The owner asked for this once
> already and the previous pass fixed **one** badge and called it done. It was
> one of fourteen.
>
> The other thirteen are written `${...}` inside template literals, and a grep
> for a dollar sign followed by a digit or a quote does not match that — which
> is exactly why "I searched and found one" was worth nothing. They were the
> ones people actually look at: every mission card, every video card, every clip
> tag, the related-video badges, the mission detail badge and the "bounty won"
> line.
>
> Verified live: every bounty element on screen reads Rs., none contains a
> dollar sign, and the check was written to fail if it found no bounties at all
> rather than pass on an empty page.

### 30. No rate limiting anywhere (HIGH) — owner asked, checked, confirmed
> ⏸️ **PARKED BY THE OWNER — see `ai/PARKED.md`.** Do not pick this up on your own.
>
> **OPEN — the owner has decided to do this properly rather than patch it.**
> The question was "do we have rate limiting?" and the answer, checked rather
> than remembered, is **no**. There is no throttle, no cooldown, no
> `lastPostAt`, and no time comparison of any kind in `js/app.js` or in
> `firestore.rules`. Cloud Functions exist in the repo (315 lines) but are not
> deployed — `firebase functions:list` fails on this project, which is the Spark
> plan saying no.
>
> **Three things get mistaken for rate limiting here and none of them is:**
> - **App Check / reCAPTCHA Enterprise** asks *"is this a real browser?"*, not
>   *"how many times have you done this?"*. A real person, or a script running
>   inside a real browser session, is waved through every single time. #14 closed
>   the scripted-abuse case and its own text says per-user limits still need
>   Cloud Functions — "FIXED" there does not mean this is covered.
> - **The Firestore rules** constrain *what* may be written — a counter moving
>   one step, a like list gaining only your own uid, text length caps — and say
>   nothing about *how often*.
> - **Cloudinary's plan caps** are per file (10MB image, 100MB video), not per
>   unit of time.
>
> **What one signed-in account can do today:** post hundreds of missions a
> minute, or thousands of comments. Every one is a billed write, and every
> mission also spends two Gemini calls on the safety filter.
>
> 🔴 **There is a limit in place, and it points the wrong way.** reCAPTCHA's free
> tier is 10,000 assessments a month across the whole organisation. Past it,
> requests come back 429 with billing off — and since App Check is *enforced*,
> that locks out **real users** while costing an attacker nothing. The only
> ceiling the project has today punishes the victim.
>
> **A rules-only version was considered and rejected as unworkable, so nobody
> re-tries it:** rules can compare `request.time` against a stored timestamp, but
> the timestamp has to be written by the client. An attacker simply never
> updates theirs, their stored time stays old, and they pass the check forever.
> Counting events over time cannot be enforced by a party that also writes the
> count. **This needs a server; there is no rules-only version of it.**
>
> A UI cooldown on the post button was offered as a partial measure — it stops
> double-taps and casual spam and stops nothing deliberate, because anything
> determined talks to Firestore directly and never sees the button. The owner
> declined it on 26 Aug in favour of doing the real thing. Not implemented, on
> purpose.

### 31. Settings refused guests with a bare toast (LOW) — found while redesigning
> **FIXED 26 Aug 2026, build `20260826d`.** `openSettings()` began
> `if(!user){ showToast('Sign in first'); return; }` — no reason, nothing to tap,
> and nothing like the prompt every other gated action shows. Settings sits in
> the drawer, and since the sign-up wall came down the drawer is what every
> first-time visitor opens, so this refusal is one a lot of people meet.
>
> It uses `guestCheck('settings')` now, with its own message, so a guest gets
> the same card with a Sign Up button that liking, commenting, posting and
> reporting give them.
>
> Found sideways: the settings list would not open for a guest at all, which is
> why the first screenshot of the redesign came back showing the home page.

### 32. Only eight fields had a size limit; every other one had none (HIGH) — owner found it
> **FIXED 26 Aug 2026, rules deployed.** The owner raised `maxlength` on the bio
> box in the browser inspector, typed past the form's limit, saved, and saw the
> result on another account. Their conclusion — *"users inspect mode mein jaakar
> ye kuch gadbad aaram se kar sakte hain"* — was right, and wider than the one
> box they tried.
>
> **What was actually true, checked rather than assumed.** The specific 1000-char
> bio is refused today: `textOk(bio, 300)` has been there since #11, and both a
> 1000 and a 301 character bio come back `permission-denied`. What DOES get
> through is 300 when the form promises 160 — so the bypass is real, just
> smaller than it looked.
>
> **The real finding is what `textOk` was not covering.** It guarded eight named
> fields. Every other field, on every collection, had no ceiling at all. Tested
> from an ordinary signed-in account against the live rules, 50KB went into all
> eleven of these:
>
> | Where | Field |
> |---|---|
> | `users` | `socials`, `settings`, `pinnedDares`, `likedProofs` |
> | `dares` | `tags`, `creator`, and `rewardAmount: 999999999` |
> | `proofs` | `note`, `takerName` |
> | `comments` | `userName` |
> | `reports` | `reason` |
>
> Eleven for eleven. `users`, `dares`, `proofs` and `comments` are all
> world-readable and pulled by the feed, so each one is a payload every visitor
> downloads afterwards — the same shape as #23, reached through a different door.
> `rewardAmount` is not a size problem but a trust one: `MIN_REWARD` and
> `MAX_REWARD` live in `app.js` only, so a mission could advertise a bounty of
> 999,999,999 on the feed.
>
> **Fixed with three helpers beside `textOk`.** Rules cannot walk a list element
> by element, but `List.join()` and `Map.values()` collapse either into one
> string, so a single length check covers both "too many entries" and "one
> enormous entry". `numOk` pins `rewardAmount` to the app's own 1..1,000,000.
> Caps are set generously against what the app writes — tags allow 300 characters
> across all five, a proof note 2000 where the form says 200 — so nothing
> legitimate is near them.
>
> **Verified both directions, which is the half that matters.** All eleven
> oversized writes now return `permission-denied`, and posting a mission with
> five tags, submitting a proof, posting a comment, filing a report, saving a
> profile, changing a settings toggle and pinning three missions all still work.
>
> **The lesson worth keeping:** a `maxlength`, a disabled button, a dropdown with
> three options — none of them is a control. They are conveniences for people who
> are not fighting you. The rules file is the only thing standing between an
> account and the database, so any limit that matters has to exist there too.

### 33. Thirteen places printed user text unescaped (LOW) — asked for after the security review
> **FIXED 27 Aug 2026, build `20260827c`.** Three shapes: the profile photo URL
> going straight into `src="…"`, the name's first initial going into a JS string
> inside an `onerror="…"` attribute, and Firebase error text printed into an
> empty state.
>
> **The apostrophe one is the interesting half.** `escHtml` covers `& < > "` and
> deliberately leaves the apostrophe alone — which is exactly the character that
> breaks out of `onerror="this.parentElement.textContent='X'"`. So reaching for
> `escHtml` there would have looked like a fix and been none. Stripped the way
> `_avHtml` already does it, which had solved this correctly all along.
>
> **Honest about severity: all thirteen carried the CURRENT user's own data into
> their own browser.** Self-inflicted only; nobody could reach anyone else
> through them. Worth closing because "it is only your own data" holds right up
> until one of those lines is copied to a screen showing somebody else's.
>
> Found by asking where user text reaches the page without `escHtml`. The other
> 119 sites were already correct.

### 34. Two profile functions that have never rendered anything (LOW)
> ⏸️ **PARKED BY THE OWNER — see `ai/PARKED.md`.** Do not pick this up on your own.
>
> **OPEN — found while removing the wallet, not caused by it.**
> `_renderProfileStats()` and `_renderProfileBadges()` both start with
> `getElementById('profStats')` / `('profBadges')` and return when it is missing.
> Neither id exists in `index.html`, and `git show` confirms neither existed
> before the wallet removal either. So the Missions / Completed / Earned /
> Paid out row and the whole achievements strip have been computed and thrown
> away on every profile view for as long as the file has been in this repo.
>
> Left alone deliberately: it is either markup that was lost at some point, or
> a feature that was never finished, and which one it is changes what the fix
> should be. **The owner should say whether that stats row is wanted** — if yes
> the container needs adding back, if no both functions should go.

### 38. The same gap on the other branch, twice more (HIGH) — found by following #35
> **FIXED 27 Aug 2026, rules deployed.** Gemini's #35 was not one bug, it was a
> shape: *a rule that guards one branch and not its twin.* Sweeping every
> collection for that shape found two more, and both were real when tested.
>
> **`users` create had no ceilings at all.** The update branch caps name, bio,
> website, photoURL, socials, settings and three arrays. Create was
> `allow create: if isSelf(userId)` and nothing else — so a brand-new account's
> **very first write**, the one `initUser` makes a second after sign-up, could
> carry a 50KB bio straight past every one of them. Verified before fixing: it
> went in. `users/{uid}` is world-readable and fetched for a name and an avatar
> all over the app, so that is a payload everyone downloads afterwards.
>
> **The proof rejection reason had no ceiling.** `proofTextOk()` caps it when
> the proof is CREATED — but the taker creates the proof, and it is the *mission
> owner* who writes `rejectionReason`, on the update, where nothing checked it.
> The reject form allows 500 characters; the rule allowed any number.
>
> The private drawer's create was uncapped too and got the same treatment. Not
> world-readable, so it is a billing and bloat problem rather than everyone's —
> but the app fetches that document on every boot.
>
> **The fix is one function, not two lists.** `userTextOk()` is now called by
> both the create and the update branch, so they cannot drift apart again. That
> drift is the whole bug; writing the caps out twice is what caused it.
>
> Verified in both directions, and the direction that mattered most was the
> boring one: **a real sign-up through the real form still works and its profile
> document still lands.** Adding a condition to the create branch is exactly the
> change that breaks every new account, so that was checked first. Then: a 50KB
> bio at create time refused, a normal bio allowed, a 50KB rejection reason
> refused, a normal rejection allowed, submitting a proof unaffected. 9/9.

### 39. Every guest search fired a write that could only be refused (LOW)
> **FIXED 27 Aug 2026, build `20260827d`.** `/searches` is signed-in-only in the
> rules, and rightly so — an open counter is an open invitation to inflate any
> term. The matching check on the client was missing, so a guest typing in the
> search box fired the transaction anyway, got a 403, and `.catch(() => {})`
> swallowed it.
>
> Nothing broke. It was simply a guaranteed-to-fail round trip on one of the
> most-used paths in the app, on every search, for every visitor who has not
> signed in — which since the sign-up wall came down is most of them.
>
> **Worth knowing rather than only fixing: Trending Searches has only ever
> counted signed-in people.** That list fills far more slowly than it looks like
> it should, and no amount of guest traffic will move it. Leaving it that way is
> the right call — letting anyone write the counter is how you get a fake
> trending list — but the owner should know the number is not "what people
> search", it is "what signed-in people search".

### 40. Search, notifications and offline — swept, and they hold up (NOT A BUG)
> **Checked 27 Aug 2026. Recorded because "we looked and found nothing" is worth
> knowing, and because the XSS scare in the middle of it was mine, not the
> app's.**
>
> **Search** was given a plain word, an empty string, one letter, something that
> matches nothing, 500 characters, only spaces, regex punctuation, and
> `<img src=x onerror=…>`. Nothing threw, nothing printed `undefined` or `NaN`,
> and the HTML payload **never executed, never became an element, and appears
> escaped on the page**. My first probe counted `img[onerror]` and found six —
> those are the app's own avatars, which use `onerror` for the fallback letter.
> A crude probe producing a scary number is not a finding.
>
> **Notifications** open and close for a guest without throwing and say
> "No notifications yet", which is correct — the collection is server-write-only
> and nothing writes to it while Cloud Functions are parked.
>
> **Offline** is the one that impressed. With the network cut: pages still
> switch, and a full reload still serves the app from the service worker rather
> than a browser error page. Back online, the feed recovers on its own.

---

## Still open — split by whether anything can be done today

🔴 **Waiting on the Blaze plan. This is now FOUR things behind one decision,
not three** — and the newest of them, rate limiting, is the one that grows
with every user the app gains.

1. **#30 rate limiting** — nothing anywhere stops one account writing without
   limit. Cannot be done in rules; needs a server. See the entry for why the
   rules-only version does not work.
2. **#17 Cloudinary signed uploads** — narrowed a long way by the preset's
   format list and the plan's own file-size caps, but bulk upload of valid
   media is still possible and only a Cloud Function handing out a signature
   closes it.
3. **#1 / #13 wallet on the server** — same door, same plan.

**Waiting on an answer from the owner.**

4. **#24 unverified email signup** — real, checked, and deliberately not done:
   the scripted half is what App Check already stops, and gating
   `emailVerified` is friction paid by every honest sign-up. Three options are
   written up in the entry; one of them needs picking.
5. **#4** — no specific flow was ever named; nothing can be checked until one is.

Everything else on this list is closed.

**Not findings, but the two loose ends worth carrying forward:**

- **Per-mission link previews.** #21 gives every link the same card. A card
  carrying that mission's own title and thumbnail needs a Cloudflare Pages
  Function rendering `/dare/:id` server-side. Not started.
- **A test account cannot delete its own private drawer.** Cleaning up after a
  throwaway account, `users/{uid}` deleted fine but
  `users/{uid}/private/main` came back `permission-denied` — the rules have no
  delete for it. Harmless (nobody but that account and an admin could ever read
  it) and it leaves one orphan document per test account, which is where the
  leftover `dmtest.*` profiles come from. Worth a `allow delete: if isSelf(u)`
  next time the rules are opened.

### 35. Comment Text Size Bypass on Update (CRITICAL)
> **FIXED 27 Aug 2026, rules deployed. Gemini's, and it was right — my own audit
> the same day missed it.** The create rule caps comment text at 500. The update
> rule let the author touch `text`, `edited` and `editedAt` and checked no size
> at all. So the cap was a formality: post "hi", then edit that comment to a
> megabyte. Comments are world-readable and fetched per video, so the bloat
> lands on everyone who opens it afterwards.
>
> The same 500 is now enforced on the edit. Verified live: editing a comment to
> 50KB comes back `permission-denied`, a normal edit still works.
>
> **Worth naming why I missed it.** My sweep asked "which FIELDS have no size
> limit" and walked the create rules. This field had a limit — on the other
> branch. Checking creates and forgetting updates is its own blind spot.

- **File**: irestore.rules (Comments)
- **Issue**: The create rule for comments enforces equest.resource.data.text.size() <= 500. However, the update rule for comments only checks onlyTouches(['text','edited','editedAt']) and completely omits the size constraint.
- **Risk**: A user can create a valid 500-character comment, and immediately update it to contain 1MB of text. Since comments are loaded automatically on missions and proofs, this acts as a targeted Economic DoS. Every user viewing the comments will download the 1MB payload.
- **Fix**: Apply 	extOk() or a direct size check equest.resource.data.text.size() <= 500 in the comment update rule.

### 36. Forged Initial Counters on Mission/Proof Creation (HIGH)
> **FIXED 27 Aug 2026, rules deployed. Gemini's, and also right.** `stepped()`
> guards how a counter MOVES and says nothing about what it was born as, so a
> mission could be created with `likeCount: 1000000` and sit at the top of "most
> liked" without ever touching the update rule it was supposed to have to get
> past. The comments rule already required `likeCount == 0` on create; dares and
> proofs never did.
>
> `countersStartAtZero()` now covers likeCount, dislikeCount, viewCount,
> commentCount, takers and proofCount on both. Absent reads as 0, so nothing
> legitimate has to set them. Verified live: a mission created with
> `likeCount: 1000000` is refused, a normal one still posts.

- **File**: irestore.rules (dares and proofs)
- **Issue**: The create rules for dares and proofs do not enforce that engagement counters (likeCount, iewCount, dislikeCount) start at 0. 
- **Risk**: A malicious user can create a mission or proof with likeCount: 1000000 or iewCount: 1000000 right from the start, making it immediately trend or appear artificially popular without needing to bypass the stepped() update rule.
- **Fix**: In the create rule, assert that if these fields exist, they must equal 0.

### 37. Unbounded Arrays in Public User Document (HIGH)
> **ALREADY FIXED — same finding as #32, reached independently.** Gemini raised
> this a few hours after the owner found it from the other end (the inspector)
> and it was closed the same day: `listOk`/`mapOk` now cap socials, settings,
> pinnedDares, likedProofs and acceptedDares. Two people finding the same hole
> on the same day from different directions is worth noting rather than
> deleting — it is the strongest signal on this list that the area was weak.

- **File**: irestore.rules (users)
- **Issue**: The update rule for users/{userId} allows the owner to modify socials, cceptedDares, pinnedDares, and likedProofs without any size or type validation. 
- **Risk**: Since users/{userId} is world-readable and is frequently fetched (e.g., to display avatars and names in comments, feeds, or leaderboards), a user can store 1MB of garbage data in cceptedDares. Any visitor who sees content by this user will unknowingly download their 1MB profile, causing massive read billing spikes (Economic DoS).
- **Fix**: Move unbounded arrays to private subcollections or strictly enforce a maximum array size/string length for these fields in irestore.rules.

### 38. Client-Side XSS via Unescaped Image/Video URLs (CRITICAL)
> **OPEN**
- **File**: js/app.js (_avHtml, _activeDareCard, _shortsSlideHtml)
- **Issue**: Image and video URLs (photoURL, 	humbnailURL, ideoURL, proofThumbnailURL) are read from Firestore and inserted directly into DOM attributes (e.g., src="") without HTML escaping.
- **Risk**: A malicious user can bypass the client UI, write a payload like "><script>alert(1)</script> into their photoURL or ideoURL field in Firestore, and trigger a Stored XSS attack against any user viewing their profile, mission, or proof. Since irestore.rules only limits the length of these strings to 800 characters, the payload is successfully saved and distributed to all clients.
- **Fix**: Apply HTML escaping (e.g., escHtml or similar attribute-safe escaping) to all URL fields before interpolating them into HTML strings. Ensure _optAv and _optImg properly escape quotes.

### 39. XSS Vulnerability due to Incomplete escHtml Escaping (HIGH)
> **OPEN**
- **File**: js/app.js (escHtml, trending searches)
- **Issue**: The escHtml function escapes &, <, >, and ", but it **does not escape single quotes (')**.
- **Risk**: When escHtml is used inside a single-quoted context (e.g., onclick="doTrendingSearch('')"), an attacker can break out of the string by providing a payload containing a single quote. An attacker can write a malicious search term to the publicly writable searches collection, leading to Stored XSS when users click the trending search item.
- **Fix**: Update the escHtml function to also escape single quotes (e.g., .replace(/'/g, '&#39;')).

