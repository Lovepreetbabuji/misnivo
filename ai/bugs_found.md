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

**Summary: 6 fixed · 2 not real · 3 known · 3 open**

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
> **OPEN — real, and the biggest one left.** There is no Firebase App Check
> anywhere in the project (checked: zero references). A script could create
> thousands of accounts or missions and the bill would follow. Fixing it means
> enabling App Check in the Firebase Console **and** initialising it in
> `js/app.js` — a project-level change the owner needs to start. Worth doing
> before the app is promoted anywhere public.

---

## Still open, in the order they are worth doing

1. **#14 App Check** — the only one that can cost real money today.
2. **#1 / #13 wallet on the server** — blocked on the Blaze plan.
3. **#4** — needs a specific flow named before anything can be done.
