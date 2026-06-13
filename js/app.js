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
let wallet          = { balance:100000, transactions:[] };
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
    { headline: 'Challenge yourself. Get paid.',    desc: 'Post a dare and set your own bounty.', cta: 'Post a Dare →'    },
    { headline: 'Earn money doing dares!',           desc: 'Accept dares and win real bounty.',    cta: 'Start Earning →'  },
    { headline: 'Your dare, your rules.',            desc: 'Set the bounty. Watch others try.',    cta: 'Try Dare Market →' },
    { headline: 'Real money. Real challenges.',      desc: '100% escrow — bounty guaranteed.',    cta: 'See Dares →'      }
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
        <button class="scroll-ad-cta" onclick="goPage('dares')">See Dares</button>
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
    goPage('home');
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
      wallet        = d.wallet        || { balance:100000, transactions:[] };
      acceptedDares = d.acceptedDares || [];
      pinnedDares   = d.pinnedDares   || [];
      user.username = d.username || (user.name||'user').toLowerCase().replace(/[^a-z0-9_.]/g,'').slice(0,20);
      user.bio      = d.bio      || '';
      userLikes = d.likedProofs || [];
      user.website  = d.website  || '';
      if (d.photoURL) user.picture = d.photoURL;  // saved photo always wins
    }
  } catch(e) {
    console.error('initUser error:', e);
    wallet = { balance:100000, transactions:[] };
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
function startDaresListener() {
  if (daresUnsub) daresUnsub();
  daresUnsub = db.collection('dares')
    .orderBy('createdAt', 'desc')
    .onSnapshot((snap) => {
      dares = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Refresh whichever page is active
      const activePage = document.querySelector('.page.active');
      if (activePage?.id === 'pageDares')    renderDaresPage();
      if (activePage?.id === 'pageAccepted') renderAcceptedPage();
      // Also refresh active dares section on home

    }, (err) => {
      console.error('Dares listener error:', err);
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
  user = null; dares = []; wallet = { balance:100000, transactions:[] }; acceptedDares = [];
  closeDD();
}

// ════════════════════════════
//  NAVIGATION
// ════════════════════════════
function goPage(pg) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page' + pg.charAt(0).toUpperCase() + pg.slice(1));
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = document.getElementById('nav-' + pg);
  if (nav) nav.classList.add('active');
  if (pg === 'home')        renderHome();
  if (pg === 'explore')     renderExplorer();
  if (pg === 'dares')       renderDaresPage();
  if (pg === 'accepted')    renderAcceptedPage();
  if (pg === 'profile')     renderProfile();
  if (pg === 'wallet')      renderWallet();
  if (pg === 'leaderboard') loadLeaderboard();
}

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

// ─── MAIN HOME RENDER ────────────────────────────────────
async function renderHome(cat) {
  if (cat) homeFilterCat = cat;

  const grid = document.getElementById('homeVideoGrid');
  if (grid) grid.innerHTML = `<div class="empty" style="padding:40px;">
    <span class="mi" style="font-size:36px;opacity:.4;">hourglass_empty</span>
    <div class="empty-title">Loading...</div></div>`;

  try {
    const snap = await db.collection('proofs').where('status','==','approved').get();
    homeProofs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allProofs = homeProofs; // sync for explorer/search/related

    const filtered = homeFilterCat === 'all'
      ? homeProofs
      : homeProofs.filter(p => {
          // Check proof tags AND parent dare's tags
          const parentDare = dares.find(d => d.id === p.dareId);
          const pTags = [
            ...(p.tags || (p.cat ? [p.cat] : [])),
            ...(parentDare?.tags || (parentDare?.cat ? [parentDare.cat] : []))
          ];
          return pTags.some(t => t.toLowerCase() === homeFilterCat.toLowerCase());
        });

    // Split by video duration:
    //   shorts  = videoDuration > 0 AND < 60 seconds
    //   regular = no duration stored OR duration >= 60 seconds
    // Route by aspect ratio: vertical (9:16) → shorts, horizontal (16:9) → long
    // Fallback for old videos without dimensions: duration < 60 = short
    // Routing: under 1 min OR 9:16 → Shorts; 1 min+ and 16:9 → Long (see _isShortVideo)
    const shorts  = filtered.filter(p => _isShortVideo(p));
    const regular = filtered.filter(p => !_isShortVideo(p));

    // #7: Build interleaved infinite feed (long + shorts mixed, never-ending)
    _renderInterleavedFeed(regular, shorts);
    // Hide the old separate shorts section (now interleaved)
    const oldShorts = document.getElementById('homeShortsSection');
    if (oldShorts) oldShorts.style.display = 'none';

    _renderHomeChips(homeProofs);

  } catch(e) {
    if (grid) grid.innerHTML = `<div class="empty">
      <span class="mi">error_outline</span>
      <div class="empty-title">Load Error</div>
      <p class="empty-desc">${e.message}</p></div>`;
  }
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
      <p class="empty-desc">Complete a dare and submit video proof — it will appear here!</p>
      <button class="btn-empty" onclick="goPage('dares')">
        <span class="mi">bolt</span>Browse Dares
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
          ? `<img src="${vidThumb(p,640)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
          : `<div class="yt-thumb-bg"><span class="mi">${icon}</span></div>`
        }
        <div class="yt-play-over"><span class="mi">play_circle</span></div>
        <div class="yt-bounty">Rs.${(p.dareBounty||0).toLocaleString('en-IN')}</div>
        ${dur ? `<div style="position:absolute;bottom:8px;right:8px;
          background:rgba(0,0,0,.8);color:#fff;font-size:10px;font-weight:600;
          padding:2px 7px;border-radius:5px;">${dur}</div>` : ''}
      </div>
      <div class="yt-info">
        <div class="yt-av">${_avHtml(p.takerPhotoURL, p.takerName)}</div>
        <div class="yt-meta">
          <div class="yt-title">${p.dareTitle||'Dare Completed'}</div>
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
    <div class="short-card" onclick="openShorts('${p.id}')">
      <div class="short-thumb">
        ${vidThumb(p,360)
          ? `<img src="${vidThumb(p,360)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
          : `<div class="short-thumb-bg" style="background:#272727;"><span class="mi" style="color:${color};">${icon}</span></div>`
        }
        <div class="short-play-over"><span class="mi">play_circle</span></div>
        <div class="short-bounty-tag">Rs.${(p.dareBounty||0).toLocaleString('en-IN')}</div>
        ${dur ? `<div class="short-dur-tag">${dur}</div>` : ''}
      </div>
      <div class="short-info">
        <div class="short-title">${p.dareTitle||'Dare Short'}</div>
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
  if (!container) return;

  const active = (dares || []).filter(d => !d.completed).slice(0, 6);

  if (!active.length) {
    container.innerHTML = `<div class="empty" style="padding:24px 16px;">
      <span class="mi">bolt</span>
      <div class="empty-title">No Active Dares</div>
      <p class="empty-desc">No dares yet. Be the first to post!</p>
      <button class="btn-empty" onclick="openPost()">
        <span class="mi">add_circle</span>Post a Dare</button>
    </div>`;
    return;
  }

  const cards = active.map(d => {
    const cat   = d.tags?.[0] || d.cat || 'fitness';
    const color = CAT_C[cat] || '#FF2D4A';
    const icon  = CAT_I[cat] || 'bolt';
    const label = CAT_L[cat] || cat;
    const title = d.caption || d.title || 'Untitled Dare';
    const reward = d.rewardAmount ?? d.bounty ?? 0;
    const thumb  = d.thumbnailURL || '';

    const isMine    = d.creatorUid === user?.uid;
    const myEntry   = (acceptedDares||[]).find(a => a.dareId === d.id);
    let   btn       = '';
    if (isMine) {
      btn = `<button class="btn-yours" style="padding:7px 14px;border-radius:50px;width:auto;cursor:default;">Your Dare</button>`;
    } else if (myEntry) {
      btn = `<button class="btn-proof-done" style="padding:7px 12px;border-radius:50px;width:auto;">
               <span class="mi">check_circle</span>Accepted</button>`;
    } else {
      btn = `<button class="btn-accept" style="width:auto;padding:8px 18px;border-radius:50px;"
               onclick="event.stopPropagation();acceptDare('${d.id}')">Accept</button>`;
    }

    const thumbHTML = thumb
      ? `<div class="dare-list-thumb" style="background:#000;overflow:hidden;">
           <img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"/>
         </div>`
      : `<div class="dare-list-thumb" style="background:linear-gradient(135deg,${color}22,${color}55);">
           <span class="mi" style="color:${color};font-size:38px;">${icon}</span>
         </div>`;

    return `
    <div class="dare-list-card">
      ${thumbHTML}
      <div class="dare-list-body">
        <div>
          <span class="dare-list-cat cat-${cat}">${label}</span>
          <div class="dare-list-title">${escHtml(title)}</div>
          <div style="font-size:12px;color:var(--t3);margin-top:3px;">
            ${d.creator||'—'} · ${d.takers||0} takers
          </div>
        </div>
        <div class="dare-list-bottom">
          <span class="dare-list-bounty">Rs.${reward.toLocaleString('en-IN')}</span>
          ${btn}
        </div>
      </div>
    </div>`;
  }).join('');

  const total   = (dares||[]).filter(d => !d.completed).length;
  const hasMore = total > 6;
  container.innerHTML = `
    <div class="dare-list">${cards}</div>
    ${hasMore ? `<div style="text-align:center;margin-top:16px;">
      <button class="btn-empty" style="display:inline-flex;" onclick="goPage('dares')">
        <span class="mi">bolt</span>View All ${total} Dares
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
    document.getElementById('vpTitle').textContent  = p.dareTitle || 'Dare Video';
    document.getElementById('vpDare').textContent   = p.dareTitle || '—';
    document.getElementById('vpSub').textContent    = `By ${p.takerName} • Rs.${(p.dareBounty||0).toLocaleString('en-IN')} bounty won`;
    document.getElementById('vpAv').textContent     = (p.takerName||'?')[0].toUpperCase();
    const player = document.getElementById('vpPlayer');
    player.src = p.videoURL;
    player.load();
    document.getElementById('videoPlayOverlay').classList.add('open');
  });
}
function closeVideoPlay() {
  document.getElementById('videoPlayOverlay').classList.remove('open');
  const p = document.getElementById('vpPlayer');
  p.pause(); p.src = '';
}

// ════════════════════════════
//  DARES PAGE
// ════════════════════════════
function renderDaresPage() {
  const feed = document.getElementById('daresPageFeed');
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
        <div class="empty-title">No Active Dares</div>
        <p class="empty-desc">No active dares yet. Post the first dare!</p>
        <button class="btn-empty" onclick="openPost()"><span class="mi">add_circle</span>Post a Dare</button>
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

  feed.innerHTML = `<div class="dare-list">${active.map(d => {
    const cat    = d.tags?.[0] || d.cat || 'fitness';
    const title  = d.caption   || d.title || 'Untitled Dare';
    const reward = d.rewardAmount ?? d.bounty ?? 0;
    const desc   = d.description || d.desc || '';
    const thumb  = d.thumbnailURL || '';
    const color  = CAT_C[cat] || '#717171';
    const icon   = CAT_I[cat] || 'bolt';
    const label  = CAT_L[cat] || cat;
    const myEntry = acceptedDares.find(a => a.dareId === d.id);
    const isMine  = d.creatorUid === user?.uid;
    const isPinned = pinnedDares.includes(d.id);

    // Expiry badge
    let expiryBadge = '';
    if (d.expiresAt) {
      const exp = d.expiresAt.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt);
      const hoursLeft = Math.max(0, Math.round((exp - now) / 3600000));
      const daysLeft  = Math.floor(hoursLeft / 24);
      const label2    = daysLeft > 0 ? `${daysLeft}d left` : `${hoursLeft}h left`;
      const color2    = hoursLeft < 24 ? '#FF453A' : '#FF9F0A';
      expiryBadge = `<span style="font-size:10px;color:${color2};font-weight:600;
        padding:2px 8px;border-radius:50px;background:${color2}18;
        border:1px solid ${color2}44;font-family:'IBM Plex Mono',monospace;">
        ⏱ ${label2}</span>`;
    }

    let btn = '';
    if (isMine) {
      btn = `<button class="btn-yours" style="padding:8px 16px;border-radius:50px;width:auto;">Your Dare</button>`;
    } else if (myEntry) {
      if (myEntry.proofStatus === 'submitted' || myEntry.proofStatus === 'approved') {
        btn = `<button class="btn-proof-done" style="padding:8px 14px;border-radius:50px;width:auto;">
                 <span class="mi">check_circle</span>Submitted</button>`;
      } else if (myEntry.applicantStatus === 'pending') {
        btn = `<button class="btn-proof-done" style="padding:8px 14px;border-radius:50px;width:auto;background:rgba(255,159,10,.1);color:var(--orange);border:1px solid rgba(255,159,10,.3);">
                 <span class="mi">hourglass_empty</span>Applied</button>`;
      } else {
        btn = `<button class="btn-proof" style="width:auto;padding:8px 16px;border-radius:50px;"
                 onclick="openProof('${d.id}')"><span class="mi">video_call</span>Submit Proof</button>`;
      }
    } else {
      btn = `<button class="btn-accept" style="width:auto;padding:9px 20px;border-radius:50px;"
               onclick="acceptDare('${d.id}')">
               ${d.takerSelectionMode === 'creator_picks' ? 'Apply' : 'Accept'}
             </button>`;
    }

    const thumbHTML = thumb
      ? `<div class="dare-list-thumb" style="background:#000;overflow:hidden;cursor:pointer;" onclick="openDareDetail('${d.id}')">
           <img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"/>
         </div>`
      : `<div class="dare-list-thumb" style="background:linear-gradient(135deg,${color}22,${color}55);cursor:pointer;" onclick="openDareDetail('${d.id}')">
           <span class="mi" style="color:${color};font-size:40px;">${icon}</span>
         </div>`;

    const tagsHTML = d.tags?.length
      ? d.tags.map(t => `<span class="dare-tag-pill">#${t}</span>`).join('')
      : `<span class="dare-list-cat cat-${cat}">${label}</span>`;

    return `
    <div class="dare-list-card ${isPinned ? 'dare-pinned' : ''}">
      ${isPinned ? `<div class="pin-ribbon"><span class="mi">push_pin</span>Pinned</div>` : ''}
      ${thumbHTML}
      <div class="dare-list-body">
        <div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px;align-items:center;">
            ${tagsHTML}${expiryBadge}
          </div>
          <div class="dare-list-title" style="cursor:pointer;" onclick="openDareDetail('${d.id}')">${escHtml(title)}</div>
          <div class="dare-list-desc">${escHtml(desc)}</div>
        </div>
        <div class="dare-list-bottom">
          <div class="dare-list-meta">
            <span><span class="mi" style="font-size:14px;">person</span>${d.creator||'—'}</span>
            <span><span class="mi" style="font-size:14px;">group</span>${d.takers||0}</span>
            ${d.takerSelectionMode==='creator_picks' ? `<span style="font-size:10px;color:var(--orange);font-weight:600;
              padding:2px 8px;border-radius:50px;background:rgba(255,159,10,.1);border:1px solid rgba(255,159,10,.3);
              font-family:'IBM Plex Mono',monospace;">Creator Picks</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="dare-list-bounty">Rs.${reward.toLocaleString('en-IN')}</span>
            ${btn}
            <button class="btn-report-icon" onclick="openReportModal('dare','${d.id}','${escHtml(title)}')" title="Report dare">
              <span class="mi">flag</span>
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
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
        <div class="empty-title">No Accepted Dares</div>
        <p class="empty-desc">You haven't accepted any dares yet. Browse the Dares page to get started!</p>
        <button class="btn-empty" onclick="goPage('dares')"><span class="mi">bolt</span>Browse Dares</button>
      </div>`;
    return;
  }

  const statusMap   = {pending:'status-active',submitted:'status-submitted',approved:'status-approved'};
  const statusLabel = {pending:'Proof Pending',submitted:'Under Review',approved:'Approved'};

  feed.innerHTML = `<div class="dare-list">${acceptedDares.map(a => {
    const cat   = a.cat || 'fitness';
    const color = CAT_C[cat] || '#FF2D4A';
    const icon  = CAT_I[cat] || 'bolt';
    let btn = '';
    if (a.proofStatus === 'pending') {
      btn = `<button class="btn-proof" style="width:auto;padding:9px 18px;border-radius:50px;" onclick="openProof('${a.dareId}')"><span class="mi">video_call</span>Submit Proof</button>`;
    } else if (a.proofStatus === 'submitted') {
      btn = `<button class="btn-proof-done" style="width:auto;padding:8px 16px;border-radius:50px;"><span class="mi">hourglass_empty</span>Under Review</button>`;
    } else if (a.proofStatus === 'approved') {
      btn = `<button class="btn-proof-done" style="width:auto;padding:8px 16px;border-radius:50px;"><span class="mi">check_circle</span>Rs.${(a.bounty||0).toLocaleString('en-IN')} Won!</button>`;
    }
    return `
    <div class="dare-list-card">
      <div class="dare-list-thumb" style="background:linear-gradient(135deg,${color}22,${color}55);">
        <span class="mi" style="color:${color};font-size:40px;">${icon}</span>
      </div>
      <div class="dare-list-body">
        <div>
          <span class="status-badge ${statusMap[a.proofStatus]}" style="margin-bottom:8px;display:inline-block;">${statusLabel[a.proofStatus]}</span>
          <div class="dare-list-title">${a.dareTitle||'—'}</div>
          <div style="font-size:12px;color:var(--t3);margin-bottom:8px;">Accepted: ${a.date||''} ${a.proofFilename ? '• '+a.proofFilename : ''}</div>
        </div>
        <div class="dare-list-bottom">
          <span class="dare-list-bounty">Rs.${(a.bounty||0).toLocaleString('en-IN')}</span>
          ${btn}
        </div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ════════════════════════════
//  SEARCH (BUG FIX: was referencing missing #dareFeed)
// ════════════════════════════
function handleSearch() {
  // #5: Debounce — wait 350ms after typing stops before searching
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(_handleSearchNow, 350);
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
  if (titleEl) titleEl.textContent = 'Post a New Dare';

  const btn = document.getElementById('submitDareBtn');
  if (btn) { btn.disabled = false; btn.innerHTML = '<span class="mi">bolt</span> Post Dare'; }

  document.getElementById('postOverlay').classList.add('open');
}

function closePost() {
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
function _avHtml(photoURL, name) {
  const letter = (String(name||'?').trim().charAt(0) || '?').toUpperCase().replace(/['"\\<>]/g,'');
  return photoURL
    ? `<img src="${photoURL}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.parentElement.textContent='${letter}'"/>`
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
      await db.collection('dares').doc(editingDareId).update({
        ...dareData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      closePost();
      showToast('Dare updated successfully!');
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
          type:'debit',
          title:'Dare Posted: ' + caption.substring(0,30),
          amount: reward,
          date: todayStr()
        });
        await db.collection('users').doc(user.uid).update({ wallet });
      }

      closePost();
      const schedMsg = currentVis === 'scheduled'
        ? ` (Scheduled)` : '';
      showToast('Dare posted!' + (reward>0 ? ` Rs.${reward.toLocaleString('en-IN')} reward set.`:'')+schedMsg);

      AdManager.showPostDareAds(() => {
        showToast('Your dare is now live!');
      });
    }

  } catch(e) {
    showToast('Error: ' + e.message);
    console.error('submitDare error:', e);
    btn.disabled = false;
    btn.innerHTML = editingDareId
      ? '<span class="mi">save</span> Save Changes'
      : '<span class="mi">bolt</span> Post Dare';
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
    showToast('You already applied or accepted this dare!'); return;
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
      showToast('Dare accepted!' + (reward > 0 ? ` Submit proof to claim Rs.${reward.toLocaleString('en-IN')}!` : 'Submit your proof!'));
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
  'My video clearly shows me completing the dare',
  'My face is visible throughout the video',
  'The recording is unedited and continuous',
  'Video is at least 30 seconds long'
];

// ── Open proof modal ─────────────────────────────────────────────────────────
function openProof(dareId) {
  const d = dares.find(x => x.id === dareId);
  if (!d) { showToast('Dare not found'); return; }

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
      'Video must clearly show you completing the dare',
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

  document.getElementById('proofOverlay').classList.add('open');
}

// ── Close proof modal — keeps active upload running in background ─────────────
function closeProof() {
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
        showToast(`Short video detected (${selectedVideoDuration}s) — will appear in Dare Shorts!`);
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
      <button onclick="document.getElementById('proofOverlay').classList.add('open')"
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

  document.getElementById('reviewOverlay').classList.add('open');

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
    ? `<video src="${p.videoURL}" controls playsinline
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
      const tw = takerData.wallet || { balance:0, transactions:[] };
      tw.balance += proof.dareBounty || 0;
      tw.transactions.unshift({
        type:'credit',
        title:'Bounty Won: ' + (proof.dareTitle||'').substring(0,30),
        amount: proof.dareBounty || 0,
        date: todayStr()
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
  document.getElementById('rejectOverlay').classList.add('open');
}
function closeRejectModal() {
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
  document.getElementById('reviewOverlay').classList.remove('open');
  reviewDareId = null; currentProofs = [];
}

// ════════════════════════════
//  LEADERBOARD
// ════════════════════════════
async function loadLeaderboard() {
  const el = document.getElementById('lbContent');
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
        <p class="empty-desc">Complete a dare to appear on the leaderboard!</p></div>`;
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
            <div style="font-size:12px;color:var(--t3);">${p.count} dare${p.count>1?'s':''} completed</div>
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
    navigator.share({ title:'Dare Market', text:`"${title}" — bounty up for grabs!`, url });
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
  document.getElementById('profProvider').textContent = user.provider;

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

  // My Dares — sorted latest first
  const md = document.getElementById('tMyDares');
  const myPostedSorted = [...myPosted].sort((a,b)=>{
    const ap = pinnedDares.includes(a.id) ? 1 : 0;
    const bp = pinnedDares.includes(b.id) ? 1 : 0;
    if (bp !== ap) return bp - ap;  // pinned first
    const ta = a.createdAt?.toDate?.()?.getTime() || 0;
    const tb = b.createdAt?.toDate?.()?.getTime() || 0;
    return tb - ta;
  });
  md.innerHTML = !myPostedSorted.length
    ? `<div class="empty" style="padding:32px;"><span class="mi">assignment</span><div class="empty-title" style="font-size:18px;">No Dares Posted</div><p class="empty-desc" style="margin-bottom:16px;">Post your first dare!</p><button class="btn-empty" onclick="openPost()"><span class="mi">add_circle</span>Post a Dare</button></div>`
    : myPostedSorted.map(d => {
        const title   = d.caption || d.title || 'Untitled';
        const reward  = d.rewardAmount ?? d.bounty ?? 0;
        const pending = d.proofCount || 0;
        const isPinned = pinnedDares.includes(d.id);
        const now = new Date();
        let expiryInfo = '';
        if (d.expiresAt) {
          const exp = d.expiresAt.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt);
          const hLeft = Math.max(0, Math.round((exp - now)/3600000));
          expiryInfo = `<span style="font-size:10px;color:${hLeft<24?'var(--red)':'var(--orange)'};font-weight:600;margin-left:6px;">${hLeft<24?hLeft+'h':Math.floor(hLeft/24)+'d'} left</span>`;
        }
        return `
        <div class="dare-mini ${isPinned?'dare-pinned-mini':''}">
          <div style="flex:1;min-width:0;">
            <div class="dare-mini-title">${escHtml(title)}${isPinned?'<span class="pin-badge"></span>':''}${expiryInfo}</div>
            <div class="dare-mini-meta">
              <span><span class="mi">bolt</span>Rs.${reward.toLocaleString('en-IN')}</span>
              <span><span class="mi">group</span>${d.takers||0} ${d.takerSelectionMode==='creator_picks'?'applicants':'takers'}</span>
              <span><span class="mi">video_call</span>${d.proofCount||0} proofs</span>
              <span>${_relTimeStr(d.date)}</span>
            </div>
          </div>
          <div class="dare-mini-right">
            ${d.completed
              ? `<span class="status-badge status-approved">Completed</span>`
              : `<span class="status-badge status-active">Active</span>`}
            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-top:6px;">
              ${d.takerSelectionMode==='creator_picks' ? `
              <button class="btn-select-takers" onclick="openSelectTakersModal('${d.id}')">
                <span class="mi">how_to_reg</span>Select Takers
                ${(d.takers||0)>0?`<span class="select-badge">${d.takers}</span>`:''}
              </button>` : ''}
              <button class="btn-review" onclick="openReviewModal('${d.id}')">
                <span class="mi">rate_review</span>Proofs
                ${pending>0?`<span class="review-badge">${pending}</span>`:''}
              </button>
              ${!d.completed ? `<button class="btn-dare-action" onclick="openEditDare('${d.id}')" title="Edit">
                <span class="mi">edit</span>
              </button>` : ''}
              <button class="btn-dare-action ${isPinned?'btn-dare-pinned':''}"
                onclick="${isPinned?`unpinDare('${d.id}')`:`pinDare('${d.id}')`}" title="${isPinned?'Unpin':'Pin'}">
                <span class="mi">push_pin</span>
              </button>
              ${!d.completed ? `<button class="btn-dare-action btn-dare-delete" onclick="deleteDare('${d.id}')" title="Delete">
                <span class="mi">delete</span>
              </button>` : ''}
            </div>
          </div>
        </div>`; }).join('');

  // Accepted Dares — sorted latest first
  const ad = document.getElementById('tAccepted');
  const statusMap   = {pending:'status-active',submitted:'status-submitted',approved:'status-approved'};
  const statusLabel = {pending:'Pending Proof',submitted:'Proof Submitted',approved:'Approved'};
  const sortedAccepted = [...acceptedDares].sort((a,b)=>{
    return (b.date||'').localeCompare(a.date||'');
  });
  ad.innerHTML = !sortedAccepted.length
    ? `<div class="empty" style="padding:32px;"><span class="mi">sports_score</span><div class="empty-title" style="font-size:18px;">No Dares Accepted</div><p class="empty-desc" style="margin-bottom:16px;">Accept a dare from the feed!</p><button class="btn-empty" onclick="goPage('dares')"><span class="mi">arrow_back</span>Browse Dares</button></div>`
    : sortedAccepted.map(a=>{
      const appliedLabel = a.applicantStatus==='pending'
        ? `<span class="status-badge" style="background:rgba(255,159,10,.12);color:var(--orange);border:1px solid rgba(255,159,10,.3);">Applied</span>`
        : `<span class="status-badge ${statusMap[a.proofStatus]}">${statusLabel[a.proofStatus]}</span>`;
      return `
      <div class="dare-mini">
        <div><div class="dare-mini-title">${a.dareTitle}</div>
          <div class="dare-mini-meta">
            <span><span class="mi">bolt</span>Rs.${(a.bounty||0).toLocaleString('en-IN')}</span>
            ${a.proofFilename?`<span><span class="mi">video_file</span>${a.proofFilename}</span>`:''}
            <span>${a.date}</span>
          </div>
        </div>
        <div class="dare-mini-right">
          ${appliedLabel}
          ${a.proofStatus==='pending' && a.applicantStatus!=='pending'
            ?`<button class="btn-mini-proof" onclick="openProof('${a.dareId}')"><span class="mi">video_call</span>Submit Proof</button>`:''
          }
        </div>
      </div>`; }).join('');

  // Transactions (now in wallet page)
  const tx = document.getElementById('walletTxns') || document.getElementById('tTxns');
  if (tx) tx.innerHTML = !wallet.transactions.length
    ? `<div class="empty" style="padding:32px;"><span class="mi">receipt_long</span><div class="empty-title" style="font-size:18px;">No Transactions</div><p class="empty-desc" style="margin-bottom:0;">Your transaction history will appear here.</p></div>`
    : wallet.transactions.map(t=>`
      <div class="txn-item">
        <div class="txn-left">
          <div class="txn-icon" style="background:${t.type==='credit'?'rgba(0,200,83,.15)':'rgba(229,57,53,.15)'};">
            <span class="mi" style="color:${t.type==='credit'?'var(--green)':'var(--red)'};">${t.type==='credit'?'arrow_downward':'arrow_upward'}</span>
          </div>
          <div><div class="txn-title">${t.title}</div><div class="txn-date">${t.date}</div></div>
        </div>
        <div class="txn-amt ${t.type}">${t.type==='credit'?'+':'-'}Rs.${(t.amount||0).toLocaleString('en-IN')}</div>
      </div>`).join('');
}

function switchPTab(el, tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['tMyDares','tAccepted','tTxns'].forEach(id => {
    document.getElementById(id).style.display = id === tabId ? 'block' : 'none';
  });
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

  // Reset photo selection and handle status
  peSelectedPhotoFile = null;
  peHandleValid       = true; // current handle is already valid
  document.getElementById('peHandleStatus').textContent = '';
  document.getElementById('peHandleStatus').className   = 'pe-status ok';
  document.getElementById('peSaveBtn').disabled = false;

  document.getElementById('profileEditOverlay').classList.add('open');
}

function cancelProfileEdit() {
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
    : 'Users apply → you review applicants → you select who gets to do the dare.';
}

// ── EDIT DARE ────────────────────────────────────────────────────────
async function openEditDare(id) {
  const _d = dares.find(x=>x.id===id); if(_d && _d.completed){ showToast('Completed dares cannot be edited'); return; }
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
  if (titleEl) titleEl.textContent = 'Edit Dare';

  const btn = document.getElementById('submitDareBtn');
  if (btn) { btn.disabled=false; btn.innerHTML='<span class="mi">save</span> Save Changes'; }

  document.getElementById('postOverlay').classList.add('open');
}

// ── DELETE DARE ──────────────────────────────────────────────────────
async function deleteDare(id) {
  const _dd = dares.find(x=>x.id===id); if(_dd && _dd.completed){ showToast('Completed dares cannot be deleted'); return; }
  const d = dares.find(x => x.id === id);
  if (!d) return;
  const title = d.caption || d.title || 'this dare';
  if (!confirm(`Delete "${title}"?\n\nIf you set a reward, it will be refunded to your wallet.`)) return;
  try {
    await db.collection('dares').doc(id).delete();
    // Refund reward if dare was not completed
    const reward = d.rewardAmount ?? d.bounty ?? 0;
    if (reward > 0 && !d.completed) {
      wallet.balance += reward;
      wallet.transactions.unshift({ type:'credit', title:'Dare Deleted (Refund): '+title.slice(0,25), amount:reward, date:todayStr() });
      await db.collection('users').doc(user.uid).update({ wallet });
    }
    showToast('Dare deleted' + (reward>0&&!d.completed ? ` · Rs.${reward.toLocaleString('en-IN')} refunded` : ''));
    renderProfile();
  } catch(e) { showToast('Error: '+e.message); }
}

// ── PIN / UNPIN DARE (max 3) ─────────────────────────────────────────
async function pinDare(id) {
  if (pinnedDares.includes(id)) { showToast('Already pinned!'); return; }
  if (pinnedDares.length >= 3)  { showToast('Maximum 3 dares can be pinned. Unpin one first.'); return; }
  pinnedDares.push(id);
  try {
    await db.collection('users').doc(user.uid).update({ pinnedDares });
    showToast('Dare pinned!  It will appear at top of the feed.');
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
    showToast('Dare unpinned.');
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
  document.getElementById('reportOverlay').classList.add('open');
}
function closeReportModal2() {
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
  document.getElementById('adminReportsOverlay').classList.add('open');
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
            <div style="font-size:13px;font-weight:600;color:var(--t1);">${r.targetType==='dare'?'📋 Dare':'👤 User'}: ${escHtml(r.targetName||r.targetId)}</div>
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
  document.getElementById('adminReportsOverlay').classList.remove('open');
}

// ── SELECT TAKERS MODAL ───────────────────────────────────────────────
async function openSelectTakersModal(dareId) {
  selectTakersDareId = dareId;
  const d = dares.find(x => x.id === dareId);
  if (!d) return;

  document.getElementById('selectTakersDareTitle').textContent = d.caption||d.title||'Dare';
  document.getElementById('selectTakersOverlay').classList.add('open');
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
    el.innerHTML = '<div class="empty" style="padding:28px;"><span class="mi">people</span><div class="empty-title">No Applicants Yet</div><p class="empty-desc">Share your dare to get more applicants!</p></div>';
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
          ${a.completionRate||0} dares completed · Applied ${a.date||''}
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
  const sw = document.querySelector('.search-wrap');
  if (sw) sw.classList.add('mobile-open');
  const inp = document.getElementById('searchInput');
  if (inp) { setTimeout(()=>inp.focus(), 50); }
}
function closeMobileSearch() {
  const sw = document.querySelector('.search-wrap');
  if (sw) sw.classList.remove('mobile-open');
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
  post:        { icon:'⚡', title:'Post Dares', msg:'Create a free account to set bounties and challenge others.' },
  accept:      { icon:'', title:'Accept Dares', msg:'Sign up to accept dares and earn real money.' },
  proof:       { icon:'', title:'Submit Proof', msg:'Create an account to submit video proof and claim your reward.' },
  profile:     { icon:'👤', title:'Your Profile', msg:'Sign up to build your profile, track earnings, and manage your wallet.' },
  accepted:    { icon:'✅', title:'Accepted Dares', msg:'Create an account to track and manage the dares you have accepted.' },
  leaderboard: { icon:'', title:'Leaderboard', msg:'Join to see top earners and compete for the highest rewards.' },
  default:     { icon:'🔐', title:'Create a free account', msg:'Sign up to unlock all features — post dares, accept challenges, and earn money.' },
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

function _doSearch(q) {
  // Show dares page as search results container
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el=document.getElementById('pageDares'); if(el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const nav=document.getElementById('nav-dares'); if(nav) nav.classList.add('active');
  if (typeof syncBottomNav === 'function') syncBottomNav('dares');
  const feed=document.getElementById('daresPageFeed');

  const typeBar=`
    <div class="search-type-bar">
      <button class="search-type-btn ${searchType==='dares'?'active':''}" onclick="setSearchType('dares')">
        <span class="mi">bolt</span> Dares
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
      feed.innerHTML=typeBar+`<div class="empty"><span class="mi">search_off</span><div class="empty-title">No dares for "${escHtml(q)}"</div><p class="empty-desc">Try searching Videos tab</p></div>`;
    } else {
      let html=typeBar+`<div style="font-size:12px;color:var(--t3);margin-bottom:14px;padding:0 4px;">${results.length} dare${results.length!==1?'s':''} for "<strong style="color:var(--t1);">${escHtml(q)}</strong>"</div>`;
      if (active.length)    html+=`<div class="search-section-label">Active (${active.length})</div><div class="dare-list">${active.map(d=>_searchDareCard(d)).join('')}</div>`;
      if (completed.length) html+=`<div class="search-section-label" style="color:var(--t3);">Completed (${completed.length})</div><div class="dare-list">${completed.map(d=>_searchDareCard(d)).join('')}</div>`;
      feed.innerHTML=html;
    }
  } else {
    const pool    = allProofs.length?allProofs:homeProofs;
    const results = _scoredSearch(pool, q, ['dareTitle','takerName','note'], ['cat']);
    if (!results.length) {
      feed.innerHTML=typeBar+`<div class="empty"><span class="mi">search_off</span><div class="empty-title">No videos for "${escHtml(q)}"</div><p class="empty-desc">Try Dares tab instead</p></div>`;
    } else {
      feed.innerHTML=typeBar+`<div style="font-size:12px;color:var(--t3);margin-bottom:14px;padding:0 4px;">${results.length} video${results.length!==1?'s':''} for "<strong style="color:var(--t1);">${escHtml(q)}</strong>"</div>`+_mixedVideoFeedHtml(results,'No videos');
    }
  }
  _trackSearch(q);
}

function _explorerDareCard(d) {
  const cat=d.tags?.[0]||d.cat||'fitness';const color=CAT_C[cat]||'#1a73e8';const icon=CAT_I[cat]||'bolt';
  const title=d.caption||d.title||'Untitled';const reward=d.rewardAmount??d.bounty??0;const thumb=d.thumbnailURL||'';
  const isMine=d.creatorUid===user?.uid;const myEntry=acceptedDares.find(a=>a.dareId===d.id);
  let btn='';
  if(isMine) btn=`<button class="btn-yours" style="padding:7px 14px;border-radius:50px;width:auto;">Your Dare</button>`;
  else if(myEntry) btn=`<button class="btn-proof-done" style="padding:7px 12px;border-radius:50px;width:auto;"><span class="mi">check_circle</span>Accepted</button>`;
  else btn=`<button class="btn-accept" style="width:auto;padding:8px 18px;border-radius:50px;" onclick="event.stopPropagation();acceptDare('${d.id}')">Accept</button>`;
  const thumbHTML=thumb?`<div class="dare-list-thumb" style="background:#000;overflow:hidden;"><img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"/></div>`:`<div class="dare-list-thumb" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};font-size:38px;">${icon}</span></div>`;
  return `<div class="dare-list-card">${thumbHTML}<div class="dare-list-body"><div><span class="dare-list-cat cat-${cat}">${CAT_L[cat]||cat}</span><div class="dare-list-title">${escHtml(title)}</div><div style="font-size:12px;color:var(--t3);margin-top:3px;">${d.creator||'—'} · <strong style="color:var(--blue2);">${d.takers||0}</strong> accepted</div></div><div class="dare-list-bottom"><span class="dare-list-bounty">Rs.${reward.toLocaleString('en-IN')}</span>${btn}</div></div></div>`;
}

function _explorerVideoCard(p) {
  const cat=p.cat||'fitness';const color=CAT_C[cat]||'#1a73e8';const icon=CAT_I[cat]||'bolt';
  const dur=p.videoDuration?(p.videoDuration>=60?Math.floor(p.videoDuration/60)+':'+String(p.videoDuration%60).padStart(2,'0'):p.videoDuration+'s'):'';
  return `<div class="yt-card" onclick="openVideo('${p.id}')">
    <div class="yt-thumb">
      ${vidThumb(p,480)?`<img src="${vidThumb(p,480)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"/>`:`<div class="yt-thumb-bg"><span class="mi">${icon}</span></div>`}
      <div class="yt-play-over"><span class="mi">play_circle</span></div>
      <div class="yt-bounty">Rs.${(p.dareBounty||0).toLocaleString('en-IN')}</div>
      ${dur?`<div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.8);color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;">${dur}</div>`:''}
    </div>
    <div class="yt-info">
      <div class="yt-av">${_avHtml(p.takerPhotoURL, p.takerName)}</div>
      <div class="yt-meta">
        <div class="yt-title">${escHtml(p.dareTitle||'Dare Video')}</div>
        <div class="yt-sub"><span>${escHtml(p.takerName||'—')}</span><span class="yt-dot"></span><span>${(p.viewCount||0).toLocaleString('en-IN')} views</span><span class="yt-dot"></span><span> ${(p.likeCount||0).toLocaleString('en-IN')}</span></div>
      </div>
    </div>
  </div>`;
}

// Mixed video list → longs in a 16:9 grid, shorts in a 9:16 row below (clean separation)
function _mixedVideoFeedHtml(arr, emptyMsg) {
  const longs  = (arr||[]).filter(p => !_isShortVideo(p));
  const shorts = (arr||[]).filter(p =>  _isShortVideo(p));
  let html = '';
  if (longs.length)  html += `<div class="yt-grid">${longs.map(p=>_explorerVideoCard(p)).join('')}</div>`;
  if (shorts.length) html += _shortsRowHtml(shorts);
  return html || `<div class="exp-empty">${emptyMsg||'Nothing here yet'}</div>`;
}

function _hideSuggestions() { const el=document.getElementById('searchSuggestions'); if(el) el.style.display='none'; }

function _notifColor(type){const m={like_milestone:'#FF453A',comment_milestone:'#0A84FF',view_milestone:'#32D74B',dare_accepted:'#FF9F0A',proof_submitted:'#BF5AF2',proof_approved:'#32D74B',proof_rejected:'#FF453A'};return m[type]||'#8E8E93';}

function _notifIcon(type){const m={like_milestone:'favorite',comment_milestone:'chat',view_milestone:'visibility',dare_accepted:'bolt',proof_submitted:'video_call',proof_approved:'check_circle',proof_rejected:'cancel'};return m[type]||'notifications';}

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
    msg:   'Your 15-minute preview is over. Create a free account to keep using Dare Market — it only takes 10 seconds!',
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

function _renderRelatedVideos(currentProof) {
  const el=document.getElementById('vdRelated'); if(!el) return;
  const pool=[...homeProofs,...allProofs].filter((p,i,arr)=>arr.findIndex(x=>x.id===p.id)===i);
  let related=pool.filter(p=>p.id!==currentProof.id&&(p.cat===currentProof.cat||p.tags?.includes(currentProof.cat))).slice(0,8);
  if(!related.length) related=pool.filter(p=>p.id!==currentProof.id).slice(0,5);
  if(!related.length){el.innerHTML='<div style="color:var(--t3);font-size:13px;">No related videos yet</div>';return;}
  el.innerHTML=related.map(p=>{
    const cat=p.cat||'fitness';const color=CAT_C[cat]||'#1a73e8';
    return `<div class="vd-related-card" onclick="openShorts('${p.id}')">
      <div class="vd-related-thumb">${vidThumb(p,320)?`<img src="${vidThumb(p,320)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"/>`:`<div style="width:100%;height:100%;background:#272727;display:flex;align-items:center;justify-content:center;"><span class="mi" style="color:${color};">play_circle</span></div>`}</div>
      <div class="vd-related-info"><div class="vd-related-title">${escHtml(p.dareTitle||'Dare Video')}</div><div class="vd-related-meta">${escHtml(p.takerName||'—')} · ${(p.viewCount||0).toLocaleString('en-IN')} views</div><div class="vd-related-bounty">Rs.${(p.dareBounty||0).toLocaleString('en-IN')}</div></div>
    </div>`;
  }).join('');
}

async function _renderVideoDetail(p) {
  if(user){
    db.collection('proofs').doc(p.id).update({viewCount:firebase.firestore.FieldValue.increment(1)})
      .then(()=>{const n=(p.viewCount||0)+1;p.viewCount=n;document.getElementById('vdMeta').textContent=`${n.toLocaleString('en-IN')} views · ${_relTime(p)}`;_checkViewMilestone(p.id,n,p.takerId,p.dareTitle);}).catch(()=>{});
  }
  // video src is set by openVideoDetail (after ad) — not here
  document.getElementById('vdTopbarTitle').textContent=p.dareTitle||'Dare Video';
  document.getElementById('vdTitle').textContent      =p.dareTitle||'Dare Video';
  document.getElementById('vdMeta').textContent       =`${(p.viewCount||0).toLocaleString('en-IN')} views · ${_relTime(p)}`;
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
  // Stash ids for collab modal
  const cm = document.getElementById('collabModal');
  if (cm) { cm.dataset.creatorId = creatorId; cm.dataset.takerId = p.takerId||''; }
  const ov = document.getElementById('videoDetailOverlay');
  ov.dataset.creatorName='@'+creatorUser; ov.dataset.takerName='@'+takerUser;
  ov.dataset.creatorAv=creatorName[0].toUpperCase(); ov.dataset.takerAv=(p.takerName||'T')[0].toUpperCase();
  document.getElementById('vdBounty').textContent     =`Rs. ${(p.dareBounty||0).toLocaleString('en-IN')} bounty won`;
  document.getElementById('vdBountyPill').textContent =`Rs. ${(p.dareBounty||0).toLocaleString('en-IN')}`;
  const catPill=document.getElementById('vdCatPill');
  if(catPill){catPill.textContent='#'+(p.cat||'dare');catPill.style.background=(CAT_C[p.cat]||'#1a73e8')+'22';catPill.style.color=CAT_C[p.cat]||'#1a73e8';}
  _updateLikeBtn(p.id,p.likeCount||0);
  // Update comment input avatar
  const vdAv=document.getElementById('vdInputAv');
  if(vdAv){if(user?.picture)vdAv.innerHTML=`<img src="${user.picture}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="av"/>`;else if(user)vdAv.textContent=user.name[0].toUpperCase();}
  loadComments(p.id);
  _renderRelatedVideos(p);
}

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
  const cat=d.tags?.[0]||d.cat||'fitness'; const color=CAT_C[cat]||'#1a73e8'; const icon=CAT_I[cat]||'bolt';
  const title=d.caption||d.title||'Untitled'; const reward=d.rewardAmount??d.bounty??0; const thumb=d.thumbnailURL||'';
  const isMine=d.creatorUid===user?.uid; const myEntry=acceptedDares.find(a=>a.dareId===d.id);
  let btn='';
  if (d.completed)   btn=`<button class="btn-proof-done" style="padding:8px 14px;border-radius:50px;width:auto;"><span class="mi">check_circle</span>Completed</button>`;
  else if (isMine)   btn=`<button class="btn-yours" style="padding:8px 14px;border-radius:50px;width:auto;">Your Dare</button>`;
  else if (myEntry)  btn=`<button class="btn-proof-done" style="padding:8px 14px;border-radius:50px;width:auto;"><span class="mi">check_circle</span>Accepted</button>`;
  else               btn=`<button class="btn-accept" style="width:auto;padding:9px 20px;border-radius:50px;" onclick="acceptDare('${d.id}')">Accept</button>`;
  const thumbHTML=thumb
    ?`<div class="dare-list-thumb" style="background:#000;overflow:hidden;"><img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"/></div>`
    :`<div class="dare-list-thumb" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};font-size:40px;">${icon}</span></div>`;
  return `<div class="dare-list-card">${thumbHTML}
    <div class="dare-list-body">
      <div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:4px;">${(d.tags||[]).map(t=>`<span class="dare-tag-pill">#${t}</span>`).join('')}${d.completed?`<span class="status-badge status-approved" style="font-size:10px;">Completed</span>`:''}</div>
        <div class="dare-list-title">${escHtml(title)}</div>
      </div>
      <div class="dare-list-bottom"><span class="dare-list-bounty">Rs.${reward.toLocaleString('en-IN')}</span>${btn}</div>
    </div>
  </div>`;
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
  btn.querySelector('.mi').textContent=isLiked?'favorite':'favorite_border';
  btn.querySelector('.mi').style.color=isLiked?'#FF453A':'var(--t3)';
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
      ${vidThumb(p,480)?`<img src="${vidThumb(p,480)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"/>`:`<div class="yt-thumb-bg"><span class="mi">${icon}</span></div>`}
      <div class="yt-play-over"><span class="mi">play_circle</span></div>
      <div class="yt-bounty">Rs.${(p.dareBounty||0).toLocaleString('en-IN')}</div>
      ${dur?`<div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.8);color:#fff;font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;">${dur}</div>`:''}
    </div>
    <div class="yt-info">
      <div class="yt-av">${_avHtml(p.takerPhotoURL, p.takerName)}</div>
      <div class="yt-meta">
        <div class="yt-title">${escHtml(p.dareTitle||'Dare Video')}</div>
        <div class="yt-sub"><span>${escHtml(p.takerName||'—')}</span><span class="yt-dot"></span><span>${(p.viewCount||0).toLocaleString('en-IN')} views</span><span class="yt-dot"></span><span> ${(p.likeCount||0).toLocaleString('en-IN')}</span></div>
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
  const player=document.getElementById('vdPlayer'); player.pause(); player.src='';
  activeProof=null;
}

// ════════════════════════════════════════════════════════════════════
//  ACTIVE DARE DETAIL PAGE — like / dislike / comment / report (2c)
// ════════════════════════════════════════════════════════════════════
let _ddCurrentId = null;

function openDareDetail(dareId){
  const d = dares.find(x=>x.id===dareId);
  if (!d) { showToast('Dare not found'); return; }
  _ddCurrentId = dareId;
  const cat = d.tags?.[0] || d.cat || 'fitness';
  const title = d.caption || d.title || 'Untitled Dare';
  const reward = d.rewardAmount ?? d.bounty ?? 0;
  const thumb = d.thumbnailURL || '';
  const color = CAT_C[cat] || '#FF2D4A', icon = CAT_I[cat] || 'bolt';

  document.getElementById('ddTopTitle').textContent = title;
  document.getElementById('ddName').textContent = title;
  document.getElementById('ddBounty').textContent = 'Rs. ' + reward.toLocaleString('en-IN');
  document.getElementById('ddMeta').textContent = `${d.creator||'—'} · ${d.takers||0} ${d.takerSelectionMode==='creator_picks'?'applicants':'takers'} · ${_relTimeStr(d.date)}`;

  document.getElementById('ddHero').innerHTML = thumb
    ? `<img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
    : `<div class="dd-hero-bg" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};font-size:72px;">${icon}</span></div>`;

  document.getElementById('ddTags').innerHTML = (d.tags?.length ? d.tags : [cat]).map(t=>`<span class="dare-tag-pill">#${escHtml(t)}</span>`).join('');

  document.getElementById('ddCreator').innerHTML = `
    <div class="dd-creator-av">${_avHtml(d.creatorPhotoURL, d.creator)}</div>
    <div class="dd-creator-info">
      <div class="dd-creator-name">${escHtml(d.creator||'Creator')}</div>
      <div class="dd-creator-sub">@${escHtml(d.creatorUsername || (d.creator||'creator'))}</div>
    </div>`;

  const desc = d.description || d.desc || '';
  document.getElementById('ddDesc').innerHTML = desc ? `<div class="dd-sec-label">Description</div><p class="dd-desc-text">${escHtml(desc)}</p>` : '';
  const rules = (d.rules||[]).filter(r=>r && r.trim());
  document.getElementById('ddRules').innerHTML = rules.length
    ? `<div class="dd-sec-label">Rules</div>${rules.map(r=>`<div class="dd-rule">• ${escHtml(r)}</div>`).join('')}` : '';

  document.getElementById('ddCta').innerHTML = _ddCtaHtml(d);
  _ddUpdateLikeUI(d);

  const av = document.getElementById('ddInputAv');
  if (user?.picture) av.innerHTML = `<img src="${user.picture}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="av"/>`;
  else if (user) av.textContent = user.name[0].toUpperCase();

  loadDareTopComment(dareId);
  renderDareMore(dareId);

  const ov = document.getElementById('dareDetailOverlay');
  ov.classList.add('open');
  ov.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeDareDetail(){
  document.getElementById('dareDetailOverlay').classList.remove('open');
  document.body.style.overflow = '';
  _ddCurrentId = null;
}
function _ddReport(){
  const d = dares.find(x=>x.id===_ddCurrentId); if (!d) return;
  openReportModal('dare', _ddCurrentId, d.caption || d.title || 'this dare');
}
function _ddCtaHtml(d){
  const isMine = d.creatorUid === user?.uid;
  const myEntry = (acceptedDares||[]).find(a=>a.dareId===d.id);
  if (isMine) return `<button class="btn-yours" style="padding:11px 22px;border-radius:50px;width:auto;">Your Dare</button>`;
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
// Dare comments reuse the comments collection (proofId = dareId)
async function loadDareTopComment(dareId){
  const el = document.getElementById('ddTopComment');
  el.innerHTML = '<div style="color:var(--t3);font-size:13px;padding:10px 0;">Loading...</div>';
  try {
    const snap = await db.collection('comments').where('proofId','==',dareId).limit(50).get();
    let cs = snap.docs.map(doc=>({id:doc.id,...doc.data()})).filter(c=>!c.parentId);
    if (!cs.length){ el.innerHTML = '<div class="vd-no-comments"><span class="mi">chat_bubble_outline</span><div>No comments yet — be the first!</div></div>'; return; }
    cs.sort((a,b)=>(b.likeCount||b.likes||0)-(a.likeCount||a.likes||0));
    const c = cs[0];
    const extra = cs.length>1 ? `<div class="dd-more-comments">+ ${cs.length-1} more comment${cs.length-1>1?'s':''}</div>` : '';
    el.innerHTML = `<div class="vd-comment">
      <div class="vd-comment-av">${_avHtml(c.userPhotoURL, c.userName)}</div>
      <div class="vd-comment-body">
        <div class="vd-comment-author">${escHtml(c.userName||'—')}<span class="vd-comment-time">${c.createdAt&&c.createdAt.toDate?_timeAgo(c.createdAt.toDate()):''}</span></div>
        <div class="vd-comment-text">${escHtml(c.text||'')}</div>
      </div></div>${extra}`;
  } catch(e){ el.innerHTML = '<div style="color:var(--t3);font-size:13px;">Could not load comment</div>'; }
}
async function submitDareComment(){
  if (!user) { showToast('Sign in to comment'); return; }
  const inp = document.getElementById('ddCommentInput'); const text = (inp.value||'').trim();
  if (!text) return; if (text.length>500){ showToast('Too long (max 500 chars)'); return; }
  try {
    await db.collection('comments').add({
      proofId: _ddCurrentId, userId: user.uid, userName: user.name, userPhotoURL: user.picture||'',
      text, likeCount: 0, likedBy: [], parentId: null, createdAt: firebase.firestore.Timestamp.now()
    });
    inp.value = '';
    loadDareTopComment(_ddCurrentId);
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
  if (!active.length){ el.innerHTML = '<div class="exp-empty">No other active dares.</div>'; return; }
  el.innerHTML = active.map(d=>{
    const cat=d.tags?.[0]||d.cat||'fitness'; const title=d.caption||d.title||'Untitled'; const reward=d.rewardAmount??d.bounty??0;
    const color=CAT_C[cat]||'#717171'; const icon=CAT_I[cat]||'bolt'; const thumb=d.thumbnailURL||'';
    const thumbHTML = thumb
      ? `<div class="dare-list-thumb" style="background:#000;overflow:hidden;"><img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"/></div>`
      : `<div class="dare-list-thumb" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};font-size:36px;">${icon}</span></div>`;
    return `<div class="dare-list-card" style="cursor:pointer;" onclick="openDareDetail('${d.id}')">${thumbHTML}
      <div class="dare-list-body"><div><div class="dare-list-title">${escHtml(title)}</div>
        <div style="font-size:12px;color:var(--t3);margin-top:3px;">${d.creator||'—'} · ${d.takers||0} takers</div></div>
        <div class="dare-list-bottom"><span class="dare-list-bounty">Rs.${reward.toLocaleString('en-IN')}</span></div></div></div>`;
  }).join('');
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
  goPage('home');
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
  const p=homeProofs.find(x=>x.id===proofId)||allProofs.find(x=>x.id===proofId);
  if(!p||!p.videoURL){showToast('Video not available');return;}
  // Open the watch page FIRST
  activeProof=p;
  _renderVideoDetail(p);
  document.getElementById('videoDetailOverlay').classList.add('open');
  document.body.style.overflow='hidden';
  // Then show ad IN the video area, then play
  const player = document.getElementById('vdPlayer');
  const dur = p.videoDuration || 0;
  if (dur >= 60) {
    _showInlineAd(player, p);
  } else {
    if (player) { player.src = p.videoURL; player.play().catch(()=>{}); }
  }
}

// Inline ad overlay inside the video player area (YouTube-style pre-roll)
function _showInlineAd(player, p) {
  if (!player) return;
  const wrap = player.parentElement;
  // Remove old ad if any
  const old = wrap.querySelector('.vd-inline-ad'); if (old) old.remove();
  player.removeAttribute('src'); player.load();
  let secs = 5;
  const ad = document.createElement('div');
  ad.className = 'vd-inline-ad';
  ad.innerHTML = `
    <div class="vd-ad-badge">Ad</div>
    <div class="vd-ad-body">
      <span class="mi" style="font-size:48px;color:var(--blue);">bolt</span>
      <div class="vd-ad-title">DareMarket</div>
      <div class="vd-ad-sub">Your video starts in <b id="vdAdCount">${secs}</b>s</div>
    </div>
    <button class="vd-ad-skip" id="vdAdSkip" disabled>Skip in ${secs}s</button>`;
  wrap.appendChild(ad);
  const tick = setInterval(() => {
    secs--;
    const c = document.getElementById('vdAdCount'); if (c) c.textContent = secs;
    const skip = document.getElementById('vdAdSkip');
    if (secs <= 0) {
      clearInterval(tick);
      ad.remove();
      player.src = p.videoURL; player.play().catch(()=>{});
    } else if (skip) { skip.textContent = `Skip in ${secs}s`; }
  }, 1000);
  // Allow skip after 3s
  setTimeout(() => {
    const skip = document.getElementById('vdAdSkip');
    if (skip) { skip.disabled = false; skip.textContent = 'Skip Ad'; skip.onclick = () => { clearInterval(tick); ad.remove(); player.src = p.videoURL; player.play().catch(()=>{}); }; }
  }, 3000);
}

async function renderExplorer() {
  const container=document.getElementById('explorerContent'); if(!container) return;
  container.innerHTML=`<div class="empty" style="padding:40px;"><span class="mi" style="font-size:36px;opacity:.4;">hourglass_empty</span><div class="empty-title">Loading...</div></div>`;
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
      ${showAll||activeExpTab==='viewed'?`<div class="exp-section"><div class="exp-sec-hdr"><span class="exp-fire"></span><div><div class="exp-sec-title">Most Viewed Today</div><div class="exp-sec-sub">Top taker videos</div></div></div>${_mixedVideoFeedHtml(mostViewed,'Complete dares to see videos here!')}</div>`:''}
      ${showAll||activeExpTab==='accepted'?`<div class="exp-section"><div class="exp-sec-hdr"><span class="exp-fire"></span><div><div class="exp-sec-title">Most Accepted Dares</div><div class="exp-sec-sub">Dares everyone wants to try</div></div></div>${mostAccepted.length?`<div class="dare-list">${mostAccepted.map(d=>_explorerDareCard(d)).join('')}</div>`:`<div class="exp-empty">No active dares!</div>`}</div>`:''}
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
  const pool = (typeof allProofs !== 'undefined' && allProofs.length) ? allProofs : homeProofs;
  shortsFeed = (pool || []).filter(p => p.videoURL && _isShortVideo(p));
  if (!shortsFeed.length) { showToast('No videos yet'); return; }
  shortsIndex = shortsFeed.findIndex(p => p.id === proofId);
  if (shortsIndex < 0) shortsIndex = 0;
  shortsCommentsOpen = false;
  document.getElementById('shortsOverlay').classList.add('open');
  document.getElementById('shortsOverlay').classList.remove('comments-open');
  document.body.style.overflow = 'hidden';
  _renderShortsSnapStack();   // build the native scroll-snap video stack
  renderShort();              // fill the fixed overlay for the current short
}

function closeShorts() {
  const ov = document.getElementById('shortsOverlay');
  ov.classList.remove('open', 'comments-open');
  document.body.style.overflow = '';
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
  const caption = escHtml(d.caption || d.title || p.dareTitle || 'Dare Video');
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
      <div class="shorts-creator-row">
        <div class="shorts-creator-av">${cAv}</div>
        <span class="shorts-creator-name">@${creatorName}</span>
        <button class="shorts-follow" onclick="toggleFollow('${creatorId}','creator')">Follow</button>
      </div>
      <div class="shorts-taker-row">
        <span class="shorts-taker-label">Taker</span>
        <span class="shorts-taker-name">@${takerName}</span>
      </div>
      <div class="shorts-caption" data-preview="${capPreview}" data-full="${caption}">${capPreview}${capToggle}</div>
      <button class="shorts-details-btn" onclick="shortsToggleDetailsLeft(this)"><span class="mi">expand_more</span> Details</button>
      <div class="shorts-details-panel" style="display:none;">
        ${desc ? `<div class="dd-sec-label">Description</div><p class="dd-desc-text">${desc}</p>` : ''}
        ${rules.length ? `<div class="dd-sec-label">Rules</div>${rulesHtml}` : ''}
        <div class="dd-sec-label">Winning Amount</div><p class="dd-bounty">Rs. ${bounty}</p>
      </div>
    </div>

    <div class="shorts-slide-box">
      <video class="shorts-snap-video" src="${p.videoURL}" loop playsinline preload="metadata"
        onclick="shortsSlideTogglePlay(this)" ontimeupdate="shortsSlideOnTime(this)"></video>

      <div class="shorts-top-ctrl">
        <button class="shorts-play-btn" onclick="shortsSlideTogglePlay(this)" title="Play/Pause"><span class="mi">pause</span></button>
        <button class="shorts-mute-btn" onclick="shortsSlideToggleMute(this)" title="Mute"><span class="mi">volume_up</span></button>
        <span class="shorts-time">0:00</span>
      </div>
      <button class="shorts-dots" onclick="shortsOpenMenu('${p.id}')"><span class="mi">more_vert</span></button>
      <div class="shorts-seek-wrap">
        <input type="range" class="shorts-seek" min="0" max="1000" value="0" oninput="shortsSlideSeek(this)"/>
      </div>
    </div>

    <div class="shorts-actions">
      <button class="shorts-act shorts-like-btn ${liked?'liked':''}" onclick="shortsLikeSlide('${p.id}', this)"><span class="mi">thumb_up</span></button>
      <span class="shorts-act-lbl shorts-like-count">${_fmtCount(p.likeCount || 0)}</span>
      <button class="shorts-act" onclick="showToast('Disliked')"><span class="mi">thumb_down</span></button>
      <span class="shorts-act-lbl">Dislike</span>
      <button class="shorts-act" onclick="shortsOpenComments('${p.id}')"><span class="mi">comment</span></button>
      <span class="shorts-act-lbl shorts-comment-count">${_fmtCount(p.commentCount || 0)}</span>
      <button class="shorts-act" onclick="showToast('Share link copied!')"><span class="mi">share</span></button>
      <span class="shorts-act-lbl">Share</span>
      <div class="shorts-act-views"><span class="mi">visibility</span><span class="shorts-views-count">${_fmtCount(p.viewCount || 0)}</span></div>
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

  if (shortsCommentsOpen) loadShortsComments(p.id);
}

// Populate the desktop fixed info + rail for the current short
function _shortsFillFixed(p, d){
  const info = document.getElementById('shortsFixedInfo');
  if (info){
    const creatorName = escHtml(d.creator || p.posterName || 'Creator');
    const takerName = escHtml(p.takerName || 'Taker');
    const creatorId = d.creatorUid || p.posterId || '';
    const caption = escHtml(d.caption || d.title || p.dareTitle || 'Dare Video');
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
  const caption = escHtml(d.caption || d.title || p.dareTitle || 'Dare Video');
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
function _renderShortsCommentsList() {
  const box = document.getElementById('shortsCommentsList'); if (!box) return;
  const comments = _shortsComments || [];
  const ov = document.getElementById('shortsOverlay');
  const isTaker = (typeof user !== 'undefined' && user && ov && user.uid === ov.dataset.takerId);
  const cntEl = document.getElementById('shortsCommentsCount'); if (cntEl) cntEl.textContent = comments.length;
  if (!comments.length) {
    box.innerHTML = '<div style="color:var(--t3);text-align:center;padding:40px 20px;">No comments yet. Be the first!</div>';
    return;
  }
  const tops = comments.filter(c => !c.parentId);
  const byParent = {};
  comments.forEach(c => { if (c.parentId) (byParent[c.parentId]=byParent[c.parentId]||[]).push(c); });
  tops.sort((a,b)=>{ if(a.pinned&&!b.pinned)return -1; if(!a.pinned&&b.pinned)return 1; return (b.likeCount||b.likes||0)-(a.likeCount||a.likes||0); });
  box.innerHTML = tops.map(c => _shortsCommentHtml(c, byParent[c.id]||[], isTaker)).join('');
}
function _shortsCommentHtml(c, replies, isTaker) {
  const liked = (c.likedBy||[]).includes(user?.uid);
  const likeN = c.likeCount || c.likes || 0;
  return `<div class="shorts-comment ${c.pinned?'pinned':''}">
    <div class="shorts-comment-av">${_avHtml(c.userPhotoURL, c.userName)}</div>
    <div class="shorts-comment-body">
      <div class="shorts-comment-head">@${escHtml(c.userName||'user')} ${c.pinned?'<span class="shorts-pin-badge"><span class="mi" style="font-size:11px;">push_pin</span> Pinned</span>':''}</div>
      <div class="shorts-comment-text">${escHtml(c.text||'')}</div>
      <div class="shorts-comment-acts">
        <button class="cmt-act ${liked?'liked':''}" onclick="likeComment('${c.id}')"><span class="mi">thumb_up</span>${likeN>0?' '+_fmtCount(likeN):''}</button>
        <button class="cmt-act" onclick="startShortsReply('${c.id}','${escHtml((c.userName||'').replace(/'/g,''))}')">Reply</button>
        ${isTaker?`<span class="shorts-comment-pin" onclick="pinShortsComment('${_shortsCommentsProofId}','${c.id}',${!c.pinned})">${c.pinned?'Unpin':'Pin'}</span>`:''}
      </div>
      ${replies.length?`<div class="shorts-replies">${replies.map(r=>_shortsReplyHtml(r)).join('')}</div>`:''}
    </div>
  </div>`;
}
function _shortsReplyHtml(c) {
  const liked = (c.likedBy||[]).includes(user?.uid);
  const likeN = c.likeCount || c.likes || 0;
  return `<div class="shorts-comment">
    <div class="shorts-comment-av" style="width:26px;height:26px;font-size:11px;">${_avHtml(c.userPhotoURL, c.userName)}</div>
    <div class="shorts-comment-body">
      <div class="shorts-comment-head">@${escHtml(c.userName||'user')}</div>
      <div class="shorts-comment-text">${escHtml(c.text||'')}</div>
      <div class="shorts-comment-acts">
        <button class="cmt-act ${liked?'liked':''}" onclick="likeComment('${c.id}')"><span class="mi">thumb_up</span>${likeN>0?' '+_fmtCount(likeN):''}</button>
      </div>
    </div>
  </div>`;
}
function startShortsReply(commentId, userName) {
  shortsReplyingTo = commentId;
  const nm = document.getElementById('shortsReplyName'); if (nm) nm.textContent = '@'+userName;
  const bar = document.getElementById('shortsReplyBar'); if (bar) bar.style.display='flex';
  const inp = document.getElementById('shortsCommentInput'); if (inp) inp.focus();
}
function cancelShortsReply() {
  shortsReplyingTo = null;
  const bar = document.getElementById('shortsReplyBar'); if (bar) bar.style.display='none';
}

async function submitShortsComment() {
  if (guestCheck()) return;
  const inp = document.getElementById('shortsCommentInput');
  const text = inp.value.trim();
  if (!text) return;
  const ov = document.getElementById('shortsOverlay');
  const pid = ov.dataset.proofId;
  inp.value = '';
  try {
    await db.collection('comments').add({
      proofId: pid, userId: user.uid, userName: user.name || 'user', userPhotoURL: user.picture || '', text,
      likes: 0, likeCount: 0, likedBy: [], parentId: (shortsReplyingTo || null), pinned: false, createdAt: firebase.firestore.Timestamp.now()
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

async function pinShortsComment(proofId, commentId, pin) {
  try {
    await db.collection('comments').doc(commentId).update({ pinned: pin });
    loadShortsComments(proofId);
    showToast(pin ? 'Comment pinned' : 'Comment unpinned');
  } catch(e) { showToast('Could not update'); }
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

function renderWallet() {
  // Balance
  const bal = document.getElementById('walletBal');
  if (bal) bal.textContent = 'Rs. ' + (wallet.balance||0).toLocaleString('en-IN');
  // Transactions
  const tx = document.getElementById('walletTxns');
  if (!tx) return;
  tx.innerHTML = !wallet.transactions.length
    ? `<div class="empty" style="padding:40px;"><span class="mi">receipt_long</span><div class="empty-title" style="font-size:18px;">No Transactions</div><p class="empty-desc">Your transaction history will appear here.</p></div>`
    : wallet.transactions.map(t=>`
      <div class="txn-item">
        <div class="txn-left">
          <div class="txn-icon" style="background:${t.type==='credit'?'rgba(0,200,83,.15)':'rgba(229,57,53,.15)'};">
            <span class="mi" style="color:${t.type==='credit'?'var(--green)':'var(--red)'};">${t.type==='credit'?'arrow_downward':'arrow_upward'}</span>
          </div>
          <div><div class="txn-title">${escHtml(t.title||'')}</div><div class="txn-date">${t.date||''}</div></div>
        </div>
        <div class="txn-amt ${t.type}">${t.type==='credit'?'+':'-'}Rs.${(t.amount||0).toLocaleString('en-IN')}</div>
      </div>`).join('');
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
  document.getElementById('cmCreatorAv').textContent   = ov.dataset.creatorAv||'C';
  document.getElementById('cmTakerAv').textContent     = ov.dataset.takerAv||'T';
  cm.style.display = 'flex';
}
function closeCollabModal() {
  const cm = document.getElementById('collabModal');
  if (cm) cm.style.display = 'none';
}

// #7: Interleaved infinite feed — mixes long videos & shorts rows in random chunks
let _feedLong = [], _feedShorts = [], _feedLongIdx = 0, _feedScrollBound = false, _shortsRowShown = false;
function _renderInterleavedFeed(longVids, shorts) {
  _feedLong = longVids || [];
  _feedShorts = shorts || [];
  _feedLongIdx = 0;
  _shortsRowShown = false;
  const container = document.getElementById('homeVideoGrid');
  if (!container) return;
  if (!_feedLong.length && !_feedShorts.length) {
    container.innerHTML = `<div class="empty"><span class="mi">play_circle</span>
      <div class="empty-title">No Videos Yet</div>
      <p class="empty-desc">Complete a dare and submit video proof — it will appear here!</p>
      <button class="btn-empty" onclick="goPage('dares')"><span class="mi">bolt</span>Browse Dares</button></div>`;
    return;
  }
  container.innerHTML = '';
  if (!_feedLong.length && _feedShorts.length) {
    // only shorts exist: show one shorts section
    container.insertAdjacentHTML('beforeend', _shortsRowHtml(_feedShorts));
    return;
  }
  _appendFeedChunk(); _appendFeedChunk(); // initial chunks
  // Infinite scroll: append more when near bottom
  if (!_feedScrollBound) {
    _feedScrollBound = true;
    const main = document.querySelector('.main') || window;
    (main===window?window:main).addEventListener('scroll', _feedMaybeLoadMore, { passive:true });
    window.addEventListener('scroll', _feedMaybeLoadMore, { passive:true });
  }
}
function _feedMaybeLoadMore() {
  const home = document.getElementById('pageHome');
  if (!home || !home.classList.contains('active')) return;
  const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 800);
  if (nearBottom) _appendFeedChunk();
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
      container.insertAdjacentHTML('beforeend', _shortsRowHtml(_shuffle(_feedShorts).slice(0, Math.min(12, _feedShorts.length))));
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
  // Show the Shorts shelf once, after the first long chunk (independent of how many longs remain)
  if (_feedShorts.length && !_shortsRowShown) {
    _shortsRowShown = true;
    const someShorts = _shuffle(_feedShorts).slice(0, Math.min(12, _feedShorts.length));
    container.insertAdjacentHTML('beforeend', _shortsRowHtml(someShorts));
  }
}
function _longCardHtml(p) {
  const dur = p.videoDuration ? (p.videoDuration>=60?Math.floor(p.videoDuration/60)+':'+String(p.videoDuration%60).padStart(2,'0'):'0:'+String(p.videoDuration).padStart(2,'0')) : '';
  const t = vidThumb(p, 640);
  return `
    <div class="yt-card" onclick="openVideoDetail('${p.id}')">
      <div class="yt-thumb">
        ${t ? `<img src="${t}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : `<div class="yt-thumb-bg"><span class="mi">bolt</span></div>`}
        ${dur?`<div class="yt-dur">${dur}</div>`:''}
        <div class="yt-rs">Rs.${(p.dareBounty||0).toLocaleString('en-IN')}</div>
      </div>
      <div class="yt-info">
        <div class="yt-av">${_avHtml(p.takerPhotoURL, p.takerName)}</div>
        <div class="yt-meta">
          <div class="yt-title">${escHtml(p.dareTitle||'Dare Completed')}</div>
          <div class="yt-sub"><span>@${p.takerUsername||p.takerName||'creator'}</span><span class="yt-dot"></span><span>${(p.viewCount||0).toLocaleString('en-IN')} views</span><span class="yt-dot"></span><span>${_relTime(p)}</span></div>
        </div>
      </div>
    </div>`;
}

function _shortsRowHtml(shorts) {
  return `<div class="home-section shorts-home-sec">
    <div class="home-sec-hdr"><span class="mi" style="color:#FF0033;font-size:22px;">play_circle</span><span class="home-sec-title">Shorts</span></div>
    <div class="shorts-row">${shorts.map(p=>{
      const t = vidThumb(p, 360);
      const _w = (p.dareTitle||'Short').trim().split(/\s+/);
      const _cap = _w.length > 5 ? _w.slice(0,5).join(' ') + '...' : _w.join(' ');
      return `
      <div class="short-card" onclick="openShorts('${p.id}')">
        <div class="short-thumb">
          ${t ? `<img src="${t}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : `<div class="yt-thumb-bg"><span class="mi">bolt</span></div>`}
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
  // Jump to current index, then play it
  setTimeout(() => {
    const items = c.querySelectorAll('.shorts-snap-item');
    if (items[shortsIndex]) items[shortsIndex].scrollIntoView({ behavior:'auto', block:'start' });
    _shortsPlayCurrent();
  }, 30);
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
  const cur = items[shortsIndex];
  if (cur) {
    const v = cur.querySelector('video');
    if (v) { v.muted = false; v.currentTime = 0; v.playbackRate = _SHORTS_SPEEDS[_shortsSpeedIdx] || 1; v.play().catch(()=>{}); _shortsSlideSyncIcons(v); }
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
            .replace(/\.(mp4|webm|mov|mkv|avi)(\?.*)?$/i, '.jpg');
  }
  return ''; // non-cloudinary: no thumb
}

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
