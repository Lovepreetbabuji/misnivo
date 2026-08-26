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
| `ai/PARKED.md` | **Jo cheezein maine jaan-boojh kar roki hain** — kyun ruki, kab chalu hogi |
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
   - `index.html` me `/css/styles.css` ka `?v=YYYYMMDD<letter>` (abhi `20260821m`)
   - `index.html` me `/js/app.js` ka `?v=` (wahi stamp)
   - **`sw.js` me `VER`** (wahi stamp — abhi `dm-shell-20260821m`)
3. `git add -A && git commit` — message ke ant me:
   `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
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

- **Test account:** `dmtest.claude1@example.com` / `dmtest123456`.
  🔴 **Ye account BANNED hai** — iske saare write fail honge, aur wo fail App Check
  ka nahi, ban ka hoga. Likhne wale test ke liye har baar naya account banao aur
  test ke ant me delete kar do (dekho section 12).
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
**App Check ab TEENO par enforced hai** (Firestore + Auth + AI Logic) — headless
browser ko token milta hi NAHI, wo 403 khata hai. Detail neeche section 12 me.

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

---

# 12. Chat 2 ka hissa — abhi kahan khade hain (25 Aug 2026)

> Upar wala part chat 1 ne likha: **project kya hai**.
> Ye part chat 2 ne likha: **abhi haalat kya hai, kya ho chuka, kya bacha**.

## 12.1 Live build

| | |
|---|---|
| Stamp | `20260826f` (teeno jagah — css, js, sw) |
| Aakhri commit | `style(settings): the outlined icons needed !important to beat a blanket rule` |
| Live site | `daremarket.pages.dev` — deploy verify ho chuka, 19/19 browser test pass |

## 12.2 App Check — POORA KHATAM ✅

reCAPTCHA Enterprise, site key `6LdMt5UtAAAAANQlYLej4_9VKQoNX87n_WmNWWmU`.
**Teeno surface Enforced hain:** Cloud Firestore, Authentication, Firebase AI Logic.
Firebase ki **2 November 2026** wali AI Logic deadline do mahine pehle nipat gayi —
ab wo yaad rakhne ki zaroorat nahi.

Do baatein jo sirf yahan likhi hain:

1. **Do Firebase app hain, dono ko alag App Check chahiye tha.** Normal app compat
   SDK par hai; safety filter ek doosre app par chalta hai
   (`initializeApp(config, 'ai')`, modular 12.10.0). Pehle sirf pehle wale par laga
   tha. Filter **fail-closed** hai — 2 Nov ko wo band hota to **har mission refuse**
   hota. Ab dono par laga hai, key `window.__appCheckKey` se share hoti hai.
2. **AI Logic ka Enforce uske `⋮` menu me NAHI hai** (baaki sab ka hai). Rasta:
   AI Logic row kholo → graph ke neeche **Set up** → *Baseline protection* =
   **Enforced** → *Replay protection* = **Disabled**.
   🔴 Replay protection hamesha **Disabled** rakhna — wo aisi token maangti hai jo
   ye app banati hi nahi, aur free quota bahut tez jalati hai.

## 12.3 Testing ke naye niyam (App Check ke baad)

🔴 **`headless:false` ab MAJBOORI hai** agar test kuch likhta hai. reCAPTCHA
automatic browser ko bot maan kar token deti hi nahi. Jo dikhega:

```
403 on exchangeRecaptchaEnterpriseToken
auth/firebase-app-check-token-is-invalid
```

**Ye app ka bug NAHI hai — yahi feature ka kaam hai.** Asli window me khol kar
dekhe bina kabhi ye mat maano ki app tut gayi.

Teen aur jaal jinme main khud phansa, taaki tum na phanso:

- **`permission-denied` par pehle `firestore.rules` padho, App Check ko dosh baad
  me do.** Mera test `creatorId` bhej raha tha jabki rule `creatorUid` maangta hai.
- **Age gate `_bootApp()` ko rokta hai, aur `_bootRoute()` usi ke andar hai.** Jab
  tak DOB nahi bhara, routing/404 chalta hi nahi. Maine do baar 404 ko "toota" samajh
  liya tha — 404 bilkul theek hai. Test me age gate paar karo:
  `_dtSet(document.getElementById('ageDob'),'1995-05-05'); await _ageSubmit();`
- **`_bootRoute()` sirf do jagah chalta hai:** `_bootApp()` (login ke baad) aur
  `enterGuestMode()`. Sirf auth screen par baithe visitor ke liye routing nahi chalti.

Test ke ant me **apna kachra khud saaf karo** — mission, profile, account, teeno
delete. (Ek sweep script banai thi jo `dares` + `users` me `appcheck|probe|dmtest`
dhoondhti hai.)

## 12.4 Admin panel — ek tha, ab ek hi hai

Pehle **do** admin darwaze the. Purana **"Admin Reports"** hata diya gaya (25 Aug):
wo `ADMIN_UID` par tika tha jo **khaali string** chhodi hui thi, isliye wo
**maalik ko bhi** "Admin access required" bolta tha — kabhi kisi ke liye khula hi
nahi. Uska menu button bhi hamesha `display:none` tha.

Asli panel uska kaam behtar karta hai: 50 ki jagah 100 reports, 24 ghante se purani
report par nishaan, aur View / Remove / Ignore — aur har kaam pehle `admin_actions`
me likha jaata hai. Purana wala seedha status badal deta tha, **bina record ke** —
yahi sabse badi wajah thi hatane ki, sudhaarne ki nahi.

**Asli panel (`openAdmin`) ko haath nahi lagaya.** Uska apna rasta hai: sidebar ka
"Admin" button (jo `admin: true` claim par khulta hai) aur `/admin` URL.
`/admin-reports` ab 404 dikhata hai.

> **Admin ban-na = auth token par `admin: true` claim.** Wo sirf Firebase Admin SDK
> se lagti hai (server se), app se nahi. Rules ka `isAdmin()` bhi yahi dekhta hai.
> **Abhi kisi ke paas ye claim hai ya nahi — ye verify nahi hua.** Agar maalik ko
> admin panel chahiye to pehle ye claim lagani padegi.

## 12.5 Kya bacha hai (25 Aug, doosri baari ke baad)

| # | Kya | Haalat |
|---|---|---|
| 17 | Cloudinary upload bina sign ke (preset public hai) | **Khula hai.** Ab app khud bade/galat file rok deti hai, par jo banda app chhodkar seedha Cloudinary par bhejta hai use koi nahi rok sakta — uske liye **Blaze plan** chahiye |
| 1 / 13 | Wallet server par (koi bhi apna balance likh sakta hai) | **Blaze plan chahiye** — tab tak `WALLET_ENABLED = false` |
| 4 | "Client par bharosa" — koi ek jagah batayi nahi gayi | Jagah batao to theek ho jayega |
| — | 4 khaali test profile: `dmtest.ag2290`, `dmtest.ag334721`, `dmtest.ag325606`, `dmtest.ag57348` | Nuksaan nahi, safai baaki (admin chahiye) |

> **CHAAR cheezein ab ek hi darwaze par khadi hain — Blaze plan.** #30 (rate
> limiting), #17, #1 aur #13.
> Ye ek faisla hai, teen nahi.

**Ab theek ho chuka (25 Aug):** #15 admin panel ki bina-limit query, #16 feed ka
60 wala wall (ab "Load older missions" button hai), aur #18 — wahi galti jo
**har visitor** ke raste par thi (home feed saari approved video ek saath maangti
thi). Detail `ai/bugs_found.md` me.

🔴 **Ek baat jo yaad rakhni hai:** Firestore ka `count()` (bina download kiye
ginti) is app me **kaam nahi karta** — compat SDK 9.22.2 me wo function hai hi
nahi. Pehle wahi likha tha, live browser me khula to admin panel me numbers ki
jagah "—" aa gaya. Isliye ab ginti "1000 tak gino, uske aage 1000+ likho" wale
tareeke se hoti hai. Agli baar `count()` likhne se pehle ye yaad karo.

## 12.6 Naye chat ko sabse pehle kya karna hai

1. `ai/HANDOFF.md` padho — `TURN:` line dekho. `TURN: GEMINI` ho to **ruk jao**.
2. Ye file (`PROJECT_CONTEXT.md`) padho.
3. Live build `20260826f` hai — local file badalne se live site nahi badalti,
   push + teeno stamp ke bina kuch nahi hota.

## 12.7 Firestore index — naya jaal (25 Aug)

Agar kisi query me `where(...)` ke saath **doosre field** par `orderBy(...)`
lagaya, to Firestore ko ek **composite index** chahiye. Wo
`firestore.indexes.json` me likho aur `firebase deploy --only
firestore:indexes` chalao — **code push karne se PEHLE**. Bina index ke query
`failed-precondition` deti hai aur us page ka data ruk jaata hai.

🔴 **Khaali collection par bhi index turant nahi banta.** Maine yahi maan liya
tha; index pehle deploy kiya phir bhi live site par thodi der error aaya. Deploy
ke baad **asli browser me query chalakar** dekho — CLI `state` batata hi nahi,
usme hamesha theek lagta hai.

Aur: `orderBy` un documents ko **poori tarah chhod deta hai** jinme wo field
hai hi nahi. Kisi purane collection par naya `orderBy` lagane se pehle pakka
karo ki har document me wo field ho.

Firebase CLI yahan chalu aur logged-in hai (project `mission-markit-9192a`), to
rules aur indexes dono deploy ho sakte hain.

## 12.8 Guest mode = default (25 Aug)

Bina account wala visitor ab **seedha app** dekhta hai — login/signup ki deewar
nahi. Logout karne par bhi wahi. **Koi 15-minute timer nahi** — wo poora hata
diya gaya (badge, timer, aur "preview khatam" wala popup).

Account tab manga jaata hai jab koi aisa kaam kare jo bina account ho hi nahi
sakta. Wo kaam `guestCheck('<key>')` karta hai, aur har key ka apna message
`GUEST_ACTION_MSGS` me hai.

🔴 **Naya koi bhi aisa button/kaam banao jo Firestore me likhta ho, to uske
pehli line me `guestCheck('<key>')` lagao.** Warna guest ke liye wo chup-chaap
fail hoga — rules refuse kar dengi aur use pata bhi nahi chalega. Pehle ye sirf
12 jagah tha; 8 jagah chhoot gaya tha (like, dislike, comment) kyunki tab guest
kam aate the. Ab har pehla visitor guest hai.

Prompt overlay-stack me hai, to phone ka back button use band karta hai. Uska
apna URL nahi hai (wo ek nudge hai, page nahi).
