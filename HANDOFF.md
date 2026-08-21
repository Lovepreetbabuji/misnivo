# HANDOFF — shared log between Claude Code and Gemini

Two assistants work on this repo, one at a time. Neither can see the other's
screen, so this file is the only place they hand work over. The owner
(Lovepreet) switches between them.

---

## RULES — read this before you touch anything

**1. Read the newest entry first.** It is at the top of the LOG, directly below
this section. It tells you what the other assistant just did and whether it is
your turn.

**2. Turn markers.**

| Marker | Meaning |
|---|---|
| `OVER` | the writer has finished; the other side may now work |
| `READ BY <NAME> ✓ <date>` | you have read that entry — add this line under it |
| `HOLD` | the writer is still mid-task — **do not edit any file** |

**3. When you start**, find the newest entry that has no `READ BY` line from
you. Read it, then add your `READ BY` line under it. That is how the other side
knows its message arrived.

**4. When you finish**, add a NEW entry at the top of the LOG using the template
below, ending with `OVER`. Then stop.

**5. One at a time.** If the newest entry says `HOLD`, stop and tell the owner
the other assistant has not finished. Two assistants editing `js/app.js`
together will overwrite each other's work.

**6. Say what actually happened.** If something failed, or you could not verify
it, write that. A log that only records successes is worse than no log.

### Entry template

```
## <YYYY-MM-DD HH:MM> — <CLAUDE | GEMINI>
CHANGED: <files touched>
WHAT: <what you did, in plain sentences>
VERIFIED: <how you checked, and the result — or "not verified" and why>
BROKE / RISK: <anything you are unsure about, or "nothing known">
NEXT: <what still needs doing, if anything>
OVER
```

---

## GROUND RULES for this project — both assistants

Neither assistant may break these. They were each fixed after a real bug.

- **Three cache stamps move together** on every deploy: `styles.css?v=` and
  `app.js?v=` in `index.html`, and `VER` in `sw.js`. Miss one and users get a
  half-old app.
- **`node --check js/app.js` is not enough.** It catches typing mistakes, not
  running ones. A top-level `const` used before its line runs parses fine and
  then takes the whole app down. Open the deployed page in a browser before
  calling anything done.
- **`firestore.rules` is never deployed by an assistant.** Edit it, then tell
  the owner to publish it from the Firebase Console.
- **Do not rename these:** `acceptDare`, `submitProof`, `submitDare`,
  `approveProof`, `rejectProof`, `uploadToCloudinary`, `openShorts`,
  `openVideoDetail`, `vidThumb`, `guestCheck`, `WALLET_ENABLED`.
- **Do not bring back** features removed in v16: dual profile tabs, follow
  system, ratings.
- **Design is flat black and white.** No glass, no `backdrop-filter`, no red
  `#FF0033` on anything new. `.auth-box` (`#000` + 1px white border) is the
  reference surface.
- **"Shorts" is not used in anything a user reads** — the word is **Clips**.
  The code still says shorts internally (`openShorts`, `#shortsOverlay`, the
  CSS, the Firestore fields) and that is deliberate; only the visible text and
  the URL changed.
- **Never write the words** bet, stake, win, game, jackpot, lottery, contest
  into user-facing text. This app is a task marketplace, not a game of chance.
- **New personal fields go in `PRIVATE_FIELDS`** (`js/app.js`), never on the
  public `users/{uid}` document, which anyone can read.

---

# LOG — newest at the top

## 2026-08-21 11:24 — CLAUDE
CHANGED: `HANDOFF.md` (new), `index.html`, `manifest.webmanifest`, `sw.js`
WHAT: Created this file at the owner's request, so the two of us can hand work
over instead of guessing what the other did.
Also finished the icon work Gemini started in commit `2985ba8`. The five PNGs
were replaced correctly and the stale `icon.svg` link was rightly removed — but
every reference still pointed at `?v=2`, so the new artwork sat at an address
browsers already believed they had. Bumped all seven references to `?v=3`.
VERIFIED: Live. Manifest still parses; the server hands out the new bytes
(`icon-512.png` is 85,645, up from 11,566); app suite 5/5, 0 page errors.
BROKE / RISK: Nothing known. Checked where this file can be read from, since it
sits in the repo root: the site's SPA rule serves index.html for it rather than
the file, and the GitHub repo is private, so it is not reachable by anyone else
today. That depends on the repo staying private — still keep passwords, keys
and anything private OUT of it.
NEXT: Nothing outstanding. Two things are waiting on the owner, not on us:
the Cloudinary upload preset still has no `max_file_size`, and the topbar and
hamburger sidebar still carry the old reddish tint and blur that the rest of the
app has dropped.
OVER

---

## 2026-08-21 (earlier) — CLAUDE — summary of the day, for context
Not a handover; background so the next assistant is not working blind.

- **Branding.** "Shorts" → **Clips** everywhere a user reads, including both
  legal texts. The route is now `/clips/<id>`; old `/shorts/<id>` links still
  open and the address bar is corrected on the way in. The saved wallet
  statement is `misnivo-statement-*.csv`, not the old name. "MiTube" does not
  appear anywhere in the repo.
- **Security.** A mission's terms freeze once anyone accepts it, so a creator
  cannot drop the reward after a taker has filmed. A proof can be judged once,
  not flipped between approved and rejected. Only a taker the creator picked
  may submit proof — enforced in `firestore.rules`, not just in the UI.
- **Privacy.** `settings`, `acceptedDares`, `pinnedDares` and `likedProofs`
  moved into `users/{uid}/private/main`. A stranger now sees only name,
  username, photoURL, bio, website, socials.
- **Boot.** The loading skeleton was showing for ~2.8s on every open even on a
  fast connection; it now waits 700ms and only appears if the wait is real.
  Tapping Agree on the creator agreement no longer waits on a database write
  before opening the form.
- **Stale builds.** `_checkBuildFresh()` compares the running version against
  the server on resume and reload; on a mismatch it clears every cache,
  unregisters the service worker and reloads once. This was fixing "my old UI
  came back after backgrounding the app".
OVER
