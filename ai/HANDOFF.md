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
- **`ai/PARKED.md` is a list of the owner’s DECISIONS, not a queue.** Anything
  in it was deliberately put on hold — it is not an oversight and it is not
  free work waiting to be picked up. If you think a parked item has become
  urgent, say so to the owner and wait. Same rule as §4 above.
- **Keep secrets out of this file.** It is safe today only because the repo is
  private and the site's SPA rule hides it — both could change.

---

# LOG — newest first, maximum 5 entries

## 2026-08-27 12:10 — CLAUDE
CHANGED: firestore.rules (DEPLOYED), js/app.js, index.html, css/styles.css,
sw.js, ai/PARKED.md — stamp 20260827f
WHAT: Built THE POT — anyone signed in except the creator can add Rs.10-500 to
a mission. New /pot_contributions collection (one receipt per contribution),
potTotal and potContributors on the mission, a sheet with quick-pick chips, a
pot row listing who chipped in, and the card badge now showing reward + pot as
one number with the split underneath. Nothing is charged and the copy says so.
Also cleaned five leftovers the wallet removal missed — the worst still wrote a
fake Rs.1,00,000 into EVERY new account’s private drawer.
VERIFIED: 22/22 live. Rs.10 lands (+10, +1 person), a second gift raises the
total but not the people count, the form and the RULES both refuse below-min,
above-max, decimals, another person’s name, a missing mission, shrinking the
pot, inflating it, and editing a receipt. Creator refused on their own mission.
Guest asked to sign up. Badge reads "Rs.130 · Rs.100 + Rs.30 pot". 0 errors.
RISK: The spec asked for a bell notification to the creator. NOT BUILT and it
cannot be from a browser — /notifications is allow create: if false for every
client, deliberately. The pot row tells the creator instead. Options written
up in PARKED.md; the "let contributors write it" one must not be taken.
The spec also said #FF0033. Not used — the ground rules above forbid it on
anything new and --blue has been white since this app went black and white.
Say the word and it turns red.
🔴 LEFTOVER TEST DATA the owner must clear (needs the admin claim): missions
SbEJK6jmqOa8SHBFINUt and k3BSm0NMZ7H15TEK39Ui, both "pot test mission", one
carrying Rs.30 of test pot, plus 2 pot_contributions receipts. Receipts are
admin-delete-only by design and their creators’ accounts are gone, so I
cannot remove them myself.
Also: creating several accounts back to back from one browser gets App Check
token-invalid and every write then reads as permission-denied. That is the
feature working. One clean sign-up per browser profile, with a gap.
OVER

