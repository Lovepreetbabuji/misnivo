# Misnivo — Project Context

> Naye chat/session me ye file padho, phir sab pata chal jayega. Response kaise
> dena hai wo `claude.md` me hai (Hinglish, aasan bhasha, user coder nahi hai).
> Ye file = "project kya hai + kaise bana hai + kahan kya hai".

---

## 1. Ek line me — ye kya hai

**Misnivo** ek real-money **mission (dare/challenge) platform** hai — YouTube +
Instagram jaisा. Koi user ek "mission" post karta hai bounty (inaam) ke sath,
doosre use accept karke complete karte hain aur video proof daalke asli paise
kamate hain. Brand ka safar: **Dare Market → Mission Market → Misnivo** (abhi
Misnivo). Support: `misnivo.support@gmail.com`.

---

## 2. Tech stack (jaan lo)

- **Frontend:** Pure vanilla **HTML + CSS + JavaScript**. Koi build tool / React /
  framework NAHI. Ek single-page app (SPA).
- **Backend:** **Firebase** (compat SDK 9.22.2) — Auth + Firestore (database) +
  Cloud Messaging (push notifications).
- **Media:** **Cloudinary** — videos/images host + optimize. Videos **HLS
  adaptive streaming** se chalti hain (`sp_auto` + hls.js) — quality network ke
  hisaab se upar-neeche.
- **Hosting:** **Cloudflare Pages** — GitHub `main` branch se **auto-deploy**.
- **PWA:** `manifest.webmanifest` + service worker (offline chalti hai).

**Live site:** `daremarket.pages.dev` · **Repo:** `github.com/Lovepreetbabuji/misnivo` (branch `main`)

---

## 3. File map (kahan kya hai)

| File | Kya hai |
|---|---|
| `index.html` | Saara markup — pages, overlays/modals, auth screen (~1700 lines) |
| `css/styles.css` | Saari styling (~6400 lines) |
| `js/app.js` | **Poora app logic** — sabse bada file (~11000+ lines) |
| `sw.js` | Service worker — offline app-shell (fonts/css/js cache) |
| `firebase-messaging-sw.js` | FCM background push handler (alag file Firebase ki zaroorat) |
| `manifest.webmanifest` | PWA config (naam, icon) |
| `_headers` | Cloudflare cache headers (index/css/js = no-cache) |
| `_redirects` | SPA fallback — `/watch/:id`, `/clips/:id` etc. → index.html |
| `firestore.rules` | Database security rules |
| `misnivo.png` | Logo |
| `claude.md` / `GEMINI.md` / `AGENTS.md` | AI instructions (response format, rules) |
| `ai/HANDOFF.md` | **Claude ↔ Gemini kaam saunpne ki jagah** |
| `ai/bugs_found.md` | Mile hue bugs ki list |
| `FIREBASE_SETUP.md` | Firebase setup notes |

---

## 4. Pages aur Routes (har cheez ka URL hai)

**Main pages** (bottom-nav / sidebar): Home `/` · Explore `/explore` ·
Missions `/dares` · Accepted `/accepted` · Wallet `/wallet` · Profile `/profile` ·
Leaderboard `/leaderboard`.

**Detail views** (apne shareable URL): video `/watch/:id` · clips/shorts
`/clips/:id` (pehle `/shorts` tha — purane link ab bhi chalte hain) · mission
`/dare/:id` · public profile `/u/:id`.

**Modals-as-pages:** 20+ popups (Settings, Post Mission, Edit Profile, Deposit,
Withdraw, KYC, Followers, etc.) — har ek ka apna URL + back-stack.

> ⚠️ **Naming gotcha:** UI text me "Mission/Clips" dikhta hai, par **code, database
> fields, aur URLs me abhi bhi "dare"/"shorts" hi hai** (`/dares`, `dareBounty`,
> `.dare-list-card`). Sirf user-visible text badla hai. Isliye `/dare/:id` URL
> galat nahi hai.

---

## 5. Key systems (js/app.js me)

- **Page navigation:** `goPage(pg)` — `.page` divs display:none/block toggle.
- **Back-button stack (YouTube-style, ek step back):** `_ovStack` (khule overlays),
  `_ovOpen(id,url)` (kholna + history push), `_ovSync(id)` (band karne pe history
  rewind), `_MODAL_URL`/`_PAGE_URL` (id→URL maps), `popstate` handler, `_bootRoute()`
  (refresh/deep-link pe sahi page/modal kholna).
  → **Naya button/popup/page banao to hamesha URL + back-stack wiring do.**
- **Video playback:** `_playSmart(v, url, opts)` = **THE entry point** har video ke
  liye. HLS adaptive + fallback. **Kabhi seedha `v.src=` mat karo** content video pe.
- **Feed:** long videos + clips + live missions interleaved, infinite scroll
  (IntersectionObserver), DOM windowing (door ke cards ka content khaali karke GPU
  bachana).
