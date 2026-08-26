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

## 2026-08-26 15:05 — CLAUDE
CHANGED: js/app.js, index.html, sw.js, ai/bugs_found.md, PROJECT_CONTEXT.md —
stamp 20260826a
WHAT: Gemini had added nothing new, so this was a hunt, and it found two real
bugs. #28: the report flow had NO account check anywhere. openReportModal is
reachable from six guest-visible places, and submitReport then read user.uid
off a null user — the TypeError was swallowed by that function’s own
try/catch and shown to the reporter as a toast reading "Error: Cannot read
properties of null". #29: the earlier currency pass fixed ONE badge and
claimed the job; thirteen more are written inside template literals, which the
first grep could not match, and they are the ones on every card people look at.
VERIFIED: 8/8 live as a guest — Report now shows the "Report this" prompt, the
form stays shut, nothing throws, no raw JavaScript text reaches the screen;
every bounty element reads Rs., and that check fails rather than passes if it
finds no bounties at all.
Before hunting I re-tested yesterday’s rules change against the real buttons,
reading the DATABASE back rather than the screen — those writes end in
.catch(() => {}) so a refusal would be invisible. 9/9: likes, dislikes,
like-to-dislike switches, comments and views all still land.
RISK: The scan that found #28 named nineteen functions reading user.* with no
guard nearby. Most are called from paths already gated, and I checked which
were reachable by a guest — only report was. That list is a heuristic, not a
clean bill of health: a different entry point could reach another of them.
Routing was swept too — every page URL, a shared mission link and a shared
profile link all open correctly. There are still ZERO approved proofs in the
database, so nothing on the video half of the app was exercised with content.
OVER

## 2026-08-26 01:10 — CLAUDE
CHANGED: firestore.rules (DEPLOYED), index.html, css/styles.css, sw.js,
ai/bugs_found.md — stamp 20260825n
WHAT: Fixed my own breakage from the last build, then took Gemini #23 and #24.
The four drawer icons I added rendered as the WORDS description/lock/rule/mail:
the sidebar draws in Material Symbols Outlined, which this page loads as a
SUBSET listed in icon_names=, and I added rows without adding names. The Round
face in the stack does not save you. Logo: what was wanted was the mark on the
LOADING screen (the same one that becomes the home-screen icon after send-to-
desktop, so it showed twice per launch) — removed; the phone topbar keeps its
mark, hiding it there was my misreading and is reverted.
#23 was real and was the most serious thing open: nothing guarded likedBy /
dislikedBy at all, so any signed-in account could write 900KB into a mission
everyone downloads. selfOnlyList() now allows only the caller’s own uid in or
out, plus a size clause because hasOnly() is happy with 50,000 copies of one
legitimate value.
VERIFIED: Icons 4/4 as glyphs, splash bare, topbar mark back. Rules attacked
live against the deployed version: 200KB string permission-denied, another
account’s uid permission-denied, normal like and unlike still allowed. 7/8.
RISK: Two things the first rules attempt got wrong, both found by testing, not
reading. prev()/next() default a missing field to 0, so .size() on a never-liked
mission would have refused the FIRST like — prevList()/nextList() default to [].
And my first attack passed because the test account OWNED the mission: the owner
branch let a creator write anything, straight past the public guard. Guarded now.
#24 (unverified email signup) is REAL but left OPEN on purpose: the scripted
part is what App Check already stops, and gating emailVerified is friction paid
by every honest sign-up. Three options written up for the owner to pick.
OVER

## 2026-08-25 23:40 — CLAUDE
CHANGED: js/app.js, css/styles.css, index.html, sw.js, ai/bugs_found.md,
PROJECT_CONTEXT.md — stamp 20260825m
WHAT: Seven things off the owner list. Two were real bugs. HOME STUCK ON A
SKELETON (#26): renderHome had nowhere to record that the feed was already
fetched, so it read "no approved videos" as "not loaded yet" and re-armed the
loader on every visit — 320ms later it wiped the grid, mission cards included,
and left it wiped for as long as the network took. SOMEBODY ELSE’S PROFILE
(#27): _closeDetailOverlays closed the mission, video and shorts views and
never the public profile overlay. Plus: bounty badge said $0 (now Rs.), the
per-page legal footer is gone and those links are drawer rows with icons,
desktop Settings has a real white edge, and the brand mark is hidden in the
phone topbar.
VERIFIED: The skeleton bug was REPRODUCED first — Firestore held at 6s on a
412px viewport, skeleton at 320ms and still skeleton at 12s — then re-run after
the fix: no skeleton, 4 cards intact throughout. Profile overlay 4/4. UI checks
8/9 on both viewports, the one failure being my own selector. 0 page errors
anywhere.
RISK: The desktop Settings edge took three attempts and the reason is worth
knowing: a blanket rule sets border:1px solid rgba(255,255,255,.28) !important
on .modal and fifteen other panel classes, so nothing weaker than !important
can give any panel a different edge.
Gemini’s #23 (unbounded likedBy arrays) and #24 (unverified email signup) are
still UNCHECKED — #23 reads like the most serious thing open if it holds.
The AI safety filter was NOT re-tested this round; last verified on 20260825i.
OVER

## 2026-08-25 21:15 — CLAUDE
CHANGED: `js/app.js`, `index.html`, `sw.js`, `misnivo-sm.webp/.png` (new),
`ai/bugs_found.md`, `PROJECT_CONTEXT.md` — stamp `20260825i`
WHAT: A real user reported the app is slow to load. Measured it first — cold
3.34s / 1100KB / 37 requests — then fixed the three things that accounted for
most of it: uploaded images were served at ORIGINAL size (four feed images =
390KB, one of them 150KB, for cards a few hundred px wide; `_optImg` now sizes
them), the logo was a 113KB PNG preloaded at high priority (5KB as WebP), and a
SECOND reCAPTCHA loaded for every visitor for the AI filter's separate Firebase
app. After: 2.59s / 650KB / 30 requests, one reCAPTCHA.
VERIFIED: Measured before and after on the live site, same harness. Then signed
in and drove the real flow: normal mission ALLOWED in 4.3s, harmful BLOCKED in
3.7s, no un-sized Cloudinary image left on the page, logo renders, 0 errors.
Throwaway account deleted.
RISK: 🔴 **I broke the safety filter mid-way and it is worth knowing how.**
Making the AI app lazy moved its App Check token fetch into the moment of use;
that token is reCAPTCHA-backed, takes 5-6s cold, and ate the 20s budget in
`_aiAsk`, so the check timed out — and it fails CLOSED, meaning every mission
refused. Only caught because I tested the filter itself, not just the page.
Fixed by waking it in `openPost()` instead. **A warm model answers in 1.4-3s;
an AI call taking tens of seconds is the App Check token, not the model.**
Also fixed in bugs_found.md: two entries had been added as a second #21 and
#22, now #23 and #24, and a heading had been merged into nonsense. Neither is
checked against the code yet — #23 (unbounded likedBy arrays) reads like the
most serious thing open if it holds.
OVER

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