## 2026-08-27 08:20 — CLAUDE
CHANGED: js/app.js, index.html, sw.js, ai/bugs_found.md — stamp 20260827d
WHAT: Swept the three areas never checked before — search, notifications,
offline. One real find (#39): /searches is signed-in-only in the rules, but
the client had no matching check, so every guest search fired a transaction
that came back 403 and was swallowed. Guarded. The other two came back clean,
recorded as #40 rather than left unmentioned.
VERIFIED: 9/10 before, 9/10 after with the 403s gone from the search phase.
Offline is the standout: with the network cut, pages still switch and a full
reload still serves the app from the service worker instead of a browser
error page; the feed recovers on its own when the network returns.
RISK: 🔴 A finding of mine turned out to be nothing, and the reason is worth
carrying. My first search probe counted img[onerror] after typing an XSS
payload, found six, and reported an injection. Those six are the app’s own
AVATARS — they use onerror for the fallback letter. A dedicated probe showed
the payload never executed, never became an element, and is escaped on the
page. **Count what the payload did, not what looks like it.**
Worth telling the owner rather than only fixing: Trending Searches has only
ever counted signed-in people, so that list fills far slower than it looks
like it should. Opening it to guests is how you get a fake trending list, so
it should stay this way — but the number means something narrower than its
label says.
OVER

## 2026-08-27 06:40 — CLAUDE
CHANGED: firestore.rules (DEPLOYED), ai/bugs_found.md — no app code, no deploy
WHAT: A hunt that started from Gemini’s #35 rather than from scratch. That
was not one bug, it was a SHAPE — a rule that guards one branch and not its
twin — so I swept every collection for the same shape and found two more,
both real when tested. #38: `users` create was `isSelf(userId)` and nothing
else, so a new account’s FIRST write (the one initUser makes seconds after
sign-up) could carry a 50KB bio past every cap on the update branch; and the
proof rejectionReason was capped on create, which the TAKER does, while the
mission owner writes that field on the update, where nothing checked it. The
private drawer’s create was uncapped too.
VERIFIED: 9/9, and the first check was the one that mattered — a real sign-up
through the real form still works and its profile document still lands.
Adding a condition to a create branch is exactly the change that breaks every
new account. Then: 50KB bio at create refused, normal bio allowed, 50KB
rejection reason refused, normal rejection allowed, proof submission
unaffected. Test accounts deleted.
RISK: The caps are now ONE function (userTextOk) called by both branches
rather than two copies of the same list. The drift between those copies was
the entire bug, so anything added to one must never be added to only one.
Note for the next sweep: my earlier audit asked "which FIELDS have no limit"
and walked the create rules. That question cannot find this class. The right
question is "does every branch that can write this field check it".
One result was a red herring worth writing down: an update that rewrites the
same bytes has an EMPTY diff, so onlyTouches() passes trivially and the write
is allowed whatever the content. It changes nothing, so it is not a hole —
but it reads like one in a test.
OVER

## 2026-08-27 04:15 — CLAUDE
CHANGED: index.html, js/app.js, css/styles.css, sw.js, firestore.rules
(DEPLOYED), ai/bugs_found.md, ai/PARKED.md, PROJECT_CONTEXT.md — stamp
20260827c
WHAT: THE WALLET IS REMOVED, at the owner’s request — page, six modals, three
menu entries, ~400 lines of JS, 52 CSS rules. It closes #1 and #13 by deletion,
which is the only thing that ever could: no rule can tell a real debit from an
invented one. Posting charges nothing now. Also escaped thirteen spots where
user text reached the page raw (#33), and fixed Gemini’s two new findings,
both of which my own audit that same day had missed: comment text was capped
on CREATE but not on UPDATE (#35 — post "hi", edit it into a megabyte), and
counters were never required to start at zero, so a mission could be born with
likeCount 1000000 and sit at the top of most-liked (#36).
VERIFIED: 11/13 on the wallet removal — the two failures are my own test
asserting on #profStats, which git shows never existed. 7/7 on Gemini’s two.
Wallet page, modals and menu entries gone, /wallet lands on home, every page
opens, signup and posting still work, 0 page errors.
RISK: I BROKE THE LIVE SITE DOING THIS, and that is the part of this entry
worth reading. One regex meant to delete a fifteen-line function used a lazy
match that ran past its own closing brace — that function builds HTML in
nested template literals full of braces — and took _skelFeed, _skelAfter,
_bootSkelHide and renderHome out with it. 711 lines removed where 430 were
intended; the home page threw a not-defined error. Fixed by restoring app.js
from the previous commit and re-applying every cut by EXACT STRING MATCH.
DO NOT DELETE CODE WITH A REGEX IN THIS FILE. _skelTxnRows is still there,
unused, because removing it is what caused this and fifteen dead lines are not
worth a second attempt on a live site.
Two corrections to the record: the owner DOES hold the admin claim (earlier
notes here said nobody did), and the Blaze queue is two now, not four.
Left open on purpose — #34: _renderProfileStats and _renderProfileBadges have
never rendered anything, because #profStats and #profBadges are not in
index.html and never were. Either markup was lost or the feature was never
finished, and which one it is changes the fix, so the owner should say whether
that stats row is wanted at all.
OVER

## 2026-08-27 00:30 — CLAUDE
CHANGED: firestore.rules (DEPLOYED), ai/bugs_found.md — no app code
WHAT: The owner raised maxlength on the bio box in the inspector, typed past
it and saved. Their instinct was right and bigger than the box they tried.
The 1000-char bio itself IS refused today (textOk caps bio at 300, verified),
but textOk only ever guarded EIGHT named fields — every other field on every
collection had no ceiling at all. Tested live from an ordinary account: 50KB
went into users.socials/settings/pinnedDares/likedProofs, dares.tags and
dares.creator, proofs.note and takerName, comments.userName, reports.reason,
and rewardAmount took 999999999. Eleven for eleven, on collections the feed
downloads. Fixed with listOk/mapOk/numOk beside textOk — join() and values()
collapse a list or map into one string, so one length check covers both "too
many entries" and "one enormous entry".
VERIFIED: 5/5. All eleven oversized writes now permission-denied, AND seven
normal flows still work — posting a mission with five tags, submitting a
proof, commenting, reporting, saving a profile, changing a settings toggle,
pinning missions. Test data and account deleted.
RISK: I briefly thought I had broken sign-up — two runs failed at signup right
after the deploy. I had not: five different user-document creates all
succeeded when tested directly. The harness was signing up ~4s after page
load, before App Check had minted a token. **Give it ~12s before any write in
a test, and do not read an early permission-denied as a rules bug.**
Still true and deliberate: the form caps bio at 160 while the rule allows 300.
The ceilings are set clear of what the app writes on purpose, so a bypass can
still get ~2x the form limit. Tightening them to match exactly is a decision,
not an oversight.
OVER
