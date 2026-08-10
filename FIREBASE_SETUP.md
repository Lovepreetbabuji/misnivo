# Firebase backend — deploy & security notes

The site itself still deploys to Cloudflare Pages from `main`. This folder set
adds the **server side**: Firestore security rules, indexes, and the Cloud
Functions that create every notification.

> **Nothing here is live until you run the deploy commands below.** Until then
> the rules in the Firebase console are whatever they were before, and the
> notification triggers do not exist — which means **notifications will stop
> appearing**, because the client no longer writes them.

---

## 1. One-time setup

```bash
npm install -g firebase-tools
firebase login
cd firebase/functions && npm install && cd ../..
```

The project id is already pinned in `.firebaserc` (`mission-markit-9192a`).

## 2. Deploy — in this order

```bash
# indexes first: the rules and functions both query on them
firebase deploy --only firestore:indexes

# functions next, so notifications keep flowing the moment rules lock writes
firebase deploy --only functions

# rules last
firebase deploy --only firestore:rules
```

Cloud Functions need the **Blaze (pay-as-you-go)** plan. At this app's volume it
sits inside the free allowance, but the card has to be on file.

## 3. Web push (optional — off until you do this)

1. Firebase console → Project settings → **Cloud Messaging** → *Web Push
   certificates* → **Generate key pair**.
2. Copy the key into `js/app.js`:
   ```js
   const FCM_VAPID_KEY = 'B...';   // currently ''
   ```
3. Redeploy the site. `firebase-messaging-sw.js` is already at the web root,
   which is where Firebase requires it.

Until the key is set, `_registerPushToken()` returns immediately — no permission
prompt, no tokens, nothing breaks. In-app notifications work either way; push is
only what reaches the phone when the tab is closed.

## 4. Admin access

`ADMIN_UID` in `js/app.js` is a client-side check — it only hides a menu item, it
protects nothing. The rules use a **custom claim** instead, which cannot be
self-granted:

```bash
node -e "
const admin=require('firebase-admin');
admin.initializeApp({credential:admin.credential.applicationDefault()});
admin.auth().setCustomUserClaims('YOUR_UID',{admin:true}).then(()=>console.log('done'));
"
```

The user must sign out and back in for the claim to appear in their token.

---

## What the rules enforce

| Collection | Read | Write |
|---|---|---|
| `users` | public (guests browse profiles) | owner only, and only the fields the UI edits |
| `users/{u}/private/*`, `users/{u}/tokens/*` | owner only | owner only |
| `usernames` | public (availability check) | reserve if free; release only your own |
| `dares` | public | creator edits; others may only step engagement counters |
| `dares/*/applicants` | applicant or mission creator | applicant creates; creator approves |
| `proofs` | public | taker creates as `submitted`; **only the mission owner can approve/reject** |
| `comments` | public | author writes text; anyone may like; video owner may pin |
| `follows` | public | doc id must encode the caller's own uid |
| `reports` | **admin only** | anyone may file; only admin reads or resolves |
| `notifications` | recipient only | **no client writes at all** — Functions only |
| `searches` | public | signed-in, `count` may only go up by 1 |
| anything else | denied | denied |

Two patterns do the heavy lifting:

- **Authorship is checked against `request.auth.uid`**, never against a field the
  client supplies. You cannot create a proof as someone else, or forge a follow.
- **Updates are field-scoped** with `diff().affectedKeys().hasOnly(...)`. Liking
  a proof is allowed to touch `likeCount`/`likedBy` and nothing else, so a "like"
  request can never smuggle in `status: 'approved'` and pay itself a bounty.

---

## ⚠ Still open — needs its own pass

These are real holes that rules alone cannot close. They were found while
writing the rules and are **not fixed** by this change.

### 1. Wallet balance is client-writable *and* world-readable

`wallet` lives on the `users/{uid}` document. The client sets `balance` directly
(`js/app.js` — posting a mission debits it, approving a proof credits the taker).

- Any signed-in user can set **their own balance to anything** from devtools.
- `users` must stay publicly readable for guest browsing, so **every user's
  balance and full transaction history is readable by anyone on the internet**,
  logged in or not.

The fix is two-part, and it is a real refactor:

1. Move `wallet` to `users/{uid}/private/wallet` — the rules already reserve
   that path as owner-only, so the read leak closes immediately.
2. Move the money operations (post, accept, approve, deposit, withdraw) into
   callable Cloud Functions so the balance is only ever written by the server.

### 2. Email addresses are public

`users/{uid}` also carries `email`, and the document is world-readable. Same
shape of fix: keep the public document to display fields (name, username,
photoURL, bio) and move contact details under `private/`.

### 3. `ADMIN_UID` is empty

Admin reports are currently unreachable. The rules are already written against
the custom claim, so set the claim (step 4) rather than filling in `ADMIN_UID`.

---

## Note on `firebase/functions/`

The functions deliberately live under `firebase/`, not at the repo root.
Cloudflare Pages treats a root-level `functions/` directory as **its own** Pages
Functions source and would try to build `index.js` as an edge worker, breaking
the site deploy.
