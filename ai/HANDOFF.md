TURN: FREE

<!-- ^ Keep this on line 1. FREE = nobody is working. Set it to your own name
     while you work, and back to FREE the moment you stop. If it already has
     someone else's name on it, do not edit any file — say so to the owner. -->

# HANDOFF — shared log between Claude and Gemini

Two assistants work on this repo, one at a time. Neither can see the other's
screen, so this file is the only place work is handed over. The owner switches
between them.

---

## RULES

**1. The `TURN:` line on line 1 is the lock.** Read it before anything else.

| Value | Meaning |
|---|---|
| `TURN: FREE` | nobody is working — you may start |
| `TURN: CLAUDE` / `TURN: GEMINI` | that one is mid-task — **edit nothing**, tell the owner |

Set it to your own name when you start, and back to `FREE` when you stop. This
is what stops two assistants writing to `js/app.js` at the same moment.

**2. Read the newest LOG entry** (top of the list) and add
`READ BY <YOUR NAME> ✓ <date>` under it, so the other side knows it arrived.

**3. `OVER` ends an entry.** It means the writer has finished and stopped.

**4. Never hand work to the other assistant.** Do not write "Claude, please
check line 45". Only the **owner** decides what gets done. This file records
what happened; it is not a to-do list passed back and forth. Without this rule
the two of us give each other tasks in circles and nothing gets finished.

**5. Keep it short — this file is read in full, every session.**
- Six lines per entry is plenty.
- **Maximum 5 entries in the LOG.** Writing the 6th? Delete the oldest.
- Long explanations belong in the git commit message, not here.

**6. Report honestly.** What failed, what you could not verify, what is a
workaround — write it. A log with only successes is worse than no log.

### Entry template

```
## <YYYY-MM-DD HH:MM> — <CLAUDE | GEMINI>
CHANGED: <files touched>
WHAT: <what you did, plainly>
VERIFIED: <how you checked and the result — or "not verified" and why>
RISK: <anything you are unsure about, or "nothing known">
OVER
```

---

## GROUND RULES — both assistants, no exceptions

Each of these is written down because it has already broken something real.

- **Three cache stamps move together** on every deploy: `styles.css?v=` and
  `app.js?v=` in `index.html`, and `VER` in `sw.js`. Miss one and users get a
  half-old app.
- **`node --check js/app.js` is not enough.** It catches typing mistakes, not
  running ones — a top-level `const` used before its line runs parses fine and
  then takes the whole app down. Open the deployed page in a browser before
  calling anything done.
- **`firestore.rules` in this repo is the ONLY source of truth for rules.**
  Never change a rule in the Firebase Console: the file would then no longer
  match what is live, and the next deploy from the file would silently undo it.
  Every rule change is written into the file first — with a comment saying why —
  and deployed from there.
- **The assistant that edits the rules deploys them.** The owner changed this on
  2026-08-21; it used to be Console-only. A deploy is a live production change,
  so check the result rather than trusting "Deploy complete": write a value the
  new rule should refuse, and confirm it is refused.
- **Do not rename:** `acceptDare`, `submitProof`, `submitDare`, `approveProof`,
  `rejectProof`, `uploadToCloudinary`, `openShorts`, `openVideoDetail`,
  `vidThumb`, `guestCheck`, `WALLET_ENABLED`.
- **Do not bring back** features removed in v16: dual profile tabs, follow
  system, ratings.
- **Design is flat black and white.** No glass, no `backdrop-filter`, no
  `#FF0033` on anything new. `.auth-box` (`#000` + 1px white border) is the
  reference surface.
- **"Shorts" appears in no text a user reads** — the word is **Clips**. The code
  still says shorts internally (`openShorts`, `#shortsOverlay`, the CSS, the
  Firestore fields) and that is deliberate.
- **Never write** bet, stake, win, game, jackpot, lottery or contest into
  user-facing text. This is a task marketplace, not a game of chance.
- **New personal fields go in `PRIVATE_FIELDS`** (`js/app.js`), never on the
  public `users/{uid}` document, which anyone can read.
- **Keep secrets out of this file.** It is safe today only because the repo is
  private and the site's SPA rule hides it — both could change.

---

# LOG — newest first, maximum 5 entries

## 2026-08-25 01:40 — CLAUDE
CHANGED: `js/app.js`, `index.html`, `css/styles.css`, `sw.js`,
`PROJECT_CONTEXT.md` — stamp `20260821m`
WHAT: Removed the old "Admin Reports" overlay. It was gated on `ADMIN_UID`, a
constant left as an empty string, so it refused every account including the
owner's and its menu item was permanently hidden — dead since it was written.
The real admin panel's Reports tab does the same job better (100 reports not 50,
an age badge past 24h, View/Remove/Ignore) and writes to `admin_actions` first;
the old resolveReport/dismissReport set status with no record of who did it,
which is why this is a removal and not a repair. Went with it: the
`/admin-reports` URL, the overlay markup, backdrop handler, back-button and
refresh-restore entries, `_checkAdminVisibility` and the wrapper it had put
around `toggleDD`, and two style rules only it used (one a #9B72FF purple older
than the black-and-white theme).
VERIFIED: Live on `20260821m`, real browser. Account dropdown still opens and
closes (it was wrapped by the removed code), no leftover menu item, report and
select-takers modals still wired, the REAL admin panel still refuses a
non-admin and keeps its hidden sidebar entry, `/admin-reports` now 404s,
0 page errors.
RISK: `openAdmin` and `/admin` untouched. Note that admin is a token claim set
only by the Admin SDK — whether any account currently holds it was NOT checked.
Also written to PROJECT_CONTEXT.md: two 404 "bugs" I reported this session were
my own testing at fault. `_bootRoute()` runs only inside `_bootApp()` and
`enterGuestMode()`, and the age gate holds `_bootApp()` back — so a test that
skips the DOB never gets routing at all. The 404 page works.
OVER

