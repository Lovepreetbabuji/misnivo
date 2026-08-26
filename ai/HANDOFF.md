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

## 2026-08-26 21:40 — CLAUDE
CHANGED: css/styles.css, index.html, js/app.js, sw.js, ai/bugs_found.md,
PROJECT_CONTEXT.md — stamp 20260826f
WHAT: Settings rebuilt to the three reference screens the owner sent. Fields go
transparent with a light hairline (they are .pe-input — an earlier pass
restyled .f-input and never touched this form, which is why it still looked
like grey slabs), the avatar loses its neumorphic shadow for a thin ring,
Change Photo and Save become solid white pills, the four nav rows get icons
they never had, and on a phone the app topbar now gets out of the way so
Settings is the whole screen. Also #31: openSettings refused guests with a bare
"Sign in first" toast instead of the prompt every other gated action shows.
VERIFIED: 7/7 signed in on a 412px viewport, plus screenshots read back rather
than trusting computed styles — which is what caught the last two gaps.
Throwaway account deleted.
RISK: The icon change took two rounds for the same reason the settings border
took three: a blanket rule sets .mi{ font-family:Material Icons Round
!important }, so the Symbols face was never reached and the FILL 0 beside it
applied to a font with no FILL axis. Five other rules in the file already carry
!important for exactly this; mine now says why in a comment.
Worth a look, NOT changed because it may be deliberate: the bounty badge on
every feed card is var(--green) — the loudest thing on a screen the owner keeps
asking to be black and white. Green for money is a real convention, so this is
their call, not mine.
OVER

## 2026-08-26 18:30 — CLAUDE
CHANGED: ai/PARKED.md (new), ai/bugs_found.md, ai/HANDOFF.md,
PROJECT_CONTEXT.md — no app code, no deploy
WHAT: The owner asked for the things they have deliberately put on hold to be
visible as decisions rather than sitting in the bug list looking unfinished.
New file ai/PARKED.md: the four items behind the Blaze plan (#30 rate
limiting, #17 Cloudinary, #1/#13 wallet), the two waiting on an answer from
them (#24 email verification, #4), the loose ends that are not findings, and a
section for things already rejected so they do not get re-proposed. Each of
those six entries in bugs_found.md now carries a PARKED marker pointing at it,
and it is named in the PROJECT_CONTEXT file map and in the ground rules here.
VERIFIED: n/a — documentation only. Markers counted: 6 of 6 placed.
RISK: The point of the file is the opposite of a queue, and the ground rule
above says so: anything in it is a decision that was made out loud, not free
work waiting to be picked up. Implementing a parked item because it looks open
is the exact mistake it exists to prevent — if one becomes urgent, say so to
the owner and wait.
Two things they still owe an answer on and know it: which of a/b/c for #24
(parked today, on purpose), and the Blaze cost breakdown they asked for, which
has not been produced yet.
OVER

## 2026-08-26 17:20 — CLAUDE
CHANGED: ai/bugs_found.md, PROJECT_CONTEXT.md only — NO app code, no deploy
WHAT: The owner asked whether the app has rate limiting. Checked rather than
remembered: it does not. No throttle, no cooldown, no lastPostAt, no time
comparison in js/app.js or firestore.rules; Cloud Functions exist in the repo
but functions:list fails, which is Spark saying no. Written up as #30, and #14
now carries a warning at the top, because its heading says FIXED and that only
covers the SCRIPTED half — App Check asks whether you are a real browser, never
how many times you have done something.
VERIFIED: n/a — nothing was changed. The finding itself was checked by grep
across both files and by firebase functions:list against the live project.
RISK: Worth knowing before anyone tries it: a rules-only rate limit does NOT
work here. Rules can compare request.time to a stored timestamp, but the client
writes that timestamp, so an attacker just never updates theirs and passes for
ever. Also recorded: reCAPTCHA free tier is 10,000 assessments a month org-wide
and App Check is ENFORCED, so crossing it returns 429 and locks out real users
while costing an attacker nothing — the only ceiling this project has points at
the victim.
A UI cooldown was offered as a partial measure and the owner declined it on
purpose, in favour of doing the real thing on Blaze. Not implemented.
The open list was stale and is rebuilt: #23 is fixed, #24 has a verdict, and
the Blaze queue is FOUR items now, not three.
OVER
