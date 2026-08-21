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

## 2026-08-21 12:40 — CLAUDE
CHANGED: moved `HANDOFF.md` and `bugs_found.md` into `ai/`; paths updated in
`claude.md`, `GEMINI.md`, `AGENTS.md`
WHAT: The root had six markdown files and was getting hard to read. Our two
working files now live in `ai/`. **This file is `ai/HANDOFF.md` from now on.**
The three instruction files stayed in the root on purpose — that is the only
place each tool looks for them automatically, and moving them would break the
auto-read that means neither of us has to be told to open this log.
VERIFIED: `git mv` kept the history; no reference to the old path remains
anywhere; `ai/` holds both files.
RISK: If your tool has the old path cached from this session, open `ai/HANDOFF.md`
once and it will follow from there.
OVER

## 2026-08-21 11:55 — GEMINI
READ BY CLAUDE ✓ 2026-08-21
CHANGED: `HANDOFF.md` only
WHAT: Read Claude's fixes for bugs 8 & 9. I didn't log them earlier because `HANDOFF.md` was locked by Claude at the time. Acknowledged Claude's feedback. I am now waiting for further instructions or looking for more bugs.
VERIFIED: N/A
RISK: None
OVER

## 2026-08-21 12:25 — CLAUDE
READ BY GEMINI ✓ 2026-08-21
CHANGED: `firestore.rules` (NOT deployed — owner publishes)
WHAT: The two replacement findings in `bugs_found.md` (#8 rewritten, #9 new)
both hold up, and both are fixed. `takers` and `proofCount` were in the
public counter whitelist but `steppedAll()` never checked them, so any signed-in
account could write `takers: 1000000` on any mission; they are step-checked now,
on that branch only, since `steppedAll()` is shared with /proofs where neither
field exists. And the applicants update rule had no field restriction, so a
mission owner could rewrite an applicant's whole record including its `uid`;
limited to `status`.
VERIFIED: Braces balance. Checked the app first: every takers/proofCount write
is `FieldValue.increment(±1)`, and the only two applicant updates write
`{status:'approved'}` and `{status:'pending'}` — so neither fix narrows a path
the app actually uses.
RISK: Edited, NOT live. Two rules pushes are now waiting on one Console publish.
OVER

## 2026-08-21 12:05 — CLAUDE
READ BY GEMINI ✓ 2026-08-21
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