## 2026-08-25 00:20 — CLAUDE
CHANGED: `ai/bugs_found.md` only (no app code)
WHAT: The owner enforced App Check on Firebase AI Logic. All three surfaces —
Firestore, Authentication, AI Logic — are now Enforced, ahead of the 2 Nov 2026
deadline. Recorded how to reach that switch, because it is not on the `⋮` menu:
open the AI Logic row → **Set up** under the graph → *Baseline protection* =
**Enforced** → *Replay protection* = **Disabled** (it needs limited-use tokens
this client does not mint, and it burns the free quota).
VERIFIED: Real browser, all three enforced. Model starts; a NORMAL mission is
allowed; a harmful one is blocked; Google answers 200 on every call; a real
mission was created end to end and deleted again. The good-mission case is the
one that matters — the filter fails closed, so a broken token refuses
everything.
RISK: None found in the app. Two notes for whoever tests next. Writes must run
`headless:false` — reCAPTCHA refuses an automated browser a token. And a
`permission-denied` on creating a dare is worth double-checking against
`firestore.rules` before blaming App Check: mine turned out to be my own
payload using `creatorId` where the rule requires `creatorUid`.
LEFTOVER: four throwaway profiles from earlier age-gate tests are still in
`users` — `dmtest.ag2290`, `dmtest.ag334721`, `dmtest.ag325606`,
`dmtest.ag57348`. Harmless, but only an admin can remove them. Missions and
proofs are clean.
OVER

## 2026-08-24 23:10 — CLAUDE
CHANGED: `ai/bugs_found.md` only (no app code)
WHAT: The owner switched App Check enforcement ON for Cloud Firestore and
Authentication. Re-tested the live site afterwards and recorded what enforcement
actually changes.
VERIFIED: Real browser window, brand-new profile — signed-out visitor reads the
feed, brand-new person signs up, signed-in person writes, AI safety filter
blocks, 0 page errors. Test account cleaned up after itself.
RISK: **A headless browser is now refused, and that is correct.** The harness
began returning `403` on the App Check token exchange and
`auth/firebase-app-check-token-is-invalid` on sign-up — reCAPTCHA Enterprise
scores an automated browser as a bot and will not issue it a token. Any test
that signs in or writes must now run with `headless:false`. A 403 there is not
the app being broken; check a real window before concluding anything.
AI Logic is still Unenforced and is safe to turn on: watched on the wire, both
`generateContent` POSTs carry a 965-character App Check header. The third line
in the trace is the CORS `OPTIONS` preflight, which never carries custom headers
by specification and is not what enforcement inspects.
OVER

## 2026-08-21 22:35 — CLAUDE
CHANGED: `index.html`, `js/app.js`, `sw.js`, `ai/bugs_found.md`
WHAT: The safety filter runs on a SECOND Firebase app — `initializeApp(config,
'ai')` on the modular SDK — and App Check is per app instance, so yesterday's
activation covered Firestore and Auth and left the AI calls unverified. Surfaced
by the Console banner: Firebase makes App Check enforcement REQUIRED for AI
Logic on 2 Nov 2026, and this filter fails CLOSED, so on that date every mission
would have been refused rather than let through. Given its own App Check now,
with the key shared via `window.__appCheckKey` so the two cannot drift.
VERIFIED: Live. AI model still starts, keyword filter still blocks, the AI stage
still reaches Google and returns "blocked", and 2 of the 4 tokened requests are
the AI ones. 0 page errors.
RISK: Console currently reads 100% verified / 0% unverified for both Firestore
and Authentication, so enforcing those is safe. AI Logic has no metrics yet —
its row says it is waiting for traffic — so that one is worth leaving until its
number shows too. Deadline for it is 2 Nov 2026.
OVER

## 2026-08-21 22:05 — CLAUDE
CHANGED: `index.html`, `js/app.js`, `sw.js`, `ai/bugs_found.md`
WHAT: App Check is in. reCAPTCHA Enterprise, score-based so nobody sees a
challenge, compat build to match the other three Firebase scripts. Wrapped in a
try/catch that also checks `firebase.appCheck` exists — if that script is slow
or blocked this must not throw, because an error at the top of app.js takes the
whole file with it, which has already happened once on this project.
VERIFIED: On the live site, not by reading the code — reCAPTCHA fetched (18
requests), a 965-character token issued, and `X-Firebase-AppCheck` present on
outgoing requests. App unharmed: signed in, 4 missions, 0 page errors.
Regression 8/8, 7/7, 5/5.
RISK: Enforcement is deliberately still OFF, so nothing is protected yet — the
owner switches it on once the Console shows this build has reached everyone.
Also: the free tier is 10,000 assessments a month org-wide and the token TTL was
set to 1 day; at 1 hour it would have burned that roughly three times faster.
OVER
