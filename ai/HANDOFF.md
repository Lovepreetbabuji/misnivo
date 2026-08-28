TURN: CLAUDE

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

## 2026-08-28 16:40 — CLAUDE
READ BY CLAUDE ✓ 2026-08-28 (both 12:10 and 12:20 entries)
CHANGED: js/app.js, index.html, css/styles.css, sw.js, firestore.rules
(DEPLOYED), ai/bugs_found.md — stamp 20260828c
WHAT: Owner's pot revision. The thumbnail carries ONE number now — the total —
and the split moved into the sheet; where a card said "N accepted" it says how
many people are in the pot. The open pot row inside a mission became a Pot
button beside Accept, and behind it a sheet: the box on top, a ranking under
it, biggest backer first with ties going to whoever got there first. The
ranking is per PERSON, so two gifts from one name add up into one row.
Then Gemini's three pot findings, all three real when tested, all three fixed
in the rules (#41/#42/#43 in bugs_found.md), plus its #38/#39 — #38 was
sixteen places, not one, and escaping alone would not have closed it because
javascript: survives escaping and the profile website link was already escaped.
VERIFIED: 9/9 UI, 15/15 rules, 7/7 on clean data, 11/12 images-and-payloads.
The one FAIL was my own assertion being wrong, not the code: I expected an
https:// payload to be REJECTED when the right answer is escaped-and-inert, and
the test that counts what the payload DID passed — nothing ran, no onerror
attribute, the whole string sat inside src as text.
Probes that mattered: a raise with no receipt, a receipt spent twice, a receipt
that does not exist, claiming more than the receipt says, bumping the head
count with a repeat receipt, a second receipt at the fixed first-time address,
draining, a receipt in another name, editing a receipt, Rs.5000 in one — all
refused. Creator refused on their own mission both by the form and by the rule.
RISK: Two things the owner should know rather than only me.
1. Receipts are written BEFORE the total and NOT in one batch — they cannot be,
because writes in a batch cannot see each other and the rule has to read the
receipt back. So a half-failure leaves a receipt standing with the total
lagging it. The summary can be short, never long. That is deliberate.
2. potContributors is exactly "unique people" now, but only because the first
receipt lives at a fixed address {missionId}__{uid}. Anything that changes how
receipt ids are made breaks the head count silently. Do not touch that id.
🔴 TEST DATA to clear (needs the admin claim): missions SbEJK6jmqOa8SHBFINUt
(Rs.940, 4 people) and k3BSm0NMZ7H15TEK39Ui (Rs.50, 1 person), both "pot test
mission", plus their pot_contributions receipts, two of which are ORPHANS from
my probes — real receipts whose total was refused, so that mission's list adds
up to Rs.20 more than its header until they go. Receipts are admin-delete-only
by design.
The bell notification for the creator is still NOT built and still cannot be
from a browser. See PARKED.md.
OVER


## 2026-08-28 12:20 — GEMINI
CHANGED: ai/bugs_found.md, ai/HANDOFF.md
WHAT: Continued audit for logic/XSS bugs per owner request. Found two unescaped HTML interpolation issues in `js/app.js` (XSS via `photoURL` and incomplete `escHtml` missing single quote). Added them as #38 and #39 to `bugs_found.md`.
VERIFIED: Code review verified that `_optAv` injects raw URL strings into `src="..."` without HTML encoding, and `escHtml` does not escape single quotes.
RISK: XSS vulnerabilities present a critical risk. Needs owner permission to fix in `js/app.js`.
OVER

## 2026-08-28 12:10 — GEMINI
READ BY GEMINI ✓ 2026-08-28
CHANGED: ai/HANDOFF.md (No app code)
WHAT: 1. Answered owner's questions about SPA vs bundled app structures (React/Next) and PWA vs Native (Playstore) benefits.
2. Reviewed Claude's new THE POT feature. Found serious backend logic flaws in `firestore.rules`.
VERIFIED: Code review only.
RISK: 🔴 POT FEATURE BUGS:
1. `potGrowsOnly` limits increments to 500, but DOES NOT enforce a matching `pot_contributions` receipt. An attacker can write a loop to inflate a mission's `potTotal` to 10,000,000 without leaving any receipts.
2. The rules for `pot_contributions` DO NOT prevent the mission creator from funding their own pot (only the UI hides it).
3. `potContributors` can be incremented multiple times by the same user if they spam the submit button, because the rule allows +1 without checking uniqueness, and the client-side check (`firstTime`) is subject to race conditions.
OVER

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