- **Auth:** Google login, email login/signup, aur **Guest mode** (`enterGuestMode()`
  — 15 min, anonymous, network chahiye).
- **Offline:** `sw.js` fonts/css/js/page cache karta hai → offline refresh pe UI
  toot-ti nahi.

---

## 6. Deploy workflow (HAR baar isi tarah)

1. `node -c js/app.js` — JS syntax check (error na ho).
2. **TEEN stamps ek saath badlo** (ek bhi chhoot gaya to purana cache atak jaata hai):
   - `index.html` me `/css/styles.css` ka `?v=YYYYMMDD<letter>` (jaise `20260821k`)
   - `index.html` me `/js/app.js` ka `?v=` (wahi stamp)
   - **`sw.js` me `VER`** (wahi stamp, jaise `dm-shell-20260821k`)
3. `git add -A && git commit` — message ke ant me:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
4. `git push origin main` → Cloudflare Pages **khud deploy** karta hai (~10-40s).
5. Verify: deployed file ko `curl` karke check karo (edge kuch der purana build deta
   hai, isliye poll karo — ek baar dekh ke "not deployed" mat maano).

> ⚠️ **`sw.js` ka `VER` kyun zaroori:** service worker un sab caches ko delete karta
> hai jinki key `VER` se alag ho. Agar `VER` na badla to kuch delete nahi hota aur
> purana css/js/index.html device pe atka reh jaata hai — PWA resume pe **purana UI
> wapas** aa jaata hai. Deploy ke baad user ko **Ctrl+Shift+R (hard refresh)** bhi
> chahiye. Testing me FRESH browser profile use karo warna purana build test karoge.

---

## 7. Browser testing (khud test karna)

Bugs static analysis se nahi, **asli browser me chala ke** pakde jaate hain.
`puppeteer-core` (scratchpad `/perf` me installed) se **installed Chrome**
(`C:/Program Files/Google/Chrome/Application/chrome.exe`, `headless:false`) chalao
→ live site kholo → guest/login → button dabao → console errors + screenshot lo.

- **Test account** (signup form se banaya): `dmtest.claude1@example.com` /
  `dmtest123456` (naam "Test Bot", handle `@dmtest.claude1`).
- Gotchas: FRESH short `userDataDir` (`C:/Users/lovep/AppData/Local/Temp/dmfreshN`)
  warna SW purana cache deta hai; offline test se pehle login karo (guest ko net
  chahiye); har `page.evaluate` ko `.catch()` se guard karo.
- Detail: memory `browser-testing-via-cdp` me.

---

## 8. Firestore rules (dhyan se)

Rule ka koi badlav **pehle `firestore.rules` FILE me** likho — Firebase Console me
kabhi nahi (warna file aur live alag ho jayenge). Deploy khud kar sakte ho, par
deploy = **live app pe turant asar**, isliye deploy ke baad khud jaancho: koi aisा
kaam karke dekho jise naya rule rokna chahiye, aur pakka karo ki wo ruka.
**App Check enforced hai** — headless/script requests refuse ho sakti hain.

---

## 9. Do AI ka setup (ZAROORI)

Is project pe **Claude aur Gemini dono** kaam karte hain. Dono ek doosre ki screen
nahi dekh sakte — `ai/HANDOFF.md` hi ek jagah hai jahan baari saunpi jaati hai.

- **Har session ke shuru me `ai/HANDOFF.md` padho** — bina kahe. `TURN:` line se
  pata chalega baari kiski hai.
- Agar `TURN: GEMINI` ho to **ruk jao**, user ko batao — Gemini ka kaam adhoora
  hai, beech me file chhedne se dono ka kaam mit sakta hai.

---

## 10. Conventions / rules (yaad rakho)

- **Reply Hinglish + aasan bhasha me** — user coder nahi hai (dhaancha `claude.md` me).
- Har naya button/popup/page → **URL + back-stack** wiring (warna back button toot-ta hai).
- Theme: **kaala-safed, minimal** — bhaari glass/blur perf khaata hai.
- UI text: "Mission/Clips"; code/DB/URL: "dare/shorts" (upar naming gotcha).
- Naya feature banao to **puppeteer se khud test** karo, phir deploy, phir fresh
  browser se verify + screenshot.

---

## 11. Memory files (`~/.claude/.../memory/`) — aur detail yahan

`MEMORY.md` index hai. Khaas:
- `project_version_history` — kaun sा feature kab bana
- `backbutton_navigation` — routing/back-stack ka poora detail
- `performance-root-cause` — lag ka asli karan (closed overlays pe blur layers) + fix
- `adaptive-streaming` — HLS video system
- `deploy-workflow` — deploy steps
- `browser-testing-via-cdp` — puppeteer testing + test account
- `appcheck-enforced` · `firebase-backend-not-deployed` — backend status
