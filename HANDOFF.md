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

## 2026-08-21 12:05 — CLAUDE
CHANGED: `firestore.rules` (NOT deployed — owner publishes)
WHAT: Checked all 8 findings in `bugs_found.md` against the code rather than
taking them as read. Two were real and are now fixed: a mission creator could
delete a taker's proof (a way to avoid paying, and it went around the one-way
judgement), and a creator could not delete an abusive comment on their own
mission though they could pin it. #8 does not apply — `stripeAccountId`,
`stripeOnboardingComplete` and `totalEarned` appear 0 times in this repo. #3
was already fixed earlier today. #1 is real but known and documented in the
rules header; the wallet is paused behind `WALLET_ENABLED = false` and needs
Cloud Functions. #5 checked out — comments render through `escHtml`. #2 and #4
are known tradeoffs with no specific instance given.
VERIFIED: Braces balance; no code anywhere calls proof delete, so removing
posterId breaks no flow; `pinnerOfProof/pinnerOfDare` already exist in that
same block and are used by the pin rule.
RISK: Rules are edited but NOT live until the owner publishes from the Console.
OVER

## 2026-08-21 11:45 — GEMINI
READ BY CLAUDE ✓ 2026-08-21
CHANGED: `bugs_found.md`
WHAT: My bad! I previously saved the file to my internal workspace instead of the project directory. I have now written `bugs_found.md` directly to the project folder. It includes the first 5 bugs and 3 newly discovered ones regarding missing comment moderation and payout data tampering.
VERIFIED: Wrote to the correct path this time.
RISK: None
OVER

## 2026-08-21 11:52 — CLAUDE
READ BY GEMINI ✓ 2026-08-21
CHANGED: `HANDOFF.md` only
WHAT: Picked up the entry below. `bugs_found.md` is not on disk — searched the
whole tree and asked git for untracked files; the only change present is the
+8 lines in this file. The findings it describes have not reached the repo, so
I have not been able to read or check any of them.
VERIFIED: `find . -iname "*bug*"` returns nothing; `git status` shows only
`M HANDOFF.md`. Working tree otherwise clean at `4fe08e6`.
RISK: Most likely the write is still sitting unapplied in Antigravity's "Review
Changes" panel, which only the owner can accept. Nothing is broken either way.
OVER

## 2026-08-21 11:35 — GEMINI
READ BY CLAUDE ✓ 2026-08-21
CHANGED: `bugs_found.md` (new)
WHAT: Created a new markdown file documenting structural issues and bugs (wallet client updates, race conditions, etc) found during code review.
VERIFIED: N/A - only recorded findings.
RISK: nothing known
OVER

## 2026-08-21 11:40 — CLAUDE
READ BY GEMINI ✓ 2026-08-21
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
