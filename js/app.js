// ════════════════════════════
//  FIREBASE INIT
// ════════════════════════════
const firebaseConfig = {
  apiKey:            "AIzaSyCAturzorr_8CJQrPf2lp-vJhgHJEofrTk",
  authDomain:        "mission-markit-9192a.firebaseapp.com",
  projectId:         "mission-markit-9192a",
  storageBucket:     "mission-markit-9192a.firebasestorage.app",
  messagingSenderId: "490715782561",
  appId:             "1:490715782561:web:e04d5ea4d86aa3b133ffe0"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();
// Offline cache: repeat reads (page switches, re-opens) are served instantly from
// local IndexedDB instead of a fresh network round-trip. Must run before any query.
try { db.enablePersistence({ synchronizeTabs: true }).catch(()=>{}); } catch(e){}
// Firebase Storage removed — requires paid plan.
// Using Cloudinary (free, no credit card needed) instead.

// ── CLOUDINARY CONFIG ─────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME    = 'ddam2qcpu';
const CLOUDINARY_UPLOAD_PRESET = 'missionbook';

// ── CLOUDINARY UPLOAD HELPER ──────────────────────────────────────────────
// Returns { promise: Promise<url>, cancel: fn }
// resourceType: 'image' | 'video' | 'auto'
// onProgress: fn(percent 0-100) or null
function uploadToCloudinary(file, resourceType, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  let xhr;
  const promise = new Promise((resolve, reject) => {
    xhr = new XMLHttpRequest();
    if (onProgress) {
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 100), e);
      });
    }
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try   { resolve(JSON.parse(xhr.responseText).secure_url); }
        catch { reject(new Error('Invalid Cloudinary response')); }
      } else {
        let msg = `Upload failed (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText).error?.message || msg; } catch(_){}
        reject(new Error(msg));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error — check internet connection')));
    xhr.addEventListener('abort', () => reject(new Error('CANCELLED')));
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`);
    xhr.send(formData);
  });
  return { promise, cancel: () => xhr && xhr.abort() };
}

// ════════════════════════════
//  STATE
// ════════════════════════════
let user            = null;
let dares           = [];
let wallet          = { balance:100000, pending:0, transactions:[] };
let acceptedDares   = [];
let activeCat       = 'all';
let proofDareId           = null;
let selectedVideo         = null;
let selectedVideoDuration = 0;    // seconds
let selectedVideoW = 0, selectedVideoH = 0;  // dimensions for aspect-ratio routing
// ─── PROOF MODAL v0.16 STATE ─────────────────────────────────────────────────
let proofCapturedFrameBlob = null; // Blob: canvas frame for proof thumbnail
let activeUploadTask       = null; // Firebase Storage task — cancel/background
let uploadStartTime        = 0;    // timestamp for speed calculation
let proofCheckState        = [];   // boolean[] — checklist tick states
let daresUnsub      = null;

// ─── PROFILE EDIT STATE ───────────────────────────────────────────────────────
let peSelectedPhotoFile = null;   // File — new profile photo selected
let peHandleTimer       = null;   // debounce timer for handle check
let peHandleValid       = false;  // true when handle is unique + valid

// ─── POST DARE MODAL STATE (v0.15) ────────────────────────────────────────────
let postTags           = [];      // String[] — tag names without #
let postRules          = [];      // String[] — rule texts
let selectedThumb      = null;    // File — thumbnail image
let selectedPreviewVid = null;    // File — video preview
let capturedFrameBlob  = null;    // Blob — canvas-captured video frame
let currentMediaTab    = 'image'; // 'image' | 'video'
let currentVis         = 'now';   // 'now' | 'scheduled'

// ─── v0.19 NEW FEATURE STATE ──────────────────────────────────────────────────
let editingDareId      = null;   // null=new dare, string=editing existing dare
let pinnedDares        = [];     // string[] max 3 — current user's pinned dare IDs
let selectTakersDareId = null;   // dare being managed in Select Takers modal
let reportTargetInfo   = null;   // {type:'dare'|'user', id, name, extra}
let currentApplicants  = [];     // applicant docs for select takers modal
let currentTakerMode   = 'open'; // 'open' | 'creator_picks' for post dare
let currentExpiryDate  = null;   // Date | null for dare expiry
const ADMIN_UID        = '';     // ← Set your Firebase UID here for admin access

const CAT_ICONS  = {fitness:'fitness_center',food:'restaurant',adventure:'terrain',comedy:'sentiment_very_satisfied',talent:'mic',socialgood:'eco'};
const CAT_LABELS = {fitness:'Fitness',food:'Food',adventure:'Adventure',comedy:'Comedy',talent:'Talent',socialgood:'Social Good'};
const CAT_COLORS = {fitness:'#FF2D4A',food:'#e53935',adventure:'#43a047',comedy:'#fb8c00',talent:'#8e24aa',socialgood:'#00acc1'};

// Shared maps used by renderHome sections
const CAT_C = {fitness:'#FF2D4A',food:'#e53935',adventure:'#43a047',comedy:'#fb8c00',talent:'#8e24aa',socialgood:'#00acc1'};
const CAT_I = {fitness:'fitness_center',food:'restaurant',adventure:'terrain',comedy:'sentiment_very_satisfied',talent:'mic',socialgood:'eco'};
const CAT_L = {fitness:'Fitness',food:'Food',adventure:'Adventure',comedy:'Comedy',talent:'Talent',socialgood:'Social Good'};

// ════════════════════════════════════════════════════════
//  AD MANAGER (v0.15)
//
//  3 types of ads:
//  1. Pre-roll  — before videos > 1 min
//     · 1–15 min  → 2 ads (15s each, skip after 15s)
//     · > 15 min  → 1 ad
//     · < 1 min   → 0 ads (Shorts are always ad-free)
//  2. Post-Dare — 2 ads after dare is posted
//  3. Scroll    — inline banner every 5 scroll ticks
//
//  ── SWITCHING TO REAL ADS ──────────────────────────────
//  1. AdSense account banao → publisher ID lo
//  2. TESTNET_MODE = false karo (neeche)
//  3. PUB_ID mein apna ca-pub-XXXXXXXXXXXXXXXX daalo
//  4. SLOT_OVERLAY + SLOT_BANNER mein real slot IDs daalo
//  5. index.html mein AdSense <script> tag uncomment karo
//  ─────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════
const AdManager = {

  // ── CONFIG (CHANGE THESE) ─────────────────────────────
  TESTNET_MODE    : true,          // true=mock ads | false=real AdSense
  PUB_ID          : 'ca-pub-XXXXXXXXXXXXXXXX',  // apna AdSense publisher ID
  SLOT_OVERLAY    : 'XXXXXXXXXX',  // 300×250 ad unit ID (overlay ads)
  SLOT_BANNER     : 'XXXXXXXXXX',  // 320×50  ad unit ID (scroll banner)

  SKIP_AFTER_SECS : 15,    // seconds before Skip button enables
  SHORT_VID_SECS  : 60,    // under this = Shorts → 0 ads
  LONG_VID_SECS   : 900,   // over 15 min → only 1 ad
  SCROLL_AD_EVERY : 5,     // show scroll banner every N scroll ticks

  // ─── STATE ────────────────────────────────────────────
  scrollTick       : 0,
  countdownTimer   : null,
  secondsLeft      : 15,
  adQueue          : [],
  currentIdx       : 0,
  onComplete       : null,

  // ─── AD CREATIVES POOL ────────────────────────────────
  // Rotate different messages so it feels fresh
  creatives: [
    { headline: 'Challenge yourself. Get paid.',    desc: 'Post a mission and set your own bounty.', cta: 'Post a Mission →'    },
    { headline: 'Earn money doing missions!',           desc: 'Accept missions and win real bounty.',    cta: 'Start Earning →'  },
    { headline: 'Your mission, your rules.',            desc: 'Set the bounty. Watch others try.',    cta: 'Try Mission Market →' },
    { headline: 'Real money. Real challenges.',      desc: '100% escrow — bounty guaranteed.',    cta: 'See Missions →'      }
  ],

  // ─── INIT SCROLL ADS ──────────────────────────────────
  // Called once when user logs in.
  // Attaches scroll listener to main feed area.
  initScrollAds() {
    const mainEl = document.querySelector('.main');
    if (!mainEl) return;
    mainEl.addEventListener('scroll', () => {
      // Only fire on Home page, not when an ad is already showing
      const activePg = document.querySelector('.page.active');
      if (activePg?.id !== 'pageHome') return;
      if (document.getElementById('adOverlay').classList.contains('active')) return;
      this.scrollTick++;
      if (this.scrollTick % this.SCROLL_AD_EVERY === 0) {
        this.showScrollBanner();
      }
    });
  },

  // ─── PRE-ROLL ADS ─────────────────────────────────────
  // Decide how many ads to show before a video.
  // videoDuration (seconds) — 0 if unknown
  // onComplete — called after all ads finish
  showPreRollAds(videoDuration, onComplete) {
    const dur = videoDuration || 0;
    // Under 1 minute = Shorts → no ads, play immediately
    if (dur < this.SHORT_VID_SECS) {
      if (onComplete) onComplete();
      return;
    }
    // Over 15 minutes → 1 ad only; else 2 ads
    const count = dur > this.LONG_VID_SECS ? 1 : 2;
    this._startSequence(count, onComplete);
  },

  // ─── POST-DARE ADS ────────────────────────────────────
  // Show 2 ads after a dare is posted.
  showPostDareAds(onComplete) {
    this._startSequence(2, onComplete);
  },

  // ─── START AD SEQUENCE ────────────────────────────────
  _startSequence(count, onComplete) {
    this.adQueue    = Array.from({ length: count });
    this.currentIdx = 0;
    this.onComplete = onComplete;
    this._playOne();
  },

  // ─── PLAY ONE AD ──────────────────────────────────────
  // TESTNET_MODE=true  → mock creative
  // TESTNET_MODE=false → real AdSense slot
  _playOne() {
    const total    = this.adQueue.length;
    const current  = this.currentIdx + 1;
    const creative = this.creatives[Math.floor(Math.random() * this.creatives.length)];

    document.getElementById('adCount').textContent       = `Ad ${current} of ${total}`;
    document.getElementById('adProgressBar').style.width = '0%';
    document.getElementById('adCountdown').textContent   = `Skip in ${this.SKIP_AFTER_SECS}s`;
    document.getElementById('adSkipBtn').disabled        = true;

    const mockEl = document.getElementById('adMockCreative');
    const realEl = document.getElementById('adRealSlot');

    if (this.TESTNET_MODE) {
      if (mockEl) mockEl.style.display = 'block';
      if (realEl) realEl.style.display = 'none';
      const headEl = document.getElementById('adHeadline');
      const descEl = document.getElementById('adDesc');
      const ctaEl  = document.getElementById('adCta');
      if (headEl) headEl.textContent = creative.headline;
      if (descEl) descEl.textContent = creative.desc;
      if (ctaEl)  ctaEl.textContent  = creative.cta;
    } else {
      if (mockEl) mockEl.style.display = 'none';
      if (realEl) realEl.style.display = 'block';
      const ins = realEl.querySelector('ins.adsbygoogle');
      if (ins) {
        ins.innerHTML = '';
        ins.removeAttribute('data-adsbygoogle-status');
        ins.setAttribute('data-ad-client', this.PUB_ID);
        ins.setAttribute('data-ad-slot',   this.SLOT_OVERLAY);
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
        catch(e) {
          console.warn('AdSense push error:', e);
          if (mockEl) { mockEl.style.display = 'block'; realEl.style.display = 'none'; }
        }
      }
    }

    document.getElementById('adOverlay').classList.add('active');

    this.secondsLeft = this.SKIP_AFTER_SECS;
    clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      this.secondsLeft--;
      const pct = ((this.SKIP_AFTER_SECS - this.secondsLeft) / this.SKIP_AFTER_SECS) * 100;
      document.getElementById('adProgressBar').style.width = pct + '%';
      if (this.secondsLeft <= 0) {
        clearInterval(this.countdownTimer);
        document.getElementById('adCountdown').textContent = 'You can skip now';
        document.getElementById('adSkipBtn').disabled = false;
      } else {
        document.getElementById('adCountdown').textContent = `Skip in ${this.secondsLeft}s`;
      }
    }, 1000);
  },

  // ─── SKIP CURRENT AD ──────────────────────────────────
  // Called from HTML: onclick="AdManager.skipAd()"
  skipAd() {
    clearInterval(this.countdownTimer);
    this.currentIdx++;
    if (this.currentIdx < this.adQueue.length) {
      this._playOne();
    } else {
      this._hide();
      if (this.onComplete) this.onComplete();
    }
  },

  // ─── HIDE OVERLAY ─────────────────────────────────────
  _hide() {
    clearInterval(this.countdownTimer);
    document.getElementById('adOverlay').classList.remove('active');
    document.getElementById('adProgressBar').style.width = '0%';
    document.getElementById('adSkipBtn').disabled = true;
  },

  // ─── SCROLL BANNER AD ─────────────────────────────────
  // Inline banner inserted in home feed on scroll.
  // Auto-removes after 10 seconds.
  showScrollBanner() {
    if (document.getElementById('scrollAdBanner')) return; // already showing

    const creative = this.creatives[Math.floor(Math.random() * this.creatives.length)];
    const banner   = document.createElement('div');
    banner.id        = 'scrollAdBanner';
    banner.className = 'scroll-ad-banner';

    if (this.TESTNET_MODE) {
      banner.innerHTML = `
        <span class="ad-label-badge" style="flex-shrink:0;">Ad 🧪</span>
        <div class="scroll-ad-text">
          <div class="scroll-ad-title">${creative.headline}</div>
          <div class="scroll-ad-sub">${creative.desc}</div>
        </div>
        <button class="scroll-ad-cta" onclick="goPage('dares')">See Missions</button>
        <button class="scroll-ad-close"
          onclick="document.getElementById('scrollAdBanner').remove()" title="Close">
          <span class="mi" style="font-size:16px;">close</span>
        </button>`;
    } else {
      banner.innerHTML = `
        <span class="ad-label-badge" style="flex-shrink:0;">Ad</span>
        <div style="flex:1; display:flex; justify-content:center;">
          <ins class="adsbygoogle scroll-ins"
               style="display:inline-block; width:320px; height:50px;"
               data-ad-client="${this.PUB_ID}"
               data-ad-slot="${this.SLOT_BANNER}"
               data-adtest="on"
               data-ad-format="fixed">
          </ins>
        </div>
        <button class="scroll-ad-close"
          onclick="document.getElementById('scrollAdBanner').remove()" title="Close">
          <span class="mi" style="font-size:16px;">close</span>
        </button>`;
    }

    // Insert after homeVideoGrid section
    const grid = document.getElementById('homeVideoGrid');
    if (grid?.parentElement) grid.parentElement.insertBefore(banner, grid.nextSibling);

    if (!this.TESTNET_MODE) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); }
      catch(e) { console.warn('Scroll banner AdSense error:', e); }
    }

    // Auto-dismiss after 10 seconds
    setTimeout(() => { if (banner.parentElement) banner.remove(); }, 10000);
  }
};

// ════════════════════════════
//  AUTH STATE LISTENER
//  This is the single entry point
// ════════════════════════════
auth.onAuthStateChanged(async (fbUser) => {
  if (fbUser) {
    await initUser(fbUser);
    document.getElementById('loadScreen').style.display = 'none';
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display  = 'block';
    isGuestMode = false; _clearGuestSession(); _setTopbarMode('user');
  if(typeof startNotificationsListener==="function") startNotificationsListener();
    startDaresListener();
    AdManager.initScrollAds();   // start scroll ad tracker
    _bootRoute();                // open the page/modal the URL points to (deep-link / refresh)
  } else {
    document.getElementById('loadScreen').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display  = 'none';
  }
});

// ════════════════════════════
//  INIT USER FROM FIRESTORE
// ════════════════════════════
async function initUser(fbUser) {
  user = {
    uid:      fbUser.uid,
    name:     fbUser.displayName || fbUser.email.split('@')[0],
    email:    fbUser.email,
    picture:  fbUser.photoURL || null,
    provider: fbUser.providerData[0]?.providerId === 'google.com' ? 'Google' : 'Email'
  };

  try {
    const ref  = db.collection('users').doc(user.uid);
    const snap = await ref.get();

    if (!snap.exists) {
      // ── First login: auto-generate a unique username ──────────────────────
      const base    = (user.name || 'user').toLowerCase().replace(/[^a-z0-9_.]/g,'').slice(0,20) || 'user';
      let   handle  = base;
      let   attempt = 0;
      while (attempt < 10) {
        const taken = await db.collection('usernames').doc(handle).get();
        if (!taken.exists) break;
        handle = base + Math.floor(1000 + Math.random() * 9000);
        attempt++;
      }
      user.username = handle;
      user.bio      = '';
      user.website  = '';
      wallet = {
        balance: 100000,
        transactions: [{ type:'credit', title:'Welcome Bonus — Testnet', amount:100000, date:todayStr() }]
      };
      acceptedDares = [];
      pinnedDares   = [];
      const batch = db.batch();
      batch.set(db.collection('users').doc(user.uid), {
        name: user.name, email: user.email,
        photoURL: user.picture || '',
        username: handle, bio: '', website: '',
        wallet, acceptedDares, pinnedDares: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.set(db.collection('usernames').doc(handle), { uid: user.uid });
      await batch.commit();
    } else {
      const d   = snap.data();
      wallet        = d.wallet        || { balance:100000, pending:0, transactions:[] };
      acceptedDares = d.acceptedDares || [];
      _reconcileTakerApprovals();   // in case dares already loaded
      pinnedDares   = d.pinnedDares   || [];
      user.username = d.username || (user.name||'user').toLowerCase().replace(/[^a-z0-9_.]/g,'').slice(0,20);
      user.bio      = d.bio      || '';
      userLikes = d.likedProofs || [];
      user.website  = d.website  || '';
      user.socials  = d.socials  || {};   // persist Instagram/X/YouTube links across reloads
      user.settings = d.settings || {};   // persist notif/privacy/autoplay settings across reloads
      if (d.photoURL) user.picture = d.photoURL;  // saved photo always wins
    }
  } catch(e) {
    console.error('initUser error:', e);
    wallet = { balance:100000, pending:0, transactions:[] };
    acceptedDares = [];
  }

  // Update topbar
  const av = document.getElementById('topAv');
  if (user.picture) {
    av.innerHTML = `<img src="${user.picture}" alt="av" onerror="this.parentElement.textContent='${user.name[0].toUpperCase()}'"/>`;
  } else {
    av.textContent = user.name[0].toUpperCase();
  }
  document.getElementById('ddName').textContent  = user.name;
  document.getElementById('ddEmail').textContent = user.email;

  showToast('Welcome, ' + user.name.split(' ')[0] + '!');

  // Sidebar profile avatar
  const sbAv = document.getElementById('sbProfAv');
  if (sbAv) {
    if (user.picture) sbAv.innerHTML = `<img src="${user.picture}" alt="av"/>`;
    else sbAv.textContent = user.name[0].toUpperCase();
  }
}

// ════════════════════════════
//  REAL-TIME DARES LISTENER
// ════════════════════════════
let _daresLoaded = false;   // first snapshot arrived? (gates the skeleton loaders)
// Re-render only the active page, debounced so a burst of dare doc-changes rebuilds once
let _daresRerenderTO = null;
function _daresRerenderDebounced(){
  if (_daresRerenderTO) clearTimeout(_daresRerenderTO);
  _daresRerenderTO = setTimeout(() => {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    if (activePage.id === 'pageDares')    renderDaresPage();
    if (activePage.id === 'pageAccepted') renderAcceptedPage();
    if (activePage.id === 'pageProfile' && user){ _renderMyDares(); _renderAcceptedDares(); }
    if (activePage.id === 'pageHome'){ const r=document.getElementById('homeDaresRow'); if(r) r.outerHTML=_homeDaresHtml(); }
  }, 180);
}
function startDaresListener() {
  if (daresUnsub) daresUnsub();
  daresUnsub = db.collection('dares')
    .orderBy('createdAt', 'desc')
    .limit(60)                       // newest 60 — cap the payload as the collection grows
    .onSnapshot((snap) => {
      dares = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      _daresLoaded = true;
      _reconcileTakerApprovals();   // creator picked me? → unlock Submit Proof
      if (typeof _maybeInitialRoute === 'function') _maybeInitialRoute();   // deep-link /dare/:id
      _daresRerenderDebounced();    // batch bursts of doc changes into one rebuild
    }, (err) => {
      console.error('Missions listener error:', err);
      showToast('Connection issue — please refresh');
    });
}

// ════════════════════════════
//  GOOGLE LOGIN
// ════════════════════════════
async function googleLogin() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      showAuthErr('loginErr', 'Google login failed: ' + e.message);
    }
  }
}

// ════════════════════════════
//  EMAIL LOGIN
// ════════════════════════════
async function emailLogin() {
  const email = document.getElementById('liEmail').value.trim();
  const pass  = document.getElementById('liPass').value;
  if (!email || !pass) { showAuthErr('loginErr','Email and password required'); return; }
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    const msg = e.code === 'auth/user-not-found'  ? 'No account found. Please sign up.' :
                e.code === 'auth/wrong-password'   ? 'Wrong password. Please try again.' :
                e.code === 'auth/invalid-email'    ? 'Invalid email address.' :
                'Login failed: ' + e.message;
    showAuthErr('loginErr', msg);
  }
}

// ════════════════════════════
//  EMAIL SIGNUP
// ════════════════════════════
async function emailSignup() {
  const name  = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const pass  = document.getElementById('suPass').value;
  if (!name || !email || !pass) { showAuthErr('signupErr','All fields required'); return; }
  if (pass.length < 6)          { showAuthErr('signupErr','Password must be at least 6 characters'); return; }
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    await auth.currentUser.reload();
    await initUser(auth.currentUser);
    document.getElementById('loadScreen').style.display = 'none';
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display  = 'block';
    isGuestMode = false; _clearGuestSession(); _setTopbarMode('user');
    startDaresListener();
    AdManager.initScrollAds();
    goPage('home');
  } catch(e) {
    const msg = e.code === 'auth/email-already-in-use' ? 'Email already registered. Please sign in.' :
                e.code === 'auth/invalid-email'         ? 'Invalid email address.' :
                'Signup failed: ' + e.message;
    showAuthErr('signupErr', msg);
  }
}

// ════════════════════════════
//  LOGOUT
// ════════════════════════════
async function logout() {
  if (daresUnsub) { daresUnsub(); daresUnsub = null; }
  await auth.signOut();
  user = null; dares = []; wallet = { balance:100000, pending:0, transactions:[] }; acceptedDares = [];
  closeDD();
}

// ════════════════════════════
//  NAVIGATION
// ════════════════════════════
// Back-button navigation state (see BACK-BUTTON STACK section below)
let _ovStack = [];          // open tracked modals (ids), in open order
let _ovInPop = false;       // guard while a close is driven by popstate / our own rewind
let _curPage = null;        // last page shown (avoid duplicate history pushes)
let _pageNavInit = false;   // first goPage uses replaceState, rest pushState

// Real URLs (slash-style, YouTube-like) for tracked pages + modals
const _PAGE_URL  = { home:'/', explore:'/explore', dares:'/dares', accepted:'/accepted', wallet:'/wallet', profile:'/profile', leaderboard:'/leaderboard' };
const _MODAL_URL = { postOverlay:'/post', proofOverlay:'/submit-proof', settingsOverlay:'/settings',
  notifSettingsOverlay:'/settings/notifications', moreSettingsOverlay:'/settings/more',
  profileEditOverlay:'/settings/edit', depositOverlay:'/wallet/deposit', withdrawOverlay:'/wallet/withdraw',
  kycOverlay:'/wallet/kyc', methodOverlay:'/wallet/account', pinOverlay:'/wallet/pin',
  txnDetailOverlay:'/wallet/transaction', followListOverlay:'/followers', photoViewer:'/profile/photo',
  reviewOverlay:'/review-proofs', rejectOverlay:'/reject-proof', reportOverlay:'/report',
  adminReportsOverlay:'/admin-reports', selectTakersOverlay:'/select-takers', videoPlayOverlay:'/play',
  searchOverlay:'/search' };
const _URL_PAGE  = Object.fromEntries(Object.entries(_PAGE_URL ).map(([k,v])=>[v,k]));
const _URL_MODAL = Object.fromEntries(Object.entries(_MODAL_URL).map(([k,v])=>[v,k]));

function goPage(pg, _fromPop) {
  _searchReturn = null;
  // Navigating to a page closes any open page-modal (its history entry gets REPLACED below)
  const _ovWasOpen = (!_fromPop && !_navBack && _ovStack.length) ? _ovCloseAllSilent() : false;
  try{ _pvStop(); }catch(e){}
  try{ _pauseAllMedia(false); }catch(e){}   // leaving a page stops everything it was playing
  document.body.classList.remove('tb-hide'); // fresh page → topbar visible
  if (typeof _closeDetailOverlays === 'function') _closeDetailOverlays();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page' + pg.charAt(0).toUpperCase() + pg.slice(1));
  if (el) {
    el.classList.remove('nav-fwd','nav-back');
    el.classList.add('active');
    // mobile slide direction: back (popstate) = L→R, forward = R→L. Skip boot + when the
    // user turned page animations off in Accessibility settings.
    if (_pageNavInit && !(user && user.settings && user.settings.pageAnim === false))
      el.classList.add(_fromPop ? 'nav-back' : 'nav-fwd');
  }
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = document.getElementById('nav-' + pg);
  if (nav) nav.classList.add('active');
  document.body.classList.toggle('profile-open', pg === 'profile');   // swaps topbar avatar→gear (desktop) / hides topbar (mobile)
  if (pg === 'home')        renderHome();
  if (pg === 'explore')     renderExplorer();
  if (pg === 'dares')       renderDaresPage();
  if (pg === 'accepted')    renderAcceptedPage();
  if (pg === 'profile')     renderProfile();
  if (pg === 'wallet')      renderWallet();
  if (pg === 'leaderboard') loadLeaderboard();
  // History entry so the BACK button steps between main pages — each page has its own URL.
  if (!_navBack && !_fromPop) {
    const st = { _page: pg }, url = _PAGE_URL[pg] || '/';
    if (!_pageNavInit) { _pageNavInit = true; try{ history.replaceState(st, '', url); }catch(e){} }
    else if (_ovWasOpen) { try{ history.replaceState(st, '', url); }catch(e){} }   // swap the modal's entry for the page
    else if (_curPage !== pg) { try{ history.pushState(st, '', url); }catch(e){} }
  }
  _curPage = pg;
  // coming (back) onto a page: restart the mobile scroll-autoplay for the centered card
  if (typeof _pvIsTouch === 'function' && _pvIsTouch()) setTimeout(()=>{ try{ _pvPlayCentered(); }catch(e){} }, 900);
}

// Mobile profile mini-bar — back button
function _profileBack(){ goPage('home'); }

// Profile photo → open in a fullscreen viewer (no edit). Initials = nothing to show.
function _viewProfilePhoto(){
  const img=document.querySelector('#profPic img');
  if(!img||!img.src){ return; }
  document.getElementById('photoViewerImg').src=img.src;
  _ovOpen('photoViewer');
}
function closePhotoViewer(){ _ovSync('photoViewer'); document.getElementById('photoViewer').classList.remove('open'); }

// ════════════════════════════════════════════════════════
//  HOME — 3-SECTION YOUTUBE-STYLE PAGE (v0.15)
//
//  SECTION 1: Dare Videos  — approved proof videos grid
//  SECTION 2: Dare Shorts  — videos under 60s (horizontal)
//  SECTION 3: Active Dares — dares available to accept
// ════════════════════════════════════════════════════════
let homeProofs    = [];
let allProofs     = [];   // synced with homeProofs for explorer/search
let userLikes     = [];   // proofIds current user liked
let _searchTrackTimer = null;
let homeFilterCat = 'all';

// ─── SHARED ROUTING RULE ─────────────────────────────────
// Confirmed rule: a video is a SHORT if it's under 1 minute OR vertical (9:16).
// Otherwise (1 min+ AND 16:9/landscape) it's a LONG video.
// Used by home feed split, openShorts, and openVideo so they never disagree.
function _isShortVideo(p) {
  if (!p) return false;
  if (p.videoDuration > 0 && p.videoDuration < 60) return true;  // under 1 min → Shorts
  if (p.videoH > 0 && p.videoW > 0) return p.videoH > p.videoW;   // else by aspect ratio (9:16 → short)
  if (typeof p.isVertical === 'boolean') return p.isVertical;     // fallback: stored flag
  return false;                                                   // default → Long
}

// ─── Unified ACTIVE-DARE card (home / dares page / explore "more missions" / search) ───
function _activeDareCard(d){
  const cat = d.tags?.[0]||d.cat||'fitness';
  const title = d.caption||d.title||'Untitled Mission';
  const reward = d.rewardAmount ?? d.bounty ?? 0;
  const thumb = d.thumbnailURL||'';
  const color = CAT_C[cat]||'#FF2D4A', icon = CAT_I[cat]||'bolt';
  const isMine = d.creatorUid===user?.uid;
  const accepted = (typeof d.takers==='number') ? d.takers : (d.approvedTakers?.length||0);
  let expiry='';
  if (d.expiresAt){ const exp=d.expiresAt.toDate?d.expiresAt.toDate():new Date(d.expiresAt); const ms=exp-Date.now();
    if (ms>0){ const h=Math.floor(ms/3600000); expiry=`<span class="adc-expiry"><span class="mi">schedule</span>${h>=24?Math.floor(h/24)+'d':h+'h'} left</span>`; } }
  const inner = thumb ? `<img src="${thumb}" loading="lazy" decoding="async"/>`
    : `<div class="adc-thumb-bg" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};">${icon}</span></div>`;
  const cAv = _avHtml(d.creatorPhotoURL || (isMine?(user&&user.picture):''), d.creator);
  const safe = (''+title).replace(/[\\'"<>]/g,'');
  const uname = (d.creatorUsername||d.creator||'creator');
  const pinned = (typeof pinnedDares!=='undefined' && pinnedDares.includes(d.id))
    ? `<div class="adc-pin"><span class="mi">push_pin</span></div>` : '';
  const menuItem = isMine
    ? `<button onclick="event.stopPropagation();_closeAdcMenus();openEditDare('${d.id}')"><span class="mi">edit</span>Edit</button>`
    : `<button onclick="event.stopPropagation();_closeAdcMenus();openReportModal('dare','${d.id}','${safe}')"><span class="mi">flag</span>Report</button>`;
  return `<div class="active-dare-card" onclick="openDareDetail('${d.id}')">
    <div class="adc-thumb">${inner}${pinned}${expiry}<span class="adc-bounty">$${reward.toLocaleString('en-IN')}</span></div>
    <div class="yt-info">
      <div class="yt-av">${cAv}</div>
      <div class="yt-meta">
        <div class="yt-title">${escHtml(title)}</div>
        <div class="yt-sub"><span>@${escHtml(uname)}</span><span class="yt-dot"></span><span>${accepted} accepted</span><span class="yt-dot"></span><span>${_relTimeStr(d.date)}</span></div>
      </div>
      <div class="adc-menu-wrap">
        <button class="adc-dots" onclick="event.stopPropagation();_toggleAdcMenu(this)" title="More"><span class="mi">more_vert</span></button>
        <div class="adc-menu">${menuItem}</div>
      </div>
    </div>
  </div>`;
}
function _toggleAdcMenu(btn){
  const wrap = btn.parentElement;
  const wasOpen = wrap.classList.contains('open');
  _closeAdcMenus();
  if (!wasOpen) wrap.classList.add('open');
}
function _closeAdcMenus(){ document.querySelectorAll('.adc-menu-wrap.open').forEach(w=>w.classList.remove('open')); }
document.addEventListener('click', _closeAdcMenus);

// ─── MAIN HOME RENDER ────────────────────────────────────
// ── Skeleton loaders (shimmer placeholders) ──
function _skelCards(n){
  // mirror the real long-video feed (.feed-longs > .yt-card) so the loader matches the UI
  let c='';
  for(let i=0;i<(n||5);i++){
    c+=`<div class="yt-card skel-yt">
      <div class="yt-thumb"><span class="skel skel-fill"></span></div>
      <div class="yt-info">
        <div class="yt-av"><span class="skel" style="display:block;width:100%;height:100%;border-radius:50%;"></span></div>
        <div class="yt-meta" style="flex:1;min-width:0;">
          <span class="skel skel-line" style="display:block;width:88%;"></span>
          <span class="skel skel-line" style="display:block;width:52%;height:11px;margin-top:9px;"></span>
        </div></div></div>`;
  }
  return `<div class="feed-longs">${c}</div>`;
}
function _skelRows(n){
  let r='';
  for(let i=0;i<(n||6);i++){
    r+=`<div class="skel-row"><div class="skel skel-av" style="width:42px;height:42px;"></div>
      <div class="skel-meta"><div class="skel skel-line sl-60"></div><div class="skel skel-line sl-40"></div></div></div>`;
  }
  return r;
}

async function renderHome(cat) {
  if (cat) homeFilterCat = cat;
  const grid = document.getElementById('homeVideoGrid');

  // 1) INSTANT paint from what we already have (memory this session, else the local
  //    IndexedDB cache) — no waiting on the network for repeat opens.
  if (homeProofs && homeProofs.length) {
    _homeRenderFeed();
  } else {
    if (grid) grid.innerHTML = _skelCards(5);
    try {
      const c = await db.collection('proofs').where('status','==','approved').get({ source:'cache' });
      if (!c.empty) { homeProofs = c.docs.map(d=>({id:d.id,...d.data()})); allProofs = homeProofs;
        if (typeof _maybeInitialRoute === 'function') _maybeInitialRoute(); _homeRenderFeed(); }
    } catch(e){}
  }

  // 2) REFRESH from the server in the background (stale-while-revalidate)
  try {
    const snap = await db.collection('proofs').where('status','==','approved').get();
    homeProofs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allProofs = homeProofs; // sync for explorer/search/related
    if (typeof _maybeInitialRoute === 'function') _maybeInitialRoute();   // deep-link /watch|/shorts
    _homeRenderFeed();
  } catch(e) {
    if (grid && !(homeProofs && homeProofs.length)) grid.innerHTML = `<div class="empty">
      <span class="mi">error_outline</span>
      <div class="empty-title">Load Error</div>
      <p class="empty-desc">${e.message}</p></div>`;
  }
}
function _homeRenderFeed() {
  const filtered = homeFilterCat === 'all'
    ? homeProofs
    : homeProofs.filter(p => {
        const parentDare = dares.find(d => d.id === p.dareId);
        const pTags = [ ...(p.tags || (p.cat ? [p.cat] : [])), ...(parentDare?.tags || (parentDare?.cat ? [parentDare.cat] : [])) ];
        return pTags.some(t => t.toLowerCase() === homeFilterCat.toLowerCase());
      });
  const shorts  = filtered.filter(p => _isShortVideo(p));
  const regular = filtered.filter(p => !_isShortVideo(p));
  _renderInterleavedFeed(regular, shorts);
  const oldShorts = document.getElementById('homeShortsSection');
  if (oldShorts) oldShorts.style.display = 'none';
  _renderHomeChips(homeProofs);
}

// ─── SECTION 1: DARE VIDEOS GRID ─────────────────────────
// YouTube-style card grid. Clicking a card triggers pre-roll ads → then plays video.
function _renderVideoGrid(proofs) {
  const container = document.getElementById('homeVideoGrid');
  if (!container) return;

  if (!proofs.length) {
    container.innerHTML = `<div class="empty">
      <span class="mi">play_circle</span>
      <div class="empty-title">No Videos Yet</div>
      <p class="empty-desc">Complete a mission and submit video proof — it will appear here!</p>
      <button class="btn-empty" onclick="goPage('dares')">
        <span class="mi">bolt</span>Browse Missions
      </button></div>`;
    return;
  }

  container.innerHTML = `<div class="yt-grid">${proofs.map(p => {
    const cat    = p.cat || 'fitness';
    const color  = CAT_C[cat] || '#717171';
    const icon   = CAT_I[cat] || 'bolt';
    const dur    = p.videoDuration
      ? (p.videoDuration >= 60
          ? Math.floor(p.videoDuration/60)+':'+String(p.videoDuration%60).padStart(2,'0')
          : p.videoDuration+'s')
      : '';
    return `
    <div class="yt-card" onclick="openVideoDetail('${p.id}')">
      <div class="yt-thumb">
        ${vidThumb(p,640)
          ? `<img src="${vidThumb(p,640)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
          : `<div class="yt-thumb-bg"><span class="mi">${icon}</span></div>`
        }
        <div class="yt-play-over"><span class="mi">play_circle</span></div>
        <div class="yt-bounty">$${(p.dareBounty||0).toLocaleString('en-IN')}</div>
        ${dur ? `<div style="position:absolute;bottom:8px;right:8px;
          background:rgba(0,0,0,.8);color:#fff;font-size:10px;font-weight:600;
          padding:2px 7px;border-radius:5px;">${dur}</div>` : ''}
      </div>
      <div class="yt-info">
        <div class="yt-av">${_avHtml(p.takerPhotoURL, p.takerName)}</div>
        <div class="yt-meta">
          <div class="yt-title">${p.dareTitle||'Mission Completed'}</div>
          <div class="yt-sub">
            <span>@${p.takerUsername||p.takerName||'creator'}</span>
            <span class="yt-dot"></span>
            <span>${(p.viewCount||0).toLocaleString('en-IN')} views</span>
            <span class="yt-dot"></span>
            <span>${_relTime(p)}</span>
          </div>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ─── SECTION 2: DARE SHORTS ──────────────────────────────
// Horizontal-scroll row of short videos (< 60s).
// Section is HIDDEN if no shorts exist.
function _renderShortsSection(shorts) {
  const section = document.getElementById('homeShortsSection');
  const row     = document.getElementById('homeShortsRow');
  if (!section || !row) return;

  if (!shorts.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'block';

  row.innerHTML = shorts.map(p => {
    const cat   = p.cat || 'fitness';
    const color = CAT_C[cat] || '#FF2D4A';
    const icon  = CAT_I[cat] || 'bolt';
    const dur   = p.videoDuration ? p.videoDuration + 's' : '';
    return `
    <div class="short-card" onclick="openShorts('${p.id}')" data-vurl="${p.videoURL||''}" data-dur="${p.videoDuration||0}">
      <div class="short-thumb">
        ${vidThumb(p,360)
          ? `<img src="${vidThumb(p,360)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
          : `<div class="short-thumb-bg" style="background:#272727;"><span class="mi" style="color:${color};">${icon}</span></div>`
        }
        <div class="short-play-over"><span class="mi">play_circle</span></div>
        <div class="short-bounty-tag">$${(p.dareBounty||0).toLocaleString('en-IN')}</div>
        ${dur ? `<div class="short-dur-tag">${dur}</div>` : ''}
      </div>
      <div class="short-info">
        <div class="short-title">${p.dareTitle||'Mission Short'}</div>
        <div class="short-meta">${p.takerName||'—'}</div>
      </div>
    </div>`;
  }).join('');
}

// ─── SECTION 3: ACTIVE DARES ─────────────────────────────
// Show up to 6 open dares at bottom of home feed.
function _renderHomeActiveDares() {
  const container = document.getElementById('homeActiveDares');
  if (!container) return;

  const active = (dares || []).filter(d => !d.completed).slice(0, 6);

  if (!active.length) {
    container.innerHTML = `<div class="empty" style="padding:24px 16px;">
      <span class="mi">bolt</span>
      <div class="empty-title">No Active Missions</div>
      <p class="empty-desc">No missions yet. Be the first to post!</p>
      <button class="btn-empty" onclick="openPost()">
        <span class="mi">add_circle</span>Post a Mission</button>
    </div>`;
    return;
  }

  const cards = active.map(_activeDareCard).join('');

  const total   = (dares||[]).filter(d => !d.completed).length;
  const hasMore = total > 6;
  container.innerHTML = `
    <div class="active-dare-grid">${cards}</div>
    ${hasMore ? `<div style="text-align:center;margin-top:16px;">
      <button class="btn-empty" style="display:inline-flex;" onclick="goPage('dares')">
        <span class="mi">bolt</span>View All ${total} Missions
      </button></div>` : ''}`;
}

// ─── HOME CHIP FILTER ─────────────────────────────────────
// ── Dynamic Chips: built from real dare tags ─────────────────────────────
function _renderHomeChips(proofs) {
  const chipsEl = document.getElementById('homeChips');
  if (!chipsEl) return;

  // Count tag frequency from loaded proofs + dares
  const tagCounts = {};
  [...proofs, ...dares].forEach(item => {
    const tags = item.tags || (item.cat ? [item.cat] : []);
    tags.forEach(t => {
      // Single word, lowercase, letters+numbers only
      const tag = t.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (tag && tag.length >= 2 && tag.length <= 20) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    });
  });

  // Sort by frequency, top 8 tags only
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);

  // Build chips HTML — "All" always first
  let html = `<button class="chip ${homeFilterCat==='all'?'active':''}"
    onclick="homeFilter('all',this)">All</button>`;
  topTags.forEach(tag => {
    const isActive = homeFilterCat === tag;
    html += `<button class="chip ${isActive?'active':''}"
      onclick="homeFilter('${tag}',this)">${tag.charAt(0).toUpperCase()+tag.slice(1)}</button>`;
  });

  // If no tags yet — hide chips bar
  if (!topTags.length) {
    chipsEl.style.display = 'none';
  } else {
    chipsEl.style.display = 'flex';
    chipsEl.innerHTML = html;
  }
}

function homeFilter(cat, el) {
  document.querySelectorAll('#homeChips .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderHome(cat);
}

// ════════════════════════════
//  VIDEO PLAY MODAL
// ════════════════════════════
// Shows pre-roll ads based on video duration, THEN opens player.
// · Under 1 min (Shorts) → 0 ads, play immediately
// · 1–15 min             → 2 ads (15s each)
// · Over 15 min          → 1 ad
function openVideoPlay(proofId) {
  const p = homeProofs.find(x => x.id === proofId);
  if (!p || !p.videoURL) { showToast('Video not available'); return; }

  // Increment view count in Firestore
  if (user) {
    db.collection('proofs').doc(proofId).update({
      viewCount: firebase.firestore.FieldValue.increment(1)
    }).catch(()=>{});
    p.viewCount = (p.viewCount||0) + 1;
  }

  AdManager.showPreRollAds(p.videoDuration || 0, () => {
    document.getElementById('vpTitle').textContent  = p.dareTitle || 'Mission Video';
    document.getElementById('vpDare').textContent   = p.dareTitle || '—';
    document.getElementById('vpSub').textContent    = `By ${p.takerName} • Rs.${(p.dareBounty||0).toLocaleString('en-IN')} bounty won`;
    document.getElementById('vpAv').textContent     = (p.takerName||'?')[0].toUpperCase();
    const player = document.getElementById('vpPlayer');
    _playSmart(player, p.videoURL, { autoplay:false, maxW: _vidMaxW() });
    _ovOpen('videoPlayOverlay');
  });
}
function closeVideoPlay() {
  _ovSync('videoPlayOverlay');
  document.getElementById('videoPlayOverlay').classList.remove('open');
  const p = document.getElementById('vpPlayer');
  p.pause(); p.src = '';
}

// ════════════════════════════
//  DARES PAGE
// ════════════════════════════
function renderDaresPage() {
  const feed = document.getElementById('daresPageFeed');
  if (feed && !_daresLoaded){ feed.innerHTML = _skelCards(4); return; }   // still loading (snapshot re-renders)
  const now  = new Date();

  // Filter: not completed + not expired
  let active = dares.filter(d => {
    if (d.completed) return false;
    if (d.expiresAt) {
      const exp = d.expiresAt.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt);
      if (exp < now) return false;
    }
    return true;
  });

  if (!active.length) {
    feed.innerHTML = `
      <div class="empty">
        <span class="mi">bolt</span>
        <div class="empty-title">No Active Missions</div>
        <p class="empty-desc">No active missions yet. Post the first mission!</p>
        <button class="btn-empty" onclick="openPost()"><span class="mi">add_circle</span>Post a Mission</button>
      </div>`;
    return;
  }

  // Sort: pinned first, then by createdAt desc
  active.sort((a, b) => {
    const aPinned = pinnedDares.includes(a.id) ? 1 : 0;
    const bPinned = pinnedDares.includes(b.id) ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;
    return 0; // already sorted by createdAt desc from listener
  });

  feed.innerHTML = `<div class="active-dare-grid">${active.map(_activeDareCard).join('')}</div>`;
}

// ════════════════════════════
//  ACCEPTED DARES PAGE
// ════════════════════════════
function renderAcceptedPage() {
  // #6: Sort latest first
  if (typeof acceptedDares !== 'undefined' && Array.isArray(acceptedDares)) {
    acceptedDares.sort((a,b) => {
      const ta = new Date(a.acceptedDate || a.date || 0).getTime();
      const tb = new Date(b.acceptedDate || b.date || 0).getTime();
      return tb - ta;
    });
  }
  const feed = document.getElementById('acceptedPageFeed');
  if (!acceptedDares.length) {
    feed.innerHTML = `
      <div class="empty">
        <span class="mi">task_alt</span>
        <div class="empty-title">No Accepted Missions</div>
        <p class="empty-desc">You haven't accepted any missions yet. Browse the Missions page to get started!</p>
        <button class="btn-empty" onclick="goPage('dares')"><span class="mi">bolt</span>Browse Missions</button>
      </div>`;
    return;
  }

  feed.innerHTML = `<div class="active-dare-grid">${acceptedDares.map(a => {
    const d = (dares||[]).find(x => x.id === a.dareId) || {
      id: a.dareId, caption: a.dareTitle, cat: a.cat,
      bounty: a.bounty, rewardAmount: a.bounty,
      thumbnailURL: a.thumbnailURL || a.dareThumbnailURL || '',
      creator: a.creator || a.posterName || '—',
      creatorPhotoURL: a.creatorPhotoURL || a.posterPhotoURL || '',
      date: a.acceptedDate || a.date
    };
    return _activeDareCard(d);
  }).join('')}</div>`;
}

// ════════════════════════════
//  SEARCH (BUG FIX: was referencing missing #dareFeed)
// ════════════════════════════
function handleSearch() {
  // Typing only updates the suggestions dropdown — it never navigates.
  // Actual search runs ONLY on Enter / search button (handleSearchImmediate).
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(()=>{
    const q = (document.getElementById('searchInput').value||'').toLowerCase().trim();
    if (q.length >= 2) _showSuggestions(q); else _hideSuggestions();
  }, 200);
}
function handleSearchImmediate() {
  // Immediate search (for Enter key, button click, suggestion tap)
  if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null; }
  _handleSearchNow();
}
function _handleSearchNow() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  if (!q) { document.getElementById('searchInput').focus(); _hideSuggestions(); return; }
  if (q.length < 2) { _hideSuggestions(); return; }

  _hideSuggestions();
  closeMobileSearch();
  // Delegate to the v32 search engine: Dares/Videos toggle + scored relevance
  // + Active/Completed sections + search tracking. (Was previously dead code.)
  _doSearch(q);
}

// ════════════════════════════════════════════════════════════════════
//  OPEN / CLOSE POST DARE MODAL
// ════════════════════════════════════════════════════════════════════
function openPost() {
  // Post modal (z9500) opens ON TOP of the current page — don't close/leave it
  editingDareId = null;
  // Reset all state
  postTags = []; postRules = []; selectedThumb = null;
  selectedPreviewVid = null; capturedFrameBlob = null;
  currentMediaTab = 'image'; currentVis = 'now';
  currentTakerMode = 'open'; currentExpiryDate = null;

  // Clear text inputs
  ['pCaption','pReward','pDesc','tagInput','scheduleDate','pExpiry']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // Reset taker mode UI
  document.getElementById('tmOpen')?.classList.add('active');
  document.getElementById('tmPick')?.classList.remove('active');
  const mhint = document.getElementById('takerModeHint');
  if (mhint) mhint.textContent = 'Anyone who accepts can submit proof.';

  // Reset media panel to image tab
  switchMediaTab('image');
  _resetThumbUI();
  _resetVideoUI();

  renderPostTags();
  renderPostRules();
  switchVis('now');

  // Modal title
  const titleEl = document.querySelector('#postOverlay .modal-title');
  if (titleEl) titleEl.textContent = 'Post a New Mission';

  const btn = document.getElementById('submitDareBtn');
  if (btn) { btn.disabled = false; btn.innerHTML = '<span class="mi">bolt</span> Post Mission'; }

  _ovOpen('postOverlay');
  _tpInit('postOverlay');   // desktop: show the first section (Caption) in the right pane
}

function closePost() {
  _ovSync('postOverlay');
  document.getElementById('postOverlay').classList.remove('open');
  // Revoke object URLs to free memory
  const vidEl = document.getElementById('previewVidPlayer');
  if (vidEl && vidEl.src) { URL.revokeObjectURL(vidEl.src); vidEl.src = ''; }
  const fpVid = document.getElementById('fpVideo');
  if (fpVid && fpVid.src) { URL.revokeObjectURL(fpVid.src); fpVid.src = ''; }
  capturedFrameBlob = null;
}

function _resetThumbUI() {
  const prev = document.getElementById('thumbPreview');
  if (prev && prev.src) URL.revokeObjectURL(prev.src);
  if (prev) { prev.src = ''; prev.style.display = 'none'; }
  const inner = document.getElementById('thumbDZInner');
  const edit  = document.getElementById('thumbEditRow');
  const dz    = document.getElementById('thumbDZ');
  const inp   = document.getElementById('thumbInput');
  if (inner) inner.style.display = 'flex';
  if (edit)  edit.style.display  = 'none';
  if (dz)    dz.classList.remove('has-media');
  if (inp)   inp.value = '';
}
function _resetVideoUI() {
  const pVid = document.getElementById('previewVidPlayer');
  const pDZ  = document.getElementById('previewVidDZInner');
  const fp   = document.getElementById('framePicker');
  const fpr  = document.getElementById('fpCapturedRow');
  const fpsb = document.getElementById('fpScrubber');
  const inp  = document.getElementById('previewVidInput');
  if (pVid) pVid.style.display = 'none';
  if (pDZ)  pDZ.style.display  = 'flex';
  if (fp)   fp.style.display   = 'none';
  if (fpr)  fpr.style.display  = 'none';
  if (fpsb) fpsb.value = 0;
  if (inp)  inp.value  = '';
}

// ════════════════════════════════════════════════════════════════════
//  MEDIA TAB SWITCH
// ════════════════════════════════════════════════════════════════════
function switchMediaTab(tab) {
  // Video Preview tab removed — only the image thumbnail remains. Kept null-safe
  // so existing callers (openPost/openEditDare) don't break.
  currentMediaTab = 'image';
  const mImg = document.getElementById('mediaTabImg');
  const mVid = document.getElementById('mediaTabVid');
  const tImg = document.getElementById('mtImg');
  const tVid = document.getElementById('mtVid');
  if (mImg) mImg.style.display = 'block';
  if (mVid) mVid.style.display = 'none';
  if (tImg) tImg.classList.toggle('active', true);
  if (tVid) tVid.classList.toggle('active', false);
}

// ════════════════════════════════════════════════════════════════════
//  THUMBNAIL (IMAGE) HANDLERS
// ════════════════════════════════════════════════════════════════════
function onThumbSelected(e) {
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('image/'))  { showToast('Please select an image file'); return; }
  if (file.size > 5 * 1024 * 1024)     { showToast('Max 5MB allowed'); return; }
  // #1: Open adjuster to crop to 16:9 (drag + zoom)
  _taBindDrag();
  openThumbAdjust(file, 'creator');
  e.target.value = ''; // allow re-selecting same file
}
function removeThumb() {
  selectedThumb = null;
  _resetThumbUI();
}
function adjustThumb() {
  // Re-open adjuster with the current selected thumbnail
  if (selectedThumb) { _taBindDrag(); openThumbAdjust(selectedThumb, 'creator'); }
  else document.getElementById('thumbInput')?.click();
}

// ════════════════════════════════════════════════════════════════════
//  VIDEO PREVIEW HANDLERS
// ════════════════════════════════════════════════════════════════════
function onPreviewVidSelected(e) {
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('video/'))   { showToast('Please select a video file'); return; }
  if (file.size > 100 * 1024 * 1024)    { showToast('Max 100MB allowed'); return; }
  selectedPreviewVid = file;

  const player = document.getElementById('previewVidPlayer');
  if (player.src) URL.revokeObjectURL(player.src);
  player.src = URL.createObjectURL(file);
  player.style.display = 'block';
  document.getElementById('previewVidDZInner').style.display = 'none';

  // Load same video in frame picker
  const fp = document.getElementById('fpVideo');
  if (fp.src) URL.revokeObjectURL(fp.src);
  fp.src = URL.createObjectURL(file);
  fp.addEventListener('loadedmetadata', () => {
    document.getElementById('fpScrubber').max = Math.floor(fp.duration * 10);
  }, { once: true });

  document.getElementById('framePicker').style.display   = 'block';
  document.getElementById('fpCapturedRow').style.display = 'none';
  capturedFrameBlob = null;
}

// ════════════════════════════════════════════════════════════════════
//  FRAME PICKER (YouTube pencil-style thumbnail selector)
// ════════════════════════════════════════════════════════════════════
function scrubFPVideo(val) {
  const vid = document.getElementById('fpVideo');
  if (vid.duration) vid.currentTime = (val / 1000) * vid.duration;
}

function captureVideoFrame() {
  const vid    = document.getElementById('fpVideo');
  const canvas = document.getElementById('fpCanvas');
  canvas.width  = vid.videoWidth  || 320;
  canvas.height = vid.videoHeight || 180;
  canvas.getContext('2d').drawImage(vid, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    if (!blob) { showToast('Frame capture failed — try again'); return; }
    capturedFrameBlob = blob;
    const thumbEl = document.getElementById('fpThumb');
    if (thumbEl.src) URL.revokeObjectURL(thumbEl.src);
    thumbEl.src = URL.createObjectURL(blob);
    document.getElementById('fpCapturedRow').style.display = 'flex';
    showToast('Thumbnail captured!');
  }, 'image/jpeg', 0.88);
}

// ════════════════════════════════════════════════════════════════════
//  TAGS
// ════════════════════════════════════════════════════════════════════
function handleTagInput(e) {
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  const raw = document.getElementById('tagInput').value.trim().replace(/^#+/, '').toLowerCase();
  if (!raw) return;
  if (postTags.includes(raw))   { showToast('Tag already added'); return; }
  if (postTags.length >= 5)     { showToast('Maximum 5 tags allowed'); return; }
  if (raw.length > 20)          { showToast('Tag is too long (max 20 characters)'); return; }
  postTags.push(raw);
  document.getElementById('tagInput').value = '';
  renderPostTags();
}
function removeTag(i) { postTags.splice(i, 1); renderPostTags(); }
function renderPostTags() {
  document.getElementById('tagChips').innerHTML =
    postTags.map((t, i) => `
      <div class="post-tag-chip">
        #${escHtml(t)}
        <button onclick="removeTag(${i})" type="button" title="Remove">×</button>
      </div>`).join('');
}

// ════════════════════════════════════════════════════════════════════
//  RULES
// ════════════════════════════════════════════════════════════════════
function addRule() {
  if (postRules.length >= 10) { showToast('Maximum 10 rules allowed'); return; }
  postRules.push('');
  renderPostRules();
  setTimeout(() => {
    const inputs = document.querySelectorAll('.rule-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}
function updateRule(i, val) { postRules[i] = val; }
function removeRule(i)      { postRules.splice(i, 1); renderPostRules(); }
function renderPostRules() {
  const list = document.getElementById('rulesList');
  if (!postRules.length) { list.innerHTML = ''; return; }
  list.innerHTML = postRules.map((rule, i) => `
    <div class="rule-row">
      <div class="rule-num">${i + 1}</div>
      <input class="rule-input f-input" type="text"
        value="${escHtml(rule)}"
        placeholder="Describe this rule..."
        oninput="updateRule(${i}, this.value)"
        style="margin:0;flex:1;border-radius:8px;font-size:13px;padding:8px 12px;"/>
      <button class="rule-del-btn" onclick="removeRule(${i})" type="button" title="Remove rule">
        <span class="mi">close</span>
      </button>
    </div>`).join('');
}

// ════════════════════════════════════════════════════════════════════
//  VISIBILITY (Publish Now / Scheduled)
// ════════════════════════════════════════════════════════════════════
function switchVis(type) {
  currentVis = type;
  document.getElementById('visNow').classList.toggle('active',   type === 'now');
  document.getElementById('visSched').classList.toggle('active', type === 'scheduled');
  document.getElementById('scheduleBox').style.display = type === 'scheduled' ? 'block' : 'none';
}

// ════════════════════════════════════════════════════════════════════
//  HELPER — HTML escape (prevents XSS in dynamic innerHTML)
// ════════════════════════════════════════════════════════════════════
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Avatar inner-HTML: real profile photo if present, else the name's first letter.
// Drop into any circular avatar container (it centers text / the img fills it).
// Avatars show up on EVERY card/comment/list row. Serving the raw upload (often
// 1000–3000px) means a heavy main-thread decode per avatar → scroll/load stutter.
// Shrink to a tiny thumbnail on the CDN + async-decode + lazy-load.
function _optAv(url) {
  if (!url) return url;
  // Cloudinary image upload → 96px square, face-aware, auto format/quality
  if (url.includes('res.cloudinary.com') && url.includes('/image/upload/')) {
    if (/\/image\/upload\/[a-z]+_[^/]*\//.test(url)) return url; // already transformed
    return url.replace('/image/upload/', '/image/upload/w_96,h_96,c_fill,g_face,q_auto,f_auto/');
  }
  // Google profile photos support a size suffix — normalise to s96
  if (url.includes('googleusercontent.com')) {
    return /=s\d+/.test(url) ? url.replace(/=s\d+(-c)?/, '=s96-c')
                             : (url.includes('=') ? url : url + '=s96-c');
  }
  return url;
}
function _avHtml(photoURL, name) {
  const letter = (String(name||'?').trim().charAt(0) || '?').toUpperCase().replace(/['"\\<>]/g,'');
  return photoURL
    ? `<img src="${_optAv(photoURL)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.parentElement.textContent='${letter}'"/>`
    : letter;
}

// ════════════════════════════════════════════════════════════════════
//  SUBMIT DARE — v0.15
//  Combined: v15 post-dare improvements + v14 AdManager.showPostDareAds
// ════════════════════════════════════════════════════════════════════
async function submitDare() {
  if (!user) { showToast('Please sign in first'); return; }

  const caption = document.getElementById('pCaption').value.trim();
  const reward  = Math.max(0, parseInt(document.getElementById('pReward').value) || 0);
  const desc    = document.getElementById('pDesc').value.trim();
  const rules   = postRules.map(r => r.trim()).filter(Boolean);
  const tags    = postTags.length ? [...postTags] : ['general'];

  if (!caption) { showToast('Please add a caption'); return; }
  if (!desc)    { showToast('Please add a description'); return; }
  if (!editingDareId && reward > wallet.balance) {
    showToast('Insufficient wallet balance'); return;
  }
  if (editingDareId) {   // editing: only the reward *increase* needs more balance
    const _oldD = dares.find(d=>d.id===editingDareId);
    const _oldR = _oldD ? (_oldD.rewardAmount ?? _oldD.bounty ?? 0) : 0;
    if (reward - _oldR > wallet.balance) { showToast('Insufficient balance to raise the reward'); return; }
  }

  // Expiry
  let expiresAt = null;
  const expiryVal = document.getElementById('pExpiry')?.value;
  if (expiryVal) {
    const expDate = new Date(expiryVal);
    if (expDate <= new Date()) { showToast('Expiry must be a future date/time'); return; }
    expiresAt = expDate;
  }

  let scheduledAt = null;
  if (currentVis === 'scheduled') {
    const dateVal = document.getElementById('scheduleDate').value;
    if (!dateVal) { showToast('Please select a schedule date and time'); return; }
    scheduledAt = new Date(dateVal);
    if (scheduledAt <= new Date()) { showToast('Please select a future date and time'); return; }
  }

  const btn = document.getElementById('submitDareBtn');
  btn.disabled = true;
  btn.innerHTML = editingDareId
    ? '<span class="mi">hourglass_empty</span> Saving...'
    : '<span class="mi">hourglass_empty</span> Posting...';

  try {
    let thumbnailURL    = editingDareId ? (dares.find(d=>d.id===editingDareId)?.thumbnailURL||'')    : '';
    let previewVideoURL = editingDareId ? (dares.find(d=>d.id===editingDareId)?.previewVideoURL||'') : '';

    const thumbFile = capturedFrameBlob
      ? new File([capturedFrameBlob], 'thumb.jpg', { type:'image/jpeg' })
      : selectedThumb;

    if (thumbFile) {
      btn.innerHTML = '<span class="mi">upload</span> Uploading thumbnail...';
      const t = uploadToCloudinary(thumbFile, 'image', pct => {
        btn.innerHTML = `<span class="mi">upload</span> Uploading thumbnail ${pct}%`;
      });
      thumbnailURL = await t.promise;
    }

    if (selectedPreviewVid && currentMediaTab === 'video') {
      const v = uploadToCloudinary(selectedPreviewVid, 'video', pct => {
        btn.innerHTML = `<span class="mi">upload</span> Uploading video ${pct}%`;
      });
      previewVideoURL = await v.promise;
    }

    btn.innerHTML = '<span class="mi">hourglass_empty</span> Saving...';

    const dareData = {
      caption, tags,
      rewardAmount: reward,
      description: desc,
      rules,
      thumbnailURL,
      previewVideoURL,
      visibility: currentVis,
      takerSelectionMode: currentTakerMode,
      expiresAt: expiresAt ? firebase.firestore.Timestamp.fromDate(expiresAt) : null,
      scheduledAt: scheduledAt ? firebase.firestore.Timestamp.fromDate(scheduledAt) : null,
      // Legacy
      title: caption,
      cat: tags[0] || 'general',
      bounty: reward,
      desc,
    };

    if (editingDareId) {
      // ── EDIT MODE: update existing dare ──────────────────────────────────
      const _oldD = dares.find(d=>d.id===editingDareId);
      const _oldR = _oldD ? (_oldD.rewardAmount ?? _oldD.bounty ?? 0) : 0;
      const _delta = reward - _oldR;     // >0 lock more, <0 refund difference
      await db.collection('dares').doc(editingDareId).update({
        ...dareData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (_delta !== 0) {                 // keep escrow accounting in sync
        wallet.balance -= _delta;
        wallet.transactions = wallet.transactions || [];
        wallet.transactions.unshift({
          id:'w'+Date.now()+Math.floor(Math.random()*1000), ts:Date.now(), status:'completed',
          type: _delta>0?'debit':'credit', category: _delta>0?'dare_posted':'refund',
          title: (_delta>0?'Reward raised: ':'Reward lowered (refund): ') + caption.substring(0,25),
          amount: Math.abs(_delta), ref:'REF'+Date.now().toString(36).toUpperCase(), date: todayStr()
        });
        await db.collection('users').doc(user.uid).update({ wallet });
      }
      closePost();
      showToast('Mission updated successfully!');
      editingDareId = null;
    } else {
      // ── CREATE MODE: new dare ─────────────────────────────────────────────
      await db.collection('dares').add({
        ...dareData,
        creator:        user.name,
        creatorEmail:   user.email,
        creatorUid:     user.uid,
        creatorUsername: user.username || '',
        creatorPhotoURL: user.picture || '',
        takers:       0,
        proofCount:   0,
        completed:    false,
        approvedTakers: [],
        date:         todayStr(),
        createdAt:    firebase.firestore.FieldValue.serverTimestamp()
      });

      if (reward > 0) {
        wallet.balance -= reward;
        wallet.transactions.unshift({
          id:'w'+Date.now()+Math.floor(Math.random()*1000), ts:Date.now(), status:'completed',
          type:'debit', category:'dare_posted',
          title:'Mission Posted: ' + caption.substring(0,30),
          amount: reward, ref:'REF'+Date.now().toString(36).toUpperCase(), date: todayStr()
        });
        await db.collection('users').doc(user.uid).update({ wallet });
      }

      closePost();
      const schedMsg = currentVis === 'scheduled'
        ? ` (Scheduled)` : '';
      showToast('Mission posted!' + (reward>0 ? ` Rs.${reward.toLocaleString('en-IN')} reward set.`:'')+schedMsg);

      AdManager.showPostDareAds(() => {
        showToast('Your mission is now live!');
      });
    }

  } catch(e) {
    showToast('Error: ' + e.message);
    console.error('submitDare error:', e);
    btn.disabled = false;
    btn.innerHTML = editingDareId
      ? '<span class="mi">save</span> Save Changes'
      : '<span class="mi">bolt</span> Post Mission';
  }
}

//  ACCEPT / APPLY DARE  (v0.19)
//  open mode       → direct accept, proof allowed immediately
//  creator_picks   → apply to be considered, wait for creator
// ════════════════════════════
async function acceptDare(id) {
  const d = dares.find(x => x.id === id);
  if (!d) return;
  if (acceptedDares.find(a => a.dareId === id)) {
    showToast('You already applied or accepted this mission!'); return;
  }

  const isCreatorPicks = d.takerSelectionMode === 'creator_picks';
  const reward = d.rewardAmount ?? d.bounty ?? 0;

  try {
    // Always write to applicants subcollection (for creator to see)
    const applicantRef = db.collection('dares').doc(id)
      .collection('applicants').doc(user.uid);
    const compSnap = await db.collection('proofs')
      .where('takerId','==', user.uid)
      .where('status','==','approved').get();
    const completionRate = compSnap.size; // number of approved proofs

    await applicantRef.set({
      uid:            user.uid,
      name:           user.name,
      email:          user.email,
      appliedAt:      firebase.firestore.FieldValue.serverTimestamp(),
      date:           todayStr(),
      completionRate, // used for "highest completion rate" random select
      status:         isCreatorPicks ? 'pending' : 'accepted'
    });

    // Increment takers count
    await db.collection('dares').doc(id).update({
      takers: firebase.firestore.FieldValue.increment(1)
    });

    // Add to user's local acceptedDares
    acceptedDares.push({
      dareId:          id,
      dareTitle:       d.caption || d.title,
      bounty:          reward,
      cat:             d.tags?.[0] || d.cat || 'general',
      date:            todayStr(),
      proofStatus:     'pending',
      applicantStatus: isCreatorPicks ? 'pending' : 'accepted',
      proofNote:       '',
      proofFilename:   ''
    });
    await db.collection('users').doc(user.uid).update({ acceptedDares });

    if (isCreatorPicks) {
      showToast('Applied! Creator will review and select takers.');
    } else {
      showToast('Mission accepted!' + (reward > 0 ? ` Submit proof to claim Rs.${reward.toLocaleString('en-IN')}!` : 'Submit your proof!'));
    }
  } catch(e) {
    showToast('Error: ' + e.message);
  }
}

// ════════════════════════════
//  VIDEO PROOF
// ════════════════════════════
// ════════════════════════════════════════════════════════════════════
//  PROOF MODAL — v0.16
//  Features: checklist · dare-specific rules · frame picker ·
//             cancel upload · background upload · speed indicator
// ════════════════════════════════════════════════════════════════════

// Fixed checklist items every taker must confirm before submitting
const PROOF_CHECKLIST_ITEMS = [
  'My video clearly shows me completing the mission',
  'My face is visible throughout the video',
  'The recording is unedited and continuous',
  'Video is at least 30 seconds long'
];

// ── Open proof modal ─────────────────────────────────────────────────────────
function openProof(dareId) {
  const d = dares.find(x => x.id === dareId);
  if (!d) { showToast('Mission not found'); return; }

  // v0.19: creator_picks mode — check if user is approved
  if (d.takerSelectionMode === 'creator_picks') {
    const approved = d.approvedTakers || [];
    if (!approved.includes(user.uid)) {
      showToast('Creator has not selected you yet. Wait for approval!');
      return;
    }
  }

  proofDareId = dareId;
  selectedVideo = null;
  selectedVideoDuration = 0;
  selectedVideoW = 0; selectedVideoH = 0;
  proofCapturedFrameBlob = null;

  // Dare info
  document.getElementById('proofDareTitle').textContent  = d.caption  || d.title;
  document.getElementById('proofDareBounty').textContent =
    'Rs. ' + ((d.rewardAmount ?? d.bounty) || 0).toLocaleString('en-IN');

  // Show dare-specific rules if creator added them; else generic requirements
  const creatorRules = (d.rules || []).filter(r => r.trim());
  const heading      = document.getElementById('proofRulesHeading');
  const rulesList    = document.getElementById('proofRulesList');
  if (creatorRules.length) {
    heading.textContent = 'Creator Rules';
    rulesList.innerHTML = creatorRules
      .map(r => `<div class="proof-rule">• ${escHtml(r)}</div>`).join('');
  } else {
    heading.textContent = 'Proof Requirements';
    rulesList.innerHTML = [
      'Video must clearly show you completing the mission',
      'Your face must be visible throughout',
      'No cuts or edits — single continuous recording',
      'Minimum 30 seconds, maximum 10 minutes'
    ].map(r => `<div class="proof-rule">• ${r}</div>`).join('');
  }

  // Render interactive checklist
  _renderProofChecklist();

  // Reset video section
  const vp = document.getElementById('videoPreview');
  vp.pause(); if (vp.src) { URL.revokeObjectURL(vp.src); vp.src = ''; }
  const fp = document.getElementById('proofFPVideo');
  if (fp.src) { URL.revokeObjectURL(fp.src); fp.src = ''; }

  document.getElementById('proofVideoWrap').style.display     = 'none';
  document.getElementById('fileInfo').style.display           = 'none';
  document.getElementById('durationWarn').style.display       = 'none';
  document.getElementById('videoDZ').classList.remove('has-file');
  document.getElementById('vdzIcon').textContent              = 'video_call';
  document.getElementById('vdzTitle').textContent             = 'Click to select video';
  document.getElementById('vdzSub').textContent               = 'MP4, MOV, AVI — Max 500MB';
  document.getElementById('videoFileInput').value             = '';
  document.getElementById('proofNote').value                  = '';
  document.getElementById('noteCharCount').textContent        = '0 / 200';
  document.getElementById('proofFrameCaptured').style.display = 'none';
  document.getElementById('uploadWrap').style.display         = 'none';
  document.getElementById('uploadBar').style.width            = '0%';
  document.getElementById('uploadPct').textContent            = '0%';
  document.getElementById('uploadSpeedText').textContent      = '';

  const btn = document.getElementById('btnSubmitProof');
  btn.disabled = true;
  btn.innerHTML = '<span class="mi">upload</span>Submit Proof';

  _ovOpen('proofOverlay');
}

// ── Close proof modal — keeps active upload running in background ─────────────
function closeProof() {
  _ovSync('proofOverlay');
  document.getElementById('proofOverlay').classList.remove('open');
  // If upload is in progress, let it continue in background
  if (activeUploadTask) {
    _showBgUploadIndicator();
  }
}

// ── Interactive checklist helpers ─────────────────────────────────────────────
function _renderProofChecklist() {
  proofCheckState = PROOF_CHECKLIST_ITEMS.map(() => false);
  document.getElementById('proofChecklist').innerHTML =
    PROOF_CHECKLIST_ITEMS.map((item, i) => `
      <div class="proof-check-item" id="pci-${i}" onclick="toggleProofCheck(${i})">
        <span class="mi proof-check-icon" id="pcicon-${i}">check_box_outline_blank</span>
        <span class="proof-check-text">${item}</span>
      </div>`).join('');
}

function toggleProofCheck(i) {
  proofCheckState[i] = !proofCheckState[i];
  const icon = document.getElementById('pcicon-' + i);
  const row  = document.getElementById('pci-'   + i);
  if (proofCheckState[i]) {
    icon.textContent = 'check_box';
    icon.style.color = '#30D158';
    row.classList.add('checked');
  } else {
    icon.textContent = 'check_box_outline_blank';
    icon.style.color = 'var(--t4)';
    row.classList.remove('checked');
  }
  _updateProofSubmitBtn();
}

// Submit button enables only when: all checklist ticked + video selected
function _updateProofSubmitBtn() {
  const allTicked = proofCheckState.length > 0 && proofCheckState.every(Boolean);
  const hasVideo  = !!selectedVideo;
  document.getElementById('btnSubmitProof').disabled = !(allTicked && hasVideo);
}

// ── Video selected handler ────────────────────────────────────────────────────
// Keeps AdManager + Shorts logic intact while adding v0.16 features
function onVideoSelected(e) {
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('video/')) { showToast('Please select a valid video file'); return; }
  if (file.size > 500 * 1024 * 1024)  { showToast('File too large — maximum 500MB allowed'); return; }
  selectedVideo = file;
  selectedVideoDuration = 0;
  selectedVideoW = 0; selectedVideoH = 0;

  // Show video preview
  const vp = document.getElementById('videoPreview');
  if (vp.src) URL.revokeObjectURL(vp.src);
  vp.src = URL.createObjectURL(file);

  // Load same src into frame picker
  const fp = document.getElementById('proofFPVideo');
  if (fp.src) URL.revokeObjectURL(fp.src);
  fp.src = URL.createObjectURL(file);
  fp.addEventListener('loadedmetadata', () => {
    document.getElementById('proofFPScrubber').max = Math.floor(fp.duration * 10);
  }, { once: true });

  document.getElementById('proofVideoWrap').style.display = 'block';

  // Duration validation + AdManager Shorts detection
  vp.onloadedmetadata = () => {
    selectedVideoDuration = Math.round(vp.duration);
    selectedVideoW = vp.videoWidth || 0;
    selectedVideoH = vp.videoHeight || 0;
    const warn = document.getElementById('durationWarn');
    warn.style.display = 'block';
    if (selectedVideoDuration < 30) {
      warn.className   = 'dur-warn dur-warn--error';
      warn.innerHTML   = `<span class="mi">warning</span> Too short (${selectedVideoDuration}s) — minimum 30 seconds required`;
    } else if (selectedVideoDuration > 600) {
      warn.className   = 'dur-warn dur-warn--warn';
      warn.innerHTML   = `<span class="mi">info</span> Too long (${Math.floor(selectedVideoDuration/60)}m ${selectedVideoDuration%60}s) — maximum 10 minutes`;
    } else {
      warn.className   = 'dur-warn dur-warn--ok';
      warn.innerHTML   = `<span class="mi">check_circle</span> Duration looks good (${selectedVideoDuration}s)`;
      if (selectedVideoDuration < 60) {
        showToast(`Short video detected (${selectedVideoDuration}s) — will appear in Mission Shorts!`);
      }
    }
  };

  // File info bar
  document.getElementById('fileInfo').style.display = 'flex';
  document.getElementById('fileName').textContent   =
    file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + 'MB)';

  // Update dropzone style
  document.getElementById('videoDZ').classList.add('has-file');
  document.getElementById('vdzIcon').textContent  = 'check_circle';
  document.getElementById('vdzTitle').textContent = 'Video selected';
  document.getElementById('vdzSub').textContent   = 'Click to change';

  _updateProofSubmitBtn();
}

// ── Frame picker — YouTube pencil style ──────────────────────────────────────
function scrubProofFrame(val) {
  const vid = document.getElementById('proofFPVideo');
  if (vid.duration) vid.currentTime = (val / 1000) * vid.duration;
}

function captureProofFrame() {
  const vid    = document.getElementById('proofFPVideo');
  const canvas = document.getElementById('proofFPCanvas');
  canvas.width  = vid.videoWidth  || 320;
  canvas.height = vid.videoHeight || 180;
  canvas.getContext('2d').drawImage(vid, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(blob => {
    if (!blob) { showToast('Could not capture frame — try again'); return; }
    // Send the captured frame into the adjuster so the taker can crop/zoom it
    const ratio = (selectedVideoH > 0 && selectedVideoW > 0 && selectedVideoH > selectedVideoW) ? '9:16' : '16:9';
    const file  = new File([blob], 'captured_frame.jpg', { type:'image/jpeg' });
    _taBindDrag();
    openThumbAdjust(file, 'proof', ratio);
  }, 'image/jpeg', 0.88);
}

function removeProofThumb() {
  proofCapturedFrameBlob = null;
  const img = document.getElementById('proofThumbPreview');
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = '';
  document.getElementById('proofFrameCaptured').style.display = 'none';
}

// ── Cancel active upload ──────────────────────────────────────────────────────
function cancelUpload() {
  if (activeUploadTask) {
    // Works for both Firebase task (.cancel()) and Cloudinary XHR (.cancel())
    if (typeof activeUploadTask.cancel === 'function') activeUploadTask.cancel();
    activeUploadTask = null;
  }
  document.getElementById('uploadWrap').style.display     = 'none';
  document.getElementById('uploadBar').style.width        = '0%';
  document.getElementById('uploadPct').textContent        = '0%';
  document.getElementById('uploadSpeedText').textContent  = '';
  const btn = document.getElementById('btnSubmitProof');
  btn.disabled = false;
  btn.innerHTML = '<span class="mi">upload</span>Submit Proof';
  _hideBgUploadIndicator();
  showToast('Upload cancelled');
}

// ── Floating background upload indicator ─────────────────────────────────────
function _showBgUploadIndicator() {
  let ind = document.getElementById('bgUploadInd');
  if (!ind) {
    ind = document.createElement('div');
    ind.id = 'bgUploadInd';
    ind.className = 'bg-upload-ind';
    ind.innerHTML = `
      <span class="mi" style="font-size:18px;color:var(--blue2);">upload</span>
      <div style="flex:1;">
        <div style="font-size:12px;font-weight:600;color:var(--t1);">Uploading proof...</div>
        <div style="font-size:11px;color:var(--t3);" id="bgUploadIndPct">0%</div>
      </div>
      <button onclick="_ovOpen('proofOverlay')"
        style="background:rgba(255,255,255,.1);border:none;cursor:pointer;
               color:var(--t2);font-size:12px;padding:4px 10px;border-radius:6px;
               font-family:inherit;">View</button>`;
    document.body.appendChild(ind);
  }
  ind.style.display = 'flex';
}
function _hideBgUploadIndicator() {
  const ind = document.getElementById('bgUploadInd');
  if (ind) ind.style.display = 'none';
}

// ════════════════════════════════════════════════════════════════════
//  SUBMIT PROOF — v0.16
//  Fixes: contentType metadata (0% stuck bug) · cancel support ·
//         thumbnail upload · background mode · English strings
// ════════════════════════════════════════════════════════════════════
async function submitProof() {
  if (!selectedVideo || !proofDareId) return;

  // Hard block: duration out of range
  if (selectedVideoDuration > 0 && selectedVideoDuration < 30) {
    showToast('Video is too short — minimum 30 seconds required'); return;
  }
  if (selectedVideoDuration > 600) {
    showToast('Video is too long — maximum 10 minutes allowed'); return;
  }

  const d = dares.find(x => x.id === proofDareId);
  if (!d) return;

  const btn = document.getElementById('btnSubmitProof');
  btn.disabled = true;
  btn.innerHTML = '<span class="mi">hourglass_empty</span>Preparing...';
  document.getElementById('uploadWrap').style.display = 'block';
  uploadStartTime = Date.now();

  try {
    const note = document.getElementById('proofNote').value.trim();

    // ── STEP 1: Upload proof thumbnail → Cloudinary ──────────────────────────
    let proofThumbnailURL = '';
    if (proofCapturedFrameBlob) {
      document.getElementById('uploadStatusText').textContent = 'Uploading thumbnail...';
      const tUpload = uploadToCloudinary(
        new File([proofCapturedFrameBlob], 'proof_thumb.jpg', { type: 'image/jpeg' }),
        'image', null
      );
      proofThumbnailURL = await tUpload.promise;
    }

    // ── STEP 2: Upload proof video → Cloudinary ───────────────────────────────
    document.getElementById('uploadStatusText').textContent = 'Uploading video...';
    const vUpload = uploadToCloudinary(selectedVideo, 'video', (pct, e) => {
      document.getElementById('uploadPct').textContent  = pct + '%';
      document.getElementById('uploadBar').style.width = pct + '%';
      btn.innerHTML = `<span class="mi">upload</span>Uploading ${pct}%`;
      const bgPct = document.getElementById('bgUploadIndPct');
      if (bgPct) bgPct.textContent = pct + '%';
      // Speed + ETA
      const elapsedSec = (Date.now() - uploadStartTime) / 1000;
      if (elapsedSec > 1 && e.loaded > 0) {
        const speedMBs = (e.loaded / 1024 / 1024 / elapsedSec).toFixed(1);
        const leftMB   = (e.total - e.loaded) / 1024 / 1024;
        const etaSec   = speedMBs > 0 ? Math.round(leftMB / speedMBs) : '?';
        document.getElementById('uploadSpeedText').textContent =
          `${speedMBs} MB/s · ~${etaSec}s remaining`;
      }
    });
    // Store cancel reference (activeUploadTask.cancel() still works)
    activeUploadTask = vUpload;
    const videoURL = await vUpload.promise;
    activeUploadTask = null;
    _hideBgUploadIndicator();

    btn.innerHTML = '<span class="mi">hourglass_empty</span>Saving...';

    // ── STEP 3: Write proof document to Firestore ─────────────────────────────
    await db.collection('proofs').add({
      dareId: proofDareId,
      dareTitle:        d.caption  || d.title,
      dareBounty:       d.rewardAmount ?? d.bounty ?? 0,
      posterId:         d.creatorUid,
      posterEmail:      d.creatorEmail,
      takerId:          user.uid,
      takerName:        user.name,
      takerUsername:    user.username || (user.name||'user').toLowerCase().replace(/[^a-z0-9_.]/g,''),
      takerEmail:       user.email,
      takerPhotoURL:    user.picture || '',
      posterName:       d.creator || '',
      posterUsername:   d.creatorUsername || '',
      posterPhotoURL:   d.creatorPhotoURL || '',
      cat:              d.tags?.[0] || d.cat || 'general',
      videoURL,
      proofThumbnailURL,          // thumbnail from frame picker (may be empty)
      videoFilename:    selectedVideo.name,
      videoSize:        (selectedVideo.size / 1024 / 1024).toFixed(1) + 'MB',
      videoDuration:    selectedVideoDuration, // seconds (Shorts + AdManager)
      videoW:           selectedVideoW,
      videoH:           selectedVideoH,
      isVertical:       (selectedVideoH > 0 && selectedVideoW > 0) ? (selectedVideoH > selectedVideoW) : false,
      note,
      status:           'submitted',
      submittedAt:      todayStr(),
      createdAtMs:      Date.now(),
      rejectionReason:  ''
    });

    // ── STEP 4: Increment dare proof count ────────────────────────────────────
    await db.collection('dares').doc(proofDareId).update({
      proofCount: firebase.firestore.FieldValue.increment(1)
    });

    // ── STEP 5: Update taker's acceptedDares record ───────────────────────────
    const entry = acceptedDares.find(a => a.dareId === proofDareId);
    if (entry) {
      entry.proofStatus   = 'submitted';
      entry.proofFilename = selectedVideo.name;
      entry.proofDate     = todayStr();
      entry.proofNote     = note;
    }
    await db.collection('users').doc(user.uid).update({ acceptedDares });

    btn.innerHTML = '<span class="mi">check_circle</span>Submitted!';
    showToast('Proof submitted! The creator will review it.');
    setTimeout(() => {
      document.getElementById('proofOverlay').classList.remove('open');
    }, 1400);

  } catch(e) {
    activeUploadTask = null;
    _hideBgUploadIndicator();
    btn.disabled  = false;
    btn.innerHTML = '<span class="mi">upload</span>Submit Proof';
    document.getElementById('uploadWrap').style.display = 'none';
    if (e.message === 'CANCELLED') {
      showToast('Upload cancelled');
    } else {
      // Show actionable error — helps diagnose Storage Rules / CORS issues
      const friendly = e.message === 'CANCELLED' ? 'Upload cancelled' :
        e.message.includes('Network error') ? 'Upload failed — check your internet connection' :
        e.message.includes('Invalid') ? 'Upload response error — try again' :
        'Upload error: ' + e.message;
      showToast(friendly);
      console.error('submitProof error:', e.code, e.message);
    }
  }
}

// ════════════════════════════
//  PROOF REVIEW SYSTEM
// ════════════════════════════
let reviewDareId   = null;
let rejectProofId  = null;
let currentProofs  = [];

async function openReviewModal(dareId) {
  reviewDareId = dareId;
  const d = dares.find(x => x.id === dareId);
  if (!d) return;

  document.getElementById('rvDareTitle').textContent  = d.caption || d.title;
  document.getElementById('rvDareBounty').textContent = 'Rs. ' + ((d.rewardAmount ?? d.bounty) || 0).toLocaleString('en-IN');
  document.getElementById('rvDareMeta').textContent   = `${d.takers||0} takers • ${d.proofCount||0} proofs submitted`;
  document.getElementById('rvProofsList').innerHTML   =
    `<div class="review-empty"><span class="mi">hourglass_empty</span><p>Loading proofs...</p></div>`;

  _ovOpen('reviewOverlay');

  try {
    const snap = await db.collection('proofs').where('dareId','==', dareId).get();
    currentProofs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderProofsList();
  } catch(e) {
    document.getElementById('rvProofsList').innerHTML =
      `<div class="review-empty"><span class="mi">error_outline</span><p>Error loading proofs: ${e.message}</p></div>`;
  }
}

function renderProofsList() {
  const container = document.getElementById('rvProofsList');
  const pending   = currentProofs.filter(p => p.status === 'submitted');
  const reviewed  = currentProofs.filter(p => p.status !== 'submitted');

  if (!currentProofs.length) {
    container.innerHTML = `<div class="review-empty"><span class="mi">inbox</span><p>No proofs submitted yet.</p></div>`;
    return;
  }

  let html = '';
  if (pending.length) {
    html += `<div style="font-size:11px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;">
      Pending Review (${pending.length})</div>`;
    html += pending.map(p => proofItemHTML(p)).join('');
  }
  if (reviewed.length) {
    html += `<div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.6px;margin:16px 0 10px;">
      Already Reviewed (${reviewed.length})</div>`;
    html += reviewed.map(p => proofItemHTML(p)).join('');
  }
  container.innerHTML = html;
}

function proofItemHTML(p) {
  const videoSection = p.videoURL
    ? `<video src="${_optVid(p.videoURL, _vidMaxW())}" controls playsinline
        style="width:100%;border-radius:14px;margin-bottom:12px;max-height:260px;background:#000;display:block;">
       </video>`
    : `<div class="proof-file-row"><span class="mi">video_file</span>${p.videoFilename||'—'}<span style="margin-left:auto;font-size:11px;color:var(--t3);">${p.videoSize||''}</span></div>`;

  const isPending  = p.status === 'submitted';
  const isApproved = p.status === 'approved';
  const isRejected = p.status === 'rejected';

  const statusBadge = isApproved
    ? `<span class="status-badge status-approved">Approved</span>`
    : isRejected
    ? `<span class="status-badge" style="background:rgba(255,69,58,.15);color:var(--red);border:1px solid rgba(255,69,58,.25);">Rejected</span>`
    : `<span class="status-badge status-submitted">Pending</span>`;

  const actions = isPending ? `
    <div class="proof-actions">
      <button class="btn-reject" onclick="openRejectModal('${p.id}')">
        <span class="mi">thumb_down</span>Reject
      </button>
      <button class="btn-approve" onclick="approveProof('${p.id}')">
        <span class="mi">thumb_up</span>Approve & Release Rs.${(p.dareBounty||0).toLocaleString('en-IN')}
      </button>
    </div>` : isRejected && p.rejectionReason ? `
    <div style="font-size:12px;color:var(--red);margin-top:8px;padding:8px 12px;background:rgba(255,69,58,.08);border-radius:8px;">
      <strong>Reason:</strong> ${p.rejectionReason}
    </div>` : '';

  return `
  <div class="proof-item ${isApproved?'approved':isRejected?'rejected':''}">
    <div class="proof-item-header">
      <div class="taker-info">
        <div class="taker-av">${_avHtml(p.takerPhotoURL, p.takerName)}</div>
        <div>
          <div class="taker-name">${p.takerName||'Unknown'}</div>
          <div class="taker-date">${_relTimeStr(p.submittedAt)} · ${p.takerEmail||''}</div>
        </div>
      </div>
      ${statusBadge}
    </div>
    ${videoSection}
    ${p.note ? `<div class="proof-note-box">"${p.note}"</div>` : ''}
    ${actions}
  </div>`;
}

async function approveProof(proofId) {
  const proof = currentProofs.find(p => p.id === proofId);
  if (!proof) return;
  if (!confirm(`Approve and transfer Rs.${(proof.dareBounty||0).toLocaleString('en-IN')} to ${proof.takerName}?`)) return;

  try {
    await db.collection('proofs').doc(proofId).update({ status: 'approved' });

    const takerRef  = db.collection('users').doc(proof.takerId);
    const takerSnap = await takerRef.get();
    if (takerSnap.exists) {
      const takerData = takerSnap.data();
      const tw = takerData.wallet || { balance:0, pending:0, transactions:[] };
      const _bw = proof.dareBounty || 0;
      tw.pending = (tw.pending||0) + _bw;   // won bounty lands in "pending earnings" until claimed
      tw.transactions = tw.transactions || [];
      tw.transactions.unshift({
        id:'w'+Date.now()+Math.floor(Math.random()*1000), ts:Date.now(), status:'completed',
        type:'credit', category:'bounty_won',
        title:'Bounty Won: ' + (proof.dareTitle||'').substring(0,30),
        amount: _bw, ref:'REF'+Date.now().toString(36).toUpperCase(), date: todayStr()
      });
      const tAD = (takerData.acceptedDares||[]).map(a =>
        a.dareId === proof.dareId ? {...a, proofStatus:'approved'} : a
      );
      await takerRef.update({ wallet: tw, acceptedDares: tAD });
    }

    await db.collection('dares').doc(proof.dareId).update({ completed: true });

    currentProofs = currentProofs.map(p => p.id === proofId ? {...p, status:'approved'} : p);
    renderProofsList();
    showToast(`Rs.${(proof.dareBounty||0).toLocaleString('en-IN')} ${proof.takerName} sent successfully!`);
  } catch(e) {
    showToast('Error: ' + e.message);
  }
}

function openRejectModal(proofId) {
  rejectProofId = proofId;
  document.getElementById('rejectReason').value = '';
  _ovOpen('rejectOverlay');
}
function closeRejectModal() {
  _ovSync('rejectOverlay');
  document.getElementById('rejectOverlay').classList.remove('open');
  rejectProofId = null;
}

async function confirmReject() {
  if (!rejectProofId) return;
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) { showToast('Please provide a rejection reason'); return; }
  const proof  = currentProofs.find(p => p.id === rejectProofId);
  if (!proof) return;

  try {
    await db.collection('proofs').doc(rejectProofId).update({ status: 'rejected', rejectionReason: reason });

    const takerRef  = db.collection('users').doc(proof.takerId);
    const takerSnap = await takerRef.get();
    if (takerSnap.exists) {
      const tAD = (takerSnap.data().acceptedDares||[]).map(a =>
        a.dareId === proof.dareId ? {...a, proofStatus:'pending', proofFilename:''} : a
      );
      await takerRef.update({ acceptedDares: tAD });
    }

    await db.collection('dares').doc(proof.dareId).update({
      proofCount: firebase.firestore.FieldValue.increment(-1)
    });

    currentProofs = currentProofs.map(p =>
      p.id === rejectProofId ? {...p, status:'rejected', rejectionReason: reason} : p
    );
    closeRejectModal();
    renderProofsList();
    showToast('Proof rejected. The taker will be notified to resubmit.');
  } catch(e) {
    showToast('Error: ' + e.message);
  }
}

function closeReview() {
  _ovSync('reviewOverlay');
  document.getElementById('reviewOverlay').classList.remove('open');
  reviewDareId = null; currentProofs = [];
}

// ════════════════════════════
//  LEADERBOARD
// ════════════════════════════
async function loadLeaderboard() {
  const el = document.getElementById('lbContent');
  if (el) el.innerHTML = _skelRows(6);
  try {
    const snap = await db.collection('proofs').where('status','==','approved').get();
    const map  = {};
    snap.docs.forEach(doc => {
      const p = doc.data();
      if (!map[p.takerId]) map[p.takerId] = { name: p.takerName, earned: 0, count: 0 };
      map[p.takerId].earned += p.dareBounty || 0;
      map[p.takerId].count++;
    });
    const sorted = Object.values(map).sort((a,b) => b.earned - a.earned).slice(0,20);
    if (!sorted.length) {
      el.innerHTML = `<div class="empty"><span class="mi">emoji_events</span>
        <div class="empty-title">Leaderboard Empty</div>
        <p class="empty-desc">Complete a mission to appear on the leaderboard!</p></div>`;
      return;
    }
    const medals = ['🥇','🥈','🥉'];
    el.innerHTML = sorted.map((p,i) => `
      <div class="dare-mini" style="margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:14px;flex:1;">
          <div style="font-size:${i<3?'24px':'16px'};min-width:32px;text-align:center;font-weight:700;color:var(--t3);">
            ${i < 3 ? medals[i] : '#'+(i+1)}</div>
          <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--blue),#FF6535);display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;font-weight:700;flex-shrink:0;">
            ${p.name[0].toUpperCase()}</div>
          <div>
            <div style="font-size:14px;font-weight:600;">${p.name}</div>
            <div style="font-size:12px;color:var(--t3);">${p.count} mission${p.count>1?'s':''} completed</div>
          </div>
        </div>
        <div style="font-size:20px;font-weight:700;color:var(--green);">Rs.${p.earned.toLocaleString('en-IN')}</div>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty"><span class="mi">error_outline</span><div class="empty-title">Error</div><p class="empty-desc">${e.message}</p></div>`;
  }
}

// ════════════════════════════
//  SHARE DARE
// ════════════════════════════
function shareDare(dareId, title) {
  const url = window.location.href.split('?')[0] + '?dare=' + dareId;
  if (navigator.share) {
    navigator.share({ title:'Mission Market', text:`"${title}" — bounty up for grabs!`, url });
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('Link copied to clipboard!'));
  }
}

// ════════════════════════════
//  PROFILE
// ════════════════════════════
function renderProfile() {
  if (!user) return;
  const pic = document.getElementById('profPic');
  if (user.picture) { pic.innerHTML = `<img src="${user.picture}" alt="av"/>`; }
  else { pic.textContent = user.name[0].toUpperCase(); }

  document.getElementById('profName').textContent     = user.name;
  document.getElementById('profHandle').textContent   = '@' + (user.username || '—');
  _ppUid = null;   // own-profile context for follow lists
  _profileFollowCounts(user.uid).then(({followers,following})=>{
    const a=document.getElementById('profFollowers'); if(a)a.textContent=_fmtCount(followers);
    const b=document.getElementById('profFollowing'); if(b)b.textContent=_fmtCount(following);
  });

  const bioEl = document.getElementById('profBio');
  if (user.bio && user.bio.trim()) {
    const words = user.bio.trim().split(/\s+/);
    if (words.length > 7) {
      const shortText = words.slice(0, 7).join(' ');
      const fullText  = user.bio;
      bioEl.innerHTML = '';
      const span = document.createElement('span');
      span.textContent = shortText + ' ';
      const btn = document.createElement('button');
      btn.textContent = '...more';
      btn.style.cssText =
        'background:none;border:none;color:var(--blue);cursor:pointer;' +
        'font-size:inherit;padding:0;font-family:inherit;font-weight:600;';
      const renderShort = () => {
        bioEl.innerHTML = '';
        const s = document.createElement('span'); s.textContent = shortText + ' ';
        const more = document.createElement('button'); more.textContent = '...more';
        more.style.cssText = 'background:none;border:none;color:var(--blue);cursor:pointer;font-size:inherit;padding:0;font-family:inherit;font-weight:600;';
        more.onclick = renderFull;
        bioEl.appendChild(s); bioEl.appendChild(more);
      };
      const renderFull = () => {
        bioEl.innerHTML = '';
        const s = document.createElement('span'); s.textContent = fullText + ' ';
        const less = document.createElement('button'); less.textContent = 'show less';
        less.style.cssText = 'background:none;border:none;color:var(--blue);cursor:pointer;font-size:inherit;padding:0;font-family:inherit;font-weight:600;';
        less.onclick = renderShort;
        bioEl.appendChild(s); bioEl.appendChild(less);
      };
      renderShort();
      span.remove(); btn.remove();
    } else {
      bioEl.textContent = user.bio;
    }
    bioEl.style.display = 'block';
  } else {
    bioEl.style.display = 'none';
  }

  const myPosted  = dares.filter(d => d.creatorUid === user.uid);
  const submitted = acceptedDares.filter(a => a.proofStatus === 'submitted' || a.proofStatus === 'approved');


  document.getElementById('walletBal').textContent  = 'Rs. ' + wallet.balance.toLocaleString('en-IN');

  // Tabs: Completed (your won videos) · My Dares · Accepted — all card-style + sub-filters
  _renderProfileSocials(user, 'profSocials');
  _renderProfileSocials(user, 'profSocialsBar');   // mobile: socials shown in the glassy topbar
  _renderProfileVideos();
  _renderMyDares();
  _renderAcceptedDares();

  // On a direct /profile refresh the home feed hasn't run, so the proofs pool can be
  // empty → "No Videos Yet". Fetch proofs once, then re-render the Completed tab.
  if (!((typeof allProofs!=='undefined' && allProofs.length) || (typeof homeProofs!=='undefined' && homeProofs.length))) {
    const tv = document.getElementById('tVideos'); if (tv) tv.innerHTML = _skelCards(3);
    _ensureProofsLoaded().then(() => { _renderProfileVideos(); });
  }
}
let _proofsLoading = false;
async function _ensureProofsLoaded(){
  if (_proofsLoading) return;
  if ((typeof allProofs!=='undefined' && allProofs.length) || (typeof homeProofs!=='undefined' && homeProofs.length)) return;
  _proofsLoading = true;
  try {
    const snap = await db.collection('proofs').where('status','==','approved').get();
    homeProofs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    allProofs = homeProofs;
  } catch(e){}
  _proofsLoading = false;
}

// ── Profile dare card (your posted dares) — thumbnail + 3-dot actions (top-left) ──
function _profileDareCard(d){
  const cat=d.tags?.[0]||d.cat||'fitness';
  const title=d.caption||d.title||'Untitled Mission';
  const reward=d.rewardAmount ?? d.bounty ?? 0;
  const thumb=d.thumbnailURL||'';
  const color=CAT_C[cat]||'#FF2D4A', icon=CAT_I[cat]||'bolt';
  const inner=thumb?`<img src="${thumb}" loading="lazy" decoding="async"/>`:`<div class="adc-thumb-bg" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};">${icon}</span></div>`;
  const isPinned=(typeof pinnedDares!=='undefined'&&pinnedDares.includes(d.id));
  const proofs=d.proofCount||0;
  const cAv=_avHtml(d.creatorPhotoURL||(user&&user.picture),d.creator||user?.name);
  const statusPill=d.completed?'<span class="pdc-status done">Completed</span>':'<span class="pdc-status live">Active</span>';
  const menu=`<div class="adc-menu pdc-menu">
    <button onclick="event.stopPropagation();_closeAdcMenus();openReviewModal('${d.id}')"><span class="mi">rate_review</span> Proofs${proofs?` (${proofs})`:''}</button>
    ${!d.completed?`<button onclick="event.stopPropagation();_closeAdcMenus();openEditDare('${d.id}')"><span class="mi">edit</span> Edit</button>`:''}
    <button onclick="event.stopPropagation();_closeAdcMenus();${isPinned?`unpinDare('${d.id}')`:`pinDare('${d.id}')`}"><span class="mi">push_pin</span> ${isPinned?'Unpin':'Pin'}</button>
    ${!d.completed?`<button onclick="event.stopPropagation();_closeAdcMenus();deleteDare('${d.id}')"><span class="mi">delete</span> Delete</button>`:''}</div>`;
  return `<div class="active-dare-card" onclick="openDareDetail('${d.id}')">
    <div class="adc-menu-wrap pdc-menu-wrap"><button class="adc-dots pdc-dots" onclick="event.stopPropagation();_toggleAdcMenu(this)"><span class="mi">more_vert</span></button>${menu}</div>
    <div class="adc-thumb">${inner}
      <span class="adc-bounty">$${reward.toLocaleString('en-IN')}</span>
      ${statusPill}${proofs?`<span class="pdc-proofs"><span class="mi">video_call</span>${proofs}</span>`:''}
    </div>
    <div class="yt-info">
      <div class="yt-av">${cAv}</div>
      <div class="yt-meta"><div class="yt-title">${escHtml(title)}</div>
        <div class="yt-sub"><span>${d.takers||0} ${d.takerSelectionMode==='creator_picks'?'applicants':'takers'}</span><span class="yt-dot"></span><span>${proofs} proofs</span><span class="yt-dot"></span><span>${_relTimeStr(d.date)}</span></div></div>
    </div>
  </div>`;
}
// ── Profile accepted card — thumbnail + status + submit-proof ──
function _profileAcceptedCard(a){
  const d=(dares||[]).find(x=>x.id===a.dareId)||{};
  const title=a.dareTitle||d.caption||'Mission';
  const reward=a.bounty ?? d.rewardAmount ?? d.bounty ?? 0;
  const thumb=d.thumbnailURL||a.thumbnailURL||'';
  const cat=d.tags?.[0]||d.cat||a.cat||'fitness'; const color=CAT_C[cat]||'#FF2D4A', icon=CAT_I[cat]||'bolt';
  const inner=thumb?`<img src="${thumb}" loading="lazy" decoding="async"/>`:`<div class="adc-thumb-bg" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};">${icon}</span></div>`;
  let badge, action='';
  if(a.applicantStatus==='pending'){ badge='<span class="pdc-status applied">Applied</span>'; }
  else if(a.proofStatus==='approved'){ badge='<span class="pdc-status done">Approved · Live</span>'; }
  else if(a.proofStatus==='submitted'){ badge='<span class="pdc-status review">Under Review</span>'; }
  else { badge='<span class="pdc-status live">To Submit</span>'; action=`<button class="pdc-submit" onclick="event.stopPropagation();openProof('${a.dareId}')"><span class="mi">video_call</span>Submit Proof</button>`; }
  return `<div class="active-dare-card" onclick="openDareDetail('${a.dareId}')">
    <div class="adc-thumb">${inner}<span class="adc-bounty">$${reward.toLocaleString('en-IN')}</span>${badge}</div>
    <div class="yt-info">
      <div class="yt-av">${_avHtml(d.creatorPhotoURL,d.creator||'—')}</div>
      <div class="yt-meta"><div class="yt-title">${escHtml(title)}</div>
        <div class="yt-sub"><span>${escHtml(d.creator||'—')}</span><span class="yt-dot"></span><span>${a.date||''}</span></div></div>
    </div>
    ${action?`<div class="pdc-action">${action}</div>`:''}
  </div>`;
}
let _pMyFilter='all', _pAccFilter='all';
function _setMyFilter(k){ _pMyFilter=k; _renderMyDares(); }
function _setAccFilter(k){ _pAccFilter=k; _renderAcceptedDares(); }
function _renderMyDares(){
  const el=document.getElementById('tMyDares'); if(!el||!user) return;
  if(!_daresLoaded){ el.innerHTML=_skelCards(2); return; }   // dares still loading (slow network)
  let list=(dares||[]).filter(d=>d.creatorUid===user.uid);
  list.sort((a,b)=>{ const ap=pinnedDares.includes(a.id)?1:0,bp=pinnedDares.includes(b.id)?1:0; if(bp!==ap)return bp-ap;
    return (b.createdAt?.toDate?.()?.getTime()||0)-(a.createdAt?.toDate?.()?.getTime()||0); });
  if(_pMyFilter==='live') list=list.filter(d=>!d.completed);
  else if(_pMyFilter==='completed') list=list.filter(d=>d.completed);
  const chips=[['all','All'],['live','Live'],['completed','Completed']]
    .map(([k,l])=>`<button class="pfilter ${_pMyFilter===k?'active':''}" onclick="_setMyFilter('${k}')">${l}</button>`).join('');
  const head=`<div class="pfilter-row">${chips}</div>`;
  el.innerHTML = head + (list.length
    ? `<div class="active-dare-grid">${list.map(_profileDareCard).join('')}</div>`
    : `<div class="empty" style="padding:32px;"><span class="mi">assignment</span><div class="empty-title" style="font-size:18px;">No missions here</div><p class="empty-desc" style="margin-bottom:16px;">Post your first mission!</p><button class="btn-empty" onclick="openPost()"><span class="mi">add_circle</span>Post a Mission</button></div>`);
}
function _renderAcceptedDares(){
  const el=document.getElementById('tAccepted'); if(!el) return;
  const stOf=a=> a.applicantStatus==='pending'?'applied' : a.proofStatus==='approved'?'approved' : a.proofStatus==='submitted'?'review' : 'tosubmit';
  const _at=a=> new Date(a.acceptedDate||a.date||0).getTime()||0;
  let list=[...(acceptedDares||[])].sort((a,b)=>_at(b)-_at(a));   // latest first
  if(_pAccFilter!=='all') list=list.filter(a=>stOf(a)===_pAccFilter);
  const chips=[['all','All'],['tosubmit','To Submit'],['review','Under Review'],['approved','Approved']]
    .map(([k,l])=>`<button class="pfilter ${_pAccFilter===k?'active':''}" onclick="_setAccFilter('${k}')">${l}</button>`).join('');
  const head=`<div class="pfilter-row">${chips}</div>`;
  el.innerHTML = head + (list.length
    ? `<div class="active-dare-grid">${list.map(_profileAcceptedCard).join('')}</div>`
    : `<div class="empty" style="padding:32px;"><span class="mi">sports_score</span><div class="empty-title" style="font-size:18px;">Nothing here</div><p class="empty-desc" style="margin-bottom:16px;">Accept a mission from the feed!</p><button class="btn-empty" onclick="goPage('dares')"><span class="mi">arrow_back</span>Browse Missions</button></div>`);
}

// ── Profile: stats row (own profile) ──
function _renderProfileStats(myPosted){
  const el = document.getElementById('profStats'); if (!el) return;
  myPosted = myPosted || (dares||[]).filter(d => d.creatorUid === user.uid);
  const posted    = myPosted.length;
  const completed = myPosted.filter(d => d.completed).length;
  const txns      = (wallet.transactions||[]);
  const earned    = txns.filter(t => _wtxnCat(t)==='bounty_won').reduce((s,t)=>s+(t.amount||0),0);
  const paid      = txns.filter(t => _wtxnCat(t)==='dare_posted').reduce((s,t)=>s+(t.amount||0),0);
  const verified  = (wallet.kyc && wallet.kyc.status==='verified');
  const stat = (val,lbl) => `<div class="pstat"><div class="pstat-v">${val}</div><div class="pstat-l">${lbl}</div></div>`;
  el.innerHTML = `
    ${verified ? `<div class="pstat-verified"><span class="mi">verified</span> Verified</div>` : ''}
    <div class="pstat-grid">
      ${stat(posted, 'Missions')}
      ${stat(completed, 'Completed')}
      ${stat('Rs.'+earned.toLocaleString('en-IN'), 'Earned')}
      ${stat('Rs.'+paid.toLocaleString('en-IN'), 'Paid out')}
      ${stat('<span id="pstatFollowers">…</span>', 'Followers')}
      ${stat('<span id="pstatFollowing">…</span>', 'Following')}
    </div>`;
  // Follower / following counts (async — from the follows collection)
  _profileFollowCounts(user.uid).then(({followers,following})=>{
    const f1=document.getElementById('pstatFollowers'); if(f1) f1.textContent=_fmtCount(followers);
    const f2=document.getElementById('pstatFollowing'); if(f2) f2.textContent=_fmtCount(following);
  });
}
async function _profileFollowCounts(uid){
  try{
    const [fr, fg] = await Promise.all([
      db.collection('follows').where('targetUid','==',uid).get(),
      db.collection('follows').where('followerUid','==',uid).get()
    ]);
    return { followers: fr.size, following: fg.size };
  }catch(e){ return { followers:0, following:0 }; }
}

// ── Profile: Videos tab (your completed-dare proof videos) ──
function _renderProfileVideos(){
  const el = document.getElementById('tVideos'); if (!el) return;
  const pool = (typeof allProofs!=='undefined' && allProofs.length) ? allProofs : homeProofs;
  const _vt = p => p.createdAtMs || (p.createdAt?.toDate?.()?.getTime()) || (p.submittedAt ? new Date(p.submittedAt).getTime() : 0) || 0;
  const mine = (pool||[]).filter(p => p.takerId === user.uid).sort((a,b)=>_vt(b)-_vt(a));  // latest first
  if (!mine.length){
    el.innerHTML = `<div class="empty" style="padding:32px;"><span class="mi">video_library</span>
      <div class="empty-title" style="font-size:18px;">No Videos Yet</div>
      <p class="empty-desc" style="margin-bottom:16px;">Complete a mission and submit video proof — it shows up here.</p>
      <button class="btn-empty" onclick="goPage('dares')"><span class="mi">bolt</span>Browse Missions</button></div>`;
    return;
  }
  const longs  = mine.filter(p => !_isShortVideo(p));
  const shorts = mine.filter(p =>  _isShortVideo(p));
  let html = '';
  if (longs.length)  html += `<div class="feed-longs">${longs.map(_longCardHtml).join('')}</div>`;
  if (shorts.length) html += _shortsRowHtml(shorts);
  el.innerHTML = html;
}

// ════════════════════════════════════════════════════════════════════
//  PUBLIC PROFILE — view any user (videos, dares, follow, share)
// ════════════════════════════════════════════════════════════════════
let _ppUid = null, _ppData = null;
async function openPublicProfile(uid){
  if (!uid) return;
  if (user && uid === user.uid){ closePublicProfile(); goPage('profile'); return; }   // your own → own page
  try{ _pvStop(); }catch(e){}
  if (typeof _pauseBackgroundMedia==='function') _pauseBackgroundMedia();
  _closeCurrentView();                                  // close any video/dare/shorts behind it
  if (!_navBack){ try{ history.pushState({dm:'u',id:uid}, '', '/u/'+encodeURIComponent(uid)); }catch(e){} }
  _ppUid = uid;
  let u = null;
  try{ const doc = await db.collection('users').doc(uid).get(); if (doc.exists) u = doc.data(); }catch(e){}
  _ppData = u || {};
  const name = u?.name || 'User';
  document.getElementById('ppName').textContent   = name;
  document.getElementById('ppHandle').textContent = '@' + (u?.username || 'user');
  const bio = document.getElementById('ppBio');
  if (bio){ bio.textContent = u?.bio || ''; bio.style.display = (u?.bio && u.bio.trim()) ? 'block' : 'none'; }
  const pic = document.getElementById('ppPic');
  if (pic){ pic.innerHTML = u?.picture ? `<img src="${u.picture}" alt="av"/>` : name[0].toUpperCase(); }
  const ban = document.getElementById('ppBanner');
  if (ban){ ban.style.background = u?.banner ? `url(${u.banner}) center/cover` : ''; }
  // reset tabs to Videos
  document.querySelectorAll('#pubProfOverlay .tab').forEach((t,i)=>t.classList.toggle('active', i===0));
  const pv=document.getElementById('ppVideos'), pd=document.getElementById('ppDares');
  if(pv) pv.style.display='block'; if(pd) pd.style.display='none';
  _renderProfileSocials(u||{}, 'ppSocials');
  _ppRenderFollowBtn(); _ppRenderStats(uid); _ppRenderContent(uid);
  const ov = document.getElementById('pubProfOverlay');
  ov.classList.add('open'); ov.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closePublicProfile(){
  const ov=document.getElementById('pubProfOverlay'); if(ov) ov.classList.remove('open');
  document.body.style.overflow=''; _ppUid=null;
}
async function _ppRenderFollowBtn(){
  const btn=document.getElementById('ppFollowBtn'); if(!btn) return;
  if(!user){ btn.style.display='none'; return; }
  btn.style.display='';
  try{ const doc=await db.collection('follows').doc(user.uid+'_'+_ppUid+'_creator').get();
    const f=doc.exists; btn.textContent=f?'Following':'Follow'; btn.classList.toggle('following',f);
  }catch(e){}
}
async function _pubFollowToggle(){
  if(!user||!_ppUid) return;
  await toggleFollow(_ppUid,'creator');
  _ppRenderFollowBtn(); _ppRenderStats(_ppUid);
}
async function _ppRenderStats(uid){
  const el=document.getElementById('ppStats'); if(!el) return;
  const their=(dares||[]).filter(d=>d.creatorUid===uid);
  const posted=their.length, completed=their.filter(d=>d.completed).length;
  const pool=(typeof allProofs!=='undefined'&&allProofs.length)?allProofs:homeProofs;
  const videos=(pool||[]).filter(p=>p.takerId===uid).length;
  const stat=(v,l,cb)=>`<div class="pstat"${cb?` onclick="${cb}" style="cursor:pointer"`:''}><div class="pstat-v">${v}</div><div class="pstat-l">${l}</div></div>`;
  el.innerHTML=`<div class="pstat-grid">
    ${stat(videos,'Videos')}${stat(posted,'Missions')}${stat(completed,'Completed')}
    ${stat('<span id="ppFollowers">…</span>','Followers',`_ppFollowList('followers')`)}
    ${stat('<span id="ppFollowing">…</span>','Following',`_ppFollowList('following')`)}</div>`;
  _profileFollowCounts(uid).then(({followers,following})=>{
    const a=document.getElementById('ppFollowers'); if(a)a.textContent=_fmtCount(followers);
    const b=document.getElementById('ppFollowing'); if(b)b.textContent=_fmtCount(following);
  });
}
function _ppRenderContent(uid){
  const pool=(typeof allProofs!=='undefined'&&allProofs.length)?allProofs:homeProofs;
  const mine=(pool||[]).filter(p=>p.takerId===uid);
  const vel=document.getElementById('ppVideos');
  if(vel){
    if(!mine.length) vel.innerHTML=`<div class="empty" style="padding:32px;"><span class="mi">video_library</span><div class="empty-title" style="font-size:18px;">No videos yet</div></div>`;
    else { const longs=mine.filter(p=>!_isShortVideo(p)),shorts=mine.filter(p=>_isShortVideo(p)); let h='';
      if(longs.length)h+=`<div class="feed-longs">${longs.map(_longCardHtml).join('')}</div>`; if(shorts.length)h+=_shortsRowHtml(shorts); vel.innerHTML=h; }
  }
  const del=document.getElementById('ppDares');
  if(del){ const active=(dares||[]).filter(d=>d.creatorUid===uid&&!d.completed);
    del.innerHTML = active.length?`<div class="active-dare-grid">${active.map(_activeDareCard).join('')}</div>`
      :`<div class="empty" style="padding:32px;"><span class="mi">bolt</span><div class="empty-title" style="font-size:18px;">No active missions</div></div>`;
  }
}
function _ppTab(el,id){
  el.parentElement.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  ['ppVideos','ppDares'].forEach(x=>{ const e=document.getElementById(x); if(e) e.style.display=x===id?'block':'none'; });
}
function _pubShare(){
  const url=location.origin+'/u/'+(_ppUid||'');
  const name=_ppData?.name||'this creator';
  if(navigator.share){ navigator.share({title:'Mission Market — '+name, url}).catch(()=>{}); }
  else if(navigator.clipboard){ navigator.clipboard.writeText(url).then(()=>showToast('Profile link copied')).catch(()=>showToast(url)); }
  else showToast(url);
}
let _flUsers=[], _flFollowing=new Set();
async function _ppFollowList(type){
  const uid=_ppUid||user?.uid; if(!uid) return;
  document.getElementById('flTitle').textContent = type==='followers'?'Followers':'Following';
  const body=document.getElementById('flBody');
  const search=document.getElementById('flSearch'); if(search) search.value='';
  body.innerHTML=_skelRows(6);
  _ovOpen('followListOverlay', type==='following' ? '/following' : '/followers');
  const field = type==='followers'?'targetUid':'followerUid';
  const other = type==='followers'?'followerUid':'targetUid';
  try{
    const snap=await db.collection('follows').where(field,'==',uid).limit(50).get();
    const uids=[...new Set(snap.docs.map(d=>d.data()[other]))];
    if(!uids.length){ _flUsers=[]; body.innerHTML='<div style="text-align:center;padding:24px;color:var(--t3);font-size:13px;">No '+type+' yet</div>'; return; }
    // who the current user already follows → label Follow / Following buttons
    _flFollowing=new Set();
    if(user){ try{ const mine=await db.collection('follows').where('followerUid','==',user.uid).get();
      mine.docs.forEach(d=>_flFollowing.add(d.data().targetUid)); }catch(e){} }
    _flUsers=(await Promise.all(uids.map(u=>db.collection('users').doc(u).get().then(d=>d.exists?{uid:u,...d.data()}:null).catch(()=>null)))).filter(Boolean);
    _flRender(_flUsers);
  }catch(e){ body.innerHTML='<div style="text-align:center;padding:24px;color:var(--t3);font-size:13px;">Could not load</div>'; }
}
function _flRender(list){
  const body=document.getElementById('flBody'); if(!body) return;
  if(!list.length){ body.innerHTML='<div style="text-align:center;padding:24px;color:var(--t3);font-size:13px;">No users found</div>'; return; }
  body.innerHTML=list.map(u=>{
    const isMe=user&&u.uid===user.uid;
    const f=_flFollowing.has(u.uid);
    const btn=isMe?'':`<button class="fl-follow${f?' following':''}" onclick="event.stopPropagation();_flToggleFollow('${u.uid}',this)">${f?'Following':'Follow'}</button>`;
    return `<div class="fl-row" onclick="_flGoProfile('${u.uid}')">
      <div class="fl-av">${_avHtml(u.picture,u.name)}</div>
      <div class="fl-info"><div class="fl-name">${escHtml(u.name||'User')}</div><div class="fl-handle">@${escHtml(u.username||'user')}</div></div>
      ${btn}</div>`;
  }).join('');
}
function _flFilter(q){
  q=(q||'').toLowerCase().trim();
  const list=!q?_flUsers:_flUsers.filter(u=>((u.username||'').toLowerCase().includes(q)||(u.name||'').toLowerCase().includes(q)));
  _flRender(list);
}
async function _flToggleFollow(uid,btn){
  if(!user){ showToast('Sign in first'); return; }
  const nowF=!_flFollowing.has(uid);            // state after toggle
  await toggleFollow(uid,'creator');
  if(nowF)_flFollowing.add(uid); else _flFollowing.delete(uid);
  if(btn){ btn.textContent=nowF?'Following':'Follow'; btn.classList.toggle('following',nowF); }
}
// Row tap → open that user's profile. REPLACE the follow-list history entry with the
// /u/:id entry (no extra entry, no desync) so Back from the profile lands where the list was opened.
function _flGoProfile(uid){
  const i=_ovStack.lastIndexOf('followListOverlay');
  const el=document.getElementById('followListOverlay'); if(el) el.classList.remove('open');
  if(i>=0) _ovStack.splice(i,1);                 // untrack without rewinding history
  _ovLock();
  try{ history.replaceState({dm:'u',id:uid}, '', '/u/'+encodeURIComponent(uid)); }catch(e){}
  _navBack=true; openPublicProfile(uid); _navBack=false;   // _navBack → openPublicProfile won't push again
}

// ════════════════════════════════════════════════════════════════════
//  PROFILE — settings, achievements, social links
// ════════════════════════════════════════════════════════════════════
// Settings — YouTube-style two-pane page: left nav picks a section, right shows it
function openSettings(){
  if(!user){ showToast('Sign in first'); return; }
  const s=user.settings||{};
  document.getElementById('setNotifLikes').checked  = s.notifLikes  !== false;
  document.getElementById('setNotifFollow').checked = s.notifFollow !== false;
  document.getElementById('setNotifDares').checked  = s.notifDares  !== false;
  document.getElementById('setPrivate').checked     = s.private === true;
  document.getElementById('setAutoplay').checked    = s.autoplay !== false;   // default ON
  document.getElementById('setPageAnim').checked    = s.pageAnim !== false;   // default ON
  _ovOpen('settingsOverlay');
  _tpInit('settingsOverlay');   // desktop: show the active/first section in the right pane
}
// ── Generic two-pane (Settings / Post Dare / Edit Profile): left nav → right section.
//    Desktop switches in place; mobile opens the tapped section as its OWN page. ──
function _tpSec(btn){
  const secId = btn.dataset.sec; const sec = document.getElementById(secId); if(!sec) return;
  if (window.innerWidth <= 768){ _openSecPage(secId, btn.dataset.title || 'Settings', btn.dataset.url || ''); return; }
  const layout = btn.closest('.set-layout'); if(!layout) return;
  layout.querySelectorAll('.set-nav-item').forEach(b=>b.classList.toggle('active', b===btn));
  layout.querySelectorAll('.set-sec').forEach(s=>{ s.style.display = s.id===secId ? 'block' : 'none'; });
}
function _tpSecById(secId){ const b=document.querySelector(`.set-nav-item[data-sec="${secId}"]`); if(b) _tpSec(b); }
// Desktop: after opening a two-pane page, show the active (or first) section in the right pane
function _tpInit(overlayId){
  if (window.innerWidth <= 768) return;
  const nav=document.querySelector(`#${overlayId} .set-nav`); if(!nav) return;
  const b=nav.querySelector('.set-nav-item.active[data-sec]') || nav.querySelector('.set-nav-item[data-sec]');
  if(b) _tpSec(b);
}
// Mobile: move the section's DOM into the shared page overlay (no duplicate ids); remembers home
function _openSecPage(secId, title, url){
  const sec=document.getElementById(secId); if(!sec) return;
  if(!sec._homeParent) sec._homeParent = sec.parentElement;
  document.getElementById('setSecTitle').textContent = title || '';
  document.getElementById('setSecBody').appendChild(sec);
  sec.style.display='block';
  _ovOpen('setSecOverlay', url || location.pathname);
}
function closeSetSec(){
  _ovSync('setSecOverlay');
  const ov=document.getElementById('setSecOverlay'); if(ov) ov.classList.remove('open');
  const body=document.getElementById('setSecBody');
  while(body && body.firstElementChild){
    const sec=body.firstElementChild; sec.style.display='none';
    (sec._homeParent || document.body).appendChild(sec);
  }
}
// Deep links (/settings/notifications, /settings/more) land on the right section
function openNotifSettings(){ openSettings(); _tpSecById('secNotif'); }
function openMoreSettings(){ openSettings(); _tpSecById('secMore'); }
function _saveSettings(){
  if(!user) return;
  const _ap=document.getElementById('setAutoplay');
  const _pa=document.getElementById('setPageAnim');
  user.settings={
    notifLikes:  document.getElementById('setNotifLikes').checked,
    notifFollow: document.getElementById('setNotifFollow').checked,
    notifDares:  document.getElementById('setNotifDares').checked,
    private:     document.getElementById('setPrivate').checked,
    autoplay:    _ap ? _ap.checked : (user.settings?.autoplay !== false),
    pageAnim:    _pa ? _pa.checked : (user.settings?.pageAnim !== false)
  };
  db.collection('users').doc(user.uid).update({ settings:user.settings }).catch(()=>{});
}
async function deleteAccount(){
  if(!user) return;
  if(!confirm('Delete your account permanently?\n\nThis removes your profile and cannot be undone.')) return;
  if(!confirm('Are you absolutely sure? This is final.')) return;
  try{
    await db.collection('users').doc(user.uid).delete();
    try{ await auth.currentUser.delete(); }catch(e){}   // needs recent login; sign out regardless
    showToast('Account deleted');
    if(typeof logout==='function') logout();
  }catch(e){ showToast('Could not delete — re-login and retry'); }
}

// Achievements (computed from your activity)
function _renderProfileBadges(myPosted){
  const el=document.getElementById('profBadges'); if(!el) return;
  myPosted = myPosted || (dares||[]).filter(d=>d.creatorUid===user.uid);
  const completed=myPosted.filter(d=>d.completed).length;
  const earned=(wallet.transactions||[]).filter(t=>_wtxnCat(t)==='bounty_won').reduce((s,t)=>s+(t.amount||0),0);
  const pool=(typeof allProofs!=='undefined'&&allProofs.length)?allProofs:homeProofs;
  const videos=(pool||[]).filter(p=>p.takerId===user.uid).length;
  const verified=(wallet.kyc&&wallet.kyc.status==='verified');
  const badges=[
    verified           && {i:'verified',      t:'Verified',      c:'#0A84FF'},
    myPosted.length>=1 && {i:'rocket_launch', t:'First Mission',    c:'#FF9F0A'},
    completed>=5       && {i:'military_tech',  t:'Dedicated',     c:'#BF5AF2'},
    videos>=1          && {i:'movie',          t:'Creator',       c:'#FF2D55'},
    earned>0           && {i:'paid',           t:'Bounty Hunter', c:'#32D74B'},
  ].filter(Boolean);
  el.innerHTML = badges.length ? badges.map(b=>`<span class="pbadge" style="--bc:${b.c}"><span class="mi">${b.i}</span>${b.t}</span>`).join('') : '';
}

// Social link icons (own profile or public profile)
function _renderProfileSocials(u, elId){
  const el=document.getElementById(elId||'profSocials'); if(!el) return;
  u = u || user || {};
  const s=u.socials||{}; const links=[];
  if(s.insta) links.push(`<a href="https://instagram.com/${encodeURIComponent((''+s.insta).replace(/^@/,''))}" target="_blank" rel="noopener" class="psocial" title="Instagram"><span class="mi">photo_camera</span></a>`);
  if(s.x)     links.push(`<a href="https://x.com/${encodeURIComponent((''+s.x).replace(/^@/,''))}" target="_blank" rel="noopener" class="psocial" title="X"><span class="psoc-x">X</span></a>`);
  if(s.yt)    links.push(`<a href="https://youtube.com/${encodeURIComponent((''+s.yt))}" target="_blank" rel="noopener" class="psocial" title="YouTube"><span class="mi">smart_display</span></a>`);
  if(u.website) links.push(`<a href="${escHtml(u.website)}" target="_blank" rel="noopener" class="psocial" title="Website"><span class="mi">link</span></a>`);
  el.innerHTML = links.join('');
}

function switchPTab(el, tabId) {
  document.querySelectorAll('#pageProfile .tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  ['tVideos','tMyDares','tAccepted','tTxns'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.style.display = id === tabId ? 'block' : 'none';
  });
}
// Open the profile page and activate a specific tab (used by the topbar menu)
function goProfileTab(tabId){
  goPage('profile');
  setTimeout(()=>{
    const btn=[...document.querySelectorAll('#pageProfile .tabs .tab')].find(b=>(b.getAttribute('onclick')||'').includes(tabId));
    if(btn) btn.click();
  }, 60);
}

// ════════════════════════════
//  DROPDOWN
// ════════════════════════════
function toggleDD() { document.getElementById('userDD').classList.toggle('open'); }
function closeDD()  { document.getElementById('userDD').classList.remove('open'); }
document.addEventListener('click', e => {
  const dd = document.getElementById('userDD');
  const av = document.getElementById('topAv');
  if (dd && av && !dd.contains(e.target) && !av.contains(e.target)) dd.classList.remove('open');
});

// ════════════════════════════
//  HELPERS
// ════════════════════════════
function switchTab(t) {
  const il = t === 'login';
  document.getElementById('tabLogin').classList.toggle('active', il);
  document.getElementById('tabSignup').classList.toggle('active', !il);
  document.getElementById('panelLogin').style.display  = il  ? 'block' : 'none';
  document.getElementById('panelSignup').style.display = !il ? 'block' : 'none';
  document.getElementById('loginErr').style.display  = 'none';
  document.getElementById('signupErr').style.display = 'none';
}
function showAuthErr(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = 'block';
}
function todayStr() {
  return new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Close modals on outside click
['postOverlay','proofOverlay','reviewOverlay','rejectOverlay'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', function(e) {
    if (e.target === this) {
      if (id === 'proofOverlay')   closeProof();
      else if (id === 'reviewOverlay')  closeReview();
      else if (id === 'rejectOverlay') closeRejectModal();
      else closePost();
    }
  });
});

// ════════════════════════════════════════════════════════════════════
//  PROFILE EDIT — Username · Bio · Photo · Website
//  Username uniqueness checked via /usernames/{handle} collection
// ════════════════════════════════════════════════════════════════════

function openProfileEdit() {
  if (!user) return;

  // Populate modal with current values
  const peAv = document.getElementById('peAvatar');
  if (user.picture) peAv.innerHTML = `<img src="${user.picture}" alt="av" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
  else              peAv.textContent = user.name[0].toUpperCase();

  document.getElementById('peName').value    = user.name    || '';
  document.getElementById('peHandle').value  = user.username || '';
  document.getElementById('peBio').value     = user.bio     || '';
  document.getElementById('peBioCount').textContent = (user.bio||'').length + ' / 160';
  document.getElementById('peWebsite').value = user.website || '';
  const _soc = user.socials || {};
  const _si=document.getElementById('peInsta'); if(_si) _si.value=_soc.insta||'';
  const _sx=document.getElementById('peX');     if(_sx) _sx.value=_soc.x||'';
  const _sy=document.getElementById('peYt');    if(_sy) _sy.value=_soc.yt||'';

  // Reset photo selection and handle status
  peSelectedPhotoFile = null;
  peHandleValid       = true; // current handle is already valid
  document.getElementById('peHandleStatus').textContent = '';
  document.getElementById('peHandleStatus').className   = 'pe-status ok';
  document.getElementById('peSaveBtn').disabled = false;
  document.getElementById('peSaveBtn').innerHTML = '<span class="mi">check</span> Save Changes';  // clear a stale "Saving..."
  const _pp = document.getElementById('pePrivate'); if(_pp) _pp.checked = (user.settings && user.settings.private === true);

  _ovOpen('profileEditOverlay');
  _tpInit('profileEditOverlay');   // desktop: show the first section (Photo) in the right pane
}
// Edit Profile → Profile visibility toggle (mirrors Settings > Privacy > Private profile)
function _pePrivacyChange(el){
  if(!user) return;
  user.settings = user.settings || {};
  user.settings.private = el.checked;
  const sp = document.getElementById('setPrivate'); if(sp) sp.checked = el.checked;
  db.collection('users').doc(user.uid).update({ settings:user.settings }).catch(()=>{});
}

function cancelProfileEdit() {
  _ovSync('profileEditOverlay');
  peSelectedPhotoFile = null;
  document.getElementById('profileEditOverlay').classList.remove('open');
}

// ── Handle (username) input — debounced uniqueness check ─────────────────────
function onHandleInput() {
  const val     = document.getElementById('peHandle').value.trim().toLowerCase();
  const statusEl = document.getElementById('peHandleStatus');
  const saveBtn  = document.getElementById('peSaveBtn');

  // Format validation
  if (!val) {
    statusEl.textContent = 'Username cannot be empty';
    statusEl.className   = 'pe-status err';
    peHandleValid = false; saveBtn.disabled = true; return;
  }
  if (!/^[a-z0-9_.]{3,30}$/.test(val)) {
    statusEl.textContent = '3–30 chars · only letters, numbers, _ and .';
    statusEl.className   = 'pe-status err';
    peHandleValid = false; saveBtn.disabled = true; return;
  }

  // Same as current — no check needed
  if (val === (user.username || '').toLowerCase()) {
    statusEl.textContent = '✓ Your current username';
    statusEl.className   = 'pe-status ok';
    peHandleValid = true; saveBtn.disabled = false; return;
  }

  // Debounce Firestore check (400ms)
  statusEl.textContent = 'Checking availability...';
  statusEl.className   = 'pe-status loading';
  peHandleValid = false; saveBtn.disabled = true;

  clearTimeout(peHandleTimer);
  peHandleTimer = setTimeout(async () => {
    try {
      const snap = await db.collection('usernames').doc(val).get();
      if (snap.exists) {
        statusEl.textContent = `@${val} is already taken`;
        statusEl.className   = 'pe-status err';
        peHandleValid = false; saveBtn.disabled = true;
      } else {
        statusEl.textContent = `✓ @${val} is available!`;
        statusEl.className   = 'pe-status ok';
        peHandleValid = true; saveBtn.disabled = false;
      }
    } catch {
      statusEl.textContent = 'Could not verify — try again';
      statusEl.className   = 'pe-status err';
      peHandleValid = false; saveBtn.disabled = true;
    }
  }, 400);
}

// ── Profile photo selected ────────────────────────────────────────────────────
function onProfilePhotoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { showToast('Photo must be under 5 MB'); return; }

  peSelectedPhotoFile = file;
  const url = URL.createObjectURL(file);
  const peAv = document.getElementById('peAvatar');
  peAv.innerHTML = `<img src="${url}" alt="preview" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
}

// ── Save profile ──────────────────────────────────────────────────────────────
async function saveProfile() {
  if (!peHandleValid) { showToast('Fix username before saving'); return; }

  const newName    = document.getElementById('peName').value.trim();
  const newHandle  = document.getElementById('peHandle').value.trim().toLowerCase();
  const newBio     = document.getElementById('peBio').value.trim();
  const newWebsite = document.getElementById('peWebsite').value.trim();
  const _clean = v => (''+(v||'')).trim().replace(/^@/,'').replace(/\s/g,'');
  const newSocials = {
    insta: _clean(document.getElementById('peInsta')?.value),
    x:     _clean(document.getElementById('peX')?.value),
    yt:    (''+(document.getElementById('peYt')?.value||'')).trim().replace(/\s/g,'')
  };

  if (!newName)   { showToast('Display name cannot be empty'); return; }
  if (!newHandle) { showToast('Username cannot be empty'); return; }

  const saveBtn = document.getElementById('peSaveBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="mi">hourglass_empty</span> Saving...';

  try {
    let photoURL = user.picture || '';

    // Upload new profile photo → Cloudinary
    if (peSelectedPhotoFile) {
      saveBtn.innerHTML = '<span class="mi">hourglass_empty</span> Uploading photo...';
      const pUpload = uploadToCloudinary(peSelectedPhotoFile, 'image', pct => {
        saveBtn.innerHTML = `<span class="mi">hourglass_empty</span> Uploading ${pct}%`;
      });
      photoURL = await pUpload.promise;
    }

    const oldHandle = user.username || '';
    const batch     = db.batch();

    // Update user document
    batch.update(db.collection('users').doc(user.uid), {
      name:     newName,
      username: newHandle,
      bio:      newBio,
      website:  newWebsite,
      socials:  newSocials,
      photoURL: photoURL
    });

    // Update username uniqueness collection (only if handle changed)
    if (newHandle !== oldHandle) {
      if (oldHandle) batch.delete(db.collection('usernames').doc(oldHandle));
      batch.set(db.collection('usernames').doc(newHandle), { uid: user.uid });
    }

    await batch.commit();

    // Update local user object
    user.name     = newName;
    user.username = newHandle;
    user.bio      = newBio;
    user.website  = newWebsite;
    user.socials  = newSocials;
    user.picture  = photoURL;

    // Refresh UI
    renderProfile();
    const av = document.getElementById('topAv');
    if (user.picture) av.innerHTML = `<img src="${user.picture}" alt="av" onerror="this.parentElement.textContent='${user.name[0].toUpperCase()}'"/>`;
    else              av.textContent = user.name[0].toUpperCase();
    document.getElementById('ddName').textContent  = user.name;
    const sbAv = document.getElementById('sbProfAv');
    if (sbAv) {
      if (user.picture) sbAv.innerHTML = `<img src="${user.picture}" alt="av"/>`;
      else              sbAv.textContent = user.name[0].toUpperCase();
    }

    cancelProfileEdit();
    showToast('Profile updated successfully!');
    // reset for the next save — success path left the button stuck on "Saving..."
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="mi">check</span> Save Changes';

  } catch(e) {
    console.error('saveProfile error:', e);
    showToast('Failed to save — please try again');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="mi">check</span> Save Changes';
  }
}

// ════════════════════════════════════════════════════════════════════
//  v0.19 NEW FEATURES
// ════════════════════════════════════════════════════════════════════

// ── TAKER MODE SWITCH (in post dare modal) ──────────────────────────
function switchTakerMode(mode) {
  currentTakerMode = mode;
  document.getElementById('tmOpen')?.classList.toggle('active', mode==='open');
  document.getElementById('tmPick')?.classList.toggle('active', mode==='creator_picks');
  const hint = document.getElementById('takerModeHint');
  if (hint) hint.textContent = mode==='open'
    ? 'Anyone who accepts can submit proof immediately.'
    : 'Users apply → you review applicants → you select who gets to do the mission.';
}

// ── EDIT DARE ────────────────────────────────────────────────────────
async function openEditDare(id) {
  const _d = dares.find(x=>x.id===id); if(_d && _d.completed){ showToast('Completed missions cannot be edited'); return; }
  const d = dares.find(x => x.id === id);
  if (!d) return;

  editingDareId = id;
  postTags = d.tags ? [...d.tags] : [];
  postRules = d.rules ? [...d.rules] : [];
  selectedThumb = null; selectedPreviewVid = null;
  capturedFrameBlob = null;
  currentMediaTab = 'image';
  currentVis = d.visibility || 'now';
  currentTakerMode = d.takerSelectionMode || 'open';

  // Fill form
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val||''; };
  set('pCaption', d.caption || d.title);
  set('pReward',  d.rewardAmount ?? d.bounty ?? 0);
  set('pDesc',    d.description || d.desc);

  if (d.expiresAt) {
    const exp = d.expiresAt.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt);
    set('pExpiry', exp.toISOString().slice(0,16));
  } else {
    set('pExpiry', '');
  }

  if (d.scheduledAt && currentVis==='scheduled') {
    const sch = d.scheduledAt.toDate ? d.scheduledAt.toDate() : new Date(d.scheduledAt);
    set('scheduleDate', sch.toISOString().slice(0,16));
  }

  switchMediaTab('image');
  _resetThumbUI();
  _resetVideoUI();

  // Show existing thumbnail as preview
  if (d.thumbnailURL) {
    const prev = document.getElementById('thumbPreview');
    if (prev) { prev.src = d.thumbnailURL; prev.style.display='block'; }
    document.getElementById('thumbDZInner')?.style && (document.getElementById('thumbDZInner').style.display='none');
    document.getElementById('thumbEditRow')?.style  && (document.getElementById('thumbEditRow').style.display='flex');
  }

  renderPostTags();
  renderPostRules();
  switchVis(currentVis);
  switchTakerMode(currentTakerMode);

  const titleEl = document.querySelector('#postOverlay .modal-title');
  if (titleEl) titleEl.textContent = 'Edit Mission';

  const btn = document.getElementById('submitDareBtn');
  if (btn) { btn.disabled=false; btn.innerHTML='<span class="mi">save</span> Save Changes'; }

  _ovOpen('postOverlay');
}

// ── DELETE DARE ──────────────────────────────────────────────────────
async function deleteDare(id) {
  const _dd = dares.find(x=>x.id===id); if(_dd && _dd.completed){ showToast('Completed missions cannot be deleted'); return; }
  const d = dares.find(x => x.id === id);
  if (!d) return;
  const title = d.caption || d.title || 'this mission';
  if (!confirm(`Delete "${title}"?\n\nIf you set a reward, it will be refunded to your wallet.`)) return;
  try {
    await db.collection('dares').doc(id).delete();
    // Refund reward if dare was not completed
    const reward = d.rewardAmount ?? d.bounty ?? 0;
    if (reward > 0 && !d.completed) {
      wallet.balance += reward;
      wallet.transactions.unshift({ id:'w'+Date.now()+Math.floor(Math.random()*1000), ts:Date.now(), status:'completed',
        type:'credit', category:'refund', title:'Mission Deleted (Refund): '+title.slice(0,25), amount:reward,
        ref:'REF'+Date.now().toString(36).toUpperCase(), date:todayStr() });
      await db.collection('users').doc(user.uid).update({ wallet });
    }
    showToast('Mission deleted' + (reward>0&&!d.completed ? ` · Rs.${reward.toLocaleString('en-IN')} refunded` : ''));
    renderProfile();
  } catch(e) { showToast('Error: '+e.message); }
}

// ── PIN / UNPIN DARE (max 3) ─────────────────────────────────────────
async function pinDare(id) {
  if (pinnedDares.includes(id)) { showToast('Already pinned!'); return; }
  if (pinnedDares.length >= 3)  { showToast('Maximum 3 missions can be pinned. Unpin one first.'); return; }
  pinnedDares.push(id);
  try {
    await db.collection('users').doc(user.uid).update({ pinnedDares });
    showToast('Mission pinned!  It will appear at top of the feed.');
    renderProfile();
  } catch(e) {
    pinnedDares.pop();
    showToast('Error: '+e.message);
  }
}

async function unpinDare(id) {
  pinnedDares = pinnedDares.filter(x => x !== id);
  try {
    await db.collection('users').doc(user.uid).update({ pinnedDares });
    showToast('Mission unpinned.');
    renderProfile();
  } catch(e) {
    showToast('Error: '+e.message);
  }
}

// ── REPORT SYSTEM ────────────────────────────────────────────────────
function openReportModal(targetType, targetId, targetName, extra) {
  reportTargetInfo = { type:targetType, id:targetId, name:targetName, extra };
  const label = targetType==='dare' ? `"${targetName}"` : `@${targetName}`;
  const titleEl = document.getElementById('reportModalTitle');
  if (titleEl) titleEl.textContent = `Report ${label}`;
  document.getElementById('reportReason').value = '';
  document.getElementById('reportType').value = 'inappropriate';
  _ovOpen('reportOverlay');
}
function closeReportModal2() {
  _ovSync('reportOverlay');
  document.getElementById('reportOverlay').classList.remove('open');
  reportTargetInfo = null;
}

async function submitReport() {
  if (!reportTargetInfo) return;
  const reason   = document.getElementById('reportReason').value.trim();
  const repType  = document.getElementById('reportType').value;
  if (!reason) { showToast('Please describe the issue'); return; }

  const btn = document.getElementById('submitReportBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    await db.collection('reports').add({
      targetType:    reportTargetInfo.type,
      targetId:      reportTargetInfo.id,
      targetName:    reportTargetInfo.name,
      reportType:    repType,
      reason,
      reporterUid:   user.uid,
      reporterName:  user.name,
      reporterEmail: user.email,
      status:        'pending',
      createdAt:     firebase.firestore.FieldValue.serverTimestamp()
    });
    closeReportModal2();
    showToast('Report submitted. Our team will review it within 24 hours.');
  } catch(e) {
    showToast('Error: '+e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Report';
  }
}

// ── ADMIN REPORTS PANEL ───────────────────────────────────────────────
async function openAdminReports() {
  if (!user || user.uid !== ADMIN_UID) {
    showToast('Admin access required'); return;
  }
  _ovOpen('adminReportsOverlay');
  document.getElementById('adminReportsList').innerHTML =
    '<div class="empty" style="padding:40px;"><span class="mi">hourglass_empty</span><div class="empty-title">Loading reports...</div></div>';
  try {
    const snap = await db.collection('reports').orderBy('createdAt','desc').limit(50).get();
    const reports = snap.docs.map(d=>({id:d.id,...d.data()}));
    if (!reports.length) {
      document.getElementById('adminReportsList').innerHTML =
        '<div class="empty" style="padding:40px;"><span class="mi">check_circle</span><div class="empty-title">No reports yet</div></div>';
      return;
    }
    document.getElementById('adminReportsList').innerHTML = reports.map(r=>`
      <div class="report-item">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--t1);">${r.targetType==='dare'?'📋 Mission':'👤 User'}: ${escHtml(r.targetName||r.targetId)}</div>
            <div style="font-size:11px;color:var(--t3);margin-top:2px;font-family:'IBM Plex Mono',monospace;">${r.reportType} · by ${r.reporterName} · ${r.createdAt?.toDate?.()?.toLocaleDateString('en-IN')||''}</div>
            <div style="font-size:13px;color:var(--t2);margin-top:6px;line-height:1.5;">"${escHtml(r.reason)}"</div>
          </div>
          <span class="status-badge ${r.status==='resolved'?'status-approved':'status-submitted'}">${r.status}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          ${r.status==='pending'?`
          <button onclick="resolveReport('${r.id}')" style="background:rgba(0,230,118,.1);color:var(--green);border:1px solid rgba(0,230,118,.3);padding:5px 12px;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer;">Resolve</button>
          <button onclick="dismissReport('${r.id}')" style="background:rgba(255,255,255,.04);color:var(--t2);border:1px solid var(--border);padding:5px 12px;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer;">Dismiss</button>`:''}
        </div>
      </div>`).join('');
  } catch(e) {
    document.getElementById('adminReportsList').innerHTML =
      `<div class="empty" style="padding:40px;"><span class="mi">error</span><div class="empty-title">Error: ${e.message}</div></div>`;
  }
}
async function resolveReport(id) {
  await db.collection('reports').doc(id).update({status:'resolved'});
  openAdminReports();
}
async function dismissReport(id) {
  await db.collection('reports').doc(id).update({status:'dismissed'});
  openAdminReports();
}
function closeAdminReports() {
  _ovSync('adminReportsOverlay');
  document.getElementById('adminReportsOverlay').classList.remove('open');
}

// ── SELECT TAKERS MODAL ───────────────────────────────────────────────
async function openSelectTakersModal(dareId) {
  selectTakersDareId = dareId;
  const d = dares.find(x => x.id === dareId);
  if (!d) return;

  document.getElementById('selectTakersDareTitle').textContent = d.caption||d.title||'Mission';
  _ovOpen('selectTakersOverlay');
  document.getElementById('applicantsList').innerHTML =
    '<div class="empty" style="padding:32px;"><span class="mi">hourglass_empty</span><div class="empty-title">Loading applicants...</div></div>';

  // Reset random panel
  document.getElementById('randomPanel')?.classList.remove('open');

  try {
    const snap = await db.collection('dares').doc(dareId).collection('applicants')
      .orderBy('appliedAt','asc').get();
    currentApplicants = snap.docs.map(doc=>({id:doc.id,...doc.data()}));
    const approvedTakers = d.approvedTakers || [];
    renderApplicantsList(currentApplicants, approvedTakers);
  } catch(e) {
    document.getElementById('applicantsList').innerHTML =
      `<div class="empty"><span class="mi">error</span><div class="empty-title">Error: ${e.message}</div></div>`;
  }
}

function renderApplicantsList(applicants, approvedTakers) {
  const el = document.getElementById('applicantsList');
  document.getElementById('applicantCount').textContent = `${applicants.length} applicant${applicants.length!==1?'s':''} · ${approvedTakers.length} approved`;

  if (!applicants.length) {
    el.innerHTML = '<div class="empty" style="padding:28px;"><span class="mi">people</span><div class="empty-title">No Applicants Yet</div><p class="empty-desc">Share your mission to get more applicants!</p></div>';
    return;
  }

  el.innerHTML = applicants.map(a => {
    const isApproved = approvedTakers.includes(a.uid);
    return `
    <div class="applicant-row ${isApproved?'applicant-approved':''}">
      <div class="applicant-av">${(a.name||'?')[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:600;color:var(--t1);">${escHtml(a.name||'Unknown')}</div>
        <div style="font-size:11px;color:var(--t3);font-family:'IBM Plex Mono',monospace;">
          ${a.completionRate||0} missions completed · Applied ${a.date||''}
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        ${isApproved
          ? `<span style="font-size:10px;color:var(--green);font-weight:700;padding:3px 10px;border-radius:50px;background:rgba(0,230,118,.12);border:1px solid rgba(0,230,118,.3);">✓ Selected</span>
             <button class="btn-dare-action" onclick="revokeTaker('${selectTakersDareId}','${a.uid}')" title="Remove selection" style="width:28px;height:28px;">
               <span class="mi" style="font-size:15px;">close</span>
             </button>`
          : `<button onclick="approveTaker('${selectTakersDareId}','${a.uid}','${escHtml(a.name)}')"
               style="background:linear-gradient(135deg,var(--blue),var(--blue2));color:#fff;border:none;
               padding:7px 16px;border-radius:50px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">
               Select
             </button>`
        }
        <button class="btn-report-icon" onclick="openReportModal('user','${a.uid}','${escHtml(a.name||'')}')" title="Report user">
          <span class="mi">flag</span>
        </button>
      </div>
    </div>`;
  }).join('');
}

async function approveTaker(dareId, takerUid, takerName) {
  try {
    const approvedTakers = [...(dares.find(d=>d.id===dareId)?.approvedTakers||[])];
    if (!approvedTakers.includes(takerUid)) approvedTakers.push(takerUid);

    await db.collection('dares').doc(dareId).update({ approvedTakers });

    // Update applicant status in subcollection
    await db.collection('dares').doc(dareId).collection('applicants').doc(takerUid)
      .update({ status: 'approved' });

    // Update dare in local state
    const d = dares.find(x=>x.id===dareId);
    if (d) d.approvedTakers = approvedTakers;

    showToast(`${takerName} selected! They can now submit proof.`);
    renderApplicantsList(currentApplicants, approvedTakers);
  } catch(e) { showToast('Error: '+e.message); }
}

// A taker's acceptedDares entry lives in THEIR user doc, which the creator can't
// write to. So when the creator approves them (dare.approvedTakers), reconcile the
// local entry here so "Applied" flips to "Submit Proof". Persist so it sticks.
function _reconcileTakerApprovals(){
  if (!user || !Array.isArray(acceptedDares) || !acceptedDares.length) return;
  let changed = false;
  acceptedDares.forEach(a => {
    if (a.applicantStatus === 'pending') {
      const d = (dares||[]).find(x => x.id === a.dareId);
      if (d && (d.approvedTakers||[]).includes(user.uid)) { a.applicantStatus = 'accepted'; changed = true; }
    }
  });
  if (changed) db.collection('users').doc(user.uid).update({ acceptedDares }).catch(()=>{});
}

async function revokeTaker(dareId, takerUid) {
  try {
    const d = dares.find(x=>x.id===dareId);
    const approvedTakers = (d?.approvedTakers||[]).filter(uid=>uid!==takerUid);

    await db.collection('dares').doc(dareId).update({ approvedTakers });
    await db.collection('dares').doc(dareId).collection('applicants').doc(takerUid)
      .update({ status: 'pending' });

    if (d) d.approvedTakers = approvedTakers;
    showToast('Selection removed.');
    renderApplicantsList(currentApplicants, approvedTakers);
  } catch(e) { showToast('Error: '+e.message); }
}

function closeSelectTakersModal() {
  _ovSync('selectTakersOverlay');
  document.getElementById('selectTakersOverlay').classList.remove('open');
  selectTakersDareId = null;
  currentApplicants = [];
}

// ── RANDOM SELECT PANEL ───────────────────────────────────────────────
function toggleRandomPanel() {
  const panel = document.getElementById('randomPanel');
  panel?.classList.toggle('open');
}

async function executeRandomSelect() {
  if (!selectTakersDareId || !currentApplicants.length) return;

  const poolInput     = document.getElementById('randomPoolSize').value.trim();
  const selectInput   = document.getElementById('randomSelectCount').value.trim();
  const criteria      = document.getElementById('randomCriteria').value;

  const poolSize   = poolInput   === '' ? currentApplicants.length : Math.max(1, parseInt(poolInput)||currentApplicants.length);
  const selectCount = selectInput === '' ? 1 : Math.max(1, parseInt(selectInput)||1);

  if (selectCount > poolSize) { showToast('Select count cannot exceed pool size'); return; }
  if (selectCount > currentApplicants.length) { showToast(`Only ${currentApplicants.length} applicants available`); return; }

  // Build pool based on criteria
  let pool = [...currentApplicants];
  if (criteria === 'first_applied') {
    // Already sorted by appliedAt asc from Firestore
    pool = pool.slice(0, poolSize);
  } else if (criteria === 'completion_rate') {
    pool = pool.sort((a,b)=>(b.completionRate||0)-(a.completionRate||0)).slice(0, poolSize);
  }

  // Fisher-Yates shuffle and pick selectCount
  for (let i=pool.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [pool[i],pool[j]] = [pool[j],pool[i]];
  }
  const chosen = pool.slice(0, selectCount);

  const btn = document.getElementById('executeRandomBtn');
  btn.disabled = true; btn.textContent = 'Selecting...';

  try {
    const d = dares.find(x=>x.id===selectTakersDareId);
    const existing = d?.approvedTakers||[];
    const newApproved = [...new Set([...existing, ...chosen.map(c=>c.uid)])];

    await db.collection('dares').doc(selectTakersDareId).update({ approvedTakers: newApproved });

    // Update subcollection statuses
    const batch = db.batch();
    chosen.forEach(c => {
      batch.update(
        db.collection('dares').doc(selectTakersDareId).collection('applicants').doc(c.uid),
        { status: 'approved' }
      );
    });
    await batch.commit();

    if (d) d.approvedTakers = newApproved;

    document.getElementById('randomPanel').classList.remove('open');
    showToast(`${chosen.length} taker${chosen.length!==1?'s':''} randomly selected!`);
    renderApplicantsList(currentApplicants, newApproved);
  } catch(e) {
    showToast('Error: '+e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Select Randomly';
  }
}

// ── Show admin link if admin ──────────────────────────────
function _checkAdminVisibility() {
  const adminEl = document.getElementById('adminDDItem');
  if (adminEl && user && ADMIN_UID && user.uid === ADMIN_UID) {
    adminEl.style.display = 'flex';
  }
}

// Hook into auth listener — call after initUser
const _origToggleDD = window.toggleDD;
window.toggleDD = function() {
  _checkAdminVisibility();
  if (_origToggleDD) _origToggleDD();
  else document.getElementById('userDD')?.classList.toggle('open');
};

// ── Close new modals on overlay click ─────────────────────
['reportOverlay','selectTakersOverlay','adminReportsOverlay'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', function(e) {
    if (e.target === this) {
      if (id === 'reportOverlay')        closeReportModal2();
      else if (id === 'selectTakersOverlay') closeSelectTakersModal();
      else if (id === 'adminReportsOverlay') closeAdminReports();
    }
  });
});


// ════════════════════════════════════════════════════════════
//  MOBILE SIDEBAR TOGGLE + BOTTOM NAV SYNC (v0.19 merge)
// ════════════════════════════════════════════════════════════

let _sidebarOpen = false;

// PURPOSE: Hamburger tap → open/close sidebar
//   Mobile  (<600px) → slides in as overlay
//   Tablet/Desktop   → collapse/expand (icons ↔ full)
function toggleSidebar() {
  // ≤768 = mobile/tablet slide-in overlay; ≥769 = desktop narrow rail ↔ expanded drawer
  const isMobile = window.innerWidth <= 768;
  const sb       = document.getElementById('sidebar');
  const overlay  = document.getElementById('sbOverlay');
  if (!sb) return;

  if (isMobile) {
    _sidebarOpen = !_sidebarOpen;
    sb.classList.toggle('open', _sidebarOpen);
    if (overlay) overlay.classList.toggle('show', _sidebarOpen);
    document.body.style.overflow = _sidebarOpen ? 'hidden' : '';
    if (_sidebarOpen) _dmPush();
  } else {
    // Desktop: default is YouTube-style narrow rail; toggle to expanded drawer
    document.body.classList.toggle('sidebar-expanded');
  }
}

// PURPOSE: Close sidebar (overlay tap / ESC / nav item click)
function closeSidebar() {
  const sb      = document.getElementById('sidebar');
  const overlay = document.getElementById('sbOverlay');
  _sidebarOpen  = false;
  if (sb)      sb.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
  document.body.style.overflow = '';
}

// PURPOSE: Sync bottom nav highlight when page changes
function syncBottomNav(pg) {
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
  const map = { home:'bn-home', dares:'bn-dares', accepted:'bn-accepted',
                profile:'bn-profile', leaderboard:'bn-leaderboard' };
  const el = map[pg] ? document.getElementById(map[pg]) : null;
  if (el) el.classList.add('active');
  if (window.innerWidth <= 768) closeSidebar();
}

// PURPOSE: Mobile search icon tap → go to dares page + focus search
function openMobileSearch() {
  _ovOpen('searchOverlay', '/search');
  const inp = document.getElementById('mSearchInput');
  if (inp){ inp.value = document.getElementById('searchInput')?.value || ''; setTimeout(()=>inp.focus(), 80); }
}
function closeMobileSearch() {
  const ov = document.getElementById('searchOverlay');
  if (ov && ov.classList.contains('open')) closeWalletModal('searchOverlay');
  const sw = document.querySelector('.search-wrap');
  if (sw) sw.classList.remove('mobile-open');   // legacy inline-expand cleanup
}
// Search page → run the normal search pipeline through the main input
function _mSearchGo(){
  const v = (document.getElementById('mSearchInput')?.value || '').trim();
  if (!v) return;
  const main = document.getElementById('searchInput'); if (main) main.value = v;
  closeWalletModal('searchOverlay');
  handleSearchImmediate();
}

// Patch goPage to also call syncBottomNav
(function() {
  const _orig = window.goPage;
  if (typeof _orig === 'function') {
    window.goPage = function(pg) { _orig(pg); syncBottomNav(pg); };
  }
})();

// Close mobile slide-in overlay when resizing up to desktop
window.addEventListener('resize', () => {
  if (window.innerWidth >= 769) closeSidebar();
});

// ESC closes sidebar
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSidebar();
});


// ═══════ ENGAGEMENT STATE (exact from v20) ═══════
let isGuestMode   = false;
let guestTimer    = null;
let guestInterval = null;
let guestEndTime  = 0;
let notifications   = [];
let notifUnread     = 0;
let notifUnsub      = null;
let activeProof     = null;
let commentsProofId = null;
let commentsCache   = {};
let replyingToCommentId = null;   // video-detail: comment being replied to
let shortsReplyingTo    = null;   // shorts: comment being replied to
let searchType      = 'dares';
let searchDebounceTimer = null;
let activeExpTab    = 'all';
const GUEST_ACTION_MSGS = {
  post:        { icon:'⚡', title:'Post Missions', msg:'Create a free account to set bounties and challenge others.' },
  accept:      { icon:'', title:'Accept Missions', msg:'Sign up to accept missions and earn real money.' },
  proof:       { icon:'', title:'Submit Proof', msg:'Create an account to submit video proof and claim your reward.' },
  profile:     { icon:'👤', title:'Your Profile', msg:'Sign up to build your profile, track earnings, and manage your wallet.' },
  accepted:    { icon:'✅', title:'Accepted Missions', msg:'Create an account to track and manage the missions you have accepted.' },
  leaderboard: { icon:'', title:'Leaderboard', msg:'Join to see top earners and compete for the highest rewards.' },
  default:     { icon:'🔐', title:'Create a free account', msg:'Sign up to unlock all features — post missions, accept challenges, and earn money.' },
};
const GUEST_BLOCKED_PAGES = ['profile', 'accepted'];
const COMMENT_MILESTONES = [1,5,10,100,1000,10000,100000];
const LIKE_MILESTONES    = [1,5,10,100,1000,10000,100000];
const VIEW_MILESTONES    = [1000,2000,10000,50000,100000];

// ═══════ ENGAGEMENT FUNCTIONS ═══════
function _findProof(proofId){
  return (typeof allProofs!=='undefined' && allProofs.find(x=>x.id===proofId))
      || (typeof homeProofs!=='undefined' && homeProofs.find(x=>x.id===proofId)) || null;
}
// Send a "Congratulations" milestone notification at most ONCE per milestone.
// Tracks sent milestones in proof.milestonesSent (e.g. { like_5:true, view_1000:true }).
async function _checkMilestone(proofId, kind, newCount, milestones){
  const p = _findProof(proofId);
  if (!p || !p.takerId || p.takerId === user?.uid) return;
  const sent = p.milestonesSent || (p.milestonesSent = {});
  const newly = milestones.filter(m => newCount >= m && !sent[kind+'_'+m]);
  if (!newly.length) return;
  const m = Math.max(...newly);                 // notify for the highest newly-reached milestone
  sent[kind+'_'+m] = true;
  db.collection('proofs').doc(proofId).update({ ['milestonesSent.'+kind+'_'+m]: true }).catch(()=>{});
  const noun = kind==='like' ? 'likes' : kind==='comment' ? 'comments' : 'views';
  await _sendNotification(p.takerId, kind+'_milestone', '🎉 Congratulations!',
    `Your video "${(p.dareTitle||'').slice(0,30)}" reached ${m.toLocaleString('en-IN')} ${noun}!`, proofId);
}
async function _checkCommentMilestone(proofId,newCount){ await _checkMilestone(proofId,'comment',newCount,COMMENT_MILESTONES); }
async function _checkLikeMilestone(proofId,newCount){    await _checkMilestone(proofId,'like',   newCount,LIKE_MILESTONES); }
async function _checkViewMilestone(proofId,newCount){    await _checkMilestone(proofId,'view',   newCount,VIEW_MILESTONES); }

function _clearGuestSession() {
  if (guestTimer)    { clearTimeout(guestTimer);    guestTimer    = null; }
  if (guestInterval) { clearInterval(guestInterval); guestInterval = null; }
}

let _searchReturn = null; // where to go back to after a search
function _doSearch(q) {
  // Remember where the user was so search gets a "back" — a dare they were
  // viewing, else the page they were on.
  if (!_searchReturn) {
    const ddOpen = document.getElementById('dareDetailOverlay')?.classList.contains('open');
    if (ddOpen && _ddCurrentId) _searchReturn = { dareId: _ddCurrentId };
    else { const ap = document.querySelector('.page.active'); _searchReturn = { page: ap ? ap.id.replace(/^page/,'').toLowerCase() : 'home' }; }
  }
  if (typeof _closeDetailOverlays === 'function') _closeDetailOverlays();
  // Show dares page as search results container
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el=document.getElementById('pageDares'); if(el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const nav=document.getElementById('nav-dares'); if(nav) nav.classList.add('active');
  if (typeof syncBottomNav === 'function') syncBottomNav('dares');
  const feed=document.getElementById('daresPageFeed');

  const typeBar=`
    <button class="search-back-btn" onclick="_searchBack()"><span class="mi">arrow_back</span> Back</button>
    <div class="search-type-bar">
      <button class="search-type-btn ${searchType==='dares'?'active':''}" onclick="setSearchType('dares')">
        <span class="mi">bolt</span> Missions
      </button>
      <button class="search-type-btn ${searchType==='videos'?'active':''}" onclick="setSearchType('videos')">
        <span class="mi">play_circle</span> Videos
      </button>
    </div>`;

  if (searchType==='dares') {
    const results   = _scoredSearch(dares, q, ['caption','title','description','desc'], ['tags','cat']);
    const active    = results.filter(d=>!d.completed);
    const completed = results.filter(d=>d.completed);
    if (!results.length) {
      feed.innerHTML=typeBar+`<div class="empty"><span class="mi">search_off</span><div class="empty-title">No missions for "${escHtml(q)}"</div><p class="empty-desc">Try searching Videos tab</p></div>`;
    } else {
      let html=typeBar+`<div style="font-size:12px;color:var(--t3);margin-bottom:14px;padding:0 4px;">${results.length} dare${results.length!==1?'s':''} for "<strong style="color:var(--t1);">${escHtml(q)}</strong>"</div>`;
      if (active.length)    html+=`<div class="search-section-label">Active (${active.length})</div><div class="active-dare-grid">${active.map(d=>_searchDareCard(d)).join('')}</div>`;
      if (completed.length) html+=`<div class="search-section-label" style="color:var(--t3);">Completed (${completed.length})</div><div class="active-dare-grid">${completed.map(d=>_searchDareCard(d)).join('')}</div>`;
      feed.innerHTML=html;
    }
  } else {
    const pool    = allProofs.length?allProofs:homeProofs;
    const results = _scoredSearch(pool, q, ['dareTitle','takerName','note'], ['cat']);
    if (!results.length) {
      feed.innerHTML=typeBar+`<div class="empty"><span class="mi">search_off</span><div class="empty-title">No videos for "${escHtml(q)}"</div><p class="empty-desc">Try Missions tab instead</p></div>`;
    } else {
      feed.innerHTML=typeBar+`<div style="font-size:12px;color:var(--t3);margin-bottom:14px;padding:0 4px;">${results.length} video${results.length!==1?'s':''} for "<strong style="color:var(--t1);">${escHtml(q)}</strong>"</div>`+_mixedVideoFeedHtml(results,'No videos');
    }
  }
  _trackSearch(q);
}

function _explorerDareCard(d) {
  return _activeDareCard(d);
}

function _explorerVideoCard(p) {
  const cat=p.cat||'fitness';const color=CAT_C[cat]||'#1a73e8';const icon=CAT_I[cat]||'bolt';
  const dur=p.videoDuration?(p.videoDuration>=60?Math.floor(p.videoDuration/60)+':'+String(p.videoDuration%60).padStart(2,'0'):p.videoDuration+'s'):'';
  return `<div class="yt-card" onclick="openVideo('${p.id}')">
    <div class="yt-thumb">
      ${vidThumb(p,480)?`<img src="${vidThumb(p,480)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;"/>`:`<div class="yt-thumb-bg"><span class="mi">${icon}</span></div>`}
      <div class="yt-play-over"><span class="mi">play_circle</span></div>
      <div class="yt-bounty">$${(p.dareBounty||0).toLocaleString('en-IN')}</div>
      ${dur?`<div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.8);color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;">${dur}</div>`:''}
    </div>
    <div class="yt-info">
      <div class="yt-av">${_avHtml(p.takerPhotoURL, p.takerName)}</div>
      <div class="yt-meta">
        <div class="yt-title">${escHtml(p.dareTitle||'Mission Video')}</div>
        <div class="yt-sub"><span>@${escHtml(p.takerUsername||p.takerName||'creator')}</span><span class="yt-dot"></span><span>${(p.viewCount||0).toLocaleString('en-IN')} views</span><span class="yt-dot"></span><span>${_relTime(p)}</span></div>
      </div>
    </div>
  </div>`;
}

// Mixed video list → longs in a 16:9 grid, shorts in a 9:16 row below (clean separation)
function _mixedVideoFeedHtml(arr, emptyMsg) {
  const longs  = (arr||[]).filter(p => !_isShortVideo(p));
  const shorts = (arr||[]).filter(p =>  _isShortVideo(p));
  let html = '';
  if (longs.length)  html += `<div class="feed-longs">${longs.map(_longCardHtml).join('')}</div>`;
  if (shorts.length) html += _shortsRowHtml(shorts);
  return html || `<div class="exp-empty">${emptyMsg||'Nothing here yet'}</div>`;
}

function _hideSuggestions() { const el=document.getElementById('searchSuggestions'); if(el) el.style.display='none'; }

function _notifColor(type){const m={like_milestone:'#FF453A',comment_milestone:'#0A84FF',view_milestone:'#32D74B',dare_accepted:'#FF9F0A',proof_submitted:'#BF5AF2',proof_approved:'#32D74B',proof_rejected:'#FF453A',wallet_credit:'#32D74B',wallet_debit:'#FF453A'};return m[type]||'#8E8E93';}

function _notifIcon(type){const m={like_milestone:'favorite',comment_milestone:'chat',view_milestone:'visibility',dare_accepted:'bolt',proof_submitted:'video_call',proof_approved:'check_circle',proof_rejected:'cancel',wallet_credit:'account_balance_wallet',wallet_debit:'account_balance_wallet'};return m[type]||'notifications';}

async function _notifyDareAccepted(dare,takerName){if(!dare.creatorUid||dare.creatorUid===user?.uid)return;await _sendNotification(dare.creatorUid,'dare_accepted',`⚡ ${takerName} accepted your dare!`,`"${(dare.caption||dare.title||'').slice(0,30)}" has a new taker.`,dare.id);}

async function _notifyProofSubmitted(dare,takerName){if(!dare.creatorUid||dare.creatorUid===user?.uid)return;await _sendNotification(dare.creatorUid,'proof_submitted',`🎥 Proof submitted!`,`${takerName} submitted proof for "${(dare.caption||dare.title||'').slice(0,30)}".`,dare.id);}

function _onGuestExpired() {
  _clearGuestSession();
  isGuestMode = false;
  // Blur app content
  document.getElementById('appScreen').style.filter = 'blur(4px) brightness(.6)';
  document.getElementById('appScreen').style.pointerEvents = 'none';
  showGuestPrompt({
    icon:  '⏰',
    title: 'Your guest session has ended',
    msg:   'Your 15-minute preview is over. Create a free account to keep using Mission Market — it only takes 10 seconds!',
  }, false); // false = NOT dismissible
}

function _renderComments(comments) {
  const el=document.getElementById('vdComments');
  if(!comments || !comments.length){el.innerHTML='<div class="vd-no-comments"><span class="mi">chat_bubble_outline</span><div>No comments yet — be the first!</div></div>';return;}
  const tops = comments.filter(c => !c.parentId);
  const byParent = {};
  comments.forEach(c => { if (c.parentId) (byParent[c.parentId] = byParent[c.parentId]||[]).push(c); });
  el.innerHTML = tops.map(c => _vdCommentHtml(c, byParent[c.id]||[])).join('');
}
function _vdCommentHtml(c, replies) {
  const liked = (c.likedBy||[]).includes(user?.uid);
  const acts = `<div class="vd-comment-acts">
    <button class="cmt-act ${liked?'liked':''}" onclick="likeComment('${c.id}')"><span class="mi">thumb_up</span>${(c.likeCount||0)>0?' '+_fmtCount(c.likeCount):''}</button>
    <button class="cmt-act" onclick="startReply('${c.id}','${escHtml((c.userName||'').replace(/'/g,''))}')">Reply</button>
  </div>`;
  return `<div class="vd-comment">
    <div class="vd-comment-av">${_avHtml(c.userPhotoURL, c.userName)}</div>
    <div class="vd-comment-body">
      <div class="vd-comment-author">${escHtml(c.userName||'—')}<span class="vd-comment-time">${c.createdAt&&c.createdAt.toDate?_timeAgo(c.createdAt.toDate()):''}</span></div>
      <div class="vd-comment-text">${escHtml(c.text||'')}</div>
      ${acts}
      ${replies.length?`<div class="vd-replies">${replies.map(r=>_vdReplyHtml(r)).join('')}</div>`:''}
    </div>
  </div>`;
}
function _vdReplyHtml(c) {
  const liked = (c.likedBy||[]).includes(user?.uid);
  return `<div class="vd-comment vd-reply">
    <div class="vd-comment-av">${_avHtml(c.userPhotoURL, c.userName)}</div>
    <div class="vd-comment-body">
      <div class="vd-comment-author">${escHtml(c.userName||'—')}<span class="vd-comment-time">${c.createdAt&&c.createdAt.toDate?_timeAgo(c.createdAt.toDate()):''}</span></div>
      <div class="vd-comment-text">${escHtml(c.text||'')}</div>
      <div class="vd-comment-acts">
        <button class="cmt-act ${liked?'liked':''}" onclick="likeComment('${c.id}')"><span class="mi">thumb_up</span>${(c.likeCount||0)>0?' '+_fmtCount(c.likeCount):''}</button>
      </div>
    </div>
  </div>`;
}
// Like/unlike a comment (works for both video-detail & shorts; updates whichever list is cached)
async function likeComment(commentId) {
  if (!user) { showToast('Sign in to like'); return; }
  const lists = [commentsCache[commentsProofId], _shortsComments];
  let c = null;
  for (const l of lists) { if (l) { const f = l.find(x=>x.id===commentId); if (f) { c = f; break; } } }
  if (!c) return;
  c.likedBy = c.likedBy || [];
  const liked = c.likedBy.includes(user.uid);
  if (liked) { c.likedBy = c.likedBy.filter(u=>u!==user.uid); c.likeCount = Math.max(0,(c.likeCount||0)-1); }
  else { c.likedBy.push(user.uid); c.likeCount = (c.likeCount||0)+1; }
  // Re-render whichever view is open
  if (commentsCache[commentsProofId]) _renderComments(commentsCache[commentsProofId]);
  if (_shortsComments && _shortsCommentsProofId) _renderShortsCommentsList();
  try {
    await db.collection('comments').doc(commentId).update({
      likedBy:  liked ? firebase.firestore.FieldValue.arrayRemove(user.uid) : firebase.firestore.FieldValue.arrayUnion(user.uid),
      likeCount: firebase.firestore.FieldValue.increment(liked ? -1 : 1)
    });
  } catch(e) {}
}
function startReply(commentId, userName) {
  replyingToCommentId = commentId;
  const bar = document.getElementById('vdReplyBar');
  const nm  = document.getElementById('vdReplyName');
  if (nm) nm.textContent = '@' + userName;
  if (bar) bar.style.display = 'flex';
  const inp = document.getElementById('vdCommentInput'); if (inp) inp.focus();
}
function cancelReply() {
  replyingToCommentId = null;
  const bar = document.getElementById('vdReplyBar'); if (bar) bar.style.display = 'none';
}

function _renderNotifications() {
  const el=document.getElementById('notifList'); if(!el) return;
  if (!notifications.length){el.innerHTML=`<div class="notif-empty"><span class="mi">notifications_none</span><div>No notifications yet</div></div>`;return;}
  el.innerHTML=notifications.map(n=>`
    <div class="notif-item ${n.read?'':'unread'}">
      <div class="notif-icon" style="background:${_notifColor(n.type)}18;"><span class="mi" style="color:${_notifColor(n.type)};font-size:18px;">${_notifIcon(n.type)}</span></div>
      <div class="notif-body">
        <div class="notif-title">${escHtml(n.title||'')}</div>
        <div class="notif-msg">${escHtml(n.message||'')}</div>
        <div class="notif-time">${n.createdAt?_timeAgo(n.createdAt.toDate()):''}</div>
      </div>
      ${!n.read?'<div class="notif-dot"></div>':''}
    </div>`).join('');
}

function _vdRelLongCard(p){
  const cat=p.cat||'fitness';const color=CAT_C[cat]||'#717171';const t=vidThumb(p,320);
  const badge=`<span class="dd-rel-badge">$${(p.dareBounty||0).toLocaleString('en-IN')}</span>`;
  const thumb = t
    ? `<div class="dd-rel-thumb"><img src="${t}" loading="lazy" decoding="async"/>${badge}</div>`
    : `<div class="dd-rel-thumb dd-rel-thumb-bg" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};">play_circle</span>${badge}</div>`;
  return `<div class="dd-rel-card" onclick="openVideo('${p.id}')">${thumb}
    <div class="dd-rel-title">${escHtml(p.dareTitle||'Mission Video')}</div>
    <div class="dd-rel-meta">${escHtml(p.takerName||'—')}</div>
    <div class="dd-rel-meta">${_fmtCount(p.viewCount||0)} views · ${_relTime(p)}</div></div>`;
}
function _vdRelShortCard(p){
  const cat=p.cat||'fitness';const color=CAT_C[cat]||'#717171';const t=vidThumb(p,240);
  const inner = t ? `<img src="${t}" loading="lazy" decoding="async"/>` : `<div class="dd-rel-short-bg" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};">play_circle</span></div>`;
  return `<div class="dd-rel-short" onclick="openVideo('${p.id}')">
    <div class="dd-rel-short-thumb">${inner}<span class="dd-rel-badge">$${(p.dareBounty||0).toLocaleString('en-IN')}</span></div>
    <div class="dd-rel-short-title">${escHtml(p.dareTitle||'')}</div>
    <div class="dd-rel-short-meta">${_fmtCount(p.viewCount||0)} views · ${_relTime(p)}</div></div>`;
}
// Related column = mobile-home-style feed: long 16:9 cards + a horizontal Shorts row
function _renderRelatedVideos(currentProof) {
  const el=document.getElementById('vdRelated'); if(!el) return;
  const pool=[...homeProofs,...allProofs].filter((p,i,arr)=>arr.findIndex(x=>x.id===p.id)===i).filter(p=>p.id!==currentProof.id);
  let related=pool.filter(p=>p.cat===currentProof.cat||p.tags?.includes(currentProof.cat));
  if(related.length<4) related=pool;
  const shorts=related.filter(p=>_isShortVideo(p)).slice(0,10);
  const longs =related.filter(p=>!_isShortVideo(p)).slice(0,8);
  if(!shorts.length&&!longs.length){el.innerHTML='<div style="color:var(--t3);font-size:13px;">No related videos yet</div>';return;}
  let html = longs.length ? `<div class="feed-longs">${longs.map(_longCardHtml).join('')}</div>` : '';
  if(shorts.length){ html += _shortsRowHtml(shorts); }
  el.innerHTML=html;
}

async function _renderVideoDetail(p) {
  if(user){
    db.collection('proofs').doc(p.id).update({viewCount:firebase.firestore.FieldValue.increment(1)})
      .then(()=>{const n=(p.viewCount||0)+1;p.viewCount=n;const m=document.getElementById('vdMeta');if(m)m.textContent=`${n.toLocaleString('en-IN')} views · ${_relTime(p)}`;_checkViewMilestone(p.id,n,p.takerId,p.dareTitle);}).catch(()=>{});
  }
  // video src is set by openVideoDetail (after ad) — not here
  document.getElementById('vdTitle').textContent = p.dareTitle||'Mission Video';
  document.getElementById('vdMeta').textContent  = `${(p.viewCount||0).toLocaleString('en-IN')} views · ${_relTime(p)}`;
  // Bounty badge on the video (top-right) — $ prefixed, no expiry
  const bb=document.getElementById('vdBountyBadge'); if(bb) bb.textContent='$'+(p.dareBounty||0).toLocaleString('en-IN');
  // Creator + Taker dual profiles
  const _dare = (typeof dares!=='undefined') ? dares.find(x=>x.id===p.dareId) : null;
  const creatorName = (_dare?.creator || p.posterName || 'creator');
  const creatorUser = (_dare?.creatorUsername || creatorName).toLowerCase().replace(/[^a-z0-9_.]/g,'');
  const creatorId = _dare?.creatorUid || p.posterId || '';
  const takerUser = (p.takerUsername || p.takerName || 'taker');
  document.getElementById('vdTakerAv').innerHTML   = _avHtml(p.takerPhotoURL, p.takerName||'T');
  document.getElementById('vdCreatorAv').innerHTML = _avHtml(_dare?.creatorPhotoURL || p.posterPhotoURL, creatorName);
  document.getElementById('vdCreatorName').textContent = '@'+creatorUser;
  document.getElementById('vdTakerName').textContent = '@'+takerUser;
  // tap creator / taker → open their public profile
  const _bindProf=(ids,uid)=>{ if(!uid) return; ids.forEach(id=>{ const e=document.getElementById(id);
    if(e){ e.style.cursor='pointer'; e.onclick=ev=>{ ev.stopPropagation(); openPublicProfile(uid); }; } }); };
  _bindProf(['vdCreatorAv','vdCreatorName'], creatorId);
  _bindProf(['vdTakerAv','vdTakerName'], p.takerId);
  document.getElementById('vdBounty').textContent  = `$${(p.dareBounty||0).toLocaleString('en-IN')} bounty won`;
  // Follow the video's taker (hidden on your own video)
  const fb=document.getElementById('vdFollowBtn');
  if(fb){ fb.style.display=''; fb.onclick=function(e){ e.stopPropagation(); openCollabModal(); }; } // opens the box with both ids + per-id follow
  // Stash ids for collab modal
  const cm = document.getElementById('collabModal');
  if (cm) { cm.dataset.creatorId = creatorId; cm.dataset.takerId = p.takerId||''; }
  const ov = document.getElementById('videoDetailOverlay');
  ov.dataset.creatorName='@'+creatorUser; ov.dataset.takerName='@'+takerUser;
  ov.dataset.creatorAv=creatorName[0].toUpperCase(); ov.dataset.takerAv=(p.takerName||'T')[0].toUpperCase();
  ov.dataset.creatorPhoto=(_dare?.creatorPhotoURL||p.posterPhotoURL||''); ov.dataset.takerPhoto=(p.takerPhotoURL||'');
  // Description + rules + tags (column 2 — hidden until "Description & rules")
  const _d = _dare || {};
  const desc = p.description || _d.description || _d.desc || '';
  document.getElementById('vdDesc').innerHTML = `<div class="dd-sec-label">Description</div><p class="dd-desc-text"${desc?'':' style="color:var(--t3)"'}>${desc?escHtml(desc):'No description.'}</p>`;
  const rules = (_d.rules||[]).filter(r=>r&&r.trim());
  document.getElementById('vdRules').innerHTML = rules.length ? `<div class="dd-sec-label">Rules</div>${rules.map(r=>`<div class="dd-rule">• ${escHtml(r)}</div>`).join('')}` : '';
  const vrb=document.getElementById('vdRulesBar'); if(vrb) vrb.style.display = rules.length?'':'none';
  const tags=(_d.tags&&_d.tags.length)?_d.tags:[p.cat||'dare'];
  document.getElementById('vdTags').innerHTML = tags.map(t=>`<span class="dd-tag-link" onclick="searchTag('${(''+t).replace(/[\\'"<>]/g,'')}')">#${escHtml(t)}</span>`).join('');
  // Like / dislike
  _updateLikeBtn(p.id,p.likeCount||0);
  _vdUpdateDislikeUI(p);
  // Shared comment-box input avatar
  const vdAv=document.getElementById('ddInputAv');
  if(vdAv){if(user?.picture)vdAv.innerHTML=`<img src="${user.picture}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="av"/>`;else if(user)vdAv.textContent=user.name[0].toUpperCase();}
  // Comments use the shared box (proofId = proof.id)
  _ddCurrentId = p.id;
  _ddCanPin = (p.takerId === user?.uid) || (creatorId === user?.uid); // taker AND creator can pin
  loadDareTopComment(p.id, { previewEl:'vdTopComment', countEl:'vdCommentCount', host:'videoDetailOverlay' });
  _renderRelatedVideos(p);
}
function _vdUpdateDislikeUI(p){
  const btn=document.getElementById('vdDislikeBtn'); if(!btn) return;
  const disliked = user && (p.dislikedBy||[]).includes(user.uid);
  btn.classList.toggle('liked', !!disliked);
  const c=document.getElementById('vdDislikeCount'); if(c) c.textContent=_fmtCount(p.dislikeCount||0);
}
async function dislikeProof(){
  if(!user){ showToast('Sign in to dislike'); return; }
  const p=activeProof; if(!p) return;
  p.dislikedBy=p.dislikedBy||[]; const d=p.dislikedBy.includes(user.uid);
  if(d){ p.dislikedBy=p.dislikedBy.filter(u=>u!==user.uid); p.dislikeCount=Math.max(0,(p.dislikeCount||0)-1); }
  else { p.dislikedBy.push(user.uid); p.dislikeCount=(p.dislikeCount||0)+1; }
  _vdUpdateDislikeUI(p);
  db.collection('proofs').doc(p.id).update({ dislikedBy:d?firebase.firestore.FieldValue.arrayRemove(user.uid):firebase.firestore.FieldValue.arrayUnion(user.uid), dislikeCount:firebase.firestore.FieldValue.increment(d?-1:1) }).catch(()=>{});
  // mutually exclusive: a new dislike clears an existing like
  if(!d && userLikes.includes(p.id)){
    userLikes=userLikes.filter(id=>id!==p.id);
    p.likeCount=Math.max(0,(p.likeCount||0)-1);
    db.collection('proofs').doc(p.id).update({likeCount:firebase.firestore.FieldValue.increment(-1)}).catch(()=>{});
    db.collection('users').doc(user.uid).update({likedProofs:userLikes}).catch(()=>{});
    _updateLikeBtn(p.id, p.likeCount);
  }
}
function _vdReport(){
  if(!activeProof) return;
  document.querySelectorAll('#videoDetailOverlay .dd-action-menu.open').forEach(m=>m.classList.remove('open'));
  openReportModal('video', activeProof.id, activeProof.dareTitle||'this video');
}
// Description/rules toggle — desktop reveals the middle column (3 cols); mobile = drawer
function toggleVideoDesc(){
  const ov=document.getElementById('videoDetailOverlay'); if(!ov) return;
  if(window.innerWidth<=768){ ov.querySelector('.dd-col2')?.classList.toggle('open'); }
  else { ov.classList.toggle('vd-show-desc'); }
}
function closeVideoDesc(){
  const ov=document.getElementById('videoDetailOverlay'); if(!ov) return;
  ov.querySelector('.dd-col2')?.classList.remove('open'); ov.classList.remove('vd-show-desc');
}
// Scroll-to-top for the video page
function _vdScroller(){ const ov=document.getElementById('videoDetailOverlay'); if(!ov) return null; if(window.innerWidth>=769){ const c=ov.querySelector('.dd-col1'); if(c) return c; } return ov; }
function _vdScrollTop(){ const sc=_vdScroller(); if(sc) sc.scrollTo({top:0,behavior:'smooth'}); }
function _vdBindScroll(){ const sc=_vdScroller(); const btn=document.getElementById('vdScrollTop'); if(!sc) return; const on=()=>{ if(btn) btn.classList.toggle('show', sc.scrollTop>500); }; if(sc._vdSH) sc.removeEventListener('scroll',sc._vdSH); sc._vdSH=on; sc.addEventListener('scroll',on); if(btn) btn.classList.remove('show'); }

function _scoredSearch(items,q,textFields,tagFields) {
  return items.map(item=>{
    let score=0;
    textFields.forEach((field,i)=>{
      const val=(item[field]||'').toLowerCase();
      if (val===q) score+=20; else if (val.startsWith(q)) score+=10; else if (val.includes(q)) score+=(textFields.length-i)*3;
    });
    tagFields.forEach(field=>{
      const tags=Array.isArray(item[field])?item[field]:[item[field]||''];
      tags.forEach(t=>{ if((t||'').toLowerCase()===q) score+=15; else if((t||'').toLowerCase().includes(q)) score+=5; });
    });
    return {...item,_score:score};
  }).filter(item=>item._score>0).sort((a,b)=>b._score-a._score);
}

function _searchDareCard(d) {
  return _activeDareCard(d);
}

async function _sendNotification(toUserId,type,title,message,refId=''){
  if(!toUserId) return;
  try{await db.collection('notifications').add({toUserId,type,title,message,refId,read:false,createdAt:firebase.firestore.Timestamp.now()});}
  catch(e){console.log('Notif error:',e);}
}

function _setTopbarMode(mode) {
  const guestEl   = document.getElementById('guestTopbarEl');
  const loggedEl  = document.getElementById('loggedInTopbarEl');
  const postBtn   = document.getElementById('btnPostTop');
  if (mode === 'guest') {
    if (guestEl)  guestEl.style.display  = 'flex';
    if (loggedEl) loggedEl.style.display = 'none';
  } else {
    if (guestEl)  guestEl.style.display  = 'none';
    if (loggedEl) loggedEl.style.display = 'flex';
    if (postBtn)  postBtn.style.display  = '';
  }
}

function _showSuggestions(q) {
  const suggestions=[]; const seen=new Set();
  dares.forEach(d=>{ const t=(d.caption||d.title||'').toLowerCase(); if(t.includes(q)&&!seen.has(t.slice(0,50))){suggestions.push({text:d.caption||d.title,type:'dare',icon:'bolt'});seen.add(t.slice(0,50));} });
  dares.forEach(d=>{ (d.tags||[]).forEach(tag=>{ if(tag.toLowerCase().includes(q)&&!seen.has('#'+tag)){suggestions.push({text:'#'+tag,type:'tag',icon:'tag'});seen.add('#'+tag);} }); });
  allProofs.forEach(p=>{ const t=(p.dareTitle||'').toLowerCase(); if(t.includes(q)&&!seen.has(t.slice(0,50))){suggestions.push({text:p.dareTitle,type:'video',icon:'play_circle'});seen.add(t.slice(0,50));} });
  if (!suggestions.length) { _hideSuggestions(); return; }
  const sugEl=document.getElementById('searchSuggestions'); if(!sugEl) return;
  sugEl.innerHTML=suggestions.slice(0,6).map(s=>`<div class="sug-item" onmousedown="applySuggestion('${escHtml(s.text.replace(/^#/,''))}')"><span class="mi" style="font-size:14px;color:var(--t4);">${s.icon}</span><span>${escHtml(s.text)}</span><span class="sug-type">${s.type}</span></div>`).join('');
  sugEl.style.display='block';
}

function _startGuestCountdown() {
  _clearGuestSession(); // clear any existing interval
  guestInterval = setInterval(() => {
    const left = Math.max(0, guestEndTime - Date.now());
    const mins = Math.floor(left / 60000);
    const secs = Math.floor((left % 60000) / 1000);
    const txt  = document.getElementById('guestTimerText');
    if (txt) txt.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    // Warning color at < 2 min
    const badge = document.getElementById('guestTimerBadge');
    if (badge) badge.classList.toggle('timer-warning', left < 2 * 60 * 1000);
    if (left === 0) clearInterval(guestInterval);
  }, 1000);
}

function _timeAgo(date){const s=Math.floor((new Date()-date)/1000);if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';return Math.floor(s/86400)+'d ago';}

function _trackSearch(q) {
  clearTimeout(_searchTrackTimer);
  _searchTrackTimer=setTimeout(async()=>{
    if(!q||q.length<2) return;
    const words=q.split(/\s+/).filter(w=>w.length>=2&&w.length<=20&&/^[a-z0-9]+$/.test(w));
    for (const word of words.slice(0,3)) {
      const ref=db.collection('searches').doc(word);
      db.runTransaction(async t=>{ const doc=await t.get(ref); if(doc.exists) t.update(ref,{count:firebase.firestore.FieldValue.increment(1)}); else t.set(ref,{term:word,count:1}); }).catch(()=>{});
    }
  },1500);
}

function _updateLikeBtn(proofId,count) {
  const isLiked=userLikes.includes(proofId);
  const btn=document.getElementById('vdLikeBtn'); const cntEl=document.getElementById('vdLikeCount');
  if(!btn) return;
  const mi=btn.querySelector('.mi'); if(mi){ mi.textContent='bolt'; mi.style.color=isLiked?'var(--blue)':''; }
  btn.classList.toggle('liked',isLiked);
  if(cntEl) cntEl.textContent=count.toLocaleString('en-IN');
}

function _updateNotifBadge() {
  const badge=document.getElementById('notifBadge'); if(!badge) return;
  if (notifUnread>0){badge.textContent=notifUnread>9?'9+':notifUnread;badge.style.display='flex';}
  else badge.style.display='none';
}

function _videoCardSearch(p) {
  const cat=p.cat||'fitness'; const color=CAT_C[cat]||'#1a73e8'; const icon=CAT_I[cat]||'bolt';
  const dur=p.videoDuration?(p.videoDuration>=60?Math.floor(p.videoDuration/60)+':'+String(p.videoDuration%60).padStart(2,'0'):p.videoDuration+'s'):'';
  return `<div class="yt-card" onclick="openVideo('${p.id}')">
    <div class="yt-thumb">
      ${vidThumb(p,480)?`<img src="${vidThumb(p,480)}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;display:block;"/>`:`<div class="yt-thumb-bg"><span class="mi">${icon}</span></div>`}
      <div class="yt-play-over"><span class="mi">play_circle</span></div>
      <div class="yt-bounty">$${(p.dareBounty||0).toLocaleString('en-IN')}</div>
      ${dur?`<div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.8);color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;">${dur}</div>`:''}
    </div>
    <div class="yt-info">
      <div class="yt-av">${_avHtml(p.takerPhotoURL, p.takerName)}</div>
      <div class="yt-meta">
        <div class="yt-title">${escHtml(p.dareTitle||'Mission Video')}</div>
        <div class="yt-sub"><span>@${escHtml(p.takerUsername||p.takerName||'creator')}</span><span class="yt-dot"></span><span>${(p.viewCount||0).toLocaleString('en-IN')} views</span><span class="yt-dot"></span><span>${_relTime(p)}</span></div>
      </div>
    </div>
  </div>`;
}

function applySuggestion(text) { document.getElementById('searchInput').value=text.replace(/^#/,''); _hideSuggestions(); handleSearchImmediate(); }

function closeGuestPrompt() {
  document.getElementById('guestPrompt').style.display = 'none';
}

function closeNotifPanel() { document.getElementById('notifPanel')?.classList.remove('open'); }

function closeVideoDetail() {
  document.getElementById('videoDetailOverlay').classList.remove('open');
  document.body.style.overflow='';
  document.body.classList.remove('detail-open');document.body.classList.remove('mission-detail');
  closeDareComments(); closeVideoDesc();
  _stopVdAd();   // kill any running pre-roll so it can't start the video in the background
  const player=document.getElementById('vdPlayer');
  if (activeProof && player && player.currentTime > 3 && !player.ended) _vdResumePos[activeProof.id] = player.currentTime;  // resume here on back
  player.pause(); player.removeAttribute('src'); player.load();
  activeProof=null;
}

// ════════════════════════════════════════════════════════════════════
//  ACTIVE DARE DETAIL PAGE — like / dislike / comment / report (2c)
// ════════════════════════════════════════════════════════════════════
let _ddCurrentId = null;

function openDareDetail(dareId){
  try{ _pvStop(); }catch(e){}
  const d = dares.find(x=>x.id===dareId);
  if (!d) { showToast('Mission not found'); return; }
  if (typeof _enterView === 'function') _enterView('dare', dareId);   // give it a URL + pause/close current
  if (typeof _searchReturn !== 'undefined') _searchReturn = null;
  _ddCurrentId = dareId;
  const cat = d.tags?.[0] || d.cat || 'fitness';
  const title = d.caption || d.title || 'Untitled Mission';
  const reward = d.rewardAmount ?? d.bounty ?? 0;
  const thumb = d.thumbnailURL || '';
  const color = CAT_C[cat] || '#FF2D4A', icon = CAT_I[cat] || 'bolt';

  document.getElementById('ddTopTitle').textContent = title;
  const ddTitleEl = document.getElementById('ddDareTitle'); if (ddTitleEl) ddTitleEl.textContent = title;

  // View count (increment once per open, like proofs)
  if (user) {
    db.collection('dares').doc(dareId).update({ viewCount: firebase.firestore.FieldValue.increment(1) }).catch(()=>{});
    d.viewCount = (d.viewCount||0) + 1;
  }

  // Expiry countdown → badge on the thumbnail (top-left)
  let expiryBadge = '';
  if (d.expiresAt){
    const exp = d.expiresAt.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt);
    const ms = exp - new Date();
    if (ms > 0){ const hrs = Math.floor(ms/3600000); expiryBadge = `<span class="dd-expiry-badge"><span class="mi">schedule</span>${hrs>=24 ? Math.floor(hrs/24)+'d' : hrs+'h'} left</span>`; }
  }
  const heroInner = thumb
    ? `<img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
    : `<div class="dd-hero-bg" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};font-size:72px;">${icon}</span></div>`;
  document.getElementById('ddHero').innerHTML = heroInner +
    `<span class="dd-bounty-badge">$${reward.toLocaleString('en-IN')}</span>` + expiryBadge;

  // Tags live below description+rules (col 2): always blue, click = search that tag
  document.getElementById('ddTags').innerHTML = (d.tags?.length ? d.tags : [cat])
    .map(t=>`<span class="dd-tag-link" onclick="searchTag('${(''+t).replace(/[\\'"<>]/g,'')}')">#${escHtml(t)}</span>`).join('');

  const ddMeta = `${_relTimeStr(d.date)} · ${_fmtCount(d.viewCount||0)} views`;
  const creatorPic = d.creatorPhotoURL || (d.creatorUid === user?.uid ? (user?.picture||'') : '');
  const _ddCu = d.creatorUid||'';
  document.getElementById('ddCreator').innerHTML = `
    <div class="dd-creator-av" style="cursor:pointer" onclick="openPublicProfile('${_ddCu}')">${_avHtml(creatorPic, d.creator)}</div>
    <div class="dd-creator-info" style="cursor:pointer" onclick="openPublicProfile('${_ddCu}')">
      <div class="dd-creator-name">${escHtml(d.creator||'Creator')}</div>
      <div class="dd-creator-sub">@${escHtml(d.creatorUsername || (d.creator||'creator'))}</div>
    </div>
    ${d.creatorUid !== user?.uid ? `<button class="shorts-follow dd-follow" onclick="toggleFollow('${_ddCu}','creator')">Follow</button>` : ''}
    <span class="dd-creator-meta">${ddMeta}</span>`;

  const desc = d.description || d.desc || '';
  document.getElementById('ddDesc').innerHTML = desc ? `<div class="dd-sec-label">Description</div><p class="dd-desc-text">${escHtml(desc)}</p>` : '';
  const rules = (d.rules||[]).filter(r=>r && r.trim());
  document.getElementById('ddRules').innerHTML = rules.length
    ? `<div class="dd-sec-label">Rules</div>${rules.map(r=>`<div class="dd-rule">• ${escHtml(r)}</div>`).join('')}` : '';
  const rulesBar = document.getElementById('ddRulesBar'); if (rulesBar) rulesBar.style.display = rules.length ? '' : 'none';

  document.getElementById('ddCta').innerHTML = _ddCtaHtml(d);
  _ddUpdateLikeUI(d);

  const av = document.getElementById('ddInputAv');
  if (user?.picture) av.innerHTML = `<img src="${user.picture}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="av"/>`;
  else if (user) av.textContent = user.name[0].toUpperCase();

  _ddCanPin = (d.creatorUid === user?.uid); // creator can pin on their dare
  loadDareTopComment(dareId);
  renderDareMore(dareId);

  const ov = document.getElementById('dareDetailOverlay');
  ov.classList.add('open');
  ov.scrollTop = 0;
  const col1 = ov.querySelector('.dd-col1'); if (col1) col1.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  document.body.classList.add('detail-open'); // makes the topbar opaque
  document.body.classList.add('mission-detail'); // mobile: immersive (hide app topbar, single back-bar)
  closeDareDetails();
  _ddBindScrollTop(); _ddBindSwipe();
}
function closeDareDetail(){
  document.getElementById('dareDetailOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.body.classList.remove('detail-open');document.body.classList.remove('mission-detail');
  closeDareComments(); closeDareDetails();
  _ddCurrentId = null;
}
// Mobile: description/rules/tags live in a drawer revealed by a left-swipe
function openDareDetails(){ document.querySelector('#dareDetailOverlay .dd-col2')?.classList.add('open'); }
function closeDareDetails(){ document.querySelector('#dareDetailOverlay .dd-col2')?.classList.remove('open'); }
let _ddTouchX=0, _ddTouchY=0, _ddTouchActive=false;
function _ddBindSwipe(){
  const ov = document.getElementById('dareDetailOverlay'); if (!ov || ov._ddSwipeBound) return;
  ov._ddSwipeBound = true;
  ov.addEventListener('touchstart', e=>{ if (window.innerWidth>768) return; const t=e.touches[0]; _ddTouchX=t.clientX; _ddTouchY=t.clientY; _ddTouchActive=true; }, {passive:true});
  ov.addEventListener('touchend', e=>{
    if (!_ddTouchActive || window.innerWidth>768) return; _ddTouchActive=false;
    const t=e.changedTouches[0]; const dx=t.clientX-_ddTouchX, dy=t.clientY-_ddTouchY;
    if (Math.abs(dx)<60 || Math.abs(dy)>Math.abs(dx)) return; // not a horizontal swipe
    const col2open = document.querySelector('#dareDetailOverlay .dd-col2.open');
    if (dx<0 && !col2open) openDareDetails();       // swipe left → open details
    else if (dx>0 && col2open) closeDareDetails();  // swipe right → close
  }, {passive:true});
}
// Which element actually scrolls? desktop = column 1; mobile = the overlay itself.
function _ddScroller(){
  const ov = document.getElementById('dareDetailOverlay'); if (!ov) return null;
  if (window.innerWidth >= 769){ const c = ov.querySelector('.dd-col1'); if (c) return c; }
  return ov;
}
function _ddBindScrollTop(){
  const sc = _ddScroller(); const btn = document.getElementById('ddScrollTop');
  const ov = document.getElementById('dareDetailOverlay');
  if (!sc) return;
  const onScroll = ()=>{
    if (btn) btn.classList.toggle('show', sc.scrollTop > 500);
    // Past the title → collapse it into the top bar (1 line) + show the 3-dots
    if (ov) ov.classList.toggle('dd-scrolled', sc.scrollTop > 140);
  };
  if (sc._ddScrollHandler) sc.removeEventListener('scroll', sc._ddScrollHandler);
  sc._ddScrollHandler = onScroll; sc.addEventListener('scroll', onScroll);
  if (btn) btn.classList.remove('show');
  if (ov) ov.classList.remove('dd-scrolled');
}
function _ddScrollTop(){
  const sc = _ddScroller(); if (sc) sc.scrollTo({ top:0, behavior:'smooth' });
}
// Close any open dare/video detail overlay so the underlying page (sidebar,
// search results, navigation) is visible & clickable — not stuck behind it.
function _closeDetailOverlays(){
  let closed = false;
  ['dareDetailOverlay','videoDetailOverlay'].forEach(id=>{
    const el = document.getElementById(id);
    if (el && el.classList.contains('open')){ el.classList.remove('open'); closed = true; }
  });
  // The shorts player is also a full page — close it on real navigation too
  const sh = document.getElementById('shortsOverlay');
  if (sh && sh.classList.contains('open')){ if (typeof closeShorts==='function') closeShorts(); closed = true; }
  if (closed){
    document.body.style.overflow = '';
    document.body.classList.remove('detail-open');document.body.classList.remove('mission-detail');
    if (typeof closeDareComments === 'function') closeDareComments();
    if (typeof _stopVdAd === 'function') _stopVdAd();   // kill any running pre-roll ad
    // Stop the long-video player (pause AND abort loading)
    const vp=document.getElementById('vdPlayer'); if(vp){ try{ vp.pause(); vp.removeAttribute('src'); vp.load(); }catch(e){} }
    // Navigating to a page → drop the view URL back to root
    if (!_navBack && /^\/(watch|shorts|dare)\//.test(location.pathname)){ try{ history.pushState({},'','/'); }catch(e){} }
    _ddCurrentId = null;
  }
}
// ── Phone BACK button: walk back through the pages you actually visited (don't
//    leave the site, don't jump to home). Each step pauses the page being left
//    so nothing keeps playing/loading in the background. ──
// ── URL routing (YouTube-style): every video/short/dare gets a real URL so
//    browser/phone back-forward work natively and links are shareable. ──
let _navBack = false;            // true while opening in response to a route (don't push a new URL)
let _routedInitial = false;      // deep-link handled?
let _deepLinkPath  = null;       // /watch|/shorts|/dare|/u path saved at boot — goPage('home') rewrites the URL to '/' before the data arrives
let _vdResumePos = {};           // proofId → seconds (resume long videos where you left)
function _dmPush(){ try{ history.pushState({dm:Date.now()},''); }catch(e){} }   // for sub-layers (comment box etc.)
function _pauseBackgroundMedia(){
  try{ const vp=document.getElementById('vdPlayer'); if(vp) vp.pause(); }catch(e){}
  document.querySelectorAll('#shortsSnapContainer video').forEach(v=>{ try{ v.pause(); }catch(e){} });
}
function _closeCurrentView(){
  const sh=document.getElementById('shortsOverlay');        if (sh && sh.classList.contains('open'))  { closeShorts(); return; }
  const vov=document.getElementById('videoDetailOverlay');  if (vov && vov.classList.contains('open')){ closeVideoDetail(); return; }
  const dov=document.getElementById('dareDetailOverlay');   if (dov && dov.classList.contains('open')){ closeDareDetail(); return; }
}
// Called at the START of openShorts / openVideoDetail / openDareDetail.
function _enterView(type, id){
  if (typeof closePublicProfile==='function') closePublicProfile();   // leaving for a video/dare → close public profile
  _pauseBackgroundMedia();
  _closeCurrentView();                              // close whatever's open (stops its video)
  if (!_navBack && id){
    try{ history.pushState({ dm:type, id }, '', '/'+type+'/'+encodeURIComponent(id)); }catch(e){}
  }
}
// Open whatever view the current URL points to (back/forward + deep links)
function _dmRouteFromUrl(){
  _navBack = true;
  const m = (location.pathname||'').match(/^\/(watch|shorts|dare|u)\/([^/?#]+)/);
  if (m){
    const id = decodeURIComponent(m[2]);
    if (m[1]==='watch')       openVideoDetail(id);
    else if (m[1]==='shorts') openShorts(id);
    else if (m[1]==='u')      openPublicProfile(id);
    else                      openDareDetail(id);
  } else {
    if (typeof closePublicProfile==='function') closePublicProfile();
    _closeCurrentView();                            // root / page URL → no overlay
    const pg = _URL_PAGE[(location.pathname||'/').replace(/\/+$/,'')||'/'];
    if (pg && pg !== _curPage) goPage(pg, true);     // sync page to URL (forward/back fallback)
  }
  _navBack = false;
}
// On cold load / refresh of a deep link, open it once the data is available
function _maybeInitialRoute(){
  if (_routedInitial) return;
  // boot rewrote the URL to '/' (goPage home) — route from the SAVED deep link
  const src = _deepLinkPath || (location.pathname||'');
  const m = src.match(/^\/(watch|shorts|dare|u)\/([^/?#]+)/);
  if (!m){ _routedInitial = true; return; }
  const id = decodeURIComponent(m[2]);
  const ready = (m[1]==='u') ? true                 // public profile fetches its own user doc
    : (m[1]==='dare') ? (dares||[]).some(d=>d.id===id)
    : [...(typeof homeProofs!=='undefined'?homeProofs:[]),...(typeof allProofs!=='undefined'?allProofs:[])].some(p=>p.id===id);
  if (ready){
    _routedInitial = true; _deepLinkPath = null;
    // open NORMALLY (not via _dmRouteFromUrl) so _enterView pushes the real
    // /watch|/shorts|/dare|/u URL on top of home — refresh restores the page,
    // and BACK from it lands on home
    if (m[1]==='watch')       openVideoDetail(id);
    else if (m[1]==='shorts') openShorts(id);
    else if (m[1]==='u')      openPublicProfile(id);
    else                      openDareDetail(id);
  }
}
// ════════════════════════════════════════════════════════════════════
//  BACK-BUTTON STACK (phase 1) — main task modals get their own history
//  entry, so the phone/browser BACK button closes ONE layer at a time
//  (YouTube-style) instead of leaving the whole page ("all back").
//  Tracked: Post Dare · Submit Proof · Settings flow · Deposit · Withdraw
//  · Edit Profile.  (Detail views / public profile already use URLs above.)
// ════════════════════════════════════════════════════════════════════
// Body scroll-lock while any page-modal is open (background must not scroll)
function _ovLock(){ document.body.classList.toggle('ov-open', _ovStack.length > 0); }
// Close every tracked overlay VISUALLY only (no history rewind) — caller fixes the URL
function _ovCloseAllSilent(){
  let closed = false;
  while(_ovStack.length){
    const id = _ovStack[_ovStack.length-1];
    _ovInPop = true; try{ _ovCloseById(id); }catch(e){} _ovInPop = false;
    _ovStack.pop(); closed = true;
  }
  _ovLock();
  return closed;
}
function _ovOpen(id, url){
  const el = document.getElementById(id); if(!el) return;
  el.classList.add('open');
  if(_ovStack.includes(id)) return;            // already tracked — don't double-push
  try{ _pauseAllMedia(true); }catch(e){}       // popup on top → pause everything behind it
  _ovStack.push(id);
  // stack order = paint order: tracked overlays share z-index 9500, so one opened
  // ON TOP of another painted UNDER it when it sat earlier in the DOM (bug: mobile
  // section pages opened beneath Post/Settings — tap looked like nothing happened)
  el.style.zIndex = String(9500 + _ovStack.length);
  _ovLock();
  try{ history.pushState({ _ov:id }, '', url || _MODAL_URL[id] || location.pathname); }catch(e){}
}
// Call at the TOP of a modal's close fn. Rewinds history to stay in sync when
// the modal is closed by UI/code (no-op when popstate already drove the close).
function _ovSync(id){
  if(_ovInPop) return;
  const i = _ovStack.lastIndexOf(id); if(i<0) return;
  const steps = _ovStack.length - i;           // this modal + anything stacked above
  _ovStack.length = i;
  _ovLock();
  _ovInPop = true;
  try{ history.go(-steps); }catch(e){ _ovInPop = false; }
  if(!_ovStack.length) setTimeout(_resumeBgMedia, 80);   // last popup gone → resume what it paused
}
// popstate-driven close (phone BACK) → run the modal's real close fn.
const _OV_CLOSERS = {
  postOverlay:          () => closePost(),
  proofOverlay:         () => closeProof(),
  profileEditOverlay:   () => cancelProfileEdit(),
  depositOverlay:       () => closeWalletModal('depositOverlay'),
  withdrawOverlay:      () => closeWalletModal('withdrawOverlay'),
  settingsOverlay:      () => { const e=document.getElementById('settingsOverlay'); if(e) e.classList.remove('open'); },
  // phase 2 — remaining popups (back closes one step; no shareable URL, they're contextual)
  photoViewer:          () => closePhotoViewer(),
  videoPlayOverlay:     () => closeVideoPlay(),
  reviewOverlay:        () => closeReview(),
  rejectOverlay:        () => closeRejectModal(),
  reportOverlay:        () => closeReportModal2(),
  adminReportsOverlay:  () => closeAdminReports(),
  selectTakersOverlay:  () => closeSelectTakersModal(),
  followListOverlay:    () => closeWalletModal('followListOverlay'),
  kycOverlay:           () => closeWalletModal('kycOverlay'),
  methodOverlay:        () => closeWalletModal('methodOverlay'),
  pinOverlay:           () => closeWalletModal('pinOverlay'),
  txnDetailOverlay:     () => closeWalletModal('txnDetailOverlay'),
  searchOverlay:        () => closeWalletModal('searchOverlay'),
  setSecOverlay:        () => closeSetSec(),
};
function _ovCloseById(id){
  const f = _OV_CLOSERS[id];
  if(f){ try{ f(); return; }catch(e){} }
  const el = document.getElementById(id); if(el) el.classList.remove('open');
}
// (Settings is now a single two-pane page — sections switch in-place via _setSec;
//  the old sub-screen overlays and their helpers are gone.)

// Click on the empty area around a page-modal's content column → close it (desktop)
document.addEventListener('click', (e)=>{
  const t = e.target;
  if (t && t.classList && t.classList.contains('as-page') && t.classList.contains('open')){
    _ovCloseById(t.id);
  }
});

// Open the page/modal that the URL points to (deep-link / refresh / address-bar visit)
function _bootRoute(){
  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(/^\/(watch|shorts|dare|u)\//.test(path)){
    _deepLinkPath = path;          // goPage('home') replaces the URL with '/' — save it first
    goPage('home'); return;        // → _maybeInitialRoute opens it once the data loads
  }
  const pg=_URL_PAGE[path];
  if(pg){ goPage(pg); return; }
  if(path==='/following'){ goPage('profile'); _ppFollowList('following'); return; }
  const mid=_URL_MODAL[path];
  if(mid){
    const base = path.startsWith('/wallet') ? 'wallet'
      : (path.startsWith('/profile') || path==='/followers') ? 'profile' : 'home';
    goPage(base); _openModalById(mid); return;
  }
  goPage('home');
}
function _openModalById(id){
  switch(id){
    case 'settingsOverlay':      openSettings(); break;
    case 'notifSettingsOverlay': openNotifSettings(); break;
    case 'moreSettingsOverlay':  openMoreSettings(); break;
    case 'profileEditOverlay':   openProfileEdit(); break;
    case 'postOverlay':          openPost(); break;
    case 'depositOverlay':       openDepositModal(); break;
    case 'withdrawOverlay':      openWithdrawModal(); break;
    case 'kycOverlay':           openKycModal(); break;
    case 'methodOverlay':        openMethodModal(); break;
    case 'adminReportsOverlay':  openAdminReports(); break;
    case 'followListOverlay':    _ppFollowList('followers'); break;
    case 'photoViewer':          _viewProfilePhoto(); break;
    case 'searchOverlay':        openMobileSearch(); break;
    // contextual — URL dikhta hai par refresh restore nahi (need a dare/proof/txn id):
    // proofOverlay, reviewOverlay, rejectOverlay, reportOverlay, selectTakersOverlay,
    // videoPlayOverlay, pinOverlay, txnDetailOverlay
  }
}

window.addEventListener('popstate', function(e){
  if(_ovInPop){ _ovInPop = false; return; }              // our own _ovSync rewind — already handled
  if(_ovStack.length){                                    // a tracked modal is open → close topmost
    const id = _ovStack[_ovStack.length-1];
    _ovInPop = true; _ovCloseById(id); _ovInPop = false;
    _ovStack.pop();
    _ovLock();
    if(!_ovStack.length) setTimeout(_resumeBgMedia, 80);  // last popup gone → resume what it paused
    return;
  }
  const isOpen = id => { const el=document.getElementById(id); return el && el.classList.contains('open'); };
  // close any open sub-layer first (keep a guard state)
  if (isOpen('ddCommentsBox')){ closeDareComments(); _dmPush(); return; }
  if (isOpen('shortsDetailsDrawer')){ shortsCloseDetails(); _dmPush(); return; }
  if (isOpen('collabModal')){ closeCollabModal(); _dmPush(); return; }
  if (typeof _sidebarOpen!=='undefined' && _sidebarOpen){ closeSidebar(); return; }
  if (e && e.state && e.state._page){ goPage(e.state._page, true); return; }   // back between main pages
  _dmRouteFromUrl();   // the URL is the source of truth — open/close to match it
});
// 3-dots on the dare actions row → Share / Report menu
function _ddToggleActionMenu(btn){
  const menu = btn.nextElementSibling; if (!menu) return;
  const open = menu.classList.contains('open');
  document.querySelectorAll('.dd-action-menu.open').forEach(m=>m.classList.remove('open'));
  if (!open) menu.classList.add('open');
}
// Click a #tag → run a search for that tag (return-context captured in _doSearch)
function searchTag(tag){
  const inp = document.getElementById('searchInput'); if (inp) inp.value = '#'+tag;
  try { searchType = 'dares'; } catch(e){}
  _doSearch(tag);
}
// "Back" from search results → reopen the dare you were on, else the page you left
function _searchBack(){
  const r = _searchReturn; _searchReturn = null;
  const inp = document.getElementById('searchInput'); if (inp) inp.value = '';
  _hideSuggestions();
  if (r && r.dareId && (dares||[]).some(d=>d.id===r.dareId)) { openDareDetail(r.dareId); return; }
  goPage((r && r.page) ? r.page : 'home');
}
function _ddReport(){
  const d = dares.find(x=>x.id===_ddCurrentId); if (!d) return;
  openReportModal('dare', _ddCurrentId, d.caption || d.title || 'this mission');
}
function _ddCtaHtml(d){
  const isMine = d.creatorUid === user?.uid;
  const myEntry = (acceptedDares||[]).find(a=>a.dareId===d.id);
  if (isMine) return `<button class="btn-yours" style="padding:11px 22px;border-radius:50px;width:auto;">Your Mission</button>`;
  if (myEntry){
    if (myEntry.proofStatus==='submitted' || myEntry.proofStatus==='approved')
      return `<button class="btn-proof-done" style="padding:11px 18px;border-radius:50px;"><span class="mi">check_circle</span>Submitted</button>`;
    if (myEntry.applicantStatus==='pending')
      return `<button class="btn-proof-done" style="padding:11px 18px;border-radius:50px;"><span class="mi">hourglass_empty</span>Applied</button>`;
    return `<button class="btn-proof" style="padding:11px 18px;border-radius:50px;" onclick="closeDareDetail();openProof('${d.id}')"><span class="mi">video_call</span>Submit Proof</button>`;
  }
  return `<button class="btn-accept" style="padding:11px 26px;border-radius:50px;" onclick="acceptDare('${d.id}')">${d.takerSelectionMode==='creator_picks'?'Apply':'Accept'}</button>`;
}
function _ddUpdateLikeUI(d){
  const liked = user && (d.likedBy||[]).includes(user.uid);
  const disliked = user && (d.dislikedBy||[]).includes(user.uid);
  document.getElementById('ddLikeBtn').classList.toggle('liked', !!liked);
  document.getElementById('ddDislikeBtn').classList.toggle('liked', !!disliked);
  document.getElementById('ddLikeCount').textContent = _fmtCount(d.likeCount||0);
  document.getElementById('ddDislikeCount').textContent = _fmtCount(d.dislikeCount||0);
}
async function likeDare(){
  if (!user) { showToast('Sign in to like'); return; }
  const d = dares.find(x=>x.id===_ddCurrentId); if (!d) return;
  d.likedBy = d.likedBy||[]; d.dislikedBy = d.dislikedBy||[];
  const liked = d.likedBy.includes(user.uid);
  const upd = {};
  if (liked){
    d.likedBy = d.likedBy.filter(u=>u!==user.uid); d.likeCount = Math.max(0,(d.likeCount||0)-1);
    upd.likedBy = firebase.firestore.FieldValue.arrayRemove(user.uid); upd.likeCount = firebase.firestore.FieldValue.increment(-1);
  } else {
    d.likedBy.push(user.uid); d.likeCount = (d.likeCount||0)+1;
    upd.likedBy = firebase.firestore.FieldValue.arrayUnion(user.uid); upd.likeCount = firebase.firestore.FieldValue.increment(1);
    if (d.dislikedBy.includes(user.uid)){ d.dislikedBy = d.dislikedBy.filter(u=>u!==user.uid); d.dislikeCount = Math.max(0,(d.dislikeCount||0)-1);
      upd.dislikedBy = firebase.firestore.FieldValue.arrayRemove(user.uid); upd.dislikeCount = firebase.firestore.FieldValue.increment(-1); }
  }
  _ddUpdateLikeUI(d);
  db.collection('dares').doc(d.id).update(upd).catch(()=>{});
}
async function dislikeDare(){
  if (!user) { showToast('Sign in to dislike'); return; }
  const d = dares.find(x=>x.id===_ddCurrentId); if (!d) return;
  d.likedBy = d.likedBy||[]; d.dislikedBy = d.dislikedBy||[];
  const disliked = d.dislikedBy.includes(user.uid);
  const upd = {};
  if (disliked){
    d.dislikedBy = d.dislikedBy.filter(u=>u!==user.uid); d.dislikeCount = Math.max(0,(d.dislikeCount||0)-1);
    upd.dislikedBy = firebase.firestore.FieldValue.arrayRemove(user.uid); upd.dislikeCount = firebase.firestore.FieldValue.increment(-1);
  } else {
    d.dislikedBy.push(user.uid); d.dislikeCount = (d.dislikeCount||0)+1;
    upd.dislikedBy = firebase.firestore.FieldValue.arrayUnion(user.uid); upd.dislikeCount = firebase.firestore.FieldValue.increment(1);
    if (d.likedBy.includes(user.uid)){ d.likedBy = d.likedBy.filter(u=>u!==user.uid); d.likeCount = Math.max(0,(d.likeCount||0)-1);
      upd.likedBy = firebase.firestore.FieldValue.arrayRemove(user.uid); upd.likeCount = firebase.firestore.FieldValue.increment(-1); }
  }
  _ddUpdateLikeUI(d);
  db.collection('dares').doc(d.id).update(upd).catch(()=>{});
}
// Dare comments reuse the comments collection (proofId = dareId).
// Top-liked first; if a comment has no likes, latest first. Replies nested
// (same sort). Desktop: show ALL. Mobile: top 1 + tap-anywhere/"View all", close btn.
let _ddComments = [];        // ALL comments for the current dare (top-level + replies)
let _ddReplyTo = null;       // comment id currently being replied to
let _ddReplyToName = '';     // name we're replying to (kept as @-prefix on the text)
let _ddCanPin = false;       // can the current user pin comments here? (dare creator / video taker)
// The comments box is shared between the dare page and the long-video page.
// These point it at the right preview element / host column for whichever is open.
let _ddPreviewElId = 'ddTopComment';
let _ddCountElId   = 'ddCommentCount';
let _ddHostOverlayId = 'dareDetailOverlay';
async function loadDareTopComment(dareId, opts){
  if (opts){ _ddPreviewElId = opts.previewEl||'ddTopComment'; _ddCountElId = opts.countEl||'ddCommentCount'; _ddHostOverlayId = opts.host||'dareDetailOverlay'; }
  else { _ddPreviewElId='ddTopComment'; _ddCountElId='ddCommentCount'; _ddHostOverlayId='dareDetailOverlay'; }
  const el = document.getElementById(_ddPreviewElId);
  if (el) el.innerHTML = '<div style="color:var(--t3);font-size:13px;padding:10px 0;">Loading...</div>';
  _ddReplyTo = null; _ddCancelReplyBar();
  try {
    const snap = await db.collection('comments').where('proofId','==',dareId).limit(120).get();
    _ddComments = snap.docs.map(doc=>({id:doc.id,...doc.data()}));
    _renderDareComments();
  } catch(e){ el.innerHTML = '<div style="color:var(--t3);font-size:13px;">Could not load comments</div>'; }
}
// Count of top-level comments → both the preview heading and the box header
function _ddUpdateCount(){
  const n = (_ddComments||[]).filter(c=>!c.parentId).length;
  const a = document.getElementById(_ddCountElId); if (a) a.textContent = _fmtCount(n);
  const b = document.getElementById('ddBoxCount'); if (b) b.textContent = _fmtCount(n);
}
// top-liked first; ties (or no likes) → latest first
function _ddSortComments(arr){
  arr.sort((a,b)=>{
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;   // pinned first
    const la=a.likeCount||a.likes||0, lb=b.likeCount||b.likes||0;
    if (lb!==la) return lb-la;
    const ta=(a.createdAt&&a.createdAt.seconds)||0, tb=(b.createdAt&&b.createdAt.seconds)||0;
    return tb-ta;
  });
  return arr;
}
async function pinDareComment(id){
  const c=(_ddComments||[]).find(x=>x.id===id); if(!c) return;
  document.querySelectorAll('#ddBoxList .cmt-menu.open').forEach(m=>m.classList.remove('open'));
  if (c.pinned){
    if (c.pinnedBy && c.pinnedBy !== user?.uid){ showToast("Only the person who pinned this can unpin it"); return; }
    c.pinned=false; c.pinnedBy=null;
    db.collection('comments').doc(id).update({ pinned:false, pinnedBy:firebase.firestore.FieldValue.delete() }).catch(()=>{});
  } else {
    c.pinned=true; c.pinnedBy=user?.uid||null;
    db.collection('comments').doc(id).update({ pinned:true, pinnedBy:user?.uid||null }).catch(()=>{});
  }
  _renderDareComments();
}
function _ddCommentHtml(c, replies){
  const liked = (c.likedBy||[]).includes(user&&user.uid);
  const likeN = c.likeCount||c.likes||0;
  const safeName = (c.userName||'').replace(/[\\'"<>]/g,'');
  // Creator AND taker can pin top-level comments — but only the person who pinned can unpin
  let pinItem = '';
  if (_ddCanPin && replies!==null){
    if (!c.pinned) pinItem = `<button onclick="event.stopPropagation();pinDareComment('${c.id}')"><span class="mi">push_pin</span> Pin</button>`;
    else if (c.pinnedBy === (user&&user.uid)) pinItem = `<button onclick="event.stopPropagation();pinDareComment('${c.id}')"><span class="mi">push_pin</span> Unpin</button>`;
  }
  const acts = `<div class="vd-comment-acts">
      <button class="cmt-act${liked?' liked':''}" onclick="event.stopPropagation();likeDareComment('${c.id}')"><span class="mi">thumb_up</span>${likeN>0?' '+_fmtCount(likeN):''}</button>
      <button class="cmt-act" onclick="event.stopPropagation();startDareReply('${c.id}','${safeName}')">Reply</button>
      <span class="cmt-more"><button class="cmt-3dots" onclick="event.stopPropagation();_ddToggleCmtMenu(this)"><span class="mi">more_vert</span></button>
        <span class="cmt-menu">${pinItem}<button onclick="event.stopPropagation();reportComment('${c.id}','${safeName}')"><span class="mi">flag</span> Report</button></span></span>
    </div>`;
  const pinBadge = (c.pinned && replies!==null) ? `<span class="cmt-pinned"><span class="mi">push_pin</span> Pinned</span>` : '';
  // Replies are HIDDEN by default behind a "Show N replies" toggle
  let repToggle = '', repHtml = '';
  if (replies && replies.length){
    repToggle = `<button class="cmt-reptoggle" onclick="event.stopPropagation();_ddToggleReplies('${c.id}',this)"><span class="mi">expand_more</span> Show ${replies.length} repl${replies.length>1?'ies':'y'}</button>`;
    repHtml = `<div class="vd-replies" id="reps-${c.id}" style="display:none;">${replies.map(r=>_ddCommentHtml(r,null)).join('')}</div>`;
  }
  return `<div class="vd-comment${replies===null?' vd-reply':''}${c.pinned&&replies!==null?' cmt-is-pinned':''}">
    <div class="vd-comment-av">${_avHtml(c.userPhotoURL, c.userName)}</div>
    <div class="vd-comment-body">
      ${pinBadge}
      <div class="vd-comment-author">${escHtml(c.userName||'—')}<span class="vd-comment-time">${c.createdAt&&c.createdAt.toDate?_timeAgo(c.createdAt.toDate()):''}</span></div>
      <div class="vd-comment-text">${escHtml(c.text||'')}</div>
      ${acts}${repToggle}${repHtml}
    </div></div>`;
}
function _ddToggleReplies(id, btn){
  const box = document.getElementById('reps-'+id); if (!box) return;
  const show = box.style.display === 'none';
  box.style.display = show ? '' : 'none';
  const n = box.children.length;
  btn.innerHTML = show
    ? '<span class="mi">expand_less</span> Hide replies'
    : `<span class="mi">expand_more</span> Show ${n} repl${n>1?'ies':'y'}`;
}
// Re-render both the col-1 preview AND (if open) the comments box
function _renderDareComments(){
  _ddUpdateCount();
  _renderDarePreview();
  if (document.getElementById('ddCommentsBox')?.classList.contains('open')) _renderDareCommentsBox();
}
// Preview shown in column 1: ONLY the top comment (no input, no replies, no actions)
function _ddPreviewHtml(c){
  return `<div class="vd-comment dd-preview-comment">
    <div class="vd-comment-av">${_avHtml(c.userPhotoURL, c.userName)}</div>
    <div class="vd-comment-body">
      <div class="vd-comment-author">${escHtml(c.userName||'—')}<span class="vd-comment-time">${c.createdAt&&c.createdAt.toDate?_timeAgo(c.createdAt.toDate()):''}</span></div>
      <div class="vd-comment-text">${escHtml(c.text||'')}</div>
    </div></div>`;
}
function _renderDarePreview(){
  const el = document.getElementById(_ddPreviewElId); if (!el) return;
  const tops = _ddSortComments((_ddComments||[]).filter(c=>!c.parentId));
  if (!tops.length){ el.innerHTML = '<div class="vd-no-comments"><span class="mi">chat_bubble_outline</span><div>No comments yet — be the first!</div></div>'; return; }
  el.innerHTML = _ddPreviewHtml(tops[0]) +
    `<button class="dd-viewall">View all ${tops.length} comment${tops.length!==1?'s':''}</button>`;
}
// Full list inside the scrollable comments box (with replies / like / reply / report)
function _renderDareCommentsBox(){
  const el = document.getElementById('ddBoxList'); if (!el) return;
  const all = _ddComments || [];
  const tops = _ddSortComments(all.filter(c=>!c.parentId));
  const byParent = {};
  all.forEach(c=>{ if(c.parentId){ (byParent[c.parentId]=byParent[c.parentId]||[]).push(c); } });
  Object.keys(byParent).forEach(k=>_ddSortComments(byParent[k]));
  if (!tops.length){ el.innerHTML = '<div class="vd-no-comments"><span class="mi">chat_bubble_outline</span><div>No comments yet — be the first!</div></div>'; return; }
  el.innerHTML = tops.map(c=>_ddCommentHtml(c, byParent[c.id]||[])).join('');
}
// Desktop: dock a floating box exactly over column 1 of the given overlay.
// Mobile: clear inline styles so the CSS bottom-sheet rules apply.
function _dockToCol1(boxEl, hostId, fullHeight){
  if (!boxEl) return;
  if (window.innerWidth >= 769){
    const col1 = document.querySelector('#'+hostId+' .dd-col1');
    if (col1){ const r = col1.getBoundingClientRect();
      const h = fullHeight ? `height:${r.height}px;` : `max-height:${r.height}px;`;
      boxEl.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;${h}right:auto;bottom:auto;margin:0;`;
    }
  } else { boxEl.style.cssText = ''; }
}
function openDareComments(){
  _renderDareCommentsBox();
  const box = document.getElementById('ddCommentsBox'); if (!box) return;
  box.classList.add('open');
  // Mobile + video page: the sheet sits just below the fixed video (doesn't cover it)
  box.classList.toggle('cbox-under-video', _ddHostOverlayId==='videoDetailOverlay');
  _dmPush();
  _dockToCol1(box.querySelector('.dd-cbox'), _ddHostOverlayId, true);
}
function closeDareComments(){
  const box = document.getElementById('ddCommentsBox'); if (box) box.classList.remove('open');
  cancelDareReply();
}
function _ddToggleCmtMenu(btn){
  const menu = btn.nextElementSibling; if (!menu) return;
  const open = menu.classList.contains('open');
  document.querySelectorAll('.cmt-menu.open').forEach(m=>m.classList.remove('open')); // any container (dd box / shorts)
  if (!open) menu.classList.add('open');
}
async function likeDareComment(commentId){
  if (!user){ showToast('Sign in to like'); return; }
  const c = (_ddComments||[]).find(x=>x.id===commentId); if (!c) return;
  c.likedBy = c.likedBy || [];
  const liked = c.likedBy.includes(user.uid);
  if (liked){ c.likedBy = c.likedBy.filter(u=>u!==user.uid); c.likeCount = Math.max(0,(c.likeCount||0)-1); }
  else { c.likedBy.push(user.uid); c.likeCount = (c.likeCount||0)+1; }
  _renderDareComments();
  try {
    await db.collection('comments').doc(commentId).update({
      likedBy: liked ? firebase.firestore.FieldValue.arrayRemove(user.uid) : firebase.firestore.FieldValue.arrayUnion(user.uid),
      likeCount: firebase.firestore.FieldValue.increment(liked?-1:1)
    });
  } catch(e){}
}
function startDareReply(commentId, userName){
  if (!user){ showToast('Sign in to reply'); return; }
  openDareComments();              // replies happen inside the box (input at bottom)
  _ddReplyTo = commentId; _ddReplyToName = userName || '';
  const bar = document.getElementById('ddReplyBar'); const nm = document.getElementById('ddReplyName');
  if (nm) nm.textContent = '@'+userName;
  if (bar) bar.style.display = 'flex';
  const inp = document.getElementById('ddCommentInput'); if (inp){ inp.focus(); }
}
function _ddCancelReplyBar(){ const bar = document.getElementById('ddReplyBar'); if (bar) bar.style.display = 'none'; }
function cancelDareReply(){ _ddReplyTo = null; _ddReplyToName = ''; _ddCancelReplyBar(); }
function reportComment(commentId, userName){
  document.querySelectorAll('.cmt-menu.open').forEach(m=>m.classList.remove('open'));
  openReportModal('comment', commentId, userName||'comment');
}
async function submitDareComment(){
  if (!user) { showToast('Sign in to comment'); return; }
  const inp = document.getElementById('ddCommentInput'); let text = (inp.value||'').trim();
  if (!text) return; if (text.length>500){ showToast('Too long (max 500 chars)'); return; }
  // Resolve the parent. Replying to a reply → attach to the SAME top-level thread
  // (flatten one level) and keep an @name prefix so the context is visible.
  let parentId = _ddReplyTo || null;
  if (parentId){
    const target = (_ddComments||[]).find(c=>c.id===parentId);
    if (target && target.parentId) parentId = target.parentId;
    if (_ddReplyToName && !text.startsWith('@')) text = '@'+_ddReplyToName+' '+text;
  }
  try {
    await db.collection('comments').add({
      proofId: _ddCurrentId, userId: user.uid, userName: user.name, userPhotoURL: user.picture||'',
      text, likeCount: 0, likedBy: [], parentId, createdAt: firebase.firestore.Timestamp.now()
    });
    inp.value = ''; _ddReplyTo = null; _ddReplyToName = ''; _ddCancelReplyBar();
    const snap = await db.collection('comments').where('proofId','==',_ddCurrentId).limit(120).get();
    _ddComments = snap.docs.map(doc=>({id:doc.id,...doc.data()}));
    _renderDareComments(); // refresh preview + box, box stays open
  } catch(e){ showToast('Could not post comment'); }
}
function renderDareMore(excludeId){
  const el = document.getElementById('ddMoreDares'); if (!el) return;
  const now = new Date();
  const active = (dares||[]).filter(d=>{
    if (d.id===excludeId || d.completed) return false;
    if (d.expiresAt){ const exp = d.expiresAt.toDate?d.expiresAt.toDate():new Date(d.expiresAt); if (exp<now) return false; }
    return true;
  }).slice(0, 12);
  if (!active.length){ el.innerHTML = '<div class="exp-empty">No other active missions.</div>'; return; }
  el.innerHTML = `<div class="active-dare-grid">${active.map(_activeDareCard).join('')}</div>`;
}

function doTrendingSearch(term){document.getElementById('searchInput').value=term;searchType='dares';handleSearchImmediate();}

function enterGuestMode() {
  isGuestMode  = true;
  const GUEST_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  guestEndTime = Date.now() + GUEST_DURATION_MS;

  // Show app, hide auth
  document.getElementById('authScreen').style.display  = 'none';
  document.getElementById('appScreen').style.display   = 'block';
  _setTopbarMode('guest');

  // Start countdown display (updates every second)
  _startGuestCountdown();

  // Hard expiry timer — shows forced login popup at 15 minutes
  guestTimer = setTimeout(() => {
    _onGuestExpired();
  }, GUEST_DURATION_MS);

  // Load dares (public read — no auth needed for Firestore read)
  startDaresListener();
  AdManager.initScrollAds();
  _bootRoute();   // respect a shared deep link (/watch/...) instead of always landing home
}

function guestCheck(actionKey) {
  if (!isGuestMode) return false;  // logged-in users: NOT blocked → allow action
  const info = GUEST_ACTION_MSGS[actionKey] || GUEST_ACTION_MSGS.default;
  showGuestPrompt(info, true); // true = dismissible
  return true; // guest: block the action
}

function leaveGuestMode(tab) {
  _clearGuestSession();
  isGuestMode = false;
  document.getElementById('guestPrompt').style.display  = 'none';
  document.getElementById('appScreen').style.filter     = '';
  document.getElementById('appScreen').style.pointerEvents = '';
  document.getElementById('appScreen').style.display    = 'none';
  document.getElementById('authScreen').style.display   = 'flex';
  switchTab(tab || 'login');
}

async function loadComments(proofId) {
  commentsProofId=proofId;
  const el=document.getElementById('vdComments'); const cnt=document.getElementById('vdCommentCount');
  el.innerHTML='<div style="text-align:center;padding:20px;color:var(--t3);font-size:13px;">Loading...</div>';
  try{
    const snap=await db.collection('comments').where('proofId','==',proofId).limit(50).get();
    let comments=snap.docs.map(doc=>({id:doc.id,...doc.data()}));
    comments.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    commentsCache[proofId]=comments;
    if(cnt) cnt.textContent=comments.length?`(${comments.length})`:'';
    _renderComments(comments);
  }catch(e){el.innerHTML=`<div style="text-align:center;padding:16px;color:var(--t3);font-size:13px;">Could not load comments</div>`;}
}

async function openVideoDetail(proofId) {
  try{ _pvStop(); }catch(e){}
  const p=homeProofs.find(x=>x.id===proofId)||allProofs.find(x=>x.id===proofId);
  if(!p||!p.videoURL){showToast('Video not available');return;}
  if (typeof _enterView === 'function') _enterView('watch', proofId);   // URL + pause/close current
  // Open the watch page FIRST
  activeProof=p;
  _renderVideoDetail(p);
  const vov=document.getElementById('videoDetailOverlay');
  vov.classList.add('open'); vov.classList.remove('vd-show-desc');
  vov.querySelector('.dd-col2')?.classList.remove('open');
  vov.scrollTop=0; const vc1=vov.querySelector('.dd-col1'); if(vc1) vc1.scrollTop=0;
  document.body.style.overflow='hidden';
  document.body.classList.add('detail-open');
  _vdBindScroll();
  // Then show ad IN the video area, then play. Ad shows once per video per
  // session — coming BACK to a video plays it directly (no repeat ad).
  const player = document.getElementById('vdPlayer');
  const dur = p.videoDuration || 0;
  if (dur >= 60 && !_vdAdShown.has(p.id)) {
    _vdAdShown.add(p.id);
    _showInlineAd(player, p);
  } else if (player) {
    // already-seen (or short) → play directly, resuming where you left off
    const resume = _vdResumePos[p.id] || 0;
    _playSmart(player, p.videoURL, { resume, maxW: _vidMaxW() });
  }
}
let _vdAdShown = new Set();   // proofs that already showed their pre-roll this session

// Inline ad overlay inside the video player area (YouTube-style pre-roll)
let _vdAdTick = null, _vdAdSkipTO = null;
// Cancel any running pre-roll ad (so it can't auto-start the old video in the
// background after you navigate away during the countdown)
function _stopVdAd(){
  if (_vdAdTick){ clearInterval(_vdAdTick); _vdAdTick = null; }
  if (_vdAdSkipTO){ clearTimeout(_vdAdSkipTO); _vdAdSkipTO = null; }
  document.querySelectorAll('.vd-inline-ad').forEach(a=>a.remove());
}
function _showInlineAd(player, p) {
  if (!player) return;
  _stopVdAd();
  const wrap = player.parentElement;
  player.removeAttribute('src'); player.load();
  let secs = 5;
  const ad = document.createElement('div');
  ad.className = 'vd-inline-ad';
  ad.innerHTML = `
    <div class="vd-ad-badge">Ad</div>
    <div class="vd-ad-body">
      <span class="mi" style="font-size:48px;color:var(--blue);">bolt</span>
      <div class="vd-ad-title">Mission Market</div>
      <div class="vd-ad-sub">Your video starts in <b id="vdAdCount">${secs}</b>s</div>
    </div>
    <button class="vd-ad-skip" id="vdAdSkip" disabled>Skip in ${secs}s</button>`;
  wrap.appendChild(ad);
  // Only start the video if we're STILL on this same video (didn't navigate away)
  const startVideo = () => {
    _stopVdAd();
    const open = document.getElementById('videoDetailOverlay')?.classList.contains('open');
    if (!open) return;
    if (typeof activeProof !== 'undefined' && activeProof && activeProof.id !== p.id) return;
    _playSmart(player, p.videoURL, { maxW: _vidMaxW() });
  };
  _vdAdTick = setInterval(() => {
    secs--;
    const c = document.getElementById('vdAdCount'); if (c) c.textContent = secs;
    const skip = document.getElementById('vdAdSkip');
    if (secs <= 0) startVideo();
    else if (skip) { skip.textContent = `Skip in ${secs}s`; }
  }, 1000);
  _vdAdSkipTO = setTimeout(() => {
    const skip = document.getElementById('vdAdSkip');
    if (skip) { skip.disabled = false; skip.textContent = 'Skip Ad'; skip.onclick = startVideo; }
  }, 3000);
}

async function renderExplorer() {
  const container=document.getElementById('explorerContent'); if(!container) return;
  // skeleton only when nothing is cached yet (slow network)
  if(!(typeof allProofs!=='undefined' && allProofs.length)) container.innerHTML=_skelCards(6);
  try {
    const snap=await db.collection('proofs').where('status','==','approved').limit(100).get();
    allProofs=snap.docs.map(doc=>({id:doc.id,...doc.data()}));
    const mostViewed  =[...allProofs].sort((a,b)=>(b.viewCount||0)-(a.viewCount||0)).slice(0,12);
    const mostAccepted=[...dares].filter(d=>!d.completed).sort((a,b)=>(b.takers||0)-(a.takers||0)).slice(0,6);
    const mostLiked   =[...allProofs].sort((a,b)=>(b.likeCount||0)-(a.likeCount||0)).slice(0,12);
    let topSearches=[];
    try{const ss=await db.collection('searches').orderBy('count','desc').limit(10).get();topSearches=ss.docs.map(d=>d.data());}catch(_){}
    const showAll=activeExpTab==='all';
    container.innerHTML=`
      ${showAll||activeExpTab==='viewed'?`<div class="exp-section"><div class="exp-sec-hdr"><span class="exp-fire"></span><div><div class="exp-sec-title">Most Viewed Today</div><div class="exp-sec-sub">Top taker videos</div></div></div>${_mixedVideoFeedHtml(mostViewed,'Complete missions to see videos here!')}</div>`:''}
      ${showAll||activeExpTab==='accepted'?`<div class="exp-section"><div class="exp-sec-hdr"><span class="exp-fire"></span><div><div class="exp-sec-title">Most Accepted Missions</div><div class="exp-sec-sub">Missions everyone wants to try</div></div></div>${mostAccepted.length?`<div class="active-dare-grid">${mostAccepted.map(d=>_explorerDareCard(d)).join('')}</div>`:`<div class="exp-empty">No active missions!</div>`}</div>`:''}
      ${showAll||activeExpTab==='liked'?`<div class="exp-section"><div class="exp-sec-hdr"><span class="exp-fire"></span><div><div class="exp-sec-title">Most Liked Videos</div><div class="exp-sec-sub">Community favorites</div></div></div>${_mixedVideoFeedHtml(mostLiked.filter(p=>(p.likeCount||0)>0),'Like videos to see them here!')}</div>`:''}
      ${showAll||activeExpTab==='searched'?`<div class="exp-section"><div class="exp-sec-hdr"><span class="exp-fire"></span><div><div class="exp-sec-title">Trending Searches</div><div class="exp-sec-sub">What people are looking for</div></div></div>${topSearches.length?`<div class="trending-searches-list">${topSearches.map((s,i)=>`<div class="trending-search-row" onclick="doTrendingSearch('${escHtml(s.term||'')}')"><span class="trending-rank">${i<3?['🥇','🥈','🥉'][i]:'#'+(i+1)}</span><span class="trending-term">${escHtml(s.term||'')}</span><span class="trending-count">${(s.count||0).toLocaleString('en-IN')} searches</span><span class="mi" style="color:var(--t4);margin-left:auto;font-size:14px;">arrow_forward_ios</span></div>`).join('')}</div>`:`<div class="exp-empty">Search for something to start tracking!</div>`}</div>`:''}`;
  }catch(e){container.innerHTML=`<div class="empty"><span class="mi">error_outline</span><div class="empty-title">Error loading trending</div><p class="empty-desc">${e.message}</p></div>`;}
}

function setSearchType(type) {
  searchType=type;
  const q=(document.getElementById('searchInput').value||'').toLowerCase().trim();
  if (q) _doSearch(q);
}

function showGuestPrompt(info, dismissible) {
  document.getElementById('guestPromptIcon').textContent  = info.icon;
  document.getElementById('guestPromptTitle').textContent = info.title;
  document.getElementById('guestPromptMsg').textContent   = info.msg;
  const dismissBtn = document.getElementById('guestPromptDismiss');
  dismissBtn.style.display = dismissible ? 'block' : 'none';
  document.getElementById('guestPrompt').style.display    = 'flex';
}

function startNotificationsListener() {
  if (!user) return;
  if (notifUnsub) notifUnsub();
  notifUnsub = db.collection('notifications')
    .where('toUserId','==',user.uid).orderBy('createdAt','desc').limit(50)
    .onSnapshot(snap=>{
      notifications = snap.docs.map(doc=>({id:doc.id,...doc.data()}));
      notifUnread   = notifications.filter(n=>!n.read).length;
      _updateNotifBadge();
      if (document.getElementById('notifPanel')?.classList.contains('open')) _renderNotifications();
    },()=>{});
}

async function submitComment() {
  if(!user){showToast('Please sign in to comment');return;}
  const input=document.getElementById('vdCommentInput'); const text=(input.value||'').trim();
  if(!text) return; if(text.length>500){showToast('Too long (max 500 chars)');return;}
  const newComment={proofId:commentsProofId,userId:user.uid,userName:user.name,userPhotoURL:user.picture||'',text,likeCount:0,likedBy:[],parentId:(replyingToCommentId||null),createdAt:firebase.firestore.Timestamp.now()};
  try{
    await db.collection('comments').add(newComment); input.value=''; cancelReply();
    const cached=commentsCache[commentsProofId]||[];
    commentsCache[commentsProofId]=[{...newComment,id:'tmp_'+Date.now()},...cached];
    _renderComments(commentsCache[commentsProofId]);
    const cntEl=document.getElementById('vdCommentCount'); if(cntEl) cntEl.textContent=`(${commentsCache[commentsProofId].length})`;
    const snap=await db.collection('comments').where('proofId','==',commentsProofId).get();
    db.collection('proofs').doc(commentsProofId).update({commentCount:snap.size}).catch(()=>{});
    const p=homeProofs.find(x=>x.id===commentsProofId)||allProofs.find(x=>x.id===commentsProofId);
    if(p) await _checkCommentMilestone(commentsProofId,snap.size,p.takerId,p.dareTitle);
  }catch(e){showToast('Could not post comment — try again');}
}

function switchExpTab(el,tab) {
  activeExpTab=tab;
  document.querySelectorAll('.exp-tab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderExplorer();
}

async function toggleLike(proofId) {
  if(!proofId) return;
  if(!user){showToast('Please sign in to like');return;}
  const isLiked=userLikes.includes(proofId);
  const p=homeProofs.find(x=>x.id===proofId)||allProofs.find(x=>x.id===proofId);
  let newCount=0;
  if(isLiked){
    userLikes=userLikes.filter(id=>id!==proofId);
    if(p){p.likeCount=Math.max(0,(p.likeCount||0)-1);newCount=p.likeCount;}
    db.collection('proofs').doc(proofId).update({likeCount:firebase.firestore.FieldValue.increment(-1)}).catch(()=>{});
  } else {
    userLikes.push(proofId);
    if(p){p.likeCount=(p.likeCount||0)+1;newCount=p.likeCount;}
    db.collection('proofs').doc(proofId).update({likeCount:firebase.firestore.FieldValue.increment(1)})
      .then(()=>_checkLikeMilestone(proofId,newCount,p?.takerId,p?.dareTitle)).catch(()=>{});
    // mutually exclusive: liking clears an existing dislike
    if(p && (p.dislikedBy||[]).includes(user.uid)){
      p.dislikedBy=p.dislikedBy.filter(u=>u!==user.uid);
      p.dislikeCount=Math.max(0,(p.dislikeCount||0)-1);
      db.collection('proofs').doc(proofId).update({dislikedBy:firebase.firestore.FieldValue.arrayRemove(user.uid),dislikeCount:firebase.firestore.FieldValue.increment(-1)}).catch(()=>{});
      if(activeProof && activeProof.id===proofId) _vdUpdateDislikeUI(p);
    }
  }
  db.collection('users').doc(user.uid).update({likedProofs:userLikes}).catch(()=>{});
  _updateLikeBtn(proofId,newCount);
}

function toggleNotifPanel() {
  const panel=document.getElementById('notifPanel'); if(!panel) return;
  const isOpen=panel.classList.toggle('open');
  if (isOpen) {
    _renderNotifications();
    notifications.filter(n=>!n.read).forEach(n=>db.collection('notifications').doc(n.id).update({read:true}).catch(()=>{}));
    notifUnread=0; _updateNotifBadge();
  }
}

// ═══════════════════════════════════════════════════════════════════
// YOUTUBE SHORTS-STYLE VERTICAL VIDEO PLAYER
// ═══════════════════════════════════════════════════════════════════
let shortsFeed = [];
let shortsIndex = 0;
let shortsCommentsOpen = false;
let shortsCaptionExpanded = false;

function openShorts(proofId) {
  try{ _pvStop(); }catch(e){}
  if (typeof _enterView === 'function') _enterView('shorts', proofId);   // URL + pause/close current
  const pool = (typeof allProofs !== 'undefined' && allProofs.length) ? allProofs : homeProofs;
  shortsFeed = (pool || []).filter(p => p.videoURL && _isShortVideo(p));
  if (!shortsFeed.length) { showToast('No videos yet'); return; }
  shortsIndex = shortsFeed.findIndex(p => p.id === proofId);
  if (shortsIndex < 0) shortsIndex = 0;
  shortsCommentsOpen = false;
  document.getElementById('shortsOverlay').classList.add('open');
  document.getElementById('shortsOverlay').classList.remove('comments-open');
  document.body.style.overflow = 'hidden';
  document.body.classList.add('shorts-open');   // mobile: hide the topbar (immersive)
  _shortsBindSwipe();
  _renderShortsSnapStack();   // build the native scroll-snap video stack
  renderShort();              // fill the fixed overlay for the current short
}

function closeShorts() {
  const ov = document.getElementById('shortsOverlay');
  ov.classList.remove('open', 'comments-open');
  shortsCloseDetails();
  document.body.style.overflow = '';
  document.body.classList.remove('shorts-open');
  const c = document.getElementById('shortsSnapContainer');
  if (c) c.querySelectorAll('video').forEach(v => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch(e){} });
  shortsCommentsOpen = false;
}

function shortsNav(dir) {
  const ni = shortsIndex + dir;
  if (ni < 0 || ni >= shortsFeed.length) return;
  // Smooth-scroll the snap container to the target; the scroll listener updates the rest
  const c = document.getElementById('shortsSnapContainer');
  if (!c) return;
  const items = c.querySelectorAll('.shorts-snap-item');
  if (items[ni]) items[ni].scrollIntoView({ behavior:'smooth', block:'start' });
}

// Build ONE self-contained slide (video + its own overlay: controls, info, action rail)
function _shortsSlideHtml(p, i) {
  const d = (typeof dares !== 'undefined' ? dares.find(x => x.id === p.dareId) : null) || {};
  const caption = escHtml(d.caption || d.title || p.dareTitle || 'Mission Video');
  const creatorName = escHtml(d.creator || p.posterName || 'Creator');
  const creatorId = d.creatorUid || p.posterId || '';
  const takerName = escHtml(p.takerName || 'Taker');
  const liked = (typeof userLikes !== 'undefined' && userLikes.includes(p.id));
  const words = caption.split(' ');
  const capPreview = words.length > 5 ? words.slice(0,5).join(' ') + '...' : caption;
  const capToggle = words.length > 5 ? ` <span class="shorts-cap-toggle" onclick="shortsCapToggleSlide(this)">more</span>` : '';
  const cAv = _avHtml(d.creatorPhotoURL || p.posterPhotoURL, creatorName);
  const desc = escHtml(d.desc || d.description || '');
  const rules = (d.rules||[]).filter(r=>r && r.trim());
  const rulesHtml = rules.map(r=>`<div class="dd-rule">• ${escHtml(r)}</div>`).join('');
  const bounty = (d.bounty || p.dareBounty || 0).toLocaleString('en-IN');
  return `
  <div class="shorts-snap-item" data-idx="${i}" data-proof-id="${p.id}">
    <div class="shorts-info">
      <div class="shorts-creator-row" onclick="shortsOpenCollab()" style="cursor:pointer;">
        <div class="shorts-creator-av">${cAv}</div>
        <span class="shorts-creator-name">@${creatorName}</span>
        <button class="shorts-follow" onclick="event.stopPropagation();shortsOpenCollab()">Follow</button>
      </div>
      <div class="shorts-taker-row" onclick="shortsOpenCollab()" style="cursor:pointer;">
        <span class="shorts-taker-label">Taker</span>
        <span class="shorts-taker-name">@${takerName}</span>
      </div>
      <div class="shorts-caption" data-preview="${capPreview}" data-full="${caption}">${capPreview}${capToggle}</div>
      <button class="shorts-m-details" onclick="shortsOpenDetails()"><span class="mi">description</span> Description &amp; rules</button>
      <button class="shorts-details-btn" onclick="shortsToggleDetailsLeft(this)"><span class="mi">expand_more</span> Description &amp; rules</button>
      <div class="shorts-details-panel" style="display:none;">${_shortsDetailsHtml(d)}</div>
    </div>

    <div class="shorts-slide-box">
      <video class="shorts-snap-video" data-src="${p.videoURL||''}" poster="${vidThumb(p,480)}" loop playsinline preload="metadata"
        onclick="shortsSlideTogglePlay(this)" ontimeupdate="shortsSlideOnTime(this)"></video>

      <div class="shorts-top-ctrl">
        <button class="shorts-play-btn" onclick="shortsSlideTogglePlay(this)" title="Play/Pause"><span class="mi">pause</span></button>
        <button class="shorts-mute-btn" onclick="shortsSlideToggleMute(this)" title="Mute"><span class="mi">volume_up</span></button>
        <span class="shorts-time">0:00</span>
      </div>
      <button class="shorts-dots" onclick="shortsOpenMenu('${p.id}')"><span class="mi">more_vert</span></button>
      <span class="shorts-bounty-badge">Rs.${bounty}</span>
      <div class="shorts-seek-wrap">
        <input type="range" class="shorts-seek" min="0" max="1000" value="0" oninput="shortsSlideSeek(this)"/>
      </div>
      <div class="shorts-actions">
        <button class="shorts-act shorts-like-btn ${liked?'liked':''}" onclick="shortsLikeSlide('${p.id}', this)"><span class="mi">thumb_up</span></button>
        <span class="shorts-act-lbl shorts-like-count">${_fmtCount(p.likeCount || 0)}</span>
        <button class="shorts-act" onclick="showToast('Disliked')"><span class="mi">thumb_down</span></button>
        <span class="shorts-act-lbl">Dislike</span>
        <button class="shorts-act shorts-cmt-rail" onclick="shortsOpenComments('${p.id}')"><span class="mi">comment</span></button>
        <span class="shorts-act-lbl shorts-comment-count shorts-cmt-rail">${_fmtCount(p.commentCount || 0)}</span>
        <button class="shorts-act" onclick="showToast('Share link copied!')"><span class="mi">share</span></button>
        <span class="shorts-act-lbl">Share</span>
        <div class="shorts-act-views"><span class="mi">visibility</span><span class="shorts-views-count">${_fmtCount(p.viewCount || 0)}</span></div>
      </div>
    </div>

    <!-- COLUMN 3 (desktop): this short's comments, own scroll -->
    <div class="shorts-rowcmts">
      <div class="shorts-rowcmts-hdr"><span class="mi">chat_bubble</span> Comments <span class="shorts-rowcmts-count">${_fmtCount(p.commentCount||0)}</span></div>
      <div class="shorts-rowcmts-list" id="rowcmts-${p.id}"><div style="color:var(--t3);text-align:center;padding:30px;">Loading…</div></div>
      <div class="shorts-rowcmts-foot">
        <div class="cmt-reply-bar shorts-rowreply" id="rowreply-${p.id}" style="display:none;"><span>Replying to <b></b></span><button onclick="event.stopPropagation();cancelShortsReply()"><span class="mi">close</span></button></div>
        <div class="vd-comment-input-row">
          <input class="vd-comment-input" id="rowinp-${p.id}" placeholder="Add a comment..." maxlength="500"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();submitShortsComment();}"/>
          <button class="vd-comment-send-btn" onclick="submitShortsComment()"><span class="mi">send</span></button>
        </div>
      </div>
    </div>
  </div>`;
}

// Called when a short becomes the centered slide: ids for shared menu/comments,
// nav arrows, fade-in this slide's overlay, view++. Overlays are per-slide (no rebuild).
async function renderShort() {
  const p = shortsFeed[shortsIndex];
  if (!p) return;
  const d = (typeof dares !== 'undefined' ? dares.find(x => x.id === p.dareId) : null) || {};
  const ov = document.getElementById('shortsOverlay');
  ov.dataset.proofId = p.id;
  ov.dataset.dareId = p.dareId || '';
  ov.dataset.creatorId = d.creatorUid || p.posterId || '';
  ov.dataset.takerId = p.takerId || '';
  // keep the URL in sync with the current short as the feed scrolls (shareable)
  try{ history.replaceState({ dm:'shorts', id:p.id }, '', '/shorts/'+encodeURIComponent(p.id)); }catch(e){}

  const up = document.getElementById('shortsNavUp'), dn = document.getElementById('shortsNavDown');
  if (up) up.classList.toggle('disabled', shortsIndex === 0);
  if (dn) dn.classList.toggle('disabled', shortsIndex === shortsFeed.length - 1);

  // Mark current slide active (drives the fade-in)
  const c = document.getElementById('shortsSnapContainer');
  const items = c ? c.querySelectorAll('.shorts-snap-item') : [];
  items.forEach((it, i) => it.classList.toggle('active', i === shortsIndex));

  // View++ (once per activation) + update this slide's view label
  if (typeof user !== 'undefined' && user) {
    db.collection('proofs').doc(p.id).update({ viewCount: firebase.firestore.FieldValue.increment(1) }).catch(()=>{});
    p.viewCount = (p.viewCount || 0) + 1;
    const cur = items[shortsIndex];
    const vc = cur ? cur.querySelector('.shorts-views-count') : null;
    if (vc) vc.textContent = _fmtCount(p.viewCount);
    _checkViewMilestone(p.id, p.viewCount);
  }

  _shortsFillCol1(p, d);
  if (shortsCommentsOpen || window.innerWidth >= 769) loadShortsComments(p.id);
  // Desktop: slide column 1 + comments in sync with the video (feels like the whole row scrolls)
  if (window.innerWidth >= 769){
    [document.getElementById('shortsCol1'), document.querySelector('#shortsOverlay .shorts-comments')].forEach(el=>{
      if (el){ el.classList.remove('shorts-col-shift'); void el.offsetWidth; el.classList.add('shorts-col-shift'); }
    });
  }
}
// Desktop column 1: creator+taker ids · caption · description & rules (synced to active short)
function _shortsDetailsHtml(d){
  const desc = escHtml(d.desc || d.description || '');
  const rules = (d.rules||[]).filter(r=>r && r.trim());
  const tags = (d.tags && d.tags.length) ? d.tags : (d.cat?[d.cat]:[]);
  return `${desc ? `<div class="dd-sec-label">Description</div><p class="dd-desc-text">${desc}</p>` : ''}
    ${rules.length ? `<div class="dd-sec-label">Rules</div>${rules.map(r=>`<div class="dd-rule">• ${escHtml(r)}</div>`).join('')}` : ''}
    ${tags.length ? `<div class="dd-sec-label">Tags</div><div class="dd-tags">${tags.map(t=>`<span class="dd-tag-link" onclick="searchTag('${(''+t).replace(/[\\'"<>]/g,'')}')">#${escHtml(t)}</span>`).join('')}</div>` : ''}`;
}
function _shortsFillCol1(p, d){
  const col1 = document.getElementById('shortsCol1'); if (!col1) return;
  const creatorName = escHtml(d.creator || p.posterName || 'Creator');
  const takerName   = escHtml(p.takerName || 'Taker');
  const caption = escHtml(d.caption || d.title || p.dareTitle || 'Mission Video');
  const cAv = _avHtml(d.creatorPhotoURL||p.posterPhotoURL, creatorName);
  const tAv = _avHtml(p.takerPhotoURL, takerName);
  col1.classList.remove('expanded');
  col1.innerHTML = `
    <div class="shorts-c1-bottom">
      <div class="shorts-c1-collab" onclick="shortsOpenCollab()">
        <div class="vd2-collab-avs"><div class="dd-creator-av">${cAv}</div><div class="dd-creator-av vd2-av2">${tAv}</div></div>
        <div class="dd-creator-info">
          <div class="dd-creator-name">@${creatorName} &amp; @${takerName}</div>
          <div class="dd-creator-sub">Creator &amp; Taker</div>
        </div>
        <button class="shorts-follow dd-follow" onclick="event.stopPropagation();shortsOpenCollab()">Follow</button>
      </div>
      <div class="shorts-c1-caption">${caption}</div>
      <button class="dd-details-btn shorts-c1-detailsbtn" onclick="shortsToggleC1Details()"><span class="mi">description</span> Description &amp; rules <span class="mi dd-details-chev">chevron_right</span></button>
      <div class="shorts-c1-details" id="shortsC1Details" style="display:none;">${_shortsDetailsHtml(d)}</div>
    </div>`;
}
function shortsToggleC1Details(){
  const col1 = document.getElementById('shortsCol1'); if (!col1) return;
  const open = col1.classList.toggle('expanded');
  const d = document.getElementById('shortsC1Details'); if (d) d.style.display = open ? 'block' : 'none';
}
// Mobile: description/rules/tags drawer (right side, glassy)
function shortsOpenDetails(){
  const p = shortsFeed[shortsIndex]; if (!p) return;
  const d = (typeof dares!=='undefined' ? dares.find(x=>x.id===p.dareId) : null) || {};
  const body = document.getElementById('shortsDetailsDrawerBody');
  if (body) body.innerHTML = _shortsDetailsHtml(d) || '<p class="dd-desc-text" style="color:var(--t3)">No details.</p>';
  document.getElementById('shortsDetailsDrawer')?.classList.add('open');
}
function shortsCloseDetails(){ document.getElementById('shortsDetailsDrawer')?.classList.remove('open'); }
let _shTouchX=0,_shTouchY=0,_shTouchOn=false;
function _shortsBindSwipe(){
  const ov = document.getElementById('shortsOverlay'); if (!ov || ov._shSwipe) return; ov._shSwipe=true;
  ov.addEventListener('touchstart', e=>{ if(window.innerWidth>768) return; const t=e.touches[0]; _shTouchX=t.clientX; _shTouchY=t.clientY; _shTouchOn=true; }, {passive:true});
  ov.addEventListener('touchend', e=>{
    if(!_shTouchOn||window.innerWidth>768) return; _shTouchOn=false;
    const t=e.changedTouches[0]; const dx=t.clientX-_shTouchX, dy=t.clientY-_shTouchY;
    if(Math.abs(dx)<60 || Math.abs(dy)>Math.abs(dx)) return;
    const open = document.getElementById('shortsDetailsDrawer')?.classList.contains('open');
    if(dx<0 && !open) shortsOpenDetails();
    else if(dx>0 && open) shortsCloseDetails();
  }, {passive:true});
}
// Glassy collaborators box for shorts (reuses the shared collab modal, centered)
function shortsOpenCollab(){
  const p = shortsFeed[shortsIndex]; if (!p) return;
  const d = (typeof dares!=='undefined' ? dares.find(x=>x.id===p.dareId) : null) || {};
  const cm = document.getElementById('collabModal'); if (!cm) return;
  const creatorName = '@'+(d.creatorUsername||d.creator||p.posterName||'creator');
  const takerName   = '@'+(p.takerUsername||p.takerName||'taker');
  cm.dataset.creatorId = d.creatorUid||p.posterId||'';
  cm.dataset.takerId   = p.takerId||'';
  document.getElementById('cmCreatorName').textContent = creatorName;
  document.getElementById('cmTakerName').textContent   = takerName;
  document.getElementById('cmCreatorAv').innerHTML = _avHtml(d.creatorPhotoURL||p.posterPhotoURL, creatorName);
  document.getElementById('cmTakerAv').innerHTML   = _avHtml(p.takerPhotoURL, takerName);
  const sheet = cm.querySelector('.collab-sheet'); if (sheet) sheet.style.cssText='';  // centered
  cm.style.display = 'flex'; cm.classList.add('open');
}

// Populate the desktop fixed info + rail for the current short
function _shortsFillFixed(p, d){
  const info = document.getElementById('shortsFixedInfo');
  if (info){
    const creatorName = escHtml(d.creator || p.posterName || 'Creator');
    const takerName = escHtml(p.takerName || 'Taker');
    const creatorId = d.creatorUid || p.posterId || '';
    const caption = escHtml(d.caption || d.title || p.dareTitle || 'Mission Video');
    const words = caption.split(' ');
    const capPreview = words.length>5 ? words.slice(0,5).join(' ')+'...' : caption;
    const capToggle = words.length>5 ? ` <span class="shorts-cap-toggle" onclick="shortsCapToggleSlide(this)">more</span>` : '';
    info.innerHTML = `
      <div class="shorts-creator-row">
        <div class="shorts-creator-av">${_avHtml(d.creatorPhotoURL||p.posterPhotoURL, creatorName)}</div>
        <span class="shorts-creator-name">@${creatorName}</span>
        <button class="shorts-follow" onclick="toggleFollow('${creatorId}','creator')">Follow</button>
      </div>
      <div class="shorts-taker-row"><span class="shorts-taker-label">Taker</span><span class="shorts-taker-name">@${takerName}</span></div>
      <div class="shorts-caption" data-preview="${capPreview}" data-full="${caption}">${capPreview}${capToggle}</div>`;
  }
  const liked = (typeof userLikes!=='undefined' && userLikes.includes(p.id));
  const lb = document.getElementById('shortsFxLikeBtn'); if (lb) lb.classList.toggle('liked', liked);
  const lc = document.getElementById('shortsFxLikeCount'); if (lc) lc.textContent = _fmtCount(p.likeCount||0);
  const cc = document.getElementById('shortsFxCommentCount'); if (cc) cc.textContent = _fmtCount(p.commentCount||0);
  const vc = document.getElementById('shortsFxViewCount'); if (vc) vc.textContent = _fmtCount(p.viewCount||0);
}
async function shortsFxLike(){
  const p = shortsFeed[shortsIndex]; if (!p) return;
  if (typeof guestCheck==='function' && guestCheck()) return;
  if (typeof toggleLike==='function') await toggleLike(p.id);
  const liked = userLikes.includes(p.id);
  const lb = document.getElementById('shortsFxLikeBtn'); if (lb) lb.classList.toggle('liked', liked);
  const lc = document.getElementById('shortsFxLikeCount'); if (lc) lc.textContent = _fmtCount(p.likeCount||0);
  const sb = document.querySelector('.shorts-snap-item.active .shorts-like-btn'); if (sb) sb.classList.toggle('liked', liked);
}
function shortsFxComments(){ const p = shortsFeed[shortsIndex]; if (p) shortsOpenComments(p.id); }
function shortsFxMenu(){ const p = shortsFeed[shortsIndex]; if (p) shortsOpenMenu(p.id); }

// ── Per-slide control handlers (each slide operates on its own video) ──
function _shortsSlideVid(el){ const it = el.closest('.shorts-snap-item'); return it ? it.querySelector('video') : null; }
function shortsSlideTogglePlay(el){
  const v = (el.tagName === 'VIDEO') ? el : _shortsSlideVid(el); if (!v) return;
  if (v.paused) v.play().catch(()=>{}); else v.pause();
  _shortsSlideSyncIcons(v);
}
function _shortsSlideSyncIcons(v){
  const it = v.closest('.shorts-snap-item'); if (!it) return;
  const pb = it.querySelector('.shorts-play-btn .mi'); if (pb) pb.textContent = v.paused ? 'play_arrow' : 'pause';
  const mb = it.querySelector('.shorts-mute-btn .mi'); if (mb) mb.textContent = v.muted ? 'volume_off' : 'volume_up';
}
function shortsSlideToggleMute(el){ const v = _shortsSlideVid(el); if (!v) return; v.muted = !v.muted; _shortsSlideSyncIcons(v); }
function shortsSlideSeek(input){ const v = _shortsSlideVid(input); if (v && v.duration) v.currentTime = (input.value/1000)*v.duration; }
function shortsSlideOnTime(v){
  if (!v.duration) return;
  const it = v.closest('.shorts-snap-item'); if (!it) return;
  const seek = it.querySelector('.shorts-seek'); const time = it.querySelector('.shorts-time');
  if (seek) seek.value = Math.round((v.currentTime/v.duration)*1000);
  if (time) time.textContent = _fmtTimeS(v.currentTime);
  _shortsSlideSyncIcons(v);
}
function shortsCapToggleSlide(span){
  const cap = span.closest('.shorts-caption'); if (!cap) return;
  if (cap.dataset.expanded === '1') {
    cap.innerHTML = cap.dataset.preview + ` <span class="shorts-cap-toggle" onclick="shortsCapToggleSlide(this)">more</span>`;
    cap.dataset.expanded = '0';
  } else {
    cap.innerHTML = cap.dataset.full + ` <span class="shorts-cap-toggle" onclick="shortsCapToggleSlide(this)">less</span>`;
    cap.dataset.expanded = '1';
  }
}
async function shortsLikeSlide(proofId, btn){
  if (typeof guestCheck === 'function' && guestCheck()) return;
  if (typeof toggleLike === 'function') await toggleLike(proofId);
  const p = (allProofs.find(x=>x.id===proofId)) || (homeProofs.find(x=>x.id===proofId));
  btn.classList.toggle('liked', (typeof userLikes!=='undefined') && userLikes.includes(proofId));
  const it = btn.closest('.shorts-snap-item');
  const lc = it ? it.querySelector('.shorts-like-count') : null;
  if (lc && p) lc.textContent = _fmtCount(p.likeCount || 0);
}
function shortsOpenMenu(proofId){
  const menu = document.getElementById('shortsMenu');
  if (menu.classList.contains('open')){ menu.classList.remove('open'); _shortsSetDotsIcon(false); return; }
  const p = (allProofs.find(x=>x.id===proofId)) || (homeProofs.find(x=>x.id===proofId)); if (!p) return;
  _shortsBuildMenu(p);
  menu.classList.add('open');
  _shortsSetDotsIcon(true);
}
function shortsOpenComments(proofId){
  const ov = document.getElementById('shortsOverlay');
  ov.dataset.proofId = proofId;
  const p = (allProofs.find(x=>x.id===proofId)) || (homeProofs.find(x=>x.id===proofId));
  if (p) ov.dataset.takerId = p.takerId || '';
  shortsCommentsOpen = true;
  ov.classList.add('comments-open');
  loadShortsComments(proofId);
}
function _shortsBuildMenu(p){
  const d = (typeof dares !== 'undefined' ? dares.find(x => x.id === p.dareId) : null) || {};
  const caption = escHtml(d.caption || d.title || p.dareTitle || 'Mission Video');
  const desc = escHtml(d.desc || d.description || '');
  const bounty = (d.bounty || p.dareBounty || 0);
  const rulesHtml = (d.rules && d.rules.length)
    ? d.rules.map(r=>`<div class="shorts-rule-item">• ${escHtml(r)}</div>`).join('')
    : '<div class="shorts-rule-item" style="color:var(--t3);">No specific rules.</div>';
  document.getElementById('shortsMenuBody').innerHTML = `
    <button class="shorts-menu-action shorts-menu-details" onclick="shortsToggleDetails()"><span class="mi">info</span> Details</button>
    <div id="shortsDetailsBlock" class="shorts-details-block" style="display:none;">
      <div class="shorts-menu-row"><span class="shorts-menu-label">Caption</span><span>${caption}</span></div>
      ${desc ? `<div class="shorts-menu-row"><span class="shorts-menu-label">Description</span><span>${desc}</span></div>` : ''}
      <div class="shorts-menu-row"><span class="shorts-menu-label">Rules</span><span>${rulesHtml}</span></div>
      <div class="shorts-menu-row"><span class="shorts-menu-label">Winning Amount</span><span style="color:var(--blue);font-weight:700;">Rs. ${bounty.toLocaleString('en-IN')}</span></div>
    </div>
    <button class="shorts-menu-action" onclick="shortsDownload()"><span class="mi">download</span> Download</button>
    <button class="shorts-menu-action" onclick="shortsCycleSpeed()"><span class="mi">slow_motion_video</span> Playback speed <span id="shortsSpeedLbl" style="margin-left:auto;color:var(--t3);">${_SHORTS_SPEEDS[_shortsSpeedIdx]}x</span></button>
    <button class="shorts-menu-action" onclick="shortsQuality()"><span class="mi">tune</span> Quality <span id="shortsQLbl" style="margin-left:auto;color:var(--t3);">${_vqLabel()}</span></button>
    <button class="shorts-menu-action" onclick="shortsToggleAutoScroll()"><span class="mi">smart_display</span> Auto-scroll <span id="shortsAutoLbl" style="margin-left:auto;color:var(--t3);">${_shortsAutoScroll?'On':'Off'}</span></button>
    <button class="shorts-menu-action" onclick="shortsPiP()"><span class="mi">picture_in_picture_alt</span> Picture-in-picture</button>
    <button class="shorts-menu-report" onclick="openReportModal('proof','${p.id}')"><span class="mi">flag</span> Report</button>
  `;
}

function _fmtCount(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1000) return (n/1000).toFixed(1).replace('.0','') + 'K';
  return String(n || 0);
}

// ── Shorts custom video controls (operate on the current snap-stack video) ───
function _shortsCurrentVideo() {
  const c = document.getElementById('shortsSnapContainer'); if (!c) return null;
  const items = c.querySelectorAll('.shorts-snap-item');
  const cur = items[shortsIndex];
  return cur ? cur.querySelector('video') : null;
}
function shortsTogglePlay() {
  const v = _shortsCurrentVideo(); if (!v) return;
  if (v.paused) v.play().catch(()=>{}); else v.pause();
  _shortsSyncPlayIcon();
}
function _shortsSyncPlayIcon() {
  const v = _shortsCurrentVideo();
  const b = document.getElementById('shortsPlayBtn');
  if (v && b) b.querySelector('.mi').textContent = v.paused ? 'play_arrow' : 'pause';
}
function shortsToggleMute() {
  const v = _shortsCurrentVideo();
  const b = document.getElementById('shortsMuteBtn');
  if (!v) return;
  v.muted = !v.muted;
  if (b) b.querySelector('.mi').textContent = v.muted ? 'volume_off' : 'volume_up';
}
function shortsSeekTo(val) {
  const v = _shortsCurrentVideo();
  if (v && v.duration) v.currentTime = (val/1000) * v.duration;
}
function shortsOnTime() {
  const v = _shortsCurrentVideo(); if (!v || !v.duration) return;
  const seek = document.getElementById('shortsSeek');
  const time = document.getElementById('shortsTime');
  if (seek) seek.value = Math.round((v.currentTime / v.duration) * 1000);
  if (time) time.textContent = _fmtTimeS(v.currentTime);
  _shortsSyncPlayIcon();
}
function _fmtTimeS(s) {
  s = Math.floor(s||0); const m = Math.floor(s/60);
  return m + ':' + String(s%60).padStart(2,'0');
}
// ── 3-dots menu actions (merged from the native video menu) ──
function shortsDownload() {
  const p = shortsFeed[shortsIndex]; if (!p || !p.videoURL) return;
  const a = document.createElement('a');
  a.href = p.videoURL; a.download = (p.dareTitle||'dare-short') + '.mp4'; a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
}
let _shortsSpeedIdx = 0;
const _SHORTS_SPEEDS = [1, 1.25, 1.5, 2, 0.5];
let _shortsAutoScroll = false;
function shortsToggleAutoScroll(){
  _shortsAutoScroll = !_shortsAutoScroll;
  const lbl = document.getElementById('shortsAutoLbl'); if (lbl) lbl.textContent = _shortsAutoScroll ? 'On' : 'Off';
  showToast(_shortsAutoScroll ? 'Auto-scroll on — next short plays automatically' : 'Auto-scroll off');
  const v = _shortsCurrentVideo(); if (v){ v.loop = !_shortsAutoScroll; }
}
function shortsCycleSpeed() {
  const v = _shortsCurrentVideo(); if (!v) return;
  _shortsSpeedIdx = (_shortsSpeedIdx + 1) % _SHORTS_SPEEDS.length;
  v.playbackRate = _SHORTS_SPEEDS[_shortsSpeedIdx];
  const lbl = document.getElementById('shortsSpeedLbl');
  if (lbl) lbl.textContent = _SHORTS_SPEEDS[_shortsSpeedIdx] + 'x';
  showToast('Speed: ' + _SHORTS_SPEEDS[_shortsSpeedIdx] + 'x');
}
async function shortsPiP() {
  const v = _shortsCurrentVideo(); if (!v) return;
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else if (v.requestPictureInPicture) await v.requestPictureInPicture();
    else showToast('Picture-in-picture not supported');
  } catch(e) { showToast('Picture-in-picture not available'); }
}

// Like current short (reuse toggleLike backend)
async function shortsLike() {
  const ov = document.getElementById('shortsOverlay');
  const pid = ov.dataset.proofId;
  if (guestCheck()) return;
  if (typeof toggleLike === 'function') { await toggleLike(pid); }
  // Update local feed
  const p = shortsFeed[shortsIndex];
  const liked = userLikes.includes(pid);
  if (p) p.likeCount = (p.likeCount||0);
  document.getElementById('shortsLikeBtn').classList.toggle('liked', liked);
  document.getElementById('shortsLikeCount').textContent = _fmtCount(p ? p.likeCount : 0);
}

// Comments panel
function shortsToggleComments() {
  shortsCommentsOpen = !shortsCommentsOpen;
  const ov = document.getElementById('shortsOverlay');
  ov.classList.toggle('comments-open', shortsCommentsOpen);
  if (shortsCommentsOpen) {
    const pid = ov.dataset.proofId;
    loadShortsComments(pid);
  }
}

let _shortsComments = [];
let _shortsCommentsProofId = null;

async function loadShortsComments(proofId) {
  const box = document.getElementById('shortsCommentsList');
  box.innerHTML = '<div style="color:var(--t3);text-align:center;padding:20px;">Loading...</div>';
  try {
    const snap = await db.collection('comments').where('proofId','==',proofId).limit(80).get();
    _shortsComments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    _shortsCommentsProofId = proofId;
    _renderShortsCommentsList();
  } catch(e) {
    box.innerHTML = '<div style="color:var(--t3);text-align:center;padding:20px;">Could not load comments</div>';
  }
}
function _shortsActiveId(){ return document.getElementById('shortsOverlay')?.dataset.proofId; }
function _renderShortsCommentsList() {
  const comments = _shortsComments || [];
  const ov = document.getElementById('shortsOverlay');
  const activeId = ov?.dataset.proofId;
  // Creator AND taker can pin (only the pinner can unpin)
  const canPin = (typeof user !== 'undefined' && user && ov && (user.uid === ov.dataset.takerId || user.uid === ov.dataset.creatorId));
  const n = comments.filter(c=>!c.parentId).length;
  let html;
  if (!comments.length) {
    html = '<div style="color:var(--t3);text-align:center;padding:40px 20px;">No comments yet. Be the first!</div>';
  } else {
    const tops = comments.filter(c => !c.parentId);
    const byParent = {};
    comments.forEach(c => { if (c.parentId) (byParent[c.parentId]=byParent[c.parentId]||[]).push(c); });
    _ddSortComments(tops);                              // pinned → top-liked → latest
    Object.keys(byParent).forEach(k=>_ddSortComments(byParent[k]));
    html = tops.map(c => _shortsCommentHtml(c, byParent[c.id]||[], canPin)).join('');
  }
  // Desktop: the active row's column-3 list. Mobile: the slide-in sheet. (Fill both if present.)
  const rowList = activeId ? document.getElementById('rowcmts-'+activeId) : null;
  if (rowList){ rowList.innerHTML = html; const rc = rowList.closest('.shorts-rowcmts')?.querySelector('.shorts-rowcmts-count'); if (rc) rc.textContent = _fmtCount(n); }
  const sheetList = document.getElementById('shortsCommentsList'); if (sheetList) sheetList.innerHTML = html;
  const sheetCnt = document.getElementById('shortsCommentsCount'); if (sheetCnt) sheetCnt.textContent = n;
}
function _shortsCommentHtml(c, replies, canPin) {
  const liked = (c.likedBy||[]).includes(user?.uid);
  const likeN = c.likeCount || c.likes || 0;
  const safeName = (c.userName||'').replace(/[\\'"<>]/g,'');
  let pinItem = '';
  if (canPin){
    if (!c.pinned) pinItem = `<button onclick="event.stopPropagation();pinShortsComment('${c.id}')"><span class="mi">push_pin</span> Pin</button>`;
    else if (c.pinnedBy === (user&&user.uid)) pinItem = `<button onclick="event.stopPropagation();pinShortsComment('${c.id}')"><span class="mi">push_pin</span> Unpin</button>`;
  }
  let repToggle = '', repHtml = '';
  if (replies && replies.length){
    repToggle = `<button class="cmt-reptoggle" onclick="event.stopPropagation();_ddToggleReplies('${c.id}',this)"><span class="mi">expand_more</span> Show ${replies.length} repl${replies.length>1?'ies':'y'}</button>`;
    repHtml = `<div class="shorts-replies" id="reps-${c.id}" style="display:none;">${replies.map(r=>_shortsReplyHtml(r)).join('')}</div>`;
  }
  return `<div class="shorts-comment ${c.pinned?'pinned':''}">
    <div class="shorts-comment-av">${_avHtml(c.userPhotoURL, c.userName)}</div>
    <div class="shorts-comment-body">
      ${c.pinned?'<span class="cmt-pinned"><span class="mi">push_pin</span> Pinned</span>':''}
      <div class="shorts-comment-head">@${escHtml(c.userName||'user')}</div>
      <div class="shorts-comment-text">${escHtml(c.text||'')}</div>
      <div class="shorts-comment-acts vd-comment-acts">
        <button class="cmt-act ${liked?'liked':''}" onclick="likeComment('${c.id}')"><span class="mi">thumb_up</span>${likeN>0?' '+_fmtCount(likeN):''}</button>
        <button class="cmt-act" onclick="startShortsReply('${c.id}','${safeName}')">Reply</button>
        <span class="cmt-more"><button class="cmt-3dots" onclick="event.stopPropagation();_ddToggleCmtMenu(this)"><span class="mi">more_vert</span></button>
          <span class="cmt-menu">${pinItem}<button onclick="event.stopPropagation();reportComment('${c.id}','${safeName}')"><span class="mi">flag</span> Report</button></span></span>
      </div>
      ${repToggle}${repHtml}
    </div>
  </div>`;
}
function _shortsReplyHtml(c) {
  const liked = (c.likedBy||[]).includes(user?.uid);
  const likeN = c.likeCount || c.likes || 0;
  const safeName = (c.userName||'').replace(/[\\'"<>]/g,'');
  return `<div class="shorts-comment shorts-reply">
    <div class="shorts-comment-av" style="width:26px;height:26px;font-size:11px;">${_avHtml(c.userPhotoURL, c.userName)}</div>
    <div class="shorts-comment-body">
      <div class="shorts-comment-head">@${escHtml(c.userName||'user')}</div>
      <div class="shorts-comment-text">${escHtml(c.text||'')}</div>
      <div class="shorts-comment-acts vd-comment-acts">
        <button class="cmt-act ${liked?'liked':''}" onclick="likeComment('${c.id}')"><span class="mi">thumb_up</span>${likeN>0?' '+_fmtCount(likeN):''}</button>
        <button class="cmt-act" onclick="startShortsReply('${c.id}','${safeName}')">Reply</button>
        <span class="cmt-more"><button class="cmt-3dots" onclick="event.stopPropagation();_ddToggleCmtMenu(this)"><span class="mi">more_vert</span></button>
          <span class="cmt-menu"><button onclick="event.stopPropagation();reportComment('${c.id}','${safeName}')"><span class="mi">flag</span> Report</button></span></span>
      </div>
    </div>
  </div>`;
}
let _shortsReplyToName = '';
function startShortsReply(commentId, userName) {
  shortsReplyingTo = commentId; _shortsReplyToName = userName || '';
  const activeId = _shortsActiveId();
  const rowReply = document.getElementById('rowreply-'+activeId);
  if (rowReply){ rowReply.style.display='flex'; const b=rowReply.querySelector('b'); if(b) b.textContent='@'+userName; }
  const nm = document.getElementById('shortsReplyName'); if (nm) nm.textContent = '@'+userName;
  const bar = document.getElementById('shortsReplyBar'); if (bar) bar.style.display='flex';
  const inp = (window.innerWidth >= 769) ? document.getElementById('rowinp-'+activeId) : document.getElementById('shortsCommentInput');
  inp?.focus();
}
function cancelShortsReply() {
  shortsReplyingTo = null; _shortsReplyToName = '';
  const activeId = _shortsActiveId();
  const rowReply = document.getElementById('rowreply-'+activeId); if (rowReply) rowReply.style.display='none';
  const bar = document.getElementById('shortsReplyBar'); if (bar) bar.style.display='none';
}

async function submitShortsComment() {
  if (guestCheck()) return;
  const ov = document.getElementById('shortsOverlay');
  const pid = ov.dataset.proofId;
  const rowInp = document.getElementById('rowinp-'+pid);
  const sheetInp = document.getElementById('shortsCommentInput');
  const inp = (window.innerWidth >= 769) ? (rowInp || sheetInp) : (sheetInp || rowInp);
  if (!inp) return;
  let text = inp.value.trim();
  if (!text) return;
  // Reply-to-reply → attach to the same top-level thread + keep an @name prefix
  let parentId = shortsReplyingTo || null;
  if (parentId){
    const t = (_shortsComments||[]).find(x=>x.id===parentId);
    if (t && t.parentId) parentId = t.parentId;
    if (_shortsReplyToName && !text.startsWith('@')) text = '@'+_shortsReplyToName+' '+text;
  }
  inp.value = '';
  try {
    await db.collection('comments').add({
      proofId: pid, userId: user.uid, userName: user.name || 'user', userPhotoURL: user.picture || '', text,
      likes: 0, likeCount: 0, likedBy: [], parentId, pinned: false, createdAt: firebase.firestore.Timestamp.now()
    });
    cancelShortsReply();
    await db.collection('proofs').doc(pid).update({ commentCount: firebase.firestore.FieldValue.increment(1) }).catch(()=>{});
    const p = (allProofs.find(x=>x.id===pid)) || (homeProofs.find(x=>x.id===pid)) || shortsFeed[shortsIndex];
    if (p) {
      p.commentCount = (p.commentCount||0)+1;
      _checkCommentMilestone(pid, p.commentCount);
      const cc = document.querySelector('.shorts-snap-item.active .shorts-comment-count');
      if (cc) cc.textContent = _fmtCount(p.commentCount);
    }
    loadShortsComments(pid);
  } catch(e) { showToast('Could not post comment'); }
}

async function pinShortsComment(commentId) {
  const c = (_shortsComments||[]).find(x=>x.id===commentId); if (!c) return;
  document.querySelectorAll('.cmt-menu.open').forEach(m=>m.classList.remove('open'));
  if (c.pinned){
    if (c.pinnedBy && c.pinnedBy !== user?.uid){ showToast('Only the person who pinned this can unpin it'); return; }
    c.pinned=false; c.pinnedBy=null;
    db.collection('comments').doc(commentId).update({ pinned:false, pinnedBy:firebase.firestore.FieldValue.delete() }).catch(()=>{});
  } else {
    c.pinned=true; c.pinnedBy=user?.uid||null;
    db.collection('comments').doc(commentId).update({ pinned:true, pinnedBy:user?.uid||null }).catch(()=>{});
  }
  _renderShortsCommentsList();
}

// 3-dots menu toggle
function shortsToggleMenu() {
  const open = document.getElementById('shortsMenu').classList.toggle('open');
  _shortsSetDotsIcon(open);
}
// Toggle the 3-dots icon → "close" (X) while the menu is open
function _shortsSetDotsIcon(open){
  const icon = open ? 'close' : 'more_vert';
  document.querySelectorAll('.shorts-dots .mi').forEach(el=>el.textContent=icon);
  const more = document.querySelector('#shortsFxMoreBtn .mi'); if (more) more.textContent = icon;
}
// Mobile: "Details" inside the 3-dots menu expands the caption/description/rules block
function shortsToggleDetails() {
  const b = document.getElementById('shortsDetailsBlock');
  if (b) b.style.display = (b.style.display === 'none' || !b.style.display) ? 'block' : 'none';
}
// Desktop: "Details" button under the caption → toggle the glassy details panel (info grows upward)
function shortsToggleDetailsLeft(btn){
  const info = btn.closest('.shorts-info'); if (!info) return;
  const panel = info.querySelector('.shorts-details-panel'); if (!panel) return;
  const open = panel.style.display === 'block';
  panel.style.display = open ? 'none' : 'block';
  btn.classList.toggle('open', !open);
  info.classList.toggle('dets-open', !open);   // expanded → ids+caption move to the top
}

// Simple follow (creator/taker) — reuse if toggleFollow exists, else basic
async function toggleFollow(targetUid, type) {
  if (guestCheck && guestCheck()) return;
  if (!targetUid || (user && targetUid === user.uid)) { showToast("Can't follow yourself"); return; }
  try {
    const fid = user.uid + '_' + targetUid + '_' + type;
    const ref = db.collection('follows').doc(fid);
    const doc = await ref.get();
    if (doc.exists) { await ref.delete(); showToast('Unfollowed'); }
    else { await ref.set({ followerUid: user.uid, targetUid, type, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); showToast('Following!'); }
  } catch(e) { showToast('Could not follow'); }
}

// Keyboard nav for shorts
document.addEventListener('keydown', (e) => {
  const ov = document.getElementById('shortsOverlay');
  if (!ov || !ov.classList.contains('open')) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); shortsNav(1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); shortsNav(-1); }
  if (e.key === 'Escape') closeShorts();
});

// Wheel nav (desktop scroll between shorts)
let _shortsWheelLock = false;
function shortsWheel(e) {
  if (_shortsWheelLock) return;
  if (Math.abs(e.deltaY) < 30) return;
  _shortsWheelLock = true;
  shortsNav(e.deltaY > 0 ? 1 : -1);
  setTimeout(() => { _shortsWheelLock = false; }, 600);
}

// Touch swipe nav (mobile)
let _shortsTouchY = 0;
function shortsTouchStart(e) { _shortsTouchY = e.touches[0].clientY; }
function shortsTouchEnd(e) {
  const dy = _shortsTouchY - e.changedTouches[0].clientY;
  if (Math.abs(dy) > 60) shortsNav(dy > 0 ? 1 : -1);
}

// ════════════════════════════════════════════════════════════════════
//  WALLET — testnet money dashboard (escrow + history + deposit/withdraw)
// ════════════════════════════════════════════════════════════════════
let _walletFilter = 'all', _walletQuery = '';
const _WTXN_CATS = {
  deposit:     { icon:'add',            label:'Deposit',      type:'credit' },
  withdraw:    { icon:'account_balance',label:'Withdrawal',   type:'debit'  },
  bounty_won:  { icon:'emoji_events',   label:'Bounty Won',   type:'credit' },
  bounty_paid: { icon:'paid',           label:'Bounty Paid',  type:'debit'  },
  dare_posted: { icon:'lock',           label:'Mission Posted',  type:'debit'  },
  refund:      { icon:'undo',           label:'Refund',       type:'credit' },
  claim:       { icon:'savings',        label:'Claimed',      type:'credit' },
  other:       { icon:'swap_horiz',     label:'Transaction',  type:'credit' }
};
const _WFILTERS = [['all','All'],['deposit','Deposits'],['withdraw','Withdrawals'],['bounty_won','Bounty Won'],['dare_posted','Bounty Paid'],['refund','Refunds']];

// Derive a category for old transactions that only have {type,title,amount,date}
function _wtxnCat(t){
  if (t.category && _WTXN_CATS[t.category]) return t.category;
  const s = (t.title||'').toLowerCase();
  if (s.startsWith('deposit')) return 'deposit';
  if (s.startsWith('withdraw')) return 'withdraw';
  if (s.includes('bounty won')) return 'bounty_won';
  if (s.includes('refund') || s.includes('deleted')) return 'refund';
  if (s.startsWith('mission posted')) return 'dare_posted';
  return t.type === 'credit' ? 'other' : 'dare_posted';
}
function _wtxnTs(t){ return t.ts || (t.date ? new Date(t.date).getTime() : 0) || 0; }

// Total bounty locked in YOUR active (incomplete) dares — computed, never drifts
function _walletLocked(){
  if (!user || typeof dares === 'undefined') return 0;
  return (dares||[]).filter(d => d.creatorUid === user.uid && !d.completed)
    .reduce((s,d) => s + (d.rewardAmount ?? d.bounty ?? 0), 0);
}

// Add a transaction + persist the wallet (current user)
function _walletAddTxn(o){
  wallet.transactions = wallet.transactions || [];
  wallet.transactions.unshift({
    id: 'w'+Date.now()+Math.floor(Math.random()*1000),
    ts: Date.now(),
    status: o.status || 'completed',
    type: o.type || (_WTXN_CATS[o.category]?.type) || 'credit',
    category: o.category || 'other',
    title: o.title || (_WTXN_CATS[o.category]?.label) || 'Transaction',
    amount: o.amount || 0,
    ref: o.ref || ('REF'+Date.now().toString(36).toUpperCase()),
    date: todayStr()
  });
  if (user) db.collection('users').doc(user.uid).update({ wallet }).catch(()=>{});
}

// Auto-refund: your own dares that expired without being completed → bounty back
async function _walletReconcileExpired(){
  if (!user || typeof dares === 'undefined') return false;
  const now = Date.now(); let changed = false;
  for (const d of (dares||[])){
    if (d.creatorUid !== user.uid || d.completed || d.refunded) continue;
    const reward = d.rewardAmount ?? d.bounty ?? 0;
    if (reward <= 0 || !d.expiresAt) continue;
    const exp = d.expiresAt.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt);
    if (exp.getTime() >= now) continue;                 // not expired yet
    d.refunded = true; d.completed = true;              // bounty was never paid out → safe to refund
    wallet.balance = (wallet.balance||0) + reward;
    wallet.transactions = wallet.transactions || [];
    wallet.transactions.unshift({ id:'w'+Date.now()+Math.floor(Math.random()*1000), ts:Date.now(), status:'completed',
      type:'credit', category:'refund', title:'Mission Expired (Refund): '+((d.caption||d.title||'').slice(0,25)), amount:reward,
      ref:'REF'+Date.now().toString(36).toUpperCase(), date:todayStr() });
    db.collection('dares').doc(d.id).update({ refunded:true, completed:true }).catch(()=>{});
    changed = true;
  }
  if (changed) db.collection('users').doc(user.uid).update({ wallet }).catch(()=>{});
  return changed;
}

function renderWallet() {
  wallet = wallet || { balance:0, pending:0, transactions:[] };
  wallet.pending = wallet.pending || 0;
  _walletReconcileExpired().then(changed=>{ if (changed) renderWallet(); });
  const locked = _walletLocked();
  const bal = document.getElementById('walletBal');
  if (bal) bal.textContent = 'Rs. ' + (wallet.balance||0).toLocaleString('en-IN');
  const lk = document.getElementById('walletLocked'); if (lk) lk.textContent = 'Rs. ' + locked.toLocaleString('en-IN');
  const pd = document.getElementById('walletPending'); if (pd) pd.textContent = 'Rs. ' + (wallet.pending||0).toLocaleString('en-IN');
  // Claim button
  const cb = document.getElementById('walletClaimBtn'), ca = document.getElementById('walletClaimAmt');
  if (cb){ if ((wallet.pending||0) > 0){ cb.style.display=''; if(ca) ca.textContent='Rs.'+wallet.pending.toLocaleString('en-IN'); } else cb.style.display='none'; }
  // Filter chips
  const fc = document.getElementById('walletFilters');
  if (fc) fc.innerHTML = _WFILTERS.map(([k,l])=>`<button class="wfilter ${_walletFilter===k?'active':''}" onclick="_walletSetFilter('${k}')">${l}</button>`).join('');
  _renderWalletStats();
  _renderWalletAcct();
  _renderWalletTxns();
}

function _renderWalletTxns(){
  const tx = document.getElementById('walletTxns'); if (!tx) return;
  let list = (wallet.transactions||[]).slice();
  if (_walletFilter !== 'all') list = list.filter(t => _wtxnCat(t) === _walletFilter);
  if (_walletQuery){
    const q = _walletQuery.toLowerCase();
    list = list.filter(t => (t.title||'').toLowerCase().includes(q) || (''+(t.amount||'')).includes(q) || (t.date||'').toLowerCase().includes(q));
  }
  list.sort((a,b)=>_wtxnTs(b)-_wtxnTs(a));
  if (!list.length){
    tx.innerHTML = `<div class="empty" style="padding:40px;"><span class="mi">receipt_long</span>
      <div class="empty-title" style="font-size:18px;">${(wallet.transactions||[]).length?'No matches':'No Transactions'}</div>
      <p class="empty-desc">${(wallet.transactions||[]).length?'Try a different filter or search.':'Your transaction history will appear here.'}</p></div>`;
    return;
  }
  tx.innerHTML = list.map(t=>{
    const cat = _wtxnCat(t), meta = _WTXN_CATS[cat] || _WTXN_CATS.other;
    const credit = (t.type||meta.type) === 'credit';
    const pending = t.status && t.status !== 'completed';
    return `<div class="txn-item" onclick="openTxnDetail('${t.id||''}')">
      <div class="txn-left">
        <div class="txn-icon" style="background:${credit?'rgba(0,200,83,.15)':'rgba(229,57,53,.15)'};">
          <span class="mi" style="color:${credit?'var(--green)':'var(--red)'};">${meta.icon}</span>
        </div>
        <div><div class="txn-title">${escHtml(t.title||meta.label)}</div>
          <div class="txn-date">${t.date||''}${pending?` · <span class="txn-status ${t.status}">${t.status}</span>`:''}</div></div>
      </div>
      <div class="txn-amt ${credit?'credit':'debit'}">${credit?'+':'-'}Rs.${(t.amount||0).toLocaleString('en-IN')}</div>
    </div>`;
  }).join('');
}

function _walletSetFilter(k){ _walletFilter = k; renderWallet(); }
function _walletSearchInput(v){ _walletQuery = (v||'').trim(); _renderWalletTxns(); }

function openTxnDetail(id){
  const t = (wallet.transactions||[]).find(x=>x.id===id); if(!t) return;
  const cat = _wtxnCat(t), meta = _WTXN_CATS[cat]||_WTXN_CATS.other;
  const credit = (t.type||meta.type)==='credit';
  const row=(k,v)=>`<div class="txd-row"><span>${k}</span><b>${v}</b></div>`;
  document.getElementById('txnDetailBody').innerHTML = `
    <div class="txd-amt ${credit?'credit':'debit'}">${credit?'+':'-'}Rs.${(t.amount||0).toLocaleString('en-IN')}</div>
    <div class="txd-title">${escHtml(t.title||meta.label)}</div>
    ${row('Type', meta.label)}
    ${row('Status', `<span class="txn-status ${t.status||'completed'}">${t.status||'completed'}</span>`)}
    ${row('Date', t.date||'—')}
    ${row('Reference', t.ref||'—')}`;
  _ovOpen('txnDetailOverlay');
}

// ── Deposit / Withdraw (testnet) ──
function openDepositModal(){
  if(!user){ showToast('Sign in first'); return; }
  const inp=document.getElementById('depositAmt'); if(inp) inp.value='';
  const chips=document.getElementById('depositChips');
  if(chips) chips.innerHTML=[500,1000,5000,10000].map(a=>`<button class="wchip" onclick="document.getElementById('depositAmt').value=${a}">+Rs.${a.toLocaleString('en-IN')}</button>`).join('');
  _ovOpen('depositOverlay');
  setTimeout(()=>inp&&inp.focus(),50);
}
function doDeposit(){
  const amt=Math.floor(+document.getElementById('depositAmt').value||0);
  if(amt<=0){ showToast('Enter a valid amount'); return; }
  if(amt>500000){ showToast('Max Rs.5,00,000 per deposit (testnet)'); return; }
  wallet.balance=(wallet.balance||0)+amt;
  _walletAddTxn({ category:'deposit', title:'Deposit', amount:amt });
  _walletNotify('Money added', `Rs.${amt.toLocaleString('en-IN')} added to your wallet`, true);
  closeWalletModal('depositOverlay');
  showToast(`Rs.${amt.toLocaleString('en-IN')} added`);
  renderWallet();
}
function openWithdrawModal(){
  if(!user){ showToast('Sign in first'); return; }
  const inp=document.getElementById('withdrawAmt'); if(inp) inp.value='';
  const av=document.getElementById('withdrawAvail'); if(av) av.textContent='Available: Rs. '+(wallet.balance||0).toLocaleString('en-IN');
  _ovOpen('withdrawOverlay');
  setTimeout(()=>inp&&inp.focus(),50);
}
function doWithdraw(){
  const amt=Math.floor(+document.getElementById('withdrawAmt').value||0);
  if(amt<=0){ showToast('Enter a valid amount'); return; }
  if(amt>(wallet.balance||0)){ showToast('Insufficient available balance'); return; }
  if(((wallet.kyc&&wallet.kyc.status)||'none')!=='verified'){ closeWalletModal('withdrawOverlay'); showToast('Complete KYC to withdraw'); openKycModal(); return; }
  if(!(wallet.methods||[]).length){ closeWalletModal('withdrawOverlay'); showToast('Add a bank/UPI account first'); openMethodModal(); return; }
  const exec=()=>_executeWithdraw(amt);
  if(wallet.pin){ closeWalletModal('withdrawOverlay'); _pinVerify(exec); } else exec();
}
function _executeWithdraw(amt){
  wallet.balance-=amt;
  const tx={ id:'w'+Date.now()+Math.floor(Math.random()*1000), ts:Date.now(), status:'processing',
    type:'debit', category:'withdraw', title:'Withdrawal to '+((wallet.methods||[])[0]?.label||'bank'), amount:amt,
    ref:'REF'+Date.now().toString(36).toUpperCase(), date:todayStr() };
  wallet.transactions=wallet.transactions||[]; wallet.transactions.unshift(tx);
  if(user) db.collection('users').doc(user.uid).update({wallet}).catch(()=>{});
  closeWalletModal('withdrawOverlay');
  showToast('Withdrawal initiated · processing');
  renderWallet();
  setTimeout(()=>{ tx.status='completed';                       // testnet: simulate settlement
    if(user) db.collection('users').doc(user.uid).update({wallet}).catch(()=>{});
    const wp=document.getElementById('pageWallet'); if(wp&&wp.classList.contains('active')) renderWallet();
    _walletNotify('Withdrawal completed', `Rs.${amt.toLocaleString('en-IN')} sent to your account`, false);
    showToast('Withdrawal completed');
  }, 4000);
}
function claimPending(){
  const amt=wallet.pending||0; if(amt<=0) return;
  wallet.balance=(wallet.balance||0)+amt; wallet.pending=0;
  _walletAddTxn({ category:'claim', title:'Pending earnings claimed', amount:amt });
  _walletNotify('Earnings claimed', `Rs.${amt.toLocaleString('en-IN')} moved to your balance`, true);
  showToast(`Rs.${amt.toLocaleString('en-IN')} moved to balance`);
  renderWallet();
}
function closeWalletModal(id){ _ovSync(id); const el=document.getElementById(id); if(el) el.classList.remove('open'); }

// ── KYC ──
function openKycModal(){
  if(!user){ showToast('Sign in first'); return; }
  wallet.kyc = wallet.kyc || { status:'none' };
  if(wallet.kyc.status==='verified'){ showToast('KYC already verified ✓'); return; }
  document.getElementById('kycName').value = wallet.kyc.name||'';
  document.getElementById('kycPan').value  = wallet.kyc.pan||'';
  _ovOpen('kycOverlay');
}
function submitKyc(){
  const name=(document.getElementById('kycName').value||'').trim();
  const pan=(document.getElementById('kycPan').value||'').trim().toUpperCase();
  if(name.length<3){ showToast('Enter your full name'); return; }
  if(!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)){ showToast('Enter a valid PAN (ABCDE1234F)'); return; }
  wallet.kyc={ status:'verified', name, pan };          // testnet: instant approval
  if(user) db.collection('users').doc(user.uid).update({ wallet }).catch(()=>{});
  closeWalletModal('kycOverlay'); showToast('KYC verified ✓'); renderWallet();
}

// ── Linked accounts (UPI / bank) ──
let _methodType='upi';
function _methodTab(t){
  _methodType=t;
  document.getElementById('wmtabUpi').classList.toggle('active',t==='upi');
  document.getElementById('wmtabBank').classList.toggle('active',t==='bank');
  document.getElementById('methodUpi').style.display = t==='upi'?'':'none';
  document.getElementById('methodBank').style.display = t==='bank'?'':'none';
}
function openMethodModal(){
  if(!user){ showToast('Sign in first'); return; }
  ['mUpi','mBankName','mBankNum','mBankIfsc'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  _methodTab('upi'); _ovOpen('methodOverlay');
}
function addMethod(){
  wallet.methods=wallet.methods||[]; let m=null;
  if(_methodType==='upi'){
    const v=(document.getElementById('mUpi').value||'').trim();
    if(!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(v)){ showToast('Enter a valid UPI ID'); return; }
    m={ id:'m'+Date.now(), type:'upi', label:v, sub:'UPI' };
  } else {
    const nm=(document.getElementById('mBankName').value||'').trim();
    const num=(document.getElementById('mBankNum').value||'').trim().replace(/\s/g,'');
    const ifsc=(document.getElementById('mBankIfsc').value||'').trim().toUpperCase();
    if(nm.length<3||!/^\d{6,18}$/.test(num)||ifsc.length<6){ showToast('Fill valid bank details'); return; }
    m={ id:'m'+Date.now(), type:'bank', label:'••••'+num.slice(-4), sub:nm+' · '+ifsc };
  }
  wallet.methods.push(m);
  if(user) db.collection('users').doc(user.uid).update({ wallet }).catch(()=>{});
  closeWalletModal('methodOverlay'); showToast('Account added'); renderWallet();
}
function removeMethod(id){
  wallet.methods=(wallet.methods||[]).filter(m=>m.id!==id);
  if(user) db.collection('users').doc(user.uid).update({ wallet }).catch(()=>{});
  renderWallet();
}

// ── Transaction PIN (set / verify) ──
let _pinCb=null, _pinMode='set';
function openPinModal(){
  _pinMode = wallet.pin ? 'change':'set';
  document.getElementById('pinTitle').textContent = wallet.pin?'Change transaction PIN':'Set transaction PIN';
  document.getElementById('pinNote').innerHTML = '<span class="mi">lock</span> A 4-digit PIN protects your withdrawals.';
  document.getElementById('pinSubmitBtn').textContent='Save PIN';
  document.getElementById('pinInput').value='';
  _ovOpen('pinOverlay');
  setTimeout(()=>document.getElementById('pinInput').focus(),60);
}
function _pinVerify(cb){
  _pinMode='verify'; _pinCb=cb;
  document.getElementById('pinTitle').textContent='Enter PIN';
  document.getElementById('pinNote').innerHTML='<span class="mi">lock</span> Enter your 4-digit PIN to confirm.';
  document.getElementById('pinSubmitBtn').textContent='Confirm';
  document.getElementById('pinInput').value='';
  _ovOpen('pinOverlay');
  setTimeout(()=>document.getElementById('pinInput').focus(),60);
}
function _pinSubmit(){
  const v=(document.getElementById('pinInput').value||'').trim();
  if(!/^\d{4}$/.test(v)){ showToast('Enter a 4-digit PIN'); return; }
  if(_pinMode==='verify'){
    if(v!==wallet.pin){ showToast('Incorrect PIN'); return; }
    closeWalletModal('pinOverlay'); const cb=_pinCb; _pinCb=null; if(cb) cb();
  } else {
    wallet.pin=v;
    if(user) db.collection('users').doc(user.uid).update({ wallet }).catch(()=>{});
    closeWalletModal('pinOverlay'); showToast('PIN saved ✓'); renderWallet();
  }
}

// ── Account & Security section (rendered inside the wallet page) ──
function _renderWalletAcct(){
  const el=document.getElementById('walletAcct'); if(!el) return;
  const kyc=(wallet.kyc&&wallet.kyc.status)||'none';
  const methods=wallet.methods||[];
  const kycBadge = kyc==='verified'?'<span class="wacc-badge ok">Verified</span>'
    : kyc==='pending'?'<span class="wacc-badge pend">Pending</span>'
    : '<span class="wacc-badge no">Not verified</span>';
  el.innerHTML = `
    <div class="sec-title" style="font-size:16px;margin:26px 0 12px;"><div class="sec-dot"></div>Account &amp; Security</div>
    <div class="wacc-card">
      <div class="wacc-row" onclick="openKycModal()">
        <div class="wacc-l"><span class="wacc-ic"><span class="mi">verified_user</span></span>
          <div><div class="wacc-t">KYC verification</div><div class="wacc-s">PAN check, needed for withdrawals</div></div></div>
        <div class="wacc-r">${kycBadge}<span class="mi" style="color:var(--t3);">chevron_right</span></div>
      </div>
      <div class="wacc-row" onclick="openPinModal()">
        <div class="wacc-l"><span class="wacc-ic"><span class="mi">lock</span></span>
          <div><div class="wacc-t">Transaction PIN</div><div class="wacc-s">${wallet.pin?'PIN is set · tap to change':'Not set'}</div></div></div>
        <div class="wacc-r"><span class="mi" style="color:var(--t3);">chevron_right</span></div>
      </div>
      <div class="wacc-methods">
        <div class="wacc-methods-hdr"><span>Linked accounts</span><button onclick="openMethodModal()"><span class="mi">add</span>Add</button></div>
        ${methods.length? methods.map(m=>`<div class="wacc-method">
            <span class="wacc-mic"><span class="mi">${m.type==='upi'?'qr_code_2':'account_balance'}</span></span>
            <div class="wacc-mbody"><div class="wacc-mt">${escHtml(m.label)}</div><div class="wacc-ms">${escHtml(m.sub||'')}</div></div>
            <button class="wacc-mdel" onclick="removeMethod('${m.id}')" title="Remove"><span class="mi">delete</span></button>
          </div>`).join('')
          : '<div class="wacc-empty">No accounts linked yet</div>'}
      </div>
    </div>`;
}

// ── Insights: earnings summary + 6-month income/expense chart ──
function _renderWalletStats(){
  const el=document.getElementById('walletStats'); if(!el) return;
  const txns=wallet.transactions||[];
  if(!txns.length){ el.innerHTML=''; return; }
  let totalIn=0, totalOut=0, bountyWon=0;
  const now=new Date(), mk=d=>d.getFullYear()+'-'+d.getMonth();
  const months=[]; for(let i=5;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); months.push({k:mk(d),label:d.toLocaleString('en-US',{month:'short'}),inc:0,exp:0}); }
  const mMap={}; months.forEach(m=>mMap[m.k]=m);
  txns.forEach(t=>{
    const cat=_wtxnCat(t), meta=_WTXN_CATS[cat]||_WTXN_CATS.other, credit=(t.type||meta.type)==='credit', amt=t.amount||0;
    if(credit){ totalIn+=amt; if(cat==='bounty_won') bountyWon+=amt; } else totalOut+=amt;
    const ts=_wtxnTs(t); if(ts){ const m=mMap[mk(new Date(ts))]; if(m){ credit?m.inc+=amt:m.exp+=amt; } }
  });
  const max=Math.max(1,...months.map(m=>Math.max(m.inc,m.exp)));
  const tm=mMap[mk(now)]||{inc:0,exp:0}, net=tm.inc-tm.exp;
  el.innerHTML=`
    <div class="sec-title" style="font-size:16px;margin:26px 0 12px;"><div class="sec-dot"></div>Insights</div>
    <div class="wstat-card">
      <div class="wstat-row">
        <div class="wstat-box"><div class="wstat-lbl">Total in</div><div class="wstat-val green">+Rs.${totalIn.toLocaleString('en-IN')}</div></div>
        <div class="wstat-box"><div class="wstat-lbl">Total out</div><div class="wstat-val red">-Rs.${totalOut.toLocaleString('en-IN')}</div></div>
        <div class="wstat-box"><div class="wstat-lbl">Bounty earned</div><div class="wstat-val">Rs.${bountyWon.toLocaleString('en-IN')}</div></div>
      </div>
      <div class="wstat-chart">
        ${months.map(m=>`<div class="wbar-col">
          <div class="wbars">
            <div class="wbar inc" style="height:${Math.round(m.inc/max*100)}%" title="In Rs.${m.inc.toLocaleString('en-IN')}"></div>
            <div class="wbar exp" style="height:${Math.round(m.exp/max*100)}%" title="Out Rs.${m.exp.toLocaleString('en-IN')}"></div>
          </div>
          <div class="wbar-lbl">${m.label}</div>
        </div>`).join('')}
      </div>
      <div class="wstat-legend"><span><i class="wdot inc"></i>Income</span><span><i class="wdot exp"></i>Expense</span>
        <span class="wstat-net">This month: <b class="${net>=0?'green':'red'}">${net>=0?'+':'−'}Rs.${Math.abs(net).toLocaleString('en-IN')}</b></span></div>
    </div>`;
}

// ── Statement export (CSV) ──
function exportWalletCSV(){
  const txns=(wallet.transactions||[]).slice().sort((a,b)=>_wtxnTs(b)-_wtxnTs(a));
  if(!txns.length){ showToast('No transactions to export'); return; }
  const esc=s=>`"${(''+s).replace(/"/g,'""')}"`;
  const rows=[['Date','Type','Category','Title','Amount (Rs)','Status','Reference']];
  txns.forEach(t=>{ const cat=_wtxnCat(t), meta=_WTXN_CATS[cat]||_WTXN_CATS.other, credit=(t.type||meta.type)==='credit';
    rows.push([t.date||'', credit?'Credit':'Debit', meta.label, t.title||'', (credit?'+':'-')+(t.amount||0), t.status||'completed', t.ref||'']); });
  const csv=rows.map(r=>r.map(esc).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}), url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='daremarket-statement-'+todayStr().replace(/\s+/g,'-')+'.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('Statement downloaded');
}

// ── Wallet event notification (self) ──
function _walletNotify(title,msg,credit){
  if(!user || typeof _sendNotification!=='function') return;
  _sendNotification(user.uid, credit?'wallet_credit':'wallet_debit', title, msg, '');
}

// Smart router: shorts (<60s) open Shorts player, long videos open YouTube watch page
function openVideo(proofId) {
  const pool = (typeof allProofs !== 'undefined' && allProofs.length) ? allProofs : homeProofs;
  const p = (pool||[]).find(x => x.id === proofId);
  const isShort = _isShortVideo(p);
  if (isShort) openShorts(proofId);
  else openVideoDetail(proofId);
}

// Relative time for video cards: "3 days ago", "2 months ago", "1 year ago"
function _relTimeStr(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr); if (isNaN(d)) return dateStr;
  const ms = Date.now() - d.getTime();
  const sec = Math.floor(ms/1000), min = Math.floor(sec/60), hr = Math.floor(min/60);
  const day = Math.floor(hr/24), mon = Math.floor(day/30), yr = Math.floor(day/365);
  if (yr >= 1) return yr + (yr===1?' year ago':' years ago');
  if (mon >= 1) return mon + (mon===1?' month ago':' months ago');
  if (day >= 1) return day + (day===1?' day ago':' days ago');
  if (hr >= 1) return hr + (hr===1?' hour ago':' hours ago');
  if (min >= 1) return min + (min===1?' minute ago':' minutes ago');
  return 'just now';
}

function _relTime(p) {
  let ms = p.createdAtMs || (p.createdAt && p.createdAt.toDate ? p.createdAt.toDate().getTime() : null);
  if (!ms && p.submittedAt) { const d = new Date(p.submittedAt); if (!isNaN(d)) ms = d.getTime(); }
  if (!ms) return 'recently';
  const diff = Date.now() - ms;
  const sec = Math.floor(diff/1000), min = Math.floor(sec/60), hr = Math.floor(min/60);
  const day = Math.floor(hr/24), mon = Math.floor(day/30), yr = Math.floor(day/365);
  if (yr >= 1) return yr + (yr===1?' year ago':' years ago');
  if (mon >= 1) return mon + (mon===1?' month ago':' months ago');
  if (day >= 1) return day + (day===1?' day ago':' days ago');
  if (hr >= 1) return hr + (hr===1?' hour ago':' hours ago');
  if (min >= 1) return min + (min===1?' minute ago':' minutes ago');
  return 'just now';
}

function openCollabModal() {
  const ov = document.getElementById('videoDetailOverlay');
  const cm = document.getElementById('collabModal');
  if (!cm) return;
  document.getElementById('cmCreatorName').textContent = ov.dataset.creatorName||'@creator';
  document.getElementById('cmTakerName').textContent   = ov.dataset.takerName||'@taker';
  document.getElementById('cmCreatorAv').innerHTML = _avHtml(ov.dataset.creatorPhoto||'', ov.dataset.creatorName||'C');
  document.getElementById('cmTakerAv').innerHTML   = _avHtml(ov.dataset.takerPhoto||'', ov.dataset.takerName||'T');
  cm.style.display = 'flex';
  cm.classList.add('open');   // .overlay needs .open or it stays invisible (opacity:0)
  // Desktop: center a small sheet inside column 1. Mobile: CSS bottom sheet.
  const sheet = cm.querySelector('.collab-sheet');
  if (sheet){
    if (window.innerWidth >= 769){
      const col1 = document.querySelector('#videoDetailOverlay .dd-col1');
      if (col1){ const r = col1.getBoundingClientRect();
        const w = Math.min(r.width - 48, 340);
        sheet.style.cssText = `position:fixed;left:${r.left + r.width/2}px;top:${r.top + r.height/2}px;transform:translate(-50%,-50%);width:${w}px;max-height:${r.height-40}px;margin:0;`;
      }
    } else { sheet.style.cssText = ''; }
  }
}
function closeCollabModal() {
  const cm = document.getElementById('collabModal');
  if (cm) { cm.classList.remove('open'); cm.style.display = 'none'; const s=cm.querySelector('.collab-sheet'); if(s) s.style.cssText=''; }
}

// #7: Interleaved infinite feed — mixes long videos & shorts rows in random chunks
let _feedLong = [], _feedShorts = [], _feedLongIdx = 0, _feedScrollBound = false, _shortsRowShown = false;
// ── Home: Live (active) Dares strip — shown inside the feed like the Shorts shelf ──
let _daresRowShown = false;
function _homeDaresHtml(){
  const now = new Date();
  const active = (dares||[]).filter(d=>{
    if (d.completed) return false;
    if (d.expiresAt){ const exp=d.expiresAt.toDate?d.expiresAt.toDate():new Date(d.expiresAt); if (exp<now) return false; }
    return true;
  }).slice(0, 4);
  if (!active.length) return '';
  return `<div class="home-section" id="homeDaresRow">
    <div class="home-sec-hdr">
      <span class="mi" style="color:var(--blue2);font-size:20px;">bolt</span>
      <span class="home-sec-title">Live Missions</span>
      <span class="home-sec-sub">Accept &amp; earn</span>
      <span class="home-sec-viewall" onclick="goPage('dares')">View All →</span>
    </div>
    <div class="active-dare-grid">${active.map(_activeDareCard).join('')}</div>
  </div>`;
}
function _renderInterleavedFeed(longVids, shorts) {
  try{ _pvStop(); }catch(e){}   // kill any running hover/scroll preview before wiping the feed
  _feedLong = longVids || [];
  _feedShorts = shorts || [];
  _feedLongIdx = 0;
  _shortsRowShown = false;
  _daresRowShown = false;
  const container = document.getElementById('homeVideoGrid');
  if (!container) return;
  // Home order (fixed): Live/Active Dares FIRST → "Mission Videos" header directly
  // above the long videos → Shorts shelf LAST (no header text above shorts)
  const _videosHdr = `<div class="home-sec-hdr" style="margin-top:4px;">
      <div class="home-sec-dot"></div>
      <span class="home-sec-title">Mission Videos</span>
      <span class="home-sec-sub">Completed missions</span>
    </div>`;
  if (!_feedLong.length && !_feedShorts.length) {
    container.innerHTML = _homeDaresHtml();                        // live dares on top
    container.insertAdjacentHTML('beforeend', `<div class="empty"><span class="mi">play_circle</span>
      <div class="empty-title">No Videos Yet</div>
      <p class="empty-desc">Complete a mission and submit video proof — it will appear here!</p>
      <button class="btn-empty" onclick="goPage('dares')"><span class="mi">bolt</span>Browse Missions</button></div>`);
    return;
  }
  container.innerHTML = _homeDaresHtml() + _videosHdr;             // live dares → videos header
  _daresRowShown = true;
  if (!_feedLong.length && _feedShorts.length) {
    // only shorts exist: show one shorts section (header-less on home)
    container.insertAdjacentHTML('beforeend', _shortsRowHtml(_feedShorts, true));
    return;
  }
  _appendFeedChunk(); _appendFeedChunk(); // initial chunks
  _feedEnsureSentinel(container);         // infinite scroll via IntersectionObserver
}
// Infinite scroll WITHOUT reading layout on scroll: a 1px sentinel at the feed's end,
// watched by an IntersectionObserver (rootMargin prefetches early). The old handler
// read document.body.offsetHeight on every scroll event = forced reflow every frame.
let _feedIO = null;
function _feedEnsureSentinel(container){
  let s = document.getElementById('feedSentinel');
  if(!s){ s=document.createElement('div'); s.id='feedSentinel'; s.setAttribute('aria-hidden','true'); s.style.cssText='height:1px;width:100%;'; }
  container.appendChild(s);   // keep it the last child
  if(!_feedIO){
    _feedIO = new IntersectionObserver((ents)=>{
      if(!ents.some(e=>e.isIntersecting)) return;
      const home=document.getElementById('pageHome');
      if(home && home.classList.contains('active')){
        _appendFeedChunk();
        const c=document.getElementById('homeVideoGrid'), sn=document.getElementById('feedSentinel');
        if(c && sn) c.appendChild(sn);   // move sentinel back to the end
      }
    }, { rootMargin:'1000px 0px' });
    _feedIO.observe(s);
  }
}
function _shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
function _appendFeedChunk() {
  const container = document.getElementById('homeVideoGrid');
  if (!container) return;
  // FIX 2: no repeats — stop when all long videos shown once
  if (_feedLongIdx >= _feedLong.length) {
    // Longs exhausted: still show the Shorts shelf once if it hasn't appeared yet
    if (_feedShorts.length && !_shortsRowShown) {
      _shortsRowShown = true;
      container.insertAdjacentHTML('beforeend', _shortsRowHtml(_shuffle(_feedShorts).slice(0, Math.min(12, _feedShorts.length)), true));
    }
    return;
  }
  const n = 2 + Math.floor(Math.random()*3); // 2-4 per chunk
  let longHtml = '';
  for (let i=0; i<n && _feedLongIdx < _feedLong.length; i++){
    longHtml += _longCardHtml(_feedLong[_feedLongIdx]);
    _feedLongIdx++;
  }
  if (longHtml) container.insertAdjacentHTML('beforeend', `<div class="feed-longs">${longHtml}</div>`);
  // (Shorts shelf appears once ALL longs are shown — see the exhausted branch above.
  //  Live Dares strip is rendered at the very top by _renderInterleavedFeed.)
}
function _longCardHtml(p) {
  const dur = p.videoDuration ? (p.videoDuration>=60?Math.floor(p.videoDuration/60)+':'+String(p.videoDuration%60).padStart(2,'0'):'0:'+String(p.videoDuration).padStart(2,'0')) : '';
  const t = vidThumb(p, 640);
  return `
    <div class="yt-card" onclick="openVideoDetail('${p.id}')" data-vurl="${p.videoURL||''}" data-dur="${p.videoDuration||0}">
      <div class="yt-thumb">
        ${t ? `<img src="${t}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'"/>` : `<div class="yt-thumb-bg"><span class="mi">bolt</span></div>`}
        ${dur?`<div class="yt-dur">${dur}</div>`:''}
        <div class="yt-bounty">$${(p.dareBounty||0).toLocaleString('en-IN')}</div>
      </div>
      <div class="yt-info">
        <div class="yt-av">${_avHtml(p.takerPhotoURL, p.takerName)}</div>
        <div class="yt-meta">
          <div class="yt-title">${escHtml(p.dareTitle||'Mission Completed')}</div>
          <div class="yt-sub"><span>@${p.takerUsername||p.takerName||'creator'}</span><span class="yt-dot"></span><span>${(p.viewCount||0).toLocaleString('en-IN')} views</span><span class="yt-dot"></span><span>${_relTime(p)}</span></div>
        </div>
      </div>
    </div>`;
}

function _shortsRowHtml(shorts, noHdr) {
  return `<div class="home-section shorts-home-sec">
    ${noHdr ? '' : `<div class="home-sec-hdr"><span class="mi" style="color:#FF0033;font-size:22px;">play_circle</span><span class="home-sec-title">Shorts</span></div>`}
    <div class="shorts-row">${shorts.map(p=>{
      const t = vidThumb(p, 360);
      const _w = (p.dareTitle||'Short').trim().split(/\s+/);
      const _cap = _w.length > 5 ? _w.slice(0,5).join(' ') + '...' : _w.join(' ');
      return `
      <div class="short-card" onclick="openShorts('${p.id}')" data-vurl="${p.videoURL||''}" data-dur="${p.videoDuration||0}">
        <div class="short-thumb">
          ${t ? `<img src="${t}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'"/>` : `<div class="yt-thumb-bg"><span class="mi">bolt</span></div>`}
          <div class="short-bounty-tag">$${(p.dareBounty||0).toLocaleString('en-IN')}</div>
        </div>
        <div class="short-cap">${escHtml(_cap)}</div>
        <div class="short-meta">${(p.viewCount||0).toLocaleString('en-IN')} views</div>
      </div>`;}).join('')}</div>
  </div>`;
}

// #8: Render the vertical scroll-snap shorts stack
function _renderShortsSnapStack() {
  const c = document.getElementById('shortsSnapContainer');
  if (!c) return;
  c.innerHTML = shortsFeed.map((p,i) => _shortsSlideHtml(p,i)).join('');
  // Jump STRAIGHT to the clicked short, instantly and synchronously. The container
  // has CSS scroll-behavior:smooth, so scrollIntoView (even behavior:'auto') would
  // ANIMATE through every earlier short — the "sab shorts scroll hote dikhte" flash.
  const items = c.querySelectorAll('.shorts-snap-item');
  c.style.scrollBehavior = 'auto';
  if (items[shortsIndex]) c.scrollTop = items[shortsIndex].offsetTop - items[0].offsetTop;
  requestAnimationFrame(() => { c.style.scrollBehavior = ''; });
  _shortsPlayCurrent();
  // On scroll-end, detect current index and play it
  if (!c._snapBound) {
    c._snapBound = true;
    let _snapTimer = null;
    c.addEventListener('scroll', () => {
      clearTimeout(_snapTimer);
      _snapTimer = setTimeout(() => {
        const cTop = c.getBoundingClientRect().top;   // compare item tops to the container top
        const items = c.querySelectorAll('.shorts-snap-item');
        let bestIdx = 0, bestDelta = Infinity;
        items.forEach((it, i) => {
          const delta = Math.abs(it.getBoundingClientRect().top - cTop);
          if (delta < bestDelta) { bestDelta = delta; bestIdx = i; }
        });
        if (bestIdx !== shortsIndex) {
          shortsIndex = bestIdx;
          shortsCaptionExpanded = false;
          renderShort();
          _shortsPlayCurrent();
        }
      }, 120);
    }, { passive: true });
  }
}
function _shortsPlayCurrent() {
  const c = document.getElementById('shortsSnapContainer');
  if (!c) return;
  c.querySelectorAll('video').forEach(v => { try { v.pause(); v.muted = true; } catch(e){} });
  const items = c.querySelectorAll('.shorts-snap-item');
  // Lazy-load: only the current short ±1 hold a real src; everything else unloads
  items.forEach((it, i) => {
    const v = it.querySelector('video'); if (!v) return;
    if (Math.abs(i - shortsIndex) <= 1) {
      if (!v._vqLoaded && v.dataset.src){ v._vqLoaded = true; _playSmart(v, v.dataset.src, { autoplay:false, maxW:720 }); }
    } else if (v._vqLoaded || v.getAttribute('src')) {
      v._vqLoaded = false;
      _vqDestroy(v);
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch(e){}
    }
  });
  const cur = items[shortsIndex];
  if (cur) {
    const v = cur.querySelector('video');
    if (v) {
      v.muted = false; v.currentTime = 0; v.playbackRate = _SHORTS_SPEEDS[_shortsSpeedIdx] || 1;
      v.loop = !_shortsAutoScroll;                                  // auto-scroll → don't loop
      v.onended = () => { if (_shortsAutoScroll) shortsNav(1); };   // …advance to next short
      v.play().catch(()=>{}); _shortsSlideSyncIcons(v);
    }
  }
}

// Cloudinary auto-thumbnail: video URL → static JPG frame (YouTube-style)
// https://res.cloudinary.com/X/video/upload/v1/abc.mp4 → .../video/upload/so_2,w_640,c_fill,q_auto/v1/abc.jpg
function vidThumb(p, w) {
  w = w || 640;
  if (p.proofThumbnailURL) return p.proofThumbnailURL;  // frame-picker choice wins
  const u = p.videoURL || '';
  if (u.includes('res.cloudinary.com') && u.includes('/video/upload/')) {
    return u.replace('/video/upload/', `/video/upload/so_2,w_${w},c_fill,q_auto,f_jpg/`)
            .replace(/\.(mp4|webm|mov|mkv|avi|3gp|3g2|m4v|wmv|flv|mpg|mpeg|ogv)(\?.*)?$/i, '.jpg');
  }
  return ''; // non-cloudinary: no thumb
}
// Cloudinary on-the-fly video optimization: best format + auto quality + resolution
// cap. Turns the raw upload into a much lighter stream (adaptive-ish, YouTube-style);
// Cloudinary transcodes once then serves it from the CDN cache.
function _optVid(url, w){
  if(!url || !url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) return url;
  if(/\/video\/upload\/[^/]*[,_](?:q|w|f)_/.test(url)) return url;   // already transformed
  return url.replace('/video/upload/', `/video/upload/f_auto,q_auto${w?`,w_${w},c_limit`:''}/`);
}
function _vidMaxW(){ return (typeof window!=='undefined' && window.innerWidth<=768) ? 720 : 1280; }

// ════════════════════════════════════════════════════════════════════
//  THUMBNAIL ADJUSTER — crop any image to 16:9 (long) or 9:16 (short) with drag + zoom
// ════════════════════════════════════════════════════════════════════
let _taState = { img:null, scale:1, x:0, y:0, baseW:0, baseH:0, natW:0, natH:0,
                 dragging:false, startX:0, startY:0, originX:0, originY:0,
                 target:'creator', file:null, pinchDist:0, ratio:'16:9' };

function openThumbAdjust(file, target, ratio) {
  _taState.file = file;
  _taState.target = target || 'creator';
  _taState.ratio = (ratio === '9:16') ? '9:16' : '16:9';
  // Shape the crop frame to the chosen ratio (16:9 long videos, 9:16 shorts)
  const stage = document.getElementById('taStage');
  if (stage) {
    if (_taState.ratio === '9:16') {
      stage.style.aspectRatio = '9 / 16';
      stage.style.width = 'auto';
      stage.style.maxWidth = '250px';
      stage.style.margin = '14px auto';
    } else {
      stage.style.aspectRatio = '16 / 9';
      stage.style.width = '';
      stage.style.maxWidth = '';
      stage.style.margin = '';
    }
  }
  const img = document.getElementById('taImg');
  const url = URL.createObjectURL(file);
  img.onload = () => {
    _taState.natW = img.naturalWidth;
    _taState.natH = img.naturalHeight;
    _taSetup();
  };
  img.src = url;
  document.getElementById('taZoom').value = 100;
  const modal = document.getElementById('thumbAdjustModal');
  modal.style.display = 'flex';
  modal.classList.add('open');   // .overlay is opacity:0/pointer-events:none until .open — without this the adjuster opened invisibly
}

function _taSetup() {
  const stage = document.getElementById('taStage');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const { natW, natH } = _taState;
  // "cover" base scale so image fills the 16:9 frame at zoom=100
  const coverScale = Math.max(sw / natW, sh / natH);
  _taState.baseW = natW * coverScale;
  _taState.baseH = natH * coverScale;
  _taState.scale = 1;
  // center
  _taState.x = (sw - _taState.baseW) / 2;
  _taState.y = (sh - _taState.baseH) / 2;
  _taApply();
}

function _taApply() {
  const img = document.getElementById('taImg');
  const stage = document.getElementById('taStage');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  _taState.scale = parseInt(document.getElementById('taZoom').value, 10) / 100;
  const w = _taState.baseW * _taState.scale;
  const h = _taState.baseH * _taState.scale;
  // clamp so frame stays covered (no empty edges)
  _taState.x = Math.min(0, Math.max(sw - w, _taState.x));
  _taState.y = Math.min(0, Math.max(sh - h, _taState.y));
  img.style.width = w + 'px';
  img.style.height = h + 'px';
  img.style.transform = `translate(${_taState.x}px, ${_taState.y}px)`;
}

// ── Drag (mouse + touch) ──
function _taPointerDown(e) {
  _taState.dragging = true;
  const p = e.touches ? e.touches[0] : e;
  _taState.startX = p.clientX; _taState.startY = p.clientY;
  _taState.originX = _taState.x; _taState.originY = _taState.y;
  if (e.touches && e.touches.length === 2) {
    _taState.pinchDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY);
  }
}
function _taPointerMove(e) {
  if (!_taState.dragging) return;
  e.preventDefault();
  // pinch zoom
  if (e.touches && e.touches.length === 2) {
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY);
    if (_taState.pinchDist) {
      const z = document.getElementById('taZoom');
      let nz = parseInt(z.value,10) * (d / _taState.pinchDist);
      nz = Math.max(100, Math.min(300, nz));
      z.value = Math.round(nz);
      _taState.pinchDist = d;
      _taApply();
    }
    return;
  }
  const p = e.touches ? e.touches[0] : e;
  _taState.x = _taState.originX + (p.clientX - _taState.startX);
  _taState.y = _taState.originY + (p.clientY - _taState.startY);
  _taApply();
}
function _taPointerUp() { _taState.dragging = false; _taState.pinchDist = 0; }

function _taBindDrag() {
  const stage = document.getElementById('taStage');
  if (!stage || stage._taBound) return;
  stage._taBound = true;
  stage.addEventListener('mousedown', _taPointerDown);
  window.addEventListener('mousemove', _taPointerMove);
  window.addEventListener('mouseup', _taPointerUp);
  stage.addEventListener('touchstart', _taPointerDown, { passive:false });
  stage.addEventListener('touchmove', _taPointerMove, { passive:false });
  stage.addEventListener('touchend', _taPointerUp);
}

function closeThumbAdjust() {
  const modal = document.getElementById('thumbAdjustModal');
  modal.classList.remove('open');
  modal.style.display = 'none';
}

// ── Render the visible 16:9 crop to a canvas → File ──
function applyThumbAdjust() {
  const stage = document.getElementById('taStage');
  const sw = stage.clientWidth, sh = stage.clientHeight;
  // Output: 1280x720 for 16:9 (long), 720x1280 for 9:16 (short)
  const is916 = _taState.ratio === '9:16';
  const OUT_W = is916 ? 720 : 1280;
  const OUT_H = is916 ? 1280 : 720;
  const canvas = document.createElement('canvas');
  canvas.width = OUT_W; canvas.height = OUT_H;
  const ctx = canvas.getContext('2d');
  // Map stage coords → source image coords
  const w = _taState.baseW * _taState.scale;
  const h = _taState.baseH * _taState.scale;
  const scaleX = _taState.natW / w;   // src px per displayed px
  const scaleY = _taState.natH / h;
  // The frame's top-left in image space:
  const srcX = (-_taState.x) * scaleX;
  const srcY = (-_taState.y) * scaleY;
  const srcW = sw * scaleX;
  const srcH = sh * scaleY;
  const img = document.getElementById('taImg');
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,OUT_W,OUT_H);
  try {
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, OUT_W, OUT_H);
  } catch(err) {
    showToast('Could not process image'); return;
  }
  canvas.toBlob((blob) => {
    if (!blob) { showToast('Could not process image'); return; }
    const cropped = new File([blob], (is916 ? 'thumbnail_9x16.jpg' : 'thumbnail_16x9.jpg'), { type:'image/jpeg' });
    if (_taState.target === 'creator') {
      selectedThumb = cropped;
      const prev = document.getElementById('thumbPreview');
      prev.src = URL.createObjectURL(cropped);
      prev.style.display = 'block';
      document.getElementById('thumbDZInner').style.display = 'none';
      document.getElementById('thumbEditRow').style.display = 'flex';
      document.getElementById('thumbDZ').classList.add('has-media');
    } else if (_taState.target === 'proof') {
      // Taker proof modal: custom uploaded thumbnail (16:9 or 9:16 per video)
      proofCapturedFrameBlob = cropped;
      const img = document.getElementById('proofThumbPreview');
      if (img) { if (img.src) URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(cropped); }
      const row = document.getElementById('proofFrameCaptured');
      if (row) row.style.display = 'flex';
    } else {
      // taker proof thumbnail (post-dare video tab)
      proofCapturedFrameBlob = cropped;
      _setProofThumbPreview(URL.createObjectURL(cropped));
    }
    closeThumbAdjust();
    showToast('Thumbnail set (' + (is916 ? '9:16' : '16:9') + ')');
  }, 'image/jpeg', 0.9);
}

// Taker uploads custom thumbnail → adjust to 16:9
function onProofThumbUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please select an image'); return; }
  if (file.size > 5*1024*1024) { showToast('Max 5MB allowed'); return; }
  _taBindDrag();
  openThumbAdjust(file, 'taker');
  e.target.value = '';
}

// Taker (proof modal) uploads a custom image thumbnail.
// Crop ratio follows the video: 9:16 video → 9:16 thumb (YouTube short style),
// 16:9 video → 16:9 thumb.
function onProofModalThumbUpload(e) {
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please select an image'); return; }
  if (file.size > 5*1024*1024) { showToast('Max 5MB allowed'); return; }
  const ratio = (selectedVideoH > 0 && selectedVideoW > 0 && selectedVideoH > selectedVideoW) ? '9:16' : '16:9';
  _taBindDrag();
  openThumbAdjust(file, 'proof', ratio);
  e.target.value = '';
}
// Helper: set proof thumb preview if the element exists
function _setProofThumbPreview(url) {
  const el = document.getElementById('fpThumb');
  if (el) { el.src = url; el.style.display = 'block'; }
  const row = document.getElementById('fpCapturedRow');
  if (row) row.style.display = 'flex';
}

// ════════════════════════════════════════════════════════════════════
//  VIDEO PREVIEW — YouTube-style hover (desktop) + scroll autoplay (mobile)
//  Applies to long-video cards (.feed-longs .yt-card[data-vurl]).
// ════════════════════════════════════════════════════════════════════
let _pvVideo = null, _pvTimer = null, _pvCard = null, _pvSoundOn = false;
const _pvIsTouch = () => window.matchMedia('(hover:none),(pointer:coarse)').matches || window.innerWidth <= 768;

// Sample points cut across the clip (mimics YouTube's snippet preview)
function _pvSamples(D){
  const n = D<=20 ? 3 : (D<=60 ? 4 : 5);
  const a=[]; for(let i=0;i<n;i++) a.push(Math.max(0, D*((i+0.5)/n))); return a;
}

function _pvStop(){
  if (_pvTimer){ clearInterval(_pvTimer); _pvTimer=null; }
  if (_pvVideo){
    try{ _pvVideo.pause(); }catch(e){}
    const th=_pvVideo.closest('.yt-thumb, .short-thumb');
    if(th){ th.classList.remove('playing'); const c=th.querySelector('.yt-pv-ctrls'); if(c) c.remove(); }
    _pvVideo.remove(); _pvVideo=null;
  }
  _pvCard=null;
}

// volume (top-right) + pause (below) controls for the full-play preview
function _pvAddControls(thumb){
  const wrap=document.createElement('div'); wrap.className='yt-pv-ctrls';
  const vol=document.createElement('button'); vol.className='yt-pv-btn';
  vol.innerHTML=`<span class="mi">${_pvSoundOn?'volume_up':'volume_off'}</span>`;
  vol.onclick=(e)=>{ e.stopPropagation(); e.preventDefault();
    _pvSoundOn=!_pvSoundOn; if(_pvVideo) _pvVideo.muted=!_pvSoundOn;
    vol.innerHTML=`<span class="mi">${_pvSoundOn?'volume_up':'volume_off'}</span>`; };
  const pause=document.createElement('button'); pause.className='yt-pv-btn';
  pause.innerHTML=`<span class="mi">pause</span>`;
  pause.onclick=(e)=>{ e.stopPropagation(); e.preventDefault();
    if(!_pvVideo) return;
    if(_pvVideo.paused){ _pvVideo.play().catch(()=>{}); pause.innerHTML=`<span class="mi">pause</span>`; }
    else { _pvVideo.pause(); pause.innerHTML=`<span class="mi">play_arrow</span>`; } };
  wrap.appendChild(vol); wrap.appendChild(pause); thumb.appendChild(wrap);
}

// mode 'long' → play normally (no cuts), muted, looping, + volume/pause buttons
// mode 'short' → cut-cut sampled snippet preview (always muted, no controls)
function _pvPlay(card, mode){
  if (user && user.settings && user.settings.autoplay === false) return;   // Additional settings → Autoplay off
  if (_ovStack.length || document.body.classList.contains('ov-open')) return;  // never preview behind a popup
  const vurl=card.getAttribute('data-vurl'); if(!vurl) return;
  if (_pvCard===card) return;
  _pvStop();
  _pvCard=card;
  const thumb=card.querySelector('.yt-thumb, .short-thumb'); if(!thumb){ _pvCard=null; return; }
  const v=document.createElement('video');
  v.src=_optVid(vurl, 400); v.playsInline=true; v.setAttribute('playsinline','');
  v.preload='auto'; v.className='yt-preview-vid';
  thumb.appendChild(v); _pvVideo=v; thumb.classList.add('playing');

  if(mode==='short'){
    // SHORTS: cut-cut snippet hop across the clip
    v.muted=true;
    const fallbackDur=parseFloat(card.getAttribute('data-dur'))||0;
    let samples=[], si=0;
    const begin=()=>{
      const D=(isFinite(v.duration)&&v.duration>0)?v.duration:(fallbackDur||10);
      samples=_pvSamples(D); si=0;
      try{ v.currentTime=samples[0]; }catch(e){}
      v.play().catch(()=>{});
      _pvTimer=setInterval(()=>{
        if(!_pvVideo) return;
        si=(si+1)%samples.length;
        try{ v.currentTime=samples[si]; }catch(e){}
        v.play().catch(()=>{});
      }, 1400);
    };
    v.addEventListener('loadedmetadata', begin, { once:true });
    v.addEventListener('error', _pvStop, { once:true });
    return;
  }

  // LONG: normal continuous playback, muted unless sound toggled, looping + controls
  v.loop=true; v.muted=!_pvSoundOn;
  _pvAddControls(thumb);
  v.play().catch(()=>{});
}

// ── Desktop: hover to preview (with ~280ms hover-intent so sweeping the mouse
//    across the feed doesn't spawn a video on every card) ──
let _pvHoverTO=null;
function _pvBindHover(){
  document.addEventListener('mouseover', (e)=>{
    if(_pvIsTouch()) return;
    const longC=e.target.closest('.feed-longs .yt-card');
    const shortC=e.target.closest('.short-card');
    const card=longC||shortC; if(!card) return;
    if(card.closest('#videoDetailOverlay,#shortsOverlay,#dareDetailOverlay')) return;
    if(card!==_pvCard){ clearTimeout(_pvHoverTO); _pvHoverTO=setTimeout(()=>_pvPlay(card, longC?'long':'short'), 280); }
  });
  document.addEventListener('mouseout', (e)=>{
    if(_pvIsTouch()) return;
    const card=e.target.closest('.feed-longs .yt-card, .short-card'); if(!card) return;
    const to=e.relatedTarget;
    if(card===_pvCard && (!to || !card.contains(to))){ clearTimeout(_pvHoverTO); _pvStop(); }
    else if(!to || !card.contains(to)){ clearTimeout(_pvHoverTO); }
  });
}

// ── Mobile: stop scrolling on a centered card → it plays. Uses an IntersectionObserver
//    so we only measure ON-SCREEN cards (no getBoundingClientRect on the whole feed =
//    no forced reflow, and it plays nice with content-visibility). ──
let _pvScrollTO=null, _pvVisible=new Set(), _pvIO=null;
function _pvObserveCards(){
  if(!_pvIO){
    _pvIO=new IntersectionObserver((ents)=>{
      for(const en of ents){ if(en.isIntersecting) _pvVisible.add(en.target); else _pvVisible.delete(en.target); }
    }, { threshold:0 });
  }
  document.querySelectorAll('.feed-longs .yt-card[data-vurl]').forEach(c=>{ if(!c._pvObs){ c._pvObs=true; _pvIO.observe(c); } });
}
function _pvPlayCentered(){
  if(!_pvIsTouch()) return;
  _pvObserveCards();                                  // pick up newly-appended cards (no layout cost)
  const cy=window.innerHeight/2; let best=null, bestD=1e9;
  for(const c of _pvVisible){
    if(!c.isConnected || !c.closest('.page.active') || !c.getAttribute('data-vurl')) continue;
    const r=c.getBoundingClientRect();               // only on-screen cards → cheap, already laid out
    const d=Math.abs((r.top+r.height/2)-cy);
    if(d<bestD){ bestD=d; best=c; }
  }
  if(!best || bestD > window.innerHeight*0.32){ _pvStop(); return; }
  if(best!==_pvCard) _pvPlay(best, 'long');
}
function _pvBindScroll(){
  const onScroll=()=>{
    if(!_pvIsTouch()) return;
    if(_pvScrollTO) clearTimeout(_pvScrollTO);
    _pvScrollTO=setTimeout(_pvPlayCentered, 2000);
  };
  window.addEventListener('scroll', onScroll, { passive:true });
  const main=document.querySelector('.main'); if(main) main.addEventListener('scroll', onScroll, { passive:true });
  setTimeout(()=>{ if(_pvIsTouch()) _pvPlayCentered(); }, 2200);
}

// stop any preview when opening a real detail view
function _pvStopOnNav(){ _pvStop(); }

_pvBindHover();
_pvBindScroll();

// While actively scrolling, mark the body so hover effects on cards are suppressed —
// otherwise every card that slides under a stationary cursor fires its :hover
// transform/transition = repaint churn = dropped frames (desktop). Cheap: one class
// toggled at scroll start, cleared 140ms after the last scroll event.
(function(){
  let _scrTO=null;
  const onScroll=()=>{
    const b=document.body;
    if(!b.classList.contains('scrolling')) b.classList.add('scrolling');
    if(_scrTO) clearTimeout(_scrTO);
    _scrTO=setTimeout(()=>b.classList.remove('scrolling'), 140);
  };
  window.addEventListener('scroll', onScroll, { passive:true });
})();

// ════════════════════════════════════════════════════════════════════
//  DOM WINDOWING — the real YouTube technique. content-visibility already
//  skips off-screen LAYOUT+PAINT, but the nodes (and their decoded images)
//  stay in the DOM / GPU memory. Here, cards far outside the viewport
//  (±1500px) get their innerHTML swapped for a fixed-height empty shell and
//  restored as they scroll back near. Cuts GPU memory + per-frame raster.
// ════════════════════════════════════════════════════════════════════
const _WIN_SEL = '.yt-card, .dare-list-card, .active-dare-card, .short-card';
let _winIO = null;
function _winEmpty(el, h){
  if (el._winOut || !h) return;          // h=0 → card inside a hidden page, skip
  el._winHtml = el.innerHTML;
  el.style.height = h + 'px';            // exact height → zero layout shift
  el.innerHTML = '';
  el._winOut = true;
}
function _winRestore(el){
  if (!el._winOut) return;
  el.innerHTML = el._winHtml || '';
  el._winHtml = null;
  el.style.height = '';
  el._winOut = false;
}
function _winScan(){
  if (!_winIO){
    _winIO = new IntersectionObserver((ents)=>{
      for (const en of ents){
        const el = en.target;
        if (en.isIntersecting) _winRestore(el);
        else if (el.isConnected) _winEmpty(el, en.boundingClientRect.height);
      }
    }, { rootMargin: '1500px' });
  }
  document.querySelectorAll(_WIN_SEL).forEach(c=>{
    if (!c._winObs && !c.classList.contains('skel-yt')){ c._winObs = true; _winIO.observe(c); }
  });
}
// One hook covers every render path: whenever a feed re-renders, re-scan.
(function(){
  let _wTO = null;
  new MutationObserver(()=>{ if (_wTO) clearTimeout(_wTO); _wTO = setTimeout(_winScan, 180); })
    .observe(document.body, { childList: true, subtree: true });
  setTimeout(_winScan, 800);
})();

// ════════════════════════════════════════════════════════════════════
//  ADAPTIVE STREAMING (YouTube-style) — Cloudinary HLS (sp_auto) + hls.js.
//  Quality steps up/down with the network mid-playback. Per-video quality
//  menu (3-dots → Quality): Auto (Adaptive) or a locked resolution.
//  If HLS fails (plan/transcode/unsupported) → silent fallback to the
//  existing capped-MP4 path (_optVid), where manual quality reloads the src.
// ════════════════════════════════════════════════════════════════════
let _hlsLibP = null;
function _ensureHls(){
  if (window.Hls) return Promise.resolve();
  if (_hlsLibP) return _hlsLibP;
  _hlsLibP = new Promise((res, rej)=>{
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js';
    s.onload = res; s.onerror = ()=>{ _hlsLibP = null; rej(); };
    document.head.appendChild(s);
  });
  return _hlsLibP;
}
function _vidHlsUrl(url){
  if(!url || !url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) return null;
  if(/\/video\/upload\/[^/]*sp_/.test(url)) return url;
  let u = url.replace('/video/upload/', '/video/upload/sp_auto/');
  if(/\.(mp4|webm|mov|mkv|avi|3gp|3g2|m4v|wmv|flv|mpg|mpeg|ogv)(\?.*)?$/i.test(u)) u = u.replace(/\.(mp4|webm|mov|mkv|avi|3gp|3g2|m4v|wmv|flv|mpg|mpeg|ogv)(\?.*)?$/i, '.m3u8');
  else if(u.includes('?')) u = u.replace('?', '.m3u8?');
  else u += '.m3u8';                    // extension-less Cloudinary URL → force HLS format
  return u;
}
// user quality preference: 'auto' (adaptive) or a number = shorter-side pixels
let _vqPref = (function(){ try{ const v=localStorage.getItem('dm_vq'); return v && v!=='auto' ? +v : 'auto'; }catch(e){ return 'auto'; } })();
const _VQ_W = { 1080:1920, 720:1280, 480:854, 360:640 };   // shorter-side → mp4 width cap
function _vqDestroy(v){ if(v && v._hls){ try{ v._hls.destroy(); }catch(e){} v._hls=null; } if(v) v._isHls=false; }
function _vqMp4W(maxW){
  if(_vqPref==='auto') return maxW || _vidMaxW();
  return Math.min(_VQ_W[_vqPref] || 1280, maxW || 99999);
}
function _playSmart(v, rawUrl, opts){
  opts = opts || {};
  if(!v || !rawUrl) return;
  _vqDestroy(v);
  v._rawUrl = rawUrl;
  const done = ()=>{
    // seek FIRST, play AFTER — playing before the seek lands means the user
    // hears the first seconds of audio before the video jumps to the resume point
    const start = ()=>{ if(opts.autoplay !== false) v.play().catch(()=>{}); };
    if(opts.resume){
      const s = ()=>{ try{ v.currentTime = opts.resume; }catch(e){} start(); };
      if(v.readyState >= 1) s(); else v.addEventListener('loadedmetadata', s, { once:true });
    } else start();
  };
  const hlsUrl = _vidHlsUrl(rawUrl);
  let _fellBack = false;
  const mp4 = ()=>{
    if(_fellBack) return; _fellBack = true;
    _vqDestroy(v); v.src = _optVid(rawUrl, _vqMp4W(opts.maxW)); done();
    // warm the HLS derivation in the background so the NEXT play streams adaptively
    if(hlsUrl){ try{ fetch(hlsUrl, { mode:'no-cors' }).catch(()=>{}); }catch(e){} }
  };
  if(!hlsUrl){ mp4(); return; }
  const native = ()=>{                                          // Safari: native HLS
    v._isHls = 'native';
    v.addEventListener('error', mp4, { once:true });
    // watchdog — some browsers claim HLS support but never load data
    const wd = setTimeout(()=>{ if(v.readyState === 0) mp4(); }, 6000);
    v.addEventListener('loadeddata', ()=>clearTimeout(wd), { once:true });
    v.src = hlsUrl; done();
  };
  // hls.js FIRST (Chrome/Edge/Firefox claim "maybe" for HLS but can't really play it)
  _ensureHls().then(()=>{
    if(!window.Hls || !Hls.isSupported()){
      if(v.canPlayType('application/vnd.apple.mpegurl')) native(); else mp4();
      return;
    }
    const h = new Hls({ capLevelToPlayerSize:true, maxBufferLength:20, backBufferLength:30,
                        manifestLoadingMaxRetry:2, manifestLoadingRetryDelay:1000 });
    v._hls = h; v._isHls = true;
    h.on(Hls.Events.ERROR, (e, data)=>{ if(data && data.fatal){ _vqDestroy(v); mp4(); } });
    h.on(Hls.Events.MANIFEST_PARSED, ()=>{ _vqApply(v); done(); });
    h.loadSource(hlsUrl);
    h.attachMedia(v);
  }).catch(()=>{
    if(v.canPlayType('application/vnd.apple.mpegurl')) native(); else mp4();
  });
}
// apply the current preference to a video (hls: level lock / auto; mp4: reload src)
function _vqApply(v){
  if(!v) return;
  if(v._hls && v._hls.levels && v._hls.levels.length){
    if(_vqPref === 'auto'){ v._hls.currentLevel = -1; return; }
    let best = -1, bestD = 1e9;
    v._hls.levels.forEach((L, i)=>{
      const side = Math.min(L.width||0, L.height||0) || (L.height||0);
      const d = Math.abs(side - _vqPref);
      if(d < bestD){ bestD = d; best = i; }
    });
    v._hls.currentLevel = best;
    return;
  }
  if(v._rawUrl && !v._isHls){                                   // capped-MP4 mode → reload at new cap
    const t = v.currentTime || 0, playing = !v.paused && !v.ended;
    v.src = _optVid(v._rawUrl, _vqMp4W());
    v.addEventListener('loadedmetadata', ()=>{ try{ v.currentTime = t; }catch(e){} if(playing) v.play().catch(()=>{}); }, { once:true });
  }
}
function _vqLabel(){ return _vqPref==='auto' ? 'Auto' : _vqPref+'p'; }

// ── Quality menu (micro panel — same policy as dropdowns: no URL/back entry) ──
let _vqTarget = null;
function openQualityMenu(v){
  if(!v) return;
  _vqTarget = v;
  let w = document.getElementById('vqWrap');
  if(!w){
    w = document.createElement('div');
    w.id = 'vqWrap'; w.className = 'vq-wrap';
    w.innerHTML = '<div class="vq-dim" onclick="closeQualityMenu()"></div><div class="vq-menu" id="vqMenu"></div>';
    document.body.appendChild(w);
  }
  // resolutions: from the HLS ladder when available, else the standard set
  let opts = [1080, 720, 480, 360];
  if(v._hls && v._hls.levels && v._hls.levels.length){
    const set = [...new Set(v._hls.levels.map(L=>Math.min(L.width||0,L.height||0)||L.height||0))].filter(Boolean);
    if(set.length) opts = set.sort((a,b)=>b-a);
  }
  const m = document.getElementById('vqMenu');
  const item = (val, lbl, sub)=>{
    const sel = String(_vqPref) === String(val);
    return '<button class="vq-item'+(sel?' sel':'')+'" onclick="_vqChoose(\''+val+'\')">'
      + '<span class="mi">'+(sel?'check':(val==='auto'?'autorenew':'high_quality'))+'</span>'
      + '<span>'+lbl+(sub?' <span class="vq-sub">'+sub+'</span>':'')+'</span></button>';
  };
  m.innerHTML = '<div class="vq-title">Video quality</div>'
    + item('auto', 'Auto (Adaptive)', 'adjusts to your network')
    + opts.map(o=>item(o, o+'p')).join('');
  w.classList.add('open');
}
function closeQualityMenu(){ const w=document.getElementById('vqWrap'); if(w) w.classList.remove('open'); }
function _vqChoose(val){
  _vqPref = (val==='auto') ? 'auto' : +val;
  try{ localStorage.setItem('dm_vq', String(_vqPref)); }catch(e){}
  if(_vqTarget) _vqApply(_vqTarget);
  const l = document.getElementById('shortsQLbl'); if(l) l.textContent = _vqLabel();
  closeQualityMenu();
  showToast(_vqPref==='auto' ? 'Quality: Auto (Adaptive)' : 'Quality: '+_vqPref+'p');
}
function shortsQuality(){
  const c = document.getElementById('shortsSnapContainer'); if(!c) return;
  const it = c.querySelectorAll('.shorts-snap-item')[shortsIndex];
  const v = it && it.querySelector('video');
  if(v) openQualityMenu(v);
}

// ── Buffering spinner: any long/short player that stalls on the network shows
//    a centered loading circle (media events don't bubble — use capture). ──
(function(){
  const SEL = '#vdPlayer, #vpPlayer, .shorts-snap-video';
  function spinFor(v, make){
    const p = v.parentElement; if(!p) return null;
    if(!p._vspin && make){
      if(getComputedStyle(p).position === 'static') p.style.position = 'relative';
      const s = document.createElement('div'); s.className = 'vspin'; s.style.display = 'none';
      s.innerHTML = '<span class="mi">bolt</span>';           // brand loader — the shimmering bolt
      p.appendChild(s); p._vspin = s;
    }
    return p._vspin || null;
  }
  const isV = e => e.target instanceof HTMLVideoElement && e.target.matches(SEL);
  const show = e => { if(!isV(e)) return;
    if(!navigator.onLine) e.target._netErr = true;            // stalled offline → retry when back online
    const s = spinFor(e.target, true); if(s) s.style.display = 'block'; };
  const hide = e => { if(!isV(e)) return;
    // offline failure pending auto-retry → keep the bolt pulsing (the play()
    // rejection fires a trailing 'pause' that would otherwise hide it)
    if(e.type !== 'emptied' && e.target._netErr && !navigator.onLine) return;
    const s = spinFor(e.target, false); if(s) s.style.display = 'none'; };
  ['waiting','stalled','seeking'].forEach(ev => document.addEventListener(ev, show, true));
  ['playing','canplay','pause','emptied','seeked'].forEach(ev => document.addEventListener(ev, hide, true));
  document.addEventListener('play', e => { if(isV(e) && e.target.readyState < 3) show(e); }, true);
  // load error while OFFLINE: keep the bolt pulsing (it will auto-retry on reconnect);
  // a real error while online just hides the loader
  document.addEventListener('error', e => {
    if(!isV(e)) return;
    const v = e.target;
    if(!navigator.onLine){ v._netErr = true; const s = spinFor(v, true); if(s) s.style.display = 'block'; }
    else { const s = spinFor(v, false); if(s) s.style.display = 'none'; }
  }, true);
})();

// ── Offline / online: tell the user + auto-recover interrupted videos ──
window.addEventListener('offline', ()=>{ try{ showToast('No internet connection'); }catch(e){} });
window.addEventListener('online', ()=>{
  try{ showToast('Back online'); }catch(e){}
  document.querySelectorAll('video').forEach(v=>{
    if(!v._netErr || !v.isConnected || !v._rawUrl) return;
    v._netErr = false;
    const host = v.closest('.overlay.open, .video-detail-overlay.open, #shortsOverlay.open, .page.active');
    if(host) _playSmart(v, v._rawUrl, { resume: v.currentTime || 0,
      maxW: v.classList.contains('shorts-snap-video') ? 720 : _vidMaxW() });
  });
});

// ── Offline app shell (fonts/css/js survive refresh without network) ──
if ('serviceWorker' in navigator) { try{ navigator.serviceWorker.register('/sw.js'); }catch(e){} }

// ── Pause the world behind popups / page switches; resume on the way back ──
let _bgPaused = [];
function _pauseAllMedia(track){
  try{ _pvStop(); }catch(e){}
  document.querySelectorAll('video').forEach(v=>{
    if(!v.paused && !v.ended){
      if(track){ v._bgResume = true; _bgPaused.push(v); }
      try{ v.pause(); }catch(e){}
    }
  });
  if(!track) _bgPaused = [];        // page switch → nothing should auto-resume later
}
function _resumeBgMedia(){
  const list = _bgPaused; _bgPaused = [];
  list.forEach(v=>{
    if(!v._bgResume || !v.isConnected) return;
    v._bgResume = false;
    const ov = v.closest('.overlay, .video-detail-overlay, #shortsOverlay');
    const pg = v.closest('.page');
    const visible = (ov && ov.classList.contains('open')) || (pg && pg.classList.contains('active'));
    if(visible) v.play().catch(()=>{});
  });
}

// ── YouTube-style auto-hiding topbar (mobile): scrolling DOWN slides the bar
//    away (fullscreen-app feel); a slight scroll UP brings it back. Near the
//    top it is always shown; open popups force it visible via CSS (ov-open). ──
(function(){
  const mq = window.matchMedia ? window.matchMedia('(max-width:768px)') : null;
  let lastY = 0, acc = 0;
  window.addEventListener('scroll', ()=>{
    if (!mq || !mq.matches) return;
    const y = window.scrollY || 0;
    const dy = y - lastY; lastY = y;
    if (document.body.classList.contains('ov-open')) return;
    if (y < 80){ document.body.classList.remove('tb-hide'); acc = 0; return; }
    acc = (dy > 0) === (acc > 0) ? acc + dy : dy;   // reset on direction change
    if (acc > 24) document.body.classList.add('tb-hide');
    else if (acc < -10) document.body.classList.remove('tb-hide');
  }, { passive:true });
})();
