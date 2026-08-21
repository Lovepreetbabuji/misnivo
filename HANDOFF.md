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
- **Never deploy `firestore.rules`.** Edit it, then tell the owner to publish it
  from the Firebase Console.
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

## 2026-08-21 11:40 — CLAUDE
CHANGED: `HANDOFF.md`, `CLAUDE.md`, `GEMINI.md` (new), `AGENTS.md` (new)
WHAT: Gemini reviewed this system and raised four fair problems. Fixed all four
in the setup rather than leaving them as warnings. Nobody has to remember to
read this file now — `CLAUDE.md` and `GEMINI.md` are loaded automatically by
each tool and both say to open it first. The `TURN:` line on line 1 is a real
lock against simultaneous edits. Rule 5 caps the log at 5 entries so it cannot
grow into a reading cost. Rule 4 forbids either assistant assigning work to the
other, which is what would otherwise loop.
VERIFIED: Files exist and are committed. The auto-load itself is only proved by
the next session actually opening this file unprompted — not yet observed.
RISK: `GEMINI.md` / `AGENTS.md` being auto-read is an assumption about
Antigravity that has not been tested. If Gemini does not open this file on its
own, tell it to once and it will still work.
OVER

## 2026-08-21 11:24 — CLAUDE
CHANGED: `index.html`, `manifest.webmanifest`, `sw.js`
WHAT: Finished the icon work from commit `2985ba8`. The five PNGs were replaced
correctly and dropping the stale `icon.svg` link was right — but every reference
still pointed at `?v=2`, so the new artwork sat at an address browsers already
believed they had. Bumped all seven to `?v=3`.
VERIFIED: Live. Manifest parses; the server hands out the new bytes
(`icon-512.png` is 85,645, up from 11,566); app suite 5/5, 0 page errors.
RISK: Nothing known.
OVER

## 2026-08-21 (earlier) — CLAUDE — context, not a handover
Branding: "Shorts" → **Clips** in everything a user reads, both legal texts
included; route is `/clips/<id>` and old `/shorts/` links still open and get
corrected. Saved statement is `misnivo-statement-*.csv`.
Security: mission terms freeze once someone accepts; a proof is judged once, not
flipped; only a creator-picked taker may submit proof (enforced in rules).
Privacy: `settings`, `acceptedDares`, `pinnedDares`, `likedProofs` moved to
`users/{uid}/private/main`.
Boot: the loading skeleton now waits 700ms and only shows if the wait is real;
`_checkBuildFresh()` clears caches and reloads when a stale build is detected.
Waiting on the owner, not on us: the Cloudinary upload preset still has no
`max_file_size`; the topbar and sidebar still carry the old reddish tint.
OVER
