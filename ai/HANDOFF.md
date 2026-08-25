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

## 2026-08-25 05:20 — CLAUDE
CHANGED: `js/app.js`, `index.html`, `css/styles.css`, `sw.js` — stamp
`20260825f`
WHAT: Guest browsing is the default. Signed-out no longer shows the sign-up
wall — it enters guest mode, and signing out returns there too, so a shared link
finally shows what it advertises. The 15-minute clock is gone with it: countdown
badge, expiry timer, and the non-dismissible "your preview is over" popup.
`guestCheck` is what asks for the account, and it was only on 12 call sites —
fine while guests were rare, not fine now that every first visit is one. Eight
write paths would have failed silently against the rules: liking/disliking a
mission or proof, liking a comment, and both comment boxes. All gated, each with
its own message, plus `submitProof`, which had `bannedCheck` but no guest gate.
The prompt is now in the overlay stack so the phone back button dismisses it
instead of navigating away; no URL of its own, it is a nudge not a place.
Theme: Sign Up in the topbar was #fff on #D9D9D9 — near-invisible, on the button
a visitor most needs. Now black on white, Login a white outline beside it, both
`nowrap` (it was breaking across two lines on a 412px phone). The prompt
inherited `.modal`, still translucent reddish with blur — now the flat black +
white hairline from `.auth-box`. Its icon slot took colour emoji, three of them
empty strings, so it jumped about; now a monochrome Material glyph per action.
VERIFIED: Live on `20260825f`, real browser, a profile that has never signed
in. 13/13: lands in the app not on a wall, guest mode on, no badge, feed loads,
Sign Up legible (#fff bg / #000 text), all four sampled actions name what they
need, prompt is rgb(0,0,0) with no blur and a glyph icon, back dismisses it,
Sign Up reaches the real screen, 0 page errors.
RISK: 🔴 Found and fixed on the way in — `sw.js` VER had gone BACKWARDS
(index.html on `e`, worker on `d`). Caches were still being purged so nothing
was stuck, but a stamp that counts down will eventually match one a device
already holds and leave the old build in place. All three moved forward together
to `20260825f`. Worth checking all three values, not just that they changed.
Not changed, and not mine to change unasked: mission cards show the bounty as a
green "$1,000" — dollars on a rupee app, and a colour on a black-and-white one.
OVER

## 2026-08-25 19:30 — CLAUDE
CHANGED: `firestore.rules` (DEPLOYED), `js/app.js`, `index.html`, `sw.js`,
`css/styles.css`, `ai/bugs_found.md`, `PROJECT_CONTEXT.md` — stamp `20260825e`
WHAT: Closed the last three findings that did not need a plan change. #19 —
a completed mission accepted more proof; the rule never read `completed`, and
because the update rule judges each proof alone, a creator could approve a
second one and record two people as completing one bounty. Now gated in the
rule plus refused in `openProof()` and again in `submitProof()`. #20 — comments
must name a real proof or mission, follows a real account. #21 — static Open
Graph / Twitter tags.
VERIFIED: Rules deployed then tested by doing the thing they should refuse, on
the live site with a throwaway account: proof on an open mission allowed, same
write after closing it `permission-denied`; fake comment id and fake follow
target both refused while the real ones still worked. 12/12. The tags were
checked with `curl` and no JavaScript, which is how a scraper sees them.
Test mission and account deleted.
RISK: 🔴 **I swept another session's uncommitted work into my commit and pushed
it live.** `git add -A` picked up an in-progress `css/styles.css` (guest UI to
black-and-white) and an `app.js` change that removes the sign-up wall — a
visitor now lands straight in the app instead of the auth screen. I did not
write either and had not read them before pushing. I smoke-tested afterwards:
the site boots, guest mode is on, Sign Up still reaches the auth screen,
0 errors — so nothing is broken, but that was luck, not care. **Use
`git add <paths>` on this repo while a second session is open.**
Also: `users/{uid}/private/main` has no delete rule, so a test account cannot
remove its own private drawer — one orphan per throwaway account, which is
where the leftover `dmtest.*` profiles come from.
OVER

## 2026-08-25 03:05 — CLAUDE
CHANGED: `js/app.js`, `index.html`, `sw.js`, `firestore.indexes.json`,
`ai/bugs_found.md`, `PROJECT_CONTEXT.md` — stamp `20260825c`
WHAT: Checked the previous session's read sweep against the live site rather
than against its own report. Its claims hold — including the honest one, that
`count()` is genuinely absent from the compat SDK this app loads (confirmed by
diffing the two 9.22.2 builds: modular has `getCountFromServer`, compat has no
aggregation at all). The "Load older missions" button is wired and works
(60 -> 120); it correctly does nothing while there is nothing older.
Two reads of the same shape were still uncapped, now #22: **applicants** on one
mission (capped 200, oldest first, fetch cap+1 so the header can say "200+")
and **startMyProofsListener** (capped 500, newest first).
VERIFIED: Live on `20260825c`. Both caps present, the sorted query runs, all
six pages open, no index complaints, 0 page errors — plus end to end with a real
mission and a real applicant: header exact at "1 applicant", and "1+ applicant"
when capped. Test data deleted.
RISK: 🔴 The proofs sort needs a composite index (`takerId` + `createdAtMs`),
now in `firestore.indexes.json` and deployed. **Deploy an index BEFORE the code
that sorts** — and do not assume an empty collection builds instantly. I
deployed first and the live site still returned `failed-precondition` on the
first check because it was mid-build. The CLI reports no state field, so it
always looks fine; poll the real query in a browser instead. Safe to sort here
only because `proofs` was empty — `orderBy` drops documents missing the field
out of results entirely.
Also fixed a numbering drift in bugs_found.md: there were two #18s, so
everything after was one behind. Now 18-22, with the two references in the
"Still open" list corrected to match.
OVER

## 2026-08-25 11:20 — CLAUDE
CHANGED: `js/app.js`, `index.html`, `sw.js`, `ai/bugs_found.md` — stamp
`20260825d`
WHAT: Profile photo now goes through a canvas and uploads as `image/jpeg`, long
edge capped at 512px. Both thumbnails already did this; the profile photo was
the one path still uploading the raw file, which mattered the moment the owner
put an allowed-formats list on the Cloudinary preset — an Android `.webp` would
have been refused, blocking a real person from setting their picture. Also
checked Gemini's two new findings, #19 and #20, and wrote verdicts.
VERIFIED: Live on `20260825d`, real browser, 6/6 then 11/12 (the one failure
was my harness calling a function that does not exist, not the app). Driving
the real `#pePhotoInput`: `.webp`, `.png` and `.jpg` all come out `image/jpeg`;
a 3000×2000 PNG went 119KB → 2KB at 512×341; an undecodable file is refused
with a message. Missions page, home, 0 page errors.
RISK: #19 is real but low — the orphan documents it allows are invisible, not a
way into anyone's data, and the `exists()` fix costs a billed read per comment
and per follow. Left for the next rules deploy. #20 is real, but the report's
"dynamic tags" fix cannot work: link previewers never run JavaScript and this
is an SPA, so per-mission cards need HTML rendered per URL (a Pages Function).
The static version is waiting on the owner's words and picture.
NOTE — not a complaint, a fact worth recording: commit `e2463a7` at 09:46
capped two more queries and deployed a Firestore index while `TURN` was FREE,
from a second session. No conflict — my work is intact, and I confirmed the
`takerId + createdAtMs` index really is deployed. It left no LOG entry, so this
line is the only record of it.
OVER

## 2026-08-25 10:30 — CLAUDE
CHANGED: `js/app.js`, `index.html`, `sw.js`, `ai/bugs_found.md`,
`PROJECT_CONTEXT.md` — stamp `20260825b`
WHAT: Bug list #15 and #16 fixed, #17 narrowed, and one nobody had reported.
Queries that fetched whole collections are capped: the admin Stats and Users
tabs, and — the worse one — the home feed, leaderboard, profile videos, comment
recount and follower counts, all of which run for every visitor on every open,
not once in an admin panel. Missions feed grew a "Load older missions" button
instead of stopping dead at 60. `uploadToCloudinary` now checks size and type
itself so no call site can skip it.
VERIFIED: Live on `20260825b`, real browser, 19/19. Paging exercised by forcing
a 1-mission window: it reported more, showed the button, widened on press, and
the button vanished when everything was shown. Guard refuses a 6MB image, a
101MB video and a PDF; a valid file still reaches the request. Home, explore,
leaderboard, mission detail all load. 0 page errors.
RISK: 🔴 **`count()` does not exist on the compat SDK 9.22.2 this app loads** —
`Query.count` is undefined. I wrote the aggregation version first and only
found out by opening the live panel, where every number had become "—". Counts
are bounded reads now ("1000+" at the ceiling), which is weaker: past the cap
the number is not true, and the leaderboard is approximate past 500 proofs.
The proof caps are deliberately NOT ordered — older proofs may lack
`createdAtMs` and Firestore drops documents missing the sort field, which would
hide videos. Not verified: the admin panel as a real admin, since nobody is
known to hold the claim; those functions were called directly. The database
currently holds 0 approved proofs, so the video paths ran empty.
OVER
