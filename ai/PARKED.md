# PARKED — jo hum baad mein karenge

> **Malik ke liye, ek line mein:** ye un cheezon ki list hai jo **maine (malik ne)
> jaan-boojh kar rok rakhi hain**. Ye bhooli nahi hain, adhoori nahi hain — inhe
> rokna ek faisla tha. Har ek ke saath likha hai **kyun rokа** aur **kya hone par
> chalu hogi**.

---

## For whoever reads this next — Claude or Gemini

**Everything below is PARKED BY THE OWNER, on purpose.** None of it is an
oversight, an unchecked finding, or work someone forgot. Each line records a
decision that was made out loud, with the date it was made.

**So: do not "helpfully" implement any of it.** If you think a parked item has
become urgent, say so to the owner and wait. Picking one up because it looks
open is the exact mistake this file exists to prevent.

This file is a **record of decisions**, not a to-do list passed between
assistants — same rule as `ai/HANDOFF.md` §4. Only the owner moves something out
of here.

Full detail for every numbered item is in `ai/bugs_found.md`; this is the
short version plus the reason it is waiting.

---

## 1. Waiting on the Blaze plan — FOUR things, ONE decision

None of these can move until the owner switches Firebase from Spark to Blaze.
They are not four problems; they are one plan change with four consequences.

| # | What | Why it needs a server |
|---|---|---|
| **30** | **Rate limiting** — nothing stops one account writing without limit | Rules cannot count events over time: the client writes the timestamp, so an attacker just never updates theirs. No rules-only version exists. |
| **17** | **Cloudinary signed uploads** | Only a Cloud Function can hand out a short-lived signature. The preset name and cloud name are in `app.js` and always will be. |
| **1 / 13** | **Wallet on the server** | No rule can tell a real debit from an invented one; only a server knows what the balance should be. `WALLET_ENABLED = false` until then. |

**Ranked by what actually grows:** #30 gets worse with every user the app gains.
#17 can cost money today. #1/#13 costs nothing while the wallet is switched off.

**What unblocks all four:** the Blaze plan. The owner has asked for a cost
breakdown before deciding — not produced yet.

---

## 2. Waiting on an answer from the owner

### #24 — unverified email signup
Real and checked: nothing sends or checks a verification email, so a made-up
address gets a working account immediately. **Deliberately not done** — the
scripted half of the risk is what App Check already stops, and gating
`emailVerified` is friction paid by every honest sign-up.

Three options were put to the owner; one needs picking:

- **(a)** send the verification email, gate nothing
- **(b)** gate only the actions that cost something — posting a mission,
  submitting proof — and leave browsing open *(recommended)*
- **(c)** gate everything at sign-up

**Parked 26 Aug 2026** — owner: *"abhi ke liye abc mein chhod do"*.

### #4 — "over-reliance on client-side enforcement"
No specific flow was ever named, so there is nothing to check. Every critical
transition found so far *is* enforced server-side. **Unblocks when the owner
points at one particular screen or button.**

---

## 3. Not findings — loose ends worth carrying

- **Per-mission link previews.** #21 gave every shared link the same card.
  A card carrying *that* mission's title and thumbnail needs the HTML rendered
  per URL — a Cloudflare Pages Function for `/dare/:id`. **Not started.**
- **Nobody holds the `admin: true` claim.** The admin panel exists and works,
  but the claim can only be set with the Firebase Admin SDK, from a server.
  Until then the panel refuses everyone, including the owner — which also means
  its tabs have never been tested by a real admin.
- **Four leftover test profiles** (`dmtest.ag2290`, `dmtest.ag334721`,
  `dmtest.ag325606`, `dmtest.ag57348`) plus one orphan private document per
  throwaway test account. Harmless. Removing them needs the admin claim above.
- **`users/{uid}/private/main` has no delete rule**, so an account cannot remove
  its own private drawer — which is where those orphans come from. Worth a
  `allow delete: if isSelf(u)` the next time the rules are opened for something
  else; not worth a deploy of its own.
- **The app has no approved proofs at all.** Every test of the video half of the
  app has run against an empty pool. It is not broken as far as anyone knows —
  it has simply never been exercised with real content.

---

## 4. Deliberately rejected — do not re-propose

Written down because each of these looks like an obvious good idea from a
standing start, and re-suggesting them wastes a turn.

- **A UI cooldown on the post button** as a stand-in for rate limiting.
  Offered 26 Aug, declined by the owner in favour of doing the real thing.
  It stops double-taps and casual spam and stops nothing deliberate, because
  anything determined talks to Firestore directly and never sees the button.
- **A rules-only rate limit** using `request.time` against a stored timestamp.
  Does not work: the client writes the timestamp, so it simply stops updating
  it. See #30.
- **Cloudflare Turnstile** instead of reCAPTCHA for App Check. Ruled out
  21 Aug — App Check has no Turnstile provider, so it needs a custom provider,
  which needs a server, which needs Blaze, which is the thing being avoided.
