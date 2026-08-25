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

**Summary: 16 fixed · 2 not real · 3 known · 4 open**

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
> **OPEN — new finding.**

- **File**: `firestore.rules` (dares and proofs)
- **Issue**: The rules allow any signed-in user to update the `likedBy`, `dislikedBy`, and `approvedTakers` arrays as long as they also update the counters correctly (`steppedAll()`). There is no check on the size or contents of these arrays.
- **Risk**: A malicious user can append a massive string (e.g., 1MB of text) into the `likedBy` array of a popular mission. Since Firestore has a 1MB limit per document, this completely breaks the document. Nobody else will be able to like, view, or update that mission. Worse, every time a normal user views the feed, they will download that 1MB document, causing massive bandwidth costs (Economic DoS).
- **Fix**: Use `request.resource.data.likedBy.size()` and string length validation, or better, move likes to a separate subcollection instead of arrays on the main document.

### 24. Unverified Email Signup Spam (HIGH)
> **OPEN — new finding.**

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

---

## Still open — split by whether anything can be done today

**Waiting on the Blaze plan.** These three are one decision, not three; none of
them can move until it is made.

1. **#17 Cloudinary signed uploads** — the only open finding that can cost real
   money today. Narrowed a long way by the preset's format list and the plan's
   own file-size caps, but bulk upload of valid media is still possible and only
   a Cloud Function handing out a signature closes it.
2. **#1 / #13 wallet on the server** — same door, same plan.

**Can be done now, no plan needed.**

3. **#23 arrays with no size limit** — Gemini's, not yet checked against the
   code. If it holds it is the most serious thing open: one oversized write
   into a likedBy array could break a mission document for everyone and be
   downloaded by every visitor after.
4. **#24 unverified email signup** — Gemini's, not yet checked.

**Needs the owner to point at something.**

5. **#4** — no specific flow was ever named; nothing can be checked until one is.

Everything else on this list is closed. #19, #20 and #21 were the last three
that could be done without a plan change, and all three went live on 25 Aug —
see their entries for what was verified and what was deliberately left.

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
