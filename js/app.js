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
// ══════════════════════════════════════════════════════════════════════════
//  WALLET — PAUSED (Phase 3 turns it back on)
//
//  Nothing is deleted. The markup stays in the DOM, the wallet field stays on
//  every user document in Firestore, and every money path is WRAPPED rather
//  than removed. Set this to true and the wallet comes back exactly as it was —
//  no code to rewrite.
//
//  What the flag does when false:
//    · hides the wallet page, its nav entries and every wallet modal (one CSS
//      rule against .wallet-off, so nothing has to re-render)
//    · sends /wallet to home instead
//    · skips every balance check, debit, credit and refund
//    · stops reading or writing the wallet field in Firestore
//
//  Missions are untouched: bounty amounts still show, and posting, accepting
//  and proof submission all work. Only the money accounting is skipped.
// ══════════════════════════════════════════════════════════════════════════
const WALLET_ENABLED = false;
// On <html>, not <body>: it applies before the first paint, so a paused wallet
// never flashes on screen on the way out.
document.documentElement.classList.toggle('wallet-off', !WALLET_ENABLED);

// Published for the AI Logic module in index.html, which runs on the modular
// SDK and cannot see this scope. One source of truth for the project config.
window.__fbConfig = firebaseConfig;
// Flash-Lite: this runs on every post and every edit, so it has to be cheap and
// fast. Named here so the model can be changed without touching the markup.
//
// The ALIAS, not a pinned version. Measured against this project's own API:
//   gemini-flash-lite-latest  2.0s   ← chosen
//   gemini-3-flash-preview    2.6s
//   gemini-flash-latest       3.9s
//   gemini-3-flash-lite, gemini-3-flash, every 2.x name: 404, not available here
// Two calls per submit, so ~4s end to end. An alias also means a model retiring
// does not silently turn this check into a 404 — which fails closed, i.e. it
// would stop every post on the site.
window.AI_SAFETY_MODEL = 'gemini-flash-lite-latest';
firebase.initializeApp(firebaseConfig);

// ── App Check ──────────────────────────────────────────────────────────────
// Every request now carries a token saying it came from this app in a real
// browser. Without it there is nothing between a script and the database: ten
// thousand sign-ups or ten thousand missions cost an attacker nothing and get
// billed to this project.
//
// The site key is PUBLIC by design — it is handed to every visitor's browser.
// It is useless on its own; the private half never leaves Google.
//
// Wrapped, and deliberately: if the App Check script is slow, blocked or fails,
// this must not take the app down with it. A thrown error here would stop the
// rest of this file from running — the whole app, over a hardening measure.
// Enforcement is off in the Console for now, so a missing token changes
// nothing yet; when it is switched on, this is what keeps real people in.
// Published for the AI Logic module in index.html, which builds a SECOND
// Firebase app and needs the same key to activate App Check on it.
const APPCHECK_SITE_KEY = '6LdMt5UtAAAAANQlYLej4_9VKQoNX87n_WmNWWmU';
window.__appCheckKey = APPCHECK_SITE_KEY;
try {
  if (firebase.appCheck) {
    firebase.appCheck().activate(
      new firebase.appCheck.ReCaptchaEnterpriseProvider(APPCHECK_SITE_KEY),
      true      // keep the token refreshed on its own
    );
  } else {
    console.warn('App Check script did not load — running without it');
  }
} catch (e) {
  console.warn('App Check could not start:', e && e.message);
}

const auth = firebase.auth();
const db   = firebase.firestore();
// Offline cache: repeat reads (page switches, re-opens) are served instantly from
// local IndexedDB instead of a fresh network round-trip. Must run before any query.
try { db.enablePersistence({ synchronizeTabs: true }).catch(()=>{}); } catch(e){}
// Firebase Storage removed — requires paid plan.
// Using Cloudinary (free, no credit card needed) instead.

// ══════════════════════════════════════════════════════════════════════════
//  LEGAL PAGES — Terms, Privacy, Community Guidelines, Contact & Grievance
//
//  Required under India's IT Rules 2021; without them there is no safe-harbour
//  protection. Structure only for now — every section says [Content to be
//  added] until the real wording lands, so the layout, routes, footer and
//  links can all be finished and tested first.
//
//  They are a full-screen layer rather than a .page inside #appScreen, because
//  #appScreen is hidden when signed out and these have to be readable BEFORE
//  anyone has an account — the sign-up screen links straight to them.
// ══════════════════════════════════════════════════════════════════════════
const LEGAL_PLACEHOLDER = '[Content to be added]';
const LEGAL_UPDATED = '15 August 2026';
const LEGAL_CONTACT = 'lovep959245@gmail.com';
const LEGAL_SUPPORT = 'misnivo.support@gmail.com';

const _LEGAL_URL  = { terms:'/terms', privacy:'/privacy', guidelines:'/guidelines', contact:'/contact' };
const _URL_LEGAL  = Object.fromEntries(Object.entries(_LEGAL_URL).map(([k,v])=>[v,k]));

const LEGAL_DOCS = {

  // ── TERMS ───────────────────────────────────────────────────────────────
  // Written against the two in-app agreements (AGREEMENT_TEXT_V1 for takers,
  // CREATOR_AGREEMENT_TEXT_V1 for creators). If those change, change these too.
  terms: { title:'Terms of Service', short:'Terms', sections:[
    { h:'Who can use Misnivo', body:
      'Misnivo is only for people aged 18 or older. When you first sign in we ask for your date of birth, and accounts that report an age under 18 are blocked.\n' +
      'You need an account to post a mission, accept one, or submit a video. You can browse without an account as a guest.\n' +
      'You are responsible for what happens on your account. Do not share your sign-in with anyone.' },

    { h:'How missions work', body:
      'Misnivo is a place to get a small task done and paid for. Nobody pays anything to take part, and nobody risks anything — a taker is simply paid for work they were selected to do.\n' +
      'A creator posts a mission with a description, rules and a reward amount. Anyone eligible can accept it. Accepting is free — a taker never pays anything to Misnivo or to a creator, and anyone who asks a taker for money to be selected is permanently banned.\n' +
      'The creator then selects one taker. Only that person carries out the mission and records a video as proof. The creator reviews the video against the rules they published.\n' +
      'A creator must judge proof only against the rules they published, must not change what they expect after the fact, and must review within the period shown on the mission.' },

    { h:'Payments and rewards', body:
      'Payments are not live yet. The wallet is switched off, no real money moves through Misnivo today, and no payment method is connected. Reward amounts shown on missions are recorded with the mission but nothing is charged or paid out.\n' +
      'When payments do go live, the reward will be held when a mission goes live and released to the taker whose proof the creator approves, minus a platform fee. We will publish the fee and update this page before that happens.\n' +
      'There is no identity verification (KYC) on Misnivo yet. It will be required before any withdrawal is possible.' },

    { h:'What you may not do', body:
      'Do not post a mission that could hurt someone. The Community Guidelines list what is not allowed, and that list is the same one the safety filter checks against.\n' +
      'Do not ask anyone to break the law, trespass, damage property, record someone without their consent, or harass or intimidate anyone.\n' +
      'Do not aim a mission at a named or identifiable person. Missions are challenges, not instructions pointed at someone.\n' +
      'Do not ask for nudity, sexual content, or anything meant to humiliate or degrade the person doing it.\n' +
      'Do not pay, or accept payment, to be selected for a mission.\n' +
      'Do not submit a video that is not genuinely your own attempt, and do not submit someone else in your place.\n' +
      'Do not use Misnivo to move money on behalf of anyone else.' },

    { h:'Content and ownership', body:
      'You keep ownership of the videos you create. Nothing here transfers copyright to Misnivo or to a creator.\n' +
      'By submitting proof you give Misnivo permission to store your video and show it on the platform — to the creator for review, and, if it is approved, to other users in feeds, Clips and search. This permission continues for content that is already published even if you later delete your account, though you may ask us to remove it and we will consider the request.\n' +
      'A creator who funds a mission gets the right to view the proof submitted to them and to share the published video using the sharing built into Misnivo. They do not get commercial rights, and may not download, republish, sell or advertise with the video without the taker’s separate written permission.\n' +
      'If anyone else appears in your video you must have their permission, and if anyone under 18 appears you must have their parent’s or guardian’s permission.' },

    { h:'Account suspension', body:
      'We may reject, hide or remove any mission or video at any time — before or after it goes live, and before or after proof is approved — if it breaks these Terms, the Community Guidelines or the law, or if it looks unsafe.\n' +
      'Misnivo runs an automated safety check on mission text. It is a safeguard, not an approval, and it is not a guarantee that a mission is safe or lawful. Passing the check does not mean we have reviewed or endorsed a mission.\n' +
      'We may suspend or close an account for repeated or serious breaches, including asking a taker for money, paying to be selected, or repeatedly refusing to review proof fairly.' },

    { h:'Disputes', body:
      'If you believe your proof was rejected unfairly, you can raise a dispute with us within 7 days of the decision and we will review it.\n' +
      'For anything else, including a complaint about content on Misnivo, write to our Grievance Officer. Contact details and the timelines we work to are on the Contact & Grievance page.\n' +
      'Completing missions and being paid for them does not make you an employee, contractor, partner or agent of Misnivo, and does not make a creator your employer. Everyone acts on their own account.\n' +
      'If someone brings a claim against Misnivo because of a mission you posted or how you attempted one — for example injury, damage to property, harassment, or use of someone else’s content — you agree to cover the reasonable costs we face because of it.' },

    { h:'Changes to these terms', body:
      'We may update these Terms as Misnivo changes. The date at the bottom of this page shows when it was last changed.\n' +
      'If a change is significant we will tell you in the app before it takes effect. Continuing to use Misnivo after a change means you accept the updated Terms.\n' +
      'The in-app agreements you accept when posting, accepting or submitting proof are recorded separately with the exact wording you were shown at that moment. A later change here does not rewrite what you already agreed to.' },

    { h:'Governing law', body:
      'These Terms are governed by the laws of India.' } ] },

  // ── PRIVACY ─────────────────────────────────────────────────────────────
  // Written from the code, not a template. Every item below is something the
  // app actually reads or writes today.
  privacy: { title:'Privacy Policy', short:'Privacy', sections:[
    { h:'What we collect', body:
      'When you sign in with Google we receive your name, email address and profile photo from your Google account. If you sign up with an email and password, we receive your name and email address.\n' +
      'When you first sign in we ask for your date of birth, and store it along with the date it was verified. If the date of birth reports an age under 18, we record that the account is blocked.\n' +
      'From your profile: your username, bio, website and any social links you add, and your settings.\n' +
      'From missions you post: the caption, description, rules, tags, reward amount, expiry, and any thumbnail or preview video you upload.\n' +
      'From missions you accept: which missions, when, and whether you were selected.\n' +
      'From proof you submit: the video itself, its thumbnail, and technical details of the file (its name, size, length and dimensions).\n' +
      'Comments you write, and which videos and missions you liked, disliked or pinned.\n' +
      'Reports you file, and the reason you give.\n' +
      'When you accept one of the in-app agreements, we record who accepted it, when, which agreement it was, and a fingerprint of the exact wording shown to you, together with your browser’s user-agent string.\n' +
      'If the safety filter blocks a mission, we record the mission text, why it was blocked, and the automated verdicts.\n' +
      'Search terms are counted so we can show what is trending. These counts are not linked to your account.\n' +
      'The app also stores two small values in your browser: your preferred video quality, and a flag remembering you were signed in so the app can start faster.' },

    { h:'Why we collect it', body:
      'To run your account and show your profile to other people on Misnivo.\n' +
      'To show missions and videos, and to let creators review the proof submitted to them.\n' +
      'To confirm you are 18 or older, which we are required to do.\n' +
      'To keep the platform safe — the safety filter checks mission text before it can be posted, and reports let people flag content to us.\n' +
      'To keep a record of the agreements you accepted, which we need if there is ever a dispute or a legal question about what you agreed to.\n' +
      'We do not use your information for advertising, and we do not build advertising profiles. Misnivo does not run ads today.\n' +
      'We do not use analytics or tracking services. There are no third-party trackers on Misnivo.' },

    { h:'Who we share it with', body:
      'We do not sell your information, and we do not share it for advertising.\n' +
      'Other people on Misnivo see your public profile — your name, username, photo, bio and links — and any missions, videos and comments you publish. Please treat everything you post as public.\n' +
      'A creator whose mission you accept sees your name and username, and the video you submit to them. They may use it only to review your proof and complete the mission.\n' +
      'We use these service providers, who process data on our behalf:\n' +
      'Google Firebase — sign-in, and the database that stores everything described above.\n' +
      'Cloudinary — the videos and images you upload are stored and served from Cloudinary.\n' +
      'Cloudflare — hosting and delivery of the site. Like any web host, it processes network requests, including IP addresses.\n' +
      'Google Gemini, through Firebase AI Logic — the text of a mission is sent to Google’s AI service to be checked for safety before it can be posted. This is the mission title, description, rules and tags only. Your videos, comments and private details are never sent to it.\n' +
      'We may disclose information if we are required to by law, a court order, or a valid request from a government authority.' },

    { h:'How long we keep it', body:
      'Your account information is kept while your account exists.\n' +
      'Missions, videos and comments are kept while they are published on Misnivo.\n' +
      'Agreement records and safety-filter records are kept even after the related content is removed, because their whole purpose is to show what was agreed and what was blocked. We keep them as long as they may be needed for a legal or safety question.\n' +
      'Date-of-birth and age-verification records are kept while the account exists, including for accounts blocked for being under 18 — otherwise the block could simply be re-tried.' },

    { h:'Your rights (access, delete)', body:
      'You can see and edit most of your information in the app: your name, username, bio, links and settings.\n' +
      'You can delete your own missions, your own videos and your own comments.\n' +
      'To get a copy of your information, or to have your account deleted, write to ' + LEGAL_CONTACT + ' and we will act on it.\n' +
      'Some things survive deletion, and we want to be straight about it: content you published and that others have already interacted with may remain, and agreement and safety records are kept for the reasons above. Your date of birth cannot be changed once it is set — this is deliberate, so the age check cannot be worked around.' },

    { h:'Cookies', body:
      'Misnivo does not use tracking or advertising cookies.\n' +
      'Signing in uses Firebase Authentication, which stores your session in your browser so you stay signed in. Clearing your browser storage signs you out.\n' +
      'The app also keeps two small values in your browser: your preferred video quality, and a flag remembering you were signed in so the app can start faster. Neither identifies you to anyone else.' },

    { h:'Data security', body:
      'Access to the database is restricted by security rules: you can write only your own account, your own missions, your own videos and your own comments. Agreement and safety records can be written but never edited or deleted, including by the person who created them.\n' +
      'Sign-in and passwords are handled by Firebase Authentication. We never see or store your password.\n' +
      'Being honest about the limits: profile information on Misnivo is public by design, and Misnivo is an early-stage platform run by one person. No service can promise perfect security. Please do not put anything in a mission, video or comment that you would not want to be public.' },

    { h:'Contact us about privacy', body:
      'For any question about this policy, or to ask for a copy or deletion of your data, write to ' + LEGAL_CONTACT + '.' } ] },

  // ── GUIDELINES ──────────────────────────────────────────────────────────
  guidelines: { title:'Community Guidelines', short:'Guidelines', sections:[
    { h:'What Misnivo is for', body:
      'Misnivo is for small, safe, creative tasks that someone can film and be paid for. Someone asks for something to be done, someone else does it and records it, and the person who asked pays for the work.\n' +
      'Nobody pays to take part, and nobody is competing against anyone — a creator picks one person and pays them for the work. If a mission is only interesting because it is dangerous, it does not belong here.' },

    { h:'Missions that are not allowed', body:
      'Missions must not ask anyone to do anything that could cause physical harm. In particular, missions involving any of the following are not allowed:',
      list:'BANNED',
      after:'This is the same list our automated safety filter checks against. If you are unsure whether something is safe, do not post it.' },

    { h:'Content rules', body:
      'Your video must be your own genuine attempt. Do not edit it to fake the result, and do not have someone else stand in for you.\n' +
      'Do not post anything unlawful, or anything that infringes someone else’s copyright.\n' +
      'No nudity or sexual content, and nothing intended to humiliate or degrade the person in it.\n' +
      'If anyone else appears in your video, you must have their permission. If anyone under 18 appears, you must have their parent’s or guardian’s permission.\n' +
      'If a mission asks for content promoting a product, service, brand or business — including your own — the mission description must say so clearly.' },

    { h:'Respecting others', body:
      'Do not name, follow, confront or single out an individual in a mission.\n' +
      'No harassment, bullying, threats, or hate directed at anyone or at any group.\n' +
      'Do not share anyone’s private information — including addresses, phone numbers, or anything that identifies where someone lives or works.\n' +
      'If you take part in a mission, use what you learn about the other person only to complete it. Do not contact them outside Misnivo or pass their details on.\n' +
      'Takers never pay to take part. Asking a taker for money in exchange for selecting them results in a permanent ban.' },

    { h:'Reporting', body:
      'Every mission and every video has a Report option in its menu. Use it if you see something unsafe or against these guidelines.\n' +
      'If a mission looks dangerous, report it instead of attempting it. No reward is worth your safety.\n' +
      'For anything urgent or serious, write to our Grievance Officer — the details are on the Contact & Grievance page.\n' +
      'Reports go to us, not to the person you are reporting.' },

    { h:'What happens if you break the rules', body:
      'Depending on what happened, we may remove the mission or video, refuse a reward, restrict what your account can do, or close it.\n' +
      'Serious breaches — asking a taker for money, paying to be selected, content involving anyone under 18, or anything that puts a person in danger — mean a permanent ban.\n' +
      'We may remove content at any time, including after a creator has approved it. Our automated checks are a safeguard, not an approval, and passing them does not mean a mission has been reviewed by a person.' } ] },

  // ── CONTACT ─────────────────────────────────────────────────────────────
  contact: { title:'Contact & Grievance', short:'Contact', sections:[
    { h:'Grievance Officer', body:
      'In line with the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, our Grievance Officer is:\n' +
      'Name: Lovepreet Singh\n' +
      'Email: ' + LEGAL_CONTACT + '\n' +
      'Please write from the email address on your Misnivo account, and include a link to the mission or video you are writing about.' },

    { h:'Response timeline', body:
      'We acknowledge every complaint within 24 hours of receiving it.\n' +
      'We resolve complaints within 15 days.\n' +
      'Where we are required to remove content by a court order or an order from a government authority, we act within 36 hours.' },

    { h:'General contact', body:
      'For help with your account or anything that is not a complaint, write to ' + LEGAL_SUPPORT + '.' },

    { h:'How to report content', body:
      'The quickest way is in the app: every mission and every video has a Report option in its menu. Choose a reason and add anything you want us to know. Reports come to us, not to the person you are reporting.\n' +
      'You can also email the Grievance Officer above. Include a link to the content and tell us what is wrong with it.\n' +
      'If you believe someone is in immediate danger, contact your local emergency services first.' } ] }
};

// The banned list is read from the safety filter's own categories, so the
// guidelines and what the filter actually blocks cannot drift apart.
function _legalBannedList(){
  return Object.keys(BANNED_KEYWORDS)
    .map(c => '<li>' + escHtml(SAFETY_CATEGORY_LABELS[c] || c) + '</li>').join('');
}

function _legalParas(text){
  return text.split('\n').filter(Boolean).map(l => '<p>' + escHtml(l) + '</p>').join('');
}
// A section can carry text, a list, and text after the list — the guidelines
// need all three around the banned-mission list.
function _legalSectionHtml(sec){
  const h = typeof sec === 'string' ? sec : sec.h;
  if (typeof sec === 'string' || (!sec.body && !sec.list))
    return '<h2 class="legal-h2">' + escHtml(h) + '</h2>'
         + '<p class="legal-todo">' + LEGAL_PLACEHOLDER + '</p>';
  let inner = sec.body ? _legalParas(sec.body) : '';
  if (sec.list === 'BANNED')
    inner += '<ul class="legal-list">' + _legalBannedList() + '</ul>';
  else if (Array.isArray(sec.list))
    inner += '<ul class="legal-list">' + sec.list.map(i => '<li>' + escHtml(i) + '</li>').join('') + '</ul>';
  if (sec.after) inner += _legalParas(sec.after);
  return '<h2 class="legal-h2">' + escHtml(h) + '</h2>' + inner;
}

function _legalHtml(kind){
  const d = LEGAL_DOCS[kind];
  return '<h1 class="legal-h1">' + escHtml(d.title) + '</h1>'
       + d.sections.map(_legalSectionHtml).join('')
       + '<p class="legal-updated">Last updated: ' + escHtml(LEGAL_UPDATED)
       + '<br>If you have questions about this page, contact us at ' + escHtml(LEGAL_CONTACT) + '</p>';
}

// ── open / close ──
// A legal page pushes its own history entry, so the phone back button closes it
// like any other layer. Arriving straight on /terms pushes nothing, and Back
// then returns to the app rather than leaving the site.
let _legalOpen = null, _legalPushed = false;

function openLegal(kind, _fromUrl){
  if (!LEGAL_DOCS[kind]) return;
  document.getElementById('legalBody').innerHTML = _legalHtml(kind);
  document.getElementById('legalPage').style.display = 'block';
  const sc = document.getElementById('legalScroll'); if (sc) sc.scrollTop = 0;
  document.body.classList.add('legal-open');
  if (!_fromUrl){
    try { history.pushState({ _legal:kind }, '', _LEGAL_URL[kind]); _legalPushed = true; } catch(e){}
  } else { _legalPushed = false; }
  _legalOpen = kind;
}

function closeLegal(_fromPop){
  if (!_legalOpen) return;
  document.getElementById('legalPage').style.display = 'none';
  document.body.classList.remove('legal-open');
  _legalOpen = null;
  if (_fromPop) return;                       // the URL already moved
  if (_legalPushed){ _legalPushed = false; try { history.back(); } catch(e){} }
  else { try { history.replaceState({}, '', '/'); } catch(e){} }   // landed here directly
}

// Captured at load, before goPage rewrites the URL to '/' — same trick
// _deepLinkPath uses for /watch and /dare.
let _legalBoot = null;
try { _legalBoot = _URL_LEGAL[(location.pathname||'/').replace(/\/+$/,'') || '/'] || null; } catch(e){}
function _legalOpenIfBooted(){ if (_legalBoot){ const k=_legalBoot; _legalBoot=null; openLegal(k, true); } }

// ══════════════════════════════════════════════════════════════════════════
//  MISSION SAFETY FILTER — stage 1: keywords
//
//  The creator agreement says what a mission may not ask for. This is what
//  actually stops it. Runs on posting AND on editing, because otherwise "sing a
//  song" gets posted, agreed to, and then edited into "climb the roof".
//
//  Deliberately blunt: it over-blocks rather than under-blocks. A wrongly
//  blocked mission costs someone a rewrite; a wrongly allowed one costs
//  somebody's safety.
// ══════════════════════════════════════════════════════════════════════════
const BANNED_KEYWORDS = {
  // Roman-script Hindi has no fixed spelling, so every plausible vowel of the
  // same word has to be here. "12m sai kodo" got posted because the list had
  // 'koodo' and not 'kodo'.
  heights: ['rooftop','roof','chhat','chat pe','balcony','terrace','climb',
            'chadh','chadho','chadhna','jump','jump from','jump off',
            'koodo','kood','kood ja','kodo','kudo','kudna','koodna','kudho',
            'chalaang','cliff','ladder','height','building se','upar se',
            'manzil','floor se','se koodo','se kodo'],
  water:   ['swim','swimming','dive','diving','drown','doob','paani mein',
            'river','nadi','pool mein','sea','samundar','lake','well','kuan'],
  fire:    ['fire','aag','burn','jalao','jala','flame','candle','matchstick',
            'lighter','petrol','kerosene','electric','current','shock','wire',
            'explosive','bomb','patakha','firecracker'],
  vehicle: ['car','bike','scooter','motorcycle','gaadi','drive','driving',
            'road pe','highway','traffic','railway','train','patri','track pe',
            'stunt','wheelie','speed'],
  weapon:  ['knife','chaaku','blade','gun','bandook','pistol','sword','talwar',
            'weapon','hathiyaar','danda','rod','acid','tezaab'],
  substance:['alcohol','sharab','daru','beer','whisky','drug','nasha','ganja',
            'weed','cigarette','smoke','tobacco','gutka','pill','tablet',
            'medicine','dawai','injection'],
  eating:  ['eat 10','eat 20','khaao','ghost pepper','mirchi','chilli challenge',
            'swallow','nigal','fasting','bhookha','starve','raw meat','kachcha',
            'spoiled','sadha','cinnamon challenge','salt challenge'],
  fighting:['fight','ladai','punch','maar','hit','slap','thappad','kick','laat',
            'beat','peet','wrestle','attack','push','dhakka'],
  selfharm:['cut yourself','self harm','suicide','khudkushi','marne',
            'hurt yourself','apne aap ko','blood','khoon nikal'],
  minorAnimal:['child','bachcha','kid','baby','minor','school student','animal',
            'dog','kutta','cat','billi','cow','gaay','bird','pakshi'],
  prank:   ['prank','scare','darao','fake call','police','bomb threat','kidnap',
            'chori','steal','trespass','ghus ja','follow someone','peecha']
};

// What the person who got blocked is told. Never the matched word — tell someone
// exactly which word tripped the filter and they will change that one word.
const SAFETY_CATEGORY_LABELS = {
  heights:    'heights or climbing',
  water:      'water or a risk of drowning',
  fire:       'fire, heat or electricity',
  vehicle:    'vehicles, roads or railways',
  weapon:     'weapons',
  substance:  'alcohol, drugs or other substances',
  eating:     'extreme eating or swallowing things',
  fighting:   'fighting or physical contact',
  selfharm:   'self-harm or harm to another person',
  minorAnimal:'anyone under 18, or animals',
  prank:      'pranks that could cause panic, injury or a police response'
};

// One regex per category, built once.
//  · word-bounded, so "car" cannot match "scared" and "hit" cannot match
//    "white" — the list is short common words, and unbounded it would block
//    almost every mission ever written.
//  · optional trailing s/es, because "drink 5 beers" and "bring knives" are the
//    same mission as "beer" and "knife" and must not walk through a plural.
//  · knife → knives, which a trailing s never catches, and a weapon is exactly
//    the word not to let through on a spelling technicality.
const _escRe = w => w.replace(/[.*+?^${}()|[\]\\]/g, m => '\\' + m);
const _wordForms = w =>
  /fe$/.test(w) ? [w, w.slice(0, -2) + 'ves']
  : /[^f]f$/.test(w) ? [w, w.slice(0, -1) + 'ves']
  : [w];
const _BANNED_RE = Object.fromEntries(Object.entries(BANNED_KEYWORDS).map(([cat, words]) => [
  cat,
  new RegExp('\\b(?:' + words.flatMap(_wordForms).map(_escRe).join('|') + ')(?:e?s)?\\b', 'i')
]));

// Rules and tags are typed by the same person as the title, so they are the same
// risk: a harmless caption over a rule that says "climb onto the roof first" is
// the whole mission. Everything the creator writes goes through the filter.
function checkMissionSafety(title, description, rules, tags) {
  const text = [title, description, (rules || []).join(' '), (tags || []).join(' ')]
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ');                 // "chhat   pe" must match "chhat pe"
  for (const cat in _BANNED_RE) {
    const m = text.match(_BANNED_RE[cat]);
    if (m) return { safe: false, category: cat, matched: m[0] };   // first hit wins
  }
  return { safe: true, category: null, matched: null };
}

// Telemetry, not consent: proof the filter is running, and which words actually
// show up. Never blocks anything on its own, so a failed write is swallowed.
function _logSafetyBlock(title, description, category, stage, ai, rules, tags) {
  try {
    const rec = {
      userId:      user ? user.uid : null,
      userEmail:   user ? (user.email || '') : '',
      title:       title || '',
      description: description || '',
      rules:       rules || [],          // a block may have come from these, not the caption
      tags:        tags  || [],
      category,
      stage:       stage || 'keyword',
      blockedAt:   firebase.firestore.FieldValue.serverTimestamp()
    };
    if (ai) {                                  // stage 2 keeps both verdicts
      rec.check1    = ai.check1 || null;
      rec.check2    = ai.check2 || null;
      rec.disagreed = !!ai.disagreed;
      rec.reason    = ai.reason || '';
      rec.model     = window.AI_SAFETY_MODEL || '';
    }
    db.collection('safety_blocks').add(rec).catch(() => {});
  } catch (e) {}
}

function _showSafetyBlock(category, customMsg) {
  const label = SAFETY_CATEGORY_LABELS[category] || 'unsafe activity';
  document.getElementById('safetyBlockMsg').textContent = customMsg ||
    ('Missions that involve ' + label + " aren't allowed on Misnivo for safety reasons.");
  const ov = document.getElementById('safetyBlockOverlay');
  ov.style.zIndex = '2147483600';        // above the post form (_ovOpen stacks at 9500+)
  ov.style.display = 'flex';
  ov.classList.add('open');              // .overlay gates opacity/pointer-events on .open
}
function _safetyBlockClose() {
  const ov = document.getElementById('safetyBlockOverlay');
  ov.style.display = 'none'; ov.classList.remove('open');   // the form is still open behind it
}

// ══════════════════════════════════════════════════════════════════════════
//  MISSION SAFETY FILTER — stage 2: the model
//
//  Runs only on what the keyword list let through. Two calls, not one: the
//  second is asked to review the first, because a single model that misreads
//  Hinglish or misses an indirect risk has nobody checking it.
//
//  EVERY failure path blocks. A safety check that passes when it cannot reach
//  the API is not a safety check — it is a delay before an accident.
// ══════════════════════════════════════════════════════════════════════════
const _AI_TIMEOUT_MS = 20000;

// Even with responseMimeType:'application/json' a model will sometimes wrap its
// answer in ```json fences. Strip them before parsing rather than fail the whole
// check on formatting.
function _aiParseJson(raw) {
  const t = String(raw || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(t);
}

async function _aiAsk(model, prompt) {
  const res = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, rej) => setTimeout(() => rej(new Error('AI timeout')), _AI_TIMEOUT_MS))
  ]);
  return _aiParseJson(res.response.text());
}

// { ok:false, error } on any failure — callers must treat that as "block".
// { ok:true, safe, reason, concern, disagreed, check1, check2 } otherwise.
async function checkMissionSafetyAI(title, description, rules, tags) {
  // Same reason as the keyword stage: the rules are part of what is being asked.
  const task = 'Task: ' + (title || '') + '\n' + (description || '')
    + ((rules && rules.length) ? '\nRules the taker must follow:\n- ' + rules.join('\n- ') : '')
    + ((tags  && tags.length)  ? '\nTags: ' + tags.join(', ') : '');
  try {
    const model = await window._aiReady;
    if (!model) return { ok:false, error:'AI Logic unavailable' };

    // CHECK 1 — the reviewer
    const c1 = await _aiAsk(model,
      'You are a safety reviewer for a task platform used in India. Someone will be ' +
      'paid to do this task and record a video.\n\n' +
      'The text is usually short and informal, written in Roman-script Hindi or ' +
      'Hinglish with no fixed spelling — "koodo", "kodo", "kudo" and "kood" all mean ' +
      '"jump"; "sai" is usually "se" ("from").\n\n' +
      'Decide if it could cause physical harm, break a law, target a specific person, ' +
      'or involve anything sexual or degrading. Not allowed: heights or climbing, ' +
      'water, fire or electricity, vehicles or roads, weapons, alcohol or drugs, ' +
      'extreme eating or swallowing, fighting, self-harm, anyone under 18 or animals, ' +
      'and pranks that could cause panic or a police response.\n\n' +
      'How to judge:\n' +
      '- Consider every plausible reading, including misspellings. If ANY plausible ' +
      'reading is dangerous, answer unsafe.\n' +
      '- If you cannot confidently tell what is being asked, answer UNSAFE. Never ' +
      'assume a harmless meaning for text you cannot read. Guessing wrong here gets ' +
      'somebody hurt; guessing wrong the other way costs them a rewrite.\n\n' +
      task + '\n\n' +
      'Reply ONLY with JSON: {"safe": true/false, "reason": "one short sentence", ' +
      '"concern": "category or none"}');
    if (typeof c1.safe !== 'boolean') return { ok:false, error:'check 1 returned no verdict' };

    // CHECK 2 — the reviewer's reviewer
    const c2 = await _aiAsk(model,
      'A first reviewer judged this task for a task platform used in India. Here is ' +
      'the task and their verdict.\n\n' +
      task + '\n\n' +
      'Their verdict: ' + JSON.stringify(c1) + '\n\n' +
      'Do you agree? Consider anything they may have missed — indirect risk, ' +
      'Roman-script Hindi or slang wording, or a way this could be misused.\n' +
      'The text has no fixed spelling: "koodo", "kodo", "kudo" and "kood" all mean ' +
      '"jump"; "sai" is usually "se" ("from"). A number with m, metre or feet is a ' +
      'height.\n' +
      'If the first reviewer assumed a harmless meaning for wording that is not ' +
      'clearly readable, that is a MISS — say so and answer finalSafe false. Text ' +
      'nobody can confidently read is unsafe.\n\n' +
      'Reply ONLY with JSON: {"agree": true/false, "finalSafe": true/false, ' +
      '"reason": "one short sentence"}');
    if (typeof c2.finalSafe !== 'boolean') return { ok:false, error:'check 2 returned no verdict' };

    // Disagreement is not a tie to be broken — it means one of them is wrong
    // about whether someone gets hurt. Block, and put it in front of a human.
    const disagreed = (c2.agree === false) || (c1.safe !== c2.finalSafe);
    const safe = !disagreed && c1.safe && c2.finalSafe;

    return {
      ok: true, safe, disagreed,
      reason:  (safe ? '' : (c2.reason || c1.reason || '')),
      concern: c1.concern || 'none',
      check1: c1, check2: c2
    };
  } catch (e) {
    console.error('AI safety check failed:', e);
    return { ok:false, error: (e && e.message) || 'unknown' };
  }
}

// Two reviewers who cannot agree is the one case a human has to see.
function _logManualReview(title, description, ai, rules, tags) {
  try {
    db.collection('manual_review').add({
      userId:      user ? user.uid : null,
      userEmail:   user ? (user.email || '') : '',
      title:       title || '',
      description: description || '',
      rules:       rules || [],
      tags:        tags  || [],
      check1:      ai.check1 || null,
      check2:      ai.check2 || null,
      model:       window.AI_SAFETY_MODEL || '',
      reason:      'reviewers disagreed',
      createdAt:   firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  } catch (e) {}
}

// ── MISSION AGREEMENT ──────────────────────────────────────────────────────
// One text, one version, shown at both gates (accepting a mission, submitting
// proof for one). Bump AGREEMENT_VERSION whenever the wording below changes —
// past acceptances keep the version and hash they were shown, so a later
// change here never rewrites what an old record says the user agreed to.
const AGREEMENT_VERSION = '1.1';
const AGREEMENT_TEXT_V1 =
`1. You are 18 or older
You confirm you are at least 18 years old. Misnivo does not allow anyone under 18 to accept missions, submit proof, or receive rewards.

2. You are acting voluntarily
You are choosing to take on this specific mission of your own free will, after reading its description, rules and reward. Nobody at Misnivo assigned it to you or requires you to attempt it. You can abandon a mission at any time, with no penalty.

3. You judge yourself capable of doing it safely
You confirm you consider yourself physically and mentally able to complete this mission, that you have any skill, equipment or preparation it requires, and that you will not attempt it under the influence of alcohol or drugs. That judgment is yours and you are responsible for it.

4. You accept the risk
Missions may involve physical activity or challenge. You understand this, and you accept all risk of injury, loss or damage that may result from attempting one. Misnivo does not perform, supervise or control how missions are carried out, and is not responsible for what happens while you attempt or record one. Misnivo does not review whether a mission is safe for you personally. Missions that appear dangerous are removed, but you must judge your own safety. If you believe a mission is unsafe or breaks the rules, report it instead of attempting it — every mission and video has a Report option in its menu. If anything feels unsafe, stop — no reward is worth your safety.

5. You will not pay to be selected
Missions are free to accept. You confirm you have not paid, offered or promised money or anything of value to a mission creator, or to anyone else, in exchange for being selected — and that you will not do so. This is strictly prohibited and results in a permanent ban and forfeited rewards.

6. Your proof must be lawful and your own
Any proof video you submit must be genuinely your own attempt — unedited, and not staged with someone standing in for you. Recording and sharing it must not break any law, damage property you don't own, or use a location you weren't allowed to use. If anyone else appears in it, you must have their permission — and if anyone under 18 appears, their parent's or guardian's permission.

7. Misnivo can host and show your proof
By submitting proof, you give Misnivo permission to store your video and show it on the platform — to the mission creator for review, and, if approved, to other users (including in feeds, Clips or search). This permission continues for content already published even if you later delete your account, though you may request removal at any time and we will consider it.

8. Misnivo can remove content
Misnivo may remove any mission or video that breaks its Community Guidelines or the law, or that appears unsafe — at any time, including after a mission creator has approved it. If content is removed for a rules breach after payment, Misnivo may reverse or withhold the reward.

9. Review and reward are not guaranteed
The mission creator reviews submitted proof and decides whether it meets the mission's rules. Accepting a mission or submitting proof does not guarantee approval or reward — rejected proof does not get paid. If you believe proof was rejected unfairly, you can raise a dispute with Misnivo within 7 days and we will review the decision.

10. This does not make you an employee
Completing missions and getting paid for them does not make you an employee, contractor or partner of Misnivo. You are acting on your own account.

11. You cover claims that come from your mission
If someone brings a claim against Misnivo because of how you attempted a mission or what is in your video — for example injury to another person, damage to property, or use of someone else's content — you agree to cover the reasonable costs Misnivo faces because of it.

12. Governing law
This agreement is governed by the laws of India.`;

// Point 20 of the creator agreement names a city for jurisdiction. Nothing in
// this repo says which one and a jurisdiction is not something to guess, so the
// clause stays at country level until a city is set here. Setting one narrows
// the clause — and changes the text, so bump CREATOR_AGREEMENT_VERSION with it.
const AGREEMENT_JURISDICTION_CITY = '';        // e.g. 'New Delhi'

// ── MISSION CREATOR AGREEMENT ──────────────────────────────────────────────
// Shown before the post form opens, so nobody fills in a mission they were
// never allowed to ask for. Its own version: the creator document and the taker
// document above change independently of each other.
const CREATOR_AGREEMENT_VERSION = '1.0';
const CREATOR_AGREEMENT_TEXT_V1 =
`1. You are 18 or older
You confirm you are at least 18 years old. Misnivo does not allow anyone under 18 to post missions or fund rewards.

2. You are responsible for what you ask
You — not Misnivo — decide what this mission asks someone to do. You are responsible for that decision. If your mission asks for something unsafe or unlawful, that is your responsibility, whether or not Misnivo's checks catch it first.

3. Your mission must be safe
You confirm this mission does not ask anyone to do anything that could cause physical harm. You will not post missions involving:
- heights, rooftops, balconies or climbing
- water, swimming, diving or drowning risk
- fire, heat, electricity or explosives
- vehicles, traffic, roads or railway areas
- weapons of any kind
- alcohol, drugs, medicines or any substance
- extreme eating, fasting, or anything swallowed
- fighting, hitting, or any contact that could injure
- self-harm, or harm to any other person
- anyone under 18, or any animal
- pranks that could cause panic, injury or a police response
If you are unsure whether something is safe, do not post it.

4. Your mission must be lawful
You confirm this mission does not ask anyone to break any law, trespass on property, damage anything, record someone without consent, harass or intimidate anyone, or violate anyone's privacy.

5. Your mission must not target a specific person
Missions must not name, identify, follow, confront or single out any individual. Missions are challenges, not instructions aimed at a person.

6. Your mission must not ask for sexual, intimate or degrading content
You will not post missions asking for nudity, sexual content, content of a sexual nature, or anything intended to humiliate or degrade the person performing it.

7. You will not ask a taker for money
Takers accept missions for free. You confirm you have not asked, accepted or agreed to receive money or anything of value from any taker in exchange for selecting them — and that you will not do so. This is strictly prohibited and results in a permanent ban, forfeited funds, and removal of your missions.

8. You are committing the reward
By posting this mission you are committing to fund the reward shown. The amount is held once your mission goes live and is released to the taker whose proof you approve, minus Misnivo's platform fee. You cannot withdraw a reward that has already been earned.

9. You choose the taker before the work begins
You select one taker from those who accept your mission. Only that person performs the mission. Once you have selected someone, you are committing to review their proof and to pay the reward if it meets your published rules.

10. You will review fairly and on time
You agree to review submitted proof within the review period shown, and to judge it only against the rules you published in the mission. You will not reject proof that meets those rules in order to avoid paying. If you do not review within the period, proof that meets your published rules may be approved automatically and the reward released. Unfair or repeated non-review may result in removal of your ability to post missions.

11. Your mission description is accurate
You confirm the mission's description, rules, reward and review period are accurate and complete. You will not change what you expect after proof is submitted, or reject proof for a rule you did not publish.

12. Rights to the proof video
The taker keeps ownership of the video they create. By funding a mission you receive the right to view the proof submitted to you, and to share the published video through Misnivo's own sharing features. You do not receive commercial rights, and you may not download, republish, sell, advertise with, or use the video elsewhere without the taker's separate written permission.

13. You will respect the taker's privacy
Through this mission you may see a taker's video, name and account details. You may use this only to review their proof and complete the mission. You will not contact them outside Misnivo, share their information with anyone, or use it for any other purpose.

14. The money is legitimately yours
You confirm the funds you use to reward missions are your own and come from a lawful source. You will not use Misnivo to move, disguise or transfer money on behalf of anyone else. Misnivo may ask you to verify your identity or the source of funds, and may hold or refuse a reward while doing so.

15. Missions are not advertising unless declared
If your mission asks for content that promotes a product, service, brand or business — including your own — you must clearly say so in the mission description. Undeclared promotional missions may be removed.

16. Missions are not employment
Posting a mission and paying a reward does not make the taker your employee, contractor or agent, and does not make you their employer. You are not directing their work, supervising how they do it, or responsible for their conduct — and they are not acting on your behalf.

17. You will not dispute a payment you owe
Once you approve proof and the reward is released, you will not raise a chargeback or payment dispute for that amount. Doing so may result in account suspension and recovery of the amount.

18. Misnivo can remove or refuse your mission
Misnivo may reject, edit, hide or remove any mission at any time — before or after it goes live, and before or after proof is approved — if it breaks these rules, the Community Guidelines or the law, or if it appears unsafe. Misnivo's checks are a safeguard, not an approval or a guarantee that your mission is safe or lawful. If your account is suspended, funds already committed to a live mission remain committed and will be settled under these rules.

19. You cover claims that come from your mission
If someone brings a claim against Misnivo because of a mission you posted — for example injury to a taker or another person, damage to property, harassment, or breach of someone's rights — you agree to cover the reasonable costs Misnivo faces because of it.

20. Governing law and jurisdiction
This agreement is governed by the laws of India. Any dispute relating to it will be subject to the exclusive jurisdiction of the courts ${AGREEMENT_JURISDICTION_CITY ? 'at ' + AGREEMENT_JURISDICTION_CITY + ', India' : 'of India'}.`;

// Everything the modal and the audit record need, per gate. Keeping the text,
// version and button together is what stops a record from claiming a user
// accepted one document while the screen showed another.
const _AGREEMENT_DOCS = {
  mission_create:   { mode:'create', text:() => CREATOR_AGREEMENT_TEXT_V1, version:() => CREATOR_AGREEMENT_VERSION,
                      title:'Mission Creator Agreement', btn:'I Agree — Post Mission',
                      note:'Please read and confirm the following before posting a mission.' },
  mission_accept:   { mode:'accept', text:() => AGREEMENT_TEXT_V1, version:() => AGREEMENT_VERSION,
                      title:'Mission Agreement', btn:'I Agree — Accept Mission', note:'' },
  proof_submission: { mode:'proof',  text:() => AGREEMENT_TEXT_V1, version:() => AGREEMENT_VERSION,
                      title:'Mission Agreement', btn:'I Agree — Submit Proof',
                      note:'You agreed to this when you accepted the mission. Please confirm again before your video uploads.' }
};
function _agreementDoc(modeOrType){
  if (_AGREEMENT_DOCS[modeOrType]) return _AGREEMENT_DOCS[modeOrType];
  for (const k in _AGREEMENT_DOCS) if (_AGREEMENT_DOCS[k].mode === modeOrType) return _AGREEMENT_DOCS[k];
  return _AGREEMENT_DOCS.mission_accept;
}

// djb2 — small, deterministic, no library. Lets a later dispute confirm exactly
// which wording a user saw: hash it once here, compare against what's stored
// on their agreement record.
function _agreementHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;   // hash*33 + c, kept 32-bit
  }
  return (hash >>> 0).toString(16);
}

// STEP 1 — the reusable modal itself. Not wired to anything yet: no caller
// gates a real action on it until the accept-mission and submit-proof flows
// are updated to open it instead of doing what they do today.
//
//   showAgreementModal(mode, onAgree)
//     mode     — 'accept' | 'proof' (only changes the button label and the
//                small "you already saw this once" note for 'proof')
//     onAgree  — called once, only after Agree is actually pressed (and only
//                once the checkbox is ticked AND the text has been scrolled
//                to its end — both are required, neither alone enables it)
//
// Cancelling (✕, the dim backdrop, or the Cancel button) calls nothing.
let _agreementOnAgree = null;
let _agreementScrolledEnd = false;
let _agreementChecked = false;

let _agreementMode = 'accept';
function showAgreementModal(mode, onAgree) {
  // above every _ovOpen-stacked page overlay (9500 + stack depth), and above
  // the player menus (2147483000) for good measure
  document.getElementById('agreementOverlay').style.zIndex = '2147483600';
  _agreementOnAgree = onAgree;
  _agreementScrolledEnd = false;
  _agreementChecked = false;

  const doc = _agreementDoc(mode);
  _agreementMode = mode;

  const note = document.getElementById('agreementProofNote');
  note.style.display = doc.note ? 'flex' : 'none';
  document.getElementById('agreementNoteText').textContent = doc.note;

  document.getElementById('agreementTitle').textContent = doc.title;

  const btn = document.getElementById('agreementAgreeBtn');
  btn.innerHTML = '<span class="mi">check</span>' + doc.btn;

  document.getElementById('agreementPoints').innerHTML = _agreementRenderHtml(doc.text());

  const cbIcon = document.getElementById('agreementCheckIcon');
  cbIcon.textContent = 'check_box_outline_blank';
  document.getElementById('agreementCheckRow').classList.remove('checked');
  document.getElementById('agreementScrollHint').style.display = 'flex';
  _agreementUpdateBtn();

  const ov = document.getElementById('agreementOverlay');
  ov.style.display = 'flex';
  ov.classList.add('open');   // .overlay gates opacity/pointer-events on .open, not display
  // AFTER display, not before: a display:none element has no scroll box, so
  // setting scrollTop on it does nothing and the old position survives. This is
  // why reopening showed the agreement exactly where it was left.
  requestAnimationFrame(() => { document.getElementById('agreementBody').scrollTop = 0; });
}

// "1. Title\nBody text..." blocks, separated by a blank line, become a
// numbered heading + paragraph each. Kept separate from AGREEMENT_TEXT_V1
// itself so the hash is always of the plain legal text, never of markup.
function _agreementRenderHtml(text) {
  return text.split(/\n\n+/).map(block => {
    const m = block.match(/^(\d+)\.\s+(.+?)\n([\s\S]*)$/);
    if (!m) return '';
    // Body lines starting "- " become a list; everything else is a paragraph.
    // Single-paragraph points render exactly as before.
    let body = '', list = [];
    const flush = () => { if (list.length){ body += '<ul class="agreement-pt-list">' +
      list.map(li => '<li>' + escHtml(li) + '</li>').join('') + '</ul>'; list = []; } };
    m[3].split('\n').forEach(line => {
      const t = line.trim();
      if (!t) return;
      if (t.startsWith('- ')) list.push(t.slice(2));
      else { flush(); body += '<p>' + escHtml(t) + '</p>'; }
    });
    flush();
    return `<div class="agreement-pt">
      <div class="agreement-pt-title"><span class="agreement-pt-num">${m[1]}.</span> ${escHtml(m[2])}</div>
      ${body}
    </div>`;
  }).join('');
}

function _agreementOnScroll() {
  const el = document.getElementById('agreementBody');
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 12) {
    _agreementScrolledEnd = true;
    document.getElementById('agreementScrollHint').style.display = 'none';
    _agreementUpdateBtn();
  }
}

function _agreementToggleCheck() {
  _agreementChecked = !_agreementChecked;
  document.getElementById('agreementCheckIcon').textContent =
    _agreementChecked ? 'check_box' : 'check_box_outline_blank';
  document.getElementById('agreementCheckRow').classList.toggle('checked', _agreementChecked);
  _agreementUpdateBtn();
}

function _agreementUpdateBtn() {
  document.getElementById('agreementAgreeBtn').disabled = !(_agreementScrolledEnd && _agreementChecked);
}

function _agreementHide() {
  const ov = document.getElementById('agreementOverlay');
  ov.style.display = 'none'; ov.classList.remove('open');
}

function _agreementCancel() {
  _agreementOnAgree = null;
  _agreementHide();
}

function _agreementConfirm() {
  if (document.getElementById('agreementAgreeBtn').disabled) return;   // defensive: no bypassing the two conditions
  const cb = _agreementOnAgree; _agreementOnAgree = null;
  _agreementHide();
  if (cb) cb();
}

// ── CLOUDINARY CONFIG ─────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME    = 'ddam2qcpu';
const CLOUDINARY_UPLOAD_PRESET = 'missionbook';

// Last cap on what leaves this app. Every file picker already checks size and
// type, but the check lived ONLY at the picker — a new call site that forgot
// one could push anything up. The preset is unsigned, so Cloudinary accepts
// whatever arrives and bills it here.
// Honest about the limit of this: it does NOT stop someone who reads the cloud
// name and preset out of this file and posts to Cloudinary directly. Only a
// signed upload (a Cloud Function handing out a short-lived signature) does
// that, and that needs the Blaze plan. This guards our own code paths.
const CLOUDINARY_MAX_BYTES = { image: 5 * 1024 * 1024, video: 100 * 1024 * 1024 };

// ── CLOUDINARY UPLOAD HELPER ──────────────────────────────────────────────
// Returns { promise: Promise<url>, cancel: fn }
// resourceType: 'image' | 'video' | 'auto'
// onProgress: fn(percent 0-100) or null
function uploadToCloudinary(file, resourceType, onProgress) {
  const _kind = resourceType === 'image' ? 'image'
              : resourceType === 'video' ? 'video'
              : ((file && file.type) || '').startsWith('image/') ? 'image' : 'video';
  const _cap  = CLOUDINARY_MAX_BYTES[_kind];
  const _bad  = !file                                              ? 'No file selected'
              : (file.type && !/^(image|video)\//.test(file.type))  ? 'Only image and video files can be uploaded'
              : (file.size > _cap)                                  ? `File too large — maximum ${Math.round(_cap/1024/1024)}MB allowed`
              : '';
  if (_bad) return { promise: Promise.reject(new Error(_bad)), cancel: () => {} };
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
// Missions used to offer a choice: 'open' let whoever accepted send proof
// straight away. Every new mission is now 'creator_picks' — accepting is open to
// all, but the creator selects who may actually submit. 'open' is still read for
// missions posted before this, so nobody mid-mission is locked out.
let currentTakerMode   = 'creator_picks';
let currentExpiryDate  = null;   // Date | null for dare expiry

const CAT_ICONS  = {fitness:'fitness_center',food:'restaurant',adventure:'terrain',comedy:'sentiment_very_satisfied',talent:'mic',socialgood:'eco'};
const CAT_LABELS = {fitness:'Fitness',food:'Food',adventure:'Adventure',comedy:'Comedy',talent:'Talent',socialgood:'Social Good'};
const CAT_COLORS = {fitness:'#FFFFFF',food:'#e53935',adventure:'#43a047',comedy:'#fb8c00',talent:'#8e24aa',socialgood:'#00acc1'};

// Shared maps used by renderHome sections
const CAT_C = {fitness:'#FFFFFF',food:'#e53935',adventure:'#43a047',comedy:'#fb8c00',talent:'#8e24aa',socialgood:'#00acc1'};
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
    { headline: 'Your mission, your rules.',            desc: 'Set the bounty. Watch others try.',    cta: 'Try Misnivo →' },
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
// ════════════════════════════════════════════════════════════════════
//  SPLASH — X-style: black, the logo, nothing else. Shown on every load,
//  including refresh.
//
//  The important part is that it does NOT wait for Firebase auth. Auth can
//  take a second or two to restore a session, and holding the splash for it
//  was most of the wait. Instead, if this browser was signed in last time, the
//  app shell is revealed straight away with skeletons standing in, and the real
//  data drops into it when auth and the listeners land.
// ════════════════════════════════════════════════════════════════════
const _SPLASH_MIN  = 450;    // ms — below this it reads as a flash, not a splash
const _SPLASH_MAX  = 2500;   // ms — never hold the app longer than this
const _AUTH_HINT   = 'mm_was_signed_in';
const _splashStart = Date.now();
let   _splashHidden = false;
let   _shellShown   = false;
let   _bootSkelTO   = null;    // declared with the other boot state: _bootShell()
let   _bootSkelArm  = null;    // the 'is this slow enough to explain?' timer
let   _bootDone     = false;   // set the moment real content is up
const _BOOT_SKEL_AFTER = 700;  // under this, a loader is noise, not information

// The player is called shorts everywhere inside this file — the function, the
// overlay id, the CSS, the Firestore fields. Only the address bar says clips,
// so the translation lives in one place instead of being spread through the
// code. Declared UP HERE, with the boot state, because _bootSkelKind reads
// _DEEP_RE while the page is still booting: a const further down the file is
// hoisted but not yet initialised at that point, and reading it throws.
const _VIEW_SEG = { shorts:'clips' };                   // view type -> URL segment
const _SEG_VIEW = { clips:'shorts', shorts:'shorts' };  // URL segment -> view type
// clips first, shorts still accepted: every /shorts/<id> link ever shared keeps
// working, and lands on exactly the same screen.
const _DEEP_RE    = /^\/(watch|clips|shorts|dare|u)\//;
const _DEEP_RE_ID = /^\/(watch|clips|shorts|dare|u)\/([^/?#]+)/;
                               // runs long before the skeleton module's own lines do

function _splashDone(){
  if (_splashHidden) return;
  const el = document.getElementById('loadScreen'); if (!el) return;
  const wait = Math.max(0, _SPLASH_MIN - (Date.now() - _splashStart));
  setTimeout(() => {
    if (_splashHidden) return;
    _splashHidden = true;
    el.classList.add('gone');                       // fade, don't cut
    setTimeout(() => { el.style.display = 'none'; }, 340);
  }, wait);
}

// Reveal the app frame before auth answers, but only for a browser that was
// signed in last time — otherwise a signed-out visitor would see the app flash
// past on its way to the sign-in screen.
function _bootShell(){
  if (_shellShown) return;
  let wasIn = false;
  try { wasIn = localStorage.getItem(_AUTH_HINT) === '1'; } catch(e){}
  if (!wasIn) return;
  _shellShown = true;
  const app = document.getElementById('appScreen');
  if (app) app.style.display = 'block';
  // Only if the wait is long enough to be worth explaining. This used to paint
  // immediately, so a fast connection still got ~2.8s of skeleton on every open
  // — the loader itself was most of the wait the user saw. Below the threshold
  // the app simply appears, which is what a quick load should look like.
  clearTimeout(_bootSkelArm);
  const kind = _bootSkelKind();
  _bootSkelArm = setTimeout(() => { if (!_bootDone) _bootSkelShow(kind); }, _BOOT_SKEL_AFTER);
  _splashDone();
}
setTimeout(_splashDone, _SPLASH_MAX);               // safety net either way

//  AUTH STATE LISTENER
//  This is the single entry point
// ════════════════════════════
auth.onAuthStateChanged(async (fbUser) => {
  // remembered so the NEXT load can show the app shell without waiting on auth
  try { fbUser ? localStorage.setItem(_AUTH_HINT,'1') : localStorage.removeItem(_AUTH_HINT); } catch(e){}
  if (fbUser) {
    await initUser(fbUser);
    _splashDone();
    // 18+ gate. Guests never reach here — guest mode is a client-side flag with
    // no Firebase user at all — so it only ever asks a signed-in account.
    if (user && user.underageBlocked === true) { _ageGateShow('blocked'); return; }
    if (user && !user.dateOfBirth)             { _ageGateShow('ask');     return; }
    _bootApp();
    _legalOpenIfBooted();                  // arrived on /terms while signed in
  } else {
    _splashDone();
    _ageGateHide();                        // a sign-out from the blocked screen
    _bootSkelHide();                       // signed out — no page is loading
    // Nobody signed in used to mean a sign-up wall before a single mission had
    // been seen. Anyone arriving on a shared link now lands in the app and
    // browses; the account is asked for at the moment it is actually needed,
    // by guestCheck(), which already names the action in the prompt.
    // _wantsAuthScreen is the exception: someone who tapped Sign Up or Log in
    // asked for that screen, and must not be dragged back out of it.
    if (_wantsAuthScreen) {
      document.getElementById('authScreen').style.display = 'flex';
      document.getElementById('appScreen').style.display  = 'none';
    } else if (!isGuestMode) {
      enterGuestMode();
    }
    _legalOpenIfBooted();                  // legal pages are readable without an account
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  PUBLIC / PRIVATE SPLIT
//
//  users/{uid} is world-readable and has to stay that way: public profiles need
//  a name, username, photo and bio, and Firestore has no field-level reads. So
//  anything that is nobody else's business lives in users/{uid}/private/main,
//  which the rules lock to the owner.
//
//  Moved: email, dateOfBirth, ageVerifiedAt, underageBlocked, blockedAt, wallet.
//  Still public: name, username, photoURL, bio, website, socials — and, for now,
//  settings/acceptedDares/pinnedDares/likedProofs, which are next but touch far
//  more code than this change should.
// ══════════════════════════════════════════════════════════════════════════
// What someone accepted, pinned and liked says a great deal about them, and
// users/{uid} is world-readable. These four were left behind when email and
// wallet moved down; they belong here too. _migratePrivate copies each one into
// private/main and deletes the public copy on the owner's next sign-in.
const PRIVATE_FIELDS = ['email','dateOfBirth','ageVerifiedAt','underageBlocked','blockedAt','wallet',
                        'settings','acceptedDares','pinnedDares','likedProofs'];
const _privRef = uid => db.collection('users').doc(uid || user.uid).collection('private').doc('main');

// Existing accounts still carry these at the top level. Copy them down, then
// delete the originals — one write each, and only the owner's own client can do
// it, so it happens the next time each person signs in.
// Legacy scrub. dares and proofs used to store email addresses, and both
// collections are world-readable, so moving email out of the user document
// alone would not have kept the promise. New writes no longer include them;
// this removes the copies already stored, from the only clients allowed to.
let _emailScrubDone = false;
function _scrubLegacyEmails(){
  if (_emailScrubDone || !user) return;
  _emailScrubDone = true;
  const del = firebase.firestore.FieldValue.delete();
  (dares||[]).forEach(d => {
    if (d.creatorUid === user.uid && d.creatorEmail !== undefined)
      db.collection('dares').doc(d.id).update({ creatorEmail: del }).catch(()=>{});
  });
  ['takerId','posterId'].forEach(field => {
    db.collection('proofs').where(field,'==',user.uid).get().then(s => {
      s.docs.forEach(doc => {
        const v = doc.data(), upd = {};
        if (v.takerEmail  !== undefined) upd.takerEmail  = del;
        if (v.posterEmail !== undefined) upd.posterEmail = del;
        if (Object.keys(upd).length) doc.ref.update(upd).catch(()=>{});
      });
    }).catch(()=>{});
  });
}

async function _migratePrivate(uid, pub){
  const move = {};
  PRIVATE_FIELDS.forEach(k => { if (pub && pub[k] !== undefined) move[k] = pub[k]; });
  if (!Object.keys(move).length) return null;
  try {
    await _privRef(uid).set(move, { merge:true });          // private copy first
    const strip = {};
    Object.keys(move).forEach(k => { strip[k] = firebase.firestore.FieldValue.delete(); });
    await db.collection('users').doc(uid).update(strip);    // then drop the public copy
    return move;
  } catch(e){ console.error('private migration failed:', e); return move; }
}

// ══════════════════════════════════════════════════════════════════════════
//  DATE / TIME PICKER
//
//  The browser's own calendar is a blue-and-grey box that belongs to the OS,
//  not to this app — on a black UI it reads as something that fell in from
//  somewhere else. This is a scrolling wheel in the app's own colours.
//
//  The machine value still lives on the input, in the exact format the rest of
//  the code already reads (YYYY-MM-DD, or YYYY-MM-DDTHH:MM), so nothing
//  downstream changes. The box itself shows a readable label instead.
// ══════════════════════════════════════════════════════════════════════════
const _DT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let _dtTarget = null, _dtMode = 'date', _dtOnPick = null;

const _dtPad = n => String(n).padStart(2,'0');
const _dtDaysIn = (y,m) => new Date(y, m+1, 0).getDate();

// "2026-08-15T14:30" / "2026-08-15" -> readable. Empty stays empty.
function _dtLabel(val, mode){
  if (!val) return '';
  const [d,t] = String(val).split('T');
  const [y,m,dd] = d.split('-').map(Number);
  if (!y || !m || !dd) return val;
  const base = dd + ' ' + _DT_MONTHS[m-1] + ' ' + y;
  if (mode !== 'datetime' || !t) return base;
  const [hh,mi] = t.split(':').map(Number);
  const ap = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return base + ', ' + h12 + ':' + _dtPad(mi) + ' ' + ap;
}

// Keep the machine value on the element (dataset) and show the label in the box.
function _dtSet(input, val){
  input.dataset.value = val || '';
  input.value = _dtLabel(val, input.dataset.dtMode || 'date');
}
// What every reader should call — the machine value, whatever the box shows.
function _dtValue(id){
  const el = document.getElementById(id);
  return el ? (el.dataset.value || '') : '';
}

function _dtColumn(key, items, selected){
  return '<div class="dtp-col" data-key="' + key + '">'
    + '<div class="dtp-pad"></div>'
    + items.map(it => '<div class="dtp-item' + (it.past ? ' past' : '') + '" data-v="' + it.v + '"'
        + (it.past ? ' data-past="1"' : '')
        + (it.v === selected ? ' data-sel="1"' : '') + '>' + escHtml(it.t) + '</div>').join('')
    + '<div class="dtp-pad"></div></div>';
}

// An expiry or a publish time in the past is not a choice anyone means to make,
// and the browser's own picker never allowed it. The floor cascades: only once
// the year and month match the floor's does the day matter, and so on down to
// the minute — otherwise every December would grey out its early days.
function _dtFloor(){ return _dtState.min instanceof Date && !isNaN(_dtState.min) ? _dtState.min : null; }
function _dtIsPast(key, v){
  const f = _dtFloor(); if (!f) return false;
  const s = _dtState;
  if (key === 'y') return v < f.getFullYear();
  if (key === 'm') return s.y === f.getFullYear() && v < f.getMonth();
  if (key === 'd') return s.y === f.getFullYear() && s.m === f.getMonth() && v < f.getDate();
  if (_dtMode !== 'datetime') return false;
  const sameDay = s.y === f.getFullYear() && s.m === f.getMonth() && s.d === f.getDate();
  if (key === 'h') return sameDay && v < f.getHours();
  if (key === 'i') return sameDay && s.h === f.getHours() && v < f.getMinutes();
  return false;
}
// Nudge the whole state up to the floor — used when a scroll lands somewhere
// that is only illegal because of what another column just became.
function _dtLift(){
  const f = _dtFloor(); if (!f) return false;
  const s = _dtState;
  const cur = new Date(s.y, s.m, s.d, _dtMode === 'datetime' ? s.h : 0, _dtMode === 'datetime' ? s.i : 0);
  const flr = _dtMode === 'datetime'
    ? new Date(f.getFullYear(), f.getMonth(), f.getDate(), f.getHours(), f.getMinutes())
    : new Date(f.getFullYear(), f.getMonth(), f.getDate());
  if (cur >= flr) return false;
  s.y = flr.getFullYear(); s.m = flr.getMonth(); s.d = flr.getDate();
  if (_dtMode === 'datetime'){ s.h = flr.getHours(); s.i = Math.ceil(flr.getMinutes() / 5) * 5 % 60; }
  return true;
}

function _dtBuild(){
  const st = _dtState;
  const yrs = [];
  for (let y = st.minYear; y <= st.maxYear; y++) yrs.push({ v:y, t:String(y) });
  const days = [];
  for (let d = 1; d <= _dtDaysIn(st.y, st.m); d++) days.push({ v:d, t:String(d) });
  const mons = _DT_MONTHS.map((t,i) => ({ v:i, t }));

  days.forEach(x => x.past = _dtIsPast('d', x.v));
  mons.forEach(x => x.past = _dtIsPast('m', x.v));
  yrs .forEach(x => x.past = _dtIsPast('y', x.v));
  let html = _dtColumn('d', days, st.d) + _dtColumn('m', mons, st.m) + _dtColumn('y', yrs, st.y);
  if (_dtMode === 'datetime'){
    const hrs = [], mins = [];
    for (let h = 0; h < 24; h++) hrs.push({ v:h, t:_dtPad(h), past:_dtIsPast('h', h) });
    for (let i = 0; i < 60; i += 5) mins.push({ v:i, t:_dtPad(i), past:_dtIsPast('i', i) });
    html += '<div class="dtp-sep">:</div>' + _dtColumn('h', hrs, st.h) + _dtColumn('i', mins, st.i);
  }
  document.getElementById('dtpCols').innerHTML = html;
  requestAnimationFrame(() => {
    document.querySelectorAll('#dtpCols .dtp-col').forEach(col => {
      const sel = col.querySelector('[data-sel="1"]') || col.querySelector('.dtp-item');
      if (sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.offsetHeight / 2;
      col.addEventListener('scroll', () => _dtOnScroll(col), { passive:true });
    });
    _dtMark();
  });
}

let _dtState = { y:2026, m:0, d:1, h:12, i:0, minYear:2020, maxYear:2030 };
let _dtScrollTO = null;

// Whichever item is nearest the middle band is the value.
function _dtCentred(col){
  const mid = col.scrollTop + col.clientHeight / 2;
  let best = null, bestD = Infinity;
  col.querySelectorAll('.dtp-item').forEach(it => {
    const c = it.offsetTop + it.offsetHeight / 2;
    const d = Math.abs(c - mid);
    if (d < bestD) { bestD = d; best = it; }
  });
  return best;
}
function _dtMark(){
  document.querySelectorAll('#dtpCols .dtp-col').forEach(col => {
    const c = _dtCentred(col);
    col.querySelectorAll('.dtp-item').forEach(it => it.classList.toggle('on', it === c));
  });
}
// Re-mark which rows are in the past without touching innerHTML, so the columns
// keep their scroll positions and nothing flashes.
function _dtRepaintPast(){
  if (!_dtFloor()) return;
  document.querySelectorAll('#dtpCols .dtp-col').forEach(col => {
    const key = col.dataset.key;
    col.querySelectorAll('.dtp-item').forEach(it => {
      const past = _dtIsPast(key, Number(it.dataset.v));
      it.classList.toggle('past', past);
      if (past) it.dataset.past = '1'; else delete it.dataset.past;
    });
  });
}

function _dtOnScroll(col){
  _dtMark();
  clearTimeout(_dtScrollTO);
  _dtScrollTO = setTimeout(() => {
    const c = _dtCentred(col); if (!c) return;
    const key = col.dataset.key, v = Number(c.dataset.v);
    _dtState[key] = v;
    // A shorter month can strand the day (31 Jan -> Feb). Rebuild the day column.
    let rebuild = false;
    if (key === 'm' || key === 'y'){
      const max = _dtDaysIn(_dtState.y, _dtState.m);
      if (_dtState.d > max){ _dtState.d = max; rebuild = true; }
    }
    // Landing in the past — either directly, or because changing the month
    // dragged an otherwise-fine day below the floor. Snap up to the floor.
    if (_dtLift()) rebuild = true;
    // Which rows count as past shifts with every column, but repainting that is
    // a class change, not a reason to rewrite all five columns — doing the full
    // rebuild here reset every scroll position and read as a blink on each nudge.
    if (rebuild) _dtBuild(); else _dtRepaintPast();
  }, 90);
}

function openDatePicker(inputId, mode, opts){
  const input = document.getElementById(inputId); if (!input) return;
  _dtTarget = inputId;
  _dtMode = mode || input.dataset.dtMode || 'date';
  const o = opts || {};
  const now = new Date();
  const cur = input.dataset.value ? new Date(input.dataset.value.replace(' ', 'T')) : null;
  const base = (cur && !isNaN(cur)) ? cur : (o.defaultDate || now);
  _dtState = {
    y: base.getFullYear(), m: base.getMonth(), d: base.getDate(),
    h: base.getHours(), i: Math.round(base.getMinutes() / 5) * 5 % 60,
    minYear: o.minYear != null ? o.minYear : now.getFullYear() - 100,
    maxYear: o.maxYear != null ? o.maxYear : now.getFullYear() + 5,
    min: o.minDate || null            // nothing before this is selectable
  };
  // Opening on a stale value (an expiry saved days ago, or simply "now" a while
  // after the form was opened) must not present a time that has already gone.
  _dtLift();
  if (_dtState.y < _dtState.minYear) _dtState.y = _dtState.minYear;
  if (_dtState.y > _dtState.maxYear) _dtState.y = _dtState.maxYear;
  document.getElementById('dtpTitle').textContent = o.title || (_dtMode === 'datetime' ? 'Pick a date and time' : 'Pick a date');
  document.getElementById('dtpSheet').classList.toggle('dtp-has-time', _dtMode === 'datetime');
  _dtBuild();
  const ov = document.getElementById('dtPicker');
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
}

function closeDatePicker(){
  const ov = document.getElementById('dtPicker');
  ov.classList.remove('open');
  setTimeout(() => { ov.style.display = 'none'; }, 200);
  _dtTarget = null;
}

function _dtConfirm(){
  const input = document.getElementById(_dtTarget); if (!input) return closeDatePicker();
  const s = _dtState;
  let val = s.y + '-' + _dtPad(s.m + 1) + '-' + _dtPad(s.d);
  if (_dtMode === 'datetime') val += 'T' + _dtPad(s.h) + ':' + _dtPad(s.i);
  input.dataset.dtMode = _dtMode;
  _dtSet(input, val);
  input.dispatchEvent(new Event('change', { bubbles:true }));
  const cb = _dtOnPick; _dtOnPick = null;
  closeDatePicker();
  if (cb) cb(val);
}

function _dtClear(){
  const input = document.getElementById(_dtTarget);
  if (input) { _dtSet(input, ''); input.dispatchEvent(new Event('change', { bubbles:true })); }
  closeDatePicker();
}

// ══════════════════════════════════════════════════════════════════════════
//  FEEDBACK
//
//  The whole point of Phase 2 is hearing what breaks from the people it breaks
//  for. So this records WHERE they were and what they were using, not just the
//  message — "the button does nothing" is unactionable without them.
//
//  Write-only from the client and admin-read: nobody browses other people's
//  complaints.
// ══════════════════════════════════════════════════════════════════════════
function openFeedback(){
  if (typeof guestCheck === 'function' && guestCheck('feedback')) return;
  const t = document.getElementById('fbText'); if (t) t.value = '';
  const e = document.getElementById('fbErr');  if (e) e.textContent = '';
  const b = document.getElementById('fbSend'); if (b){ b.disabled = false; b.textContent = 'Send'; }
  const ov = document.getElementById('feedbackOverlay');
  ov.style.zIndex = '2147483450';
  ov.style.display = 'flex'; ov.classList.add('open');
}
function closeFeedback(){
  const ov = document.getElementById('feedbackOverlay');
  ov.style.display = 'none'; ov.classList.remove('open');
}
async function sendFeedback(){
  const t = document.getElementById('fbText');
  const e = document.getElementById('fbErr');
  const b = document.getElementById('fbSend');
  const msg = (t.value || '').trim();
  if (msg.length < 5){ e.textContent = 'Please tell us a little more.'; return; }
  if (msg.length > 2000){ e.textContent = 'That is too long — 2000 characters max.'; return; }
  e.textContent = ''; b.disabled = true; b.textContent = 'Sending...';
  try {
    await db.collection('feedback').add({
      userId:    user ? user.uid : null,
      message:   msg,
      // where they were when it went wrong — the part that makes this useful
      page:      (typeof _curPage !== 'undefined' ? _curPage : '') + ' ' + location.pathname,
      userAgent: navigator.userAgent || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeFeedback();
    showToast('Thank you — we read every one of these');
  } catch(err){
    b.disabled = false; b.textContent = 'Send';
    e.textContent = 'Could not send that — please check your connection.';
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  ADMIN PANEL  (/admin)
//
//  Access is a CUSTOM CLAIM on the auth token, never a field in a document —
//  a document field can be written by whoever owns the document, a claim can
//  only be set with the Admin SDK. The same isAdmin() guards the rules, so the
//  panel and the database agree on who is an admin.
//
//  Everything an admin does is written to admin_actions before the effect
//  lands. That log is append-only even for the admin: without it there is no
//  way to answer "who banned this person and why" six months later, and no way
//  to undo a mistake you cannot see.
// ══════════════════════════════════════════════════════════════════════════
let _isAdmin = false;          // resolved from the token at sign-in
let _adminTabName = 'stats';
let _adminUserCache = [];

async function _resolveAdmin(){
  _isAdmin = false;
  try {
    if (!auth.currentUser) return false;
    const t = await auth.currentUser.getIdTokenResult();
    _isAdmin = t.claims && t.claims.admin === true;
  } catch(e){}
  return _isAdmin;
}

// Append-only record of every admin action. Written BEFORE the action, so a
// failure halfway still leaves evidence that it was attempted.
async function _adminLog(action, target, detail){
  try {
    await db.collection('admin_actions').add({
      action, target: target || null, detail: detail || '',
      adminUid: user ? user.uid : null,
      adminEmail: user ? (user.email || '') : '',
      at: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch(e){ console.error('admin log failed:', e); throw e; }
}

function openAdmin(_fromUrl){
  if (!_isAdmin){ if (typeof goPage==='function') goPage('home'); return; }
  document.getElementById('adminPanel').style.display = 'block';
  document.body.classList.add('admin-open');
  if (!_fromUrl){ try { history.pushState({ _admin:1 }, '', '/admin'); } catch(e){} }
  _adminTab(_adminTabName);
}
function closeAdmin(_fromPop){
  const el = document.getElementById('adminPanel'); if (!el) return;
  el.style.display = 'none';
  document.body.classList.remove('admin-open');
  if (!_fromPop){ try { history.back(); } catch(e){} }
}
function _adminOpen(){ return document.getElementById('adminPanel')
  && document.getElementById('adminPanel').style.display === 'block'; }

function _adminTab(name){
  _adminTabName = name;
  document.querySelectorAll('.adm-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));
  const body = document.getElementById('adminBody');
  body.innerHTML = '<div class="adm-load">Loading…</div>';
  ({ stats:_adminStats, reports:_adminReports, review:_adminReview,
     users:_adminUsers, feedback:_adminFeedback }[name] || _adminStats)();
}

const _admFmt = ts => { try { return ts && ts.toDate ? ts.toDate().toLocaleString() : '—'; } catch(e){ return '—'; } };
const _admAge = ts => {
  try { const t = ts && ts.toDate ? ts.toDate().getTime() : 0;
        if (!t) return { h:0, txt:'unknown' };
        const h = Math.floor((Date.now()-t)/3600000);
        return { h, txt: h < 24 ? h+'h old' : Math.floor(h/24)+'d old' };
  } catch(e){ return { h:0, txt:'unknown' }; }
};

// Count with a ceiling on it.
// Firestore's count() aggregation would be the right tool — one read per 1000
// documents and exact at any size — but it is NOT in the compat SDK this app
// loads. Checked in a real browser on the live site: on 9.22.2 `Query.count`
// is undefined, so an aggregation call is a TypeError, not a slow path.
// Counting therefore still means reading documents, and the fix is to stop it
// running away: at most `cap` are read, and the answer comes back as "1000+"
// once it reaches that ceiling rather than pretending to be exact.
// Honest about what this is not: it does not give a true total past the cap.
// It replaces code that had NO ceiling at all — one visit to the admin panel
// downloaded every user, mission and proof in the database into the browser.
// An exact count at scale needs a newer Firebase SDK or a server keeping
// running totals, and both of those are the owner's call, not this function's.
// Returns a number, a "<cap>+" string, or null if the read failed.
async function _countUpTo(q, cap){
  const c = cap || 1000;
  try { const s = await q.limit(c + 1).get(); return s.size > c ? (c + '+') : s.size; }
  catch(e){ return null; }
}

// ── 1. STATS ──────────────────────────────────────────────────────────────
// Every number here is now capped. The old version pulled EVERY user, mission,
// proof, block and report into this tab just to read .size off each snapshot —
// fine at fifty documents, a dead tab and a billing spike at fifty thousand.
// Past a thousand a number reads "1000+", which is the honest answer this SDK
// can give; see _countUpTo for why an exact one is not available.
// A number shows "—" if its read failed (no permission) — one missing number
// no longer takes the whole panel down with it.
async function _adminStats(){
  const body = document.getElementById('adminBody');
  try {
    const day = new Date(); day.setHours(0,0,0,0);
    const [u, d, p, sb, mr, newU, newD, openSnap] = await Promise.all([
      _countUpTo(db.collection('users'), 1000),
      _countUpTo(db.collection('dares'), 1000),
      _countUpTo(db.collection('proofs'), 1000),
      _countUpTo(db.collection('safety_blocks'), 1000),
      _countUpTo(db.collection('manual_review'), 1000),
      _countUpTo(db.collection('users').where('createdAt','>=',day), 1000),
      _countUpTo(db.collection('dares').where('createdAt','>=',day), 1000),
      // Pending reports are the one thing still read as documents: "past 24h"
      // needs each report's own age, and asking Firestore for status + age in
      // one query would need a composite index. Capped at 300 — if that many
      // are ever open at once, the exact number is not the problem.
      db.collection('reports').where('status','==','pending').limit(300).get().catch(() => null)
    ]);
    const open    = openSnap ? openSnap.size : null;
    const overdue = openSnap ? openSnap.docs.filter(x => _admAge(x.data().createdAt).h > 24).length : null;
    const n = v => (v === null || v === undefined) ? '—' : v;
    const card = (v,l,warn) => `<div class="adm-stat${warn?' warn':''}"><div class="adm-stat-v">${n(v)}</div><div class="adm-stat-l">${escHtml(l)}</div></div>`;
    body.innerHTML =
      `<div class="adm-stats">
        ${card(u,'Users')}${card(d,'Missions')}${card(p,'Proofs')}
        ${card(newU,'New users today')}
        ${card(newD,'New missions today')}
        ${card(sb,'Missions blocked by the filter')}
        ${card(mr,'Waiting on manual review', (mr||0)>0)}
        ${card(open,'Open reports', (open||0)>0)}
        ${card(overdue,'Reports past 24h', (overdue||0)>0)}
      </div>
      <p class="adm-note">The Contact page promises a reply within 24 hours and a
      resolution within 15 days. "Reports past 24h" is that promise, counted.</p>`;
  } catch(e){ body.innerHTML = `<div class="adm-err">Could not load stats: ${escHtml(e.message)}</div>`; }
}

// ── 2. REPORTS ────────────────────────────────────────────────────────────
async function _adminReports(){
  const body = document.getElementById('adminBody');
  try {
    const snap = await db.collection('reports').orderBy('createdAt','desc').limit(100).get();
    const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const open = rows.filter(r => (r.status||'pending') === 'pending');
    if (!rows.length){ body.innerHTML = '<div class="adm-empty">No reports.</div>'; return; }
    body.innerHTML = `<div class="adm-sub">${open.length} open of ${rows.length}</div>` +
      rows.map(r => {
        const age = _admAge(r.createdAt);
        const done = (r.status||'pending') !== 'pending';
        return `<div class="adm-row${done?' done':''}">
          <div class="adm-row-top">
            <span class="adm-pill">${escHtml(r.targetType||'?')}</span>
            <span class="adm-pill ${age.h>24&&!done?'late':''}">${escHtml(age.txt)}</span>
            ${done?`<span class="adm-pill ok">${escHtml(r.status)}</span>`:''}
          </div>
          <div class="adm-row-title">${escHtml(r.reportType||'')} — ${escHtml(r.targetName||r.targetId||'')}</div>
          <div class="adm-row-sub">${escHtml(r.reason||'')}</div>
          <div class="adm-row-meta">by ${escHtml(r.reporterUid||'?').slice(0,10)} · ${_admFmt(r.createdAt)}</div>
          ${done?'':`<div class="adm-acts">
            <button onclick="_adminViewTarget('${r.targetType}','${r.targetId}')">View</button>
            <button class="danger" onclick="_adminRemoveTarget('${r.id}','${r.targetType}','${r.targetId}')">Remove content</button>
            <button onclick="_adminCloseReport('${r.id}','dismissed')">Ignore</button>
          </div>`}
        </div>`;
      }).join('');
  } catch(e){ body.innerHTML = `<div class="adm-err">Could not load reports: ${escHtml(e.message)}</div>`; }
}

function _adminViewTarget(type, id){
  closeAdmin();
  setTimeout(() => {
    try {
      if (type === 'dare')  openDareDetail(id);
      else if (type === 'proof' || type === 'video') openVideoDetail(id);
      else showToast('Nothing to open for this report type');
    } catch(e){ showToast('Could not open it — it may already be gone'); }
  }, 260);
}

async function _adminRemoveTarget(reportId, type, targetId){
  if (!confirm('Remove this content? This cannot be undone.')) return;
  try {
    await _adminLog('remove_content', targetId, type + ' via report ' + reportId);
    const col = type === 'dare' ? 'dares' : type === 'comment' ? 'comments' : 'proofs';
    await db.collection(col).doc(targetId).delete();
    await db.collection('reports').doc(reportId).update({ status:'resolved' });
    showToast('Content removed');
    _adminTab('reports');
  } catch(e){ showToast('Failed: ' + e.message); }
}

async function _adminCloseReport(id, status){
  try {
    await _adminLog('close_report', id, status);
    await db.collection('reports').doc(id).update({ status });
    _adminTab('reports');
  } catch(e){ showToast('Failed: ' + e.message); }
}

// ── 3. MANUAL REVIEW ──────────────────────────────────────────────────────
async function _adminReview(){
  const body = document.getElementById('adminBody');
  try {
    const snap = await db.collection('manual_review').orderBy('createdAt','desc').limit(100).get();
    const rows = snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(r => !r.decided);
    if (!rows.length){ body.innerHTML = '<div class="adm-empty">Nothing waiting. The two reviewers agreed on everything.</div>'; return; }
    body.innerHTML = rows.map(r => `
      <div class="adm-row">
        <div class="adm-row-title">${escHtml(r.title||'(no title)')}</div>
        <div class="adm-row-sub">${escHtml(r.description||'')}</div>
        ${(r.rules&&r.rules.length)?`<div class="adm-row-sub">Rules: ${escHtml(r.rules.join(' · '))}</div>`:''}
        <div class="adm-verdicts">
          <div><b>Reviewer 1</b><br>${escHtml(r.check1? (r.check1.safe?'safe':'unsafe') + ' — ' + (r.check1.reason||'') : '—')}</div>
          <div><b>Reviewer 2</b><br>${escHtml(r.check2? (r.check2.finalSafe?'safe':'unsafe') + ' — ' + (r.check2.reason||'') : '—')}</div>
        </div>
        <div class="adm-row-meta">by ${escHtml(r.userEmail||r.userId||'?')} · ${_admFmt(r.createdAt)}</div>
        <div class="adm-acts">
          <button onclick="_adminReviewDecide('${r.id}','allowed')">Allow</button>
          <button class="danger" onclick="_adminReviewDecide('${r.id}','blocked')">Keep blocked</button>
        </div>
      </div>`).join('');
  } catch(e){ body.innerHTML = `<div class="adm-err">Could not load the queue: ${escHtml(e.message)}</div>`; }
}

async function _adminReviewDecide(id, decision){
  try {
    await _adminLog('review_decision', id, decision);
    await db.collection('manual_review').doc(id).update({
      decided: decision, decidedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast('Marked ' + decision);
    _adminTab('review');
  } catch(e){ showToast('Failed: ' + e.message); }
}

// ── 5. FEEDBACK ───────────────────────────────────────────────────────────
async function _adminFeedback(){
  const body = document.getElementById('adminBody');
  try {
    const snap = await db.collection('feedback').orderBy('createdAt','desc').limit(100).get();
    if (snap.empty){ body.innerHTML = '<div class="adm-empty">No feedback yet.</div>'; return; }
    body.innerHTML = snap.docs.map(d => {
      const f = d.data();
      return `<div class="adm-row">
        <div class="adm-row-sub" style="margin-top:0;">${escHtml(f.message||'')}</div>
        <div class="adm-row-meta">${escHtml(f.page||'')} · ${_admFmt(f.createdAt)}</div>
        <div class="adm-row-meta">${escHtml(f.userId||'signed out')}</div>
        <div class="adm-row-meta">${escHtml((f.userAgent||'').slice(0,110))}</div>
      </div>`;
    }).join('');
  } catch(e){ body.innerHTML = `<div class="adm-err">Could not load feedback: ${escHtml(e.message)}</div>`; }
}

// ── 4. USERS ──────────────────────────────────────────────────────────────
async function _adminUsers(){
  const body = document.getElementById('adminBody');
  body.innerHTML = `
    <div class="adm-search">
      <input id="admUserQ" placeholder="Search username, name or uid" oninput="_adminUserFilter(this.value)"/>
    </div>
    <div id="admUserList"><div class="adm-load">Loading…</div></div>`;
  try {
    // Only the users are listed. This used to also download EVERY mission and
    // EVERY proof, purely to put a "3 missions · 1 proof" line under each row —
    // two whole collections for a caption. Those two numbers are now counted
    // per user, on demand, inside the Details panel.
    const us = await db.collection('users').limit(500).get();
    _adminUserCache = us.docs.map(d => ({ uid:d.id, ...d.data() }));
    _adminUserFilter('');
  } catch(e){ document.getElementById('admUserList').innerHTML =
    `<div class="adm-err">Could not load users: ${escHtml(e.message)}</div>`; }
}

function _adminUserFilter(q){
  const el = document.getElementById('admUserList'); if (!el) return;
  const s = (q||'').trim().toLowerCase();
  const rows = _adminUserCache.filter(u => !s
    || (u.username||'').toLowerCase().includes(s)
    || (u.name||'').toLowerCase().includes(s)
    || u.uid.toLowerCase().includes(s)).slice(0, 60);
  if (!rows.length){ el.innerHTML = '<div class="adm-empty">No match.</div>'; return; }
  el.innerHTML = rows.map(u => `
    <div class="adm-row" id="admu-${u.uid}">
      <div class="adm-row-title">${escHtml(u.name||'—')} <span class="adm-dim">@${escHtml(u.username||'')}</span></div>
      <div class="adm-row-meta">${u.uid}</div>
      <div class="adm-row-sub">joined ${_admFmt(u.createdAt)}</div>
      <div class="adm-acts">
        <button onclick="_adminUserDetail('${u.uid}')">Details</button>
      </div>
      <div class="adm-detail" id="admd-${u.uid}"></div>
    </div>`).join('');
}

// The private drawer is where email, the age check and the ban live. Only an
// admin (or the person themselves) can read it, which is the whole point.
async function _adminUserDetail(uid){
  const el = document.getElementById('admd-'+uid); if (!el) return;
  if (el.dataset.open === '1'){ el.innerHTML=''; el.dataset.open='0'; return; }
  el.dataset.open='1';
  el.innerHTML = '<div class="adm-load">Loading…</div>';
  try {
    // Counted here, for ONE person, instead of downloading two whole
    // collections to caption every row of the list.
    const [ps, ags, nDares, nProofs] = await Promise.all([
      db.collection('users').doc(uid).collection('private').doc('main').get(),
      db.collection('agreements').where('userId','==',uid).limit(20).get(),
      _countUpTo(db.collection('dares').where('creatorUid','==',uid), 500),
      _countUpTo(db.collection('proofs').where('takerId','==',uid), 500)
    ]);
    const p = ps.exists ? ps.data() : {};
    const ag = ags.docs.map(d=>d.data())
      .sort((a,b)=>((b.acceptedAt&&b.acceptedAt.seconds)||0)-((a.acceptedAt&&a.acceptedAt.seconds)||0));
    const _n = v => (v === null || v === undefined) ? '—' : v;
    el.innerHTML = `
      <div class="adm-kv"><span>Missions posted</span><b>${_n(nDares)}</b></div>
      <div class="adm-kv"><span>Proofs submitted</span><b>${_n(nProofs)}</b></div>
      <div class="adm-kv"><span>Email</span><b>${escHtml(p.email||'—')}</b></div>
      <div class="adm-kv"><span>Date of birth</span><b>${escHtml(p.dateOfBirth||'—')}</b></div>
      <div class="adm-kv"><span>Under-18 block</span><b>${p.underageBlocked?'YES':'no'}</b></div>
      <div class="adm-kv"><span>Banned</span><b>${p.banned?'YES — '+escHtml(p.bannedReason||''):'no'}</b></div>
      <div class="adm-acts">
        ${p.banned
          ? `<button onclick="_adminUnban('${uid}')">Unban</button>`
          : `<button class="danger" onclick="_adminBan('${uid}')">Ban</button>`}
        ${p.underageBlocked ? `<button onclick="_adminLiftAgeBlock('${uid}')">Lift age block</button>` : ''}
      </div>
      <div class="adm-sub" style="margin-top:14px;">Agreements accepted (${ag.length})</div>
      ${ag.length ? ag.map(a=>`<div class="adm-row-meta">${escHtml(a.type||'')} v${escHtml(a.agreementVersion||'')} · ${_admFmt(a.acceptedAt)}</div>`).join('')
                  : '<div class="adm-row-meta">none recorded</div>'}`;
  } catch(e){ el.innerHTML = `<div class="adm-err">${escHtml(e.message)}</div>`; }
}

async function _adminBan(uid){
  const reason = prompt('Why is this account being banned? (recorded in the log)');
  if (reason === null) return;
  if (!reason.trim()){ showToast('A reason is required'); return; }
  try {
    await _adminLog('ban', uid, reason.trim());
    await db.collection('users').doc(uid).collection('private').doc('main').set({
      banned: true, bannedReason: reason.trim(),
      bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
      bannedBy: user.uid }, { merge:true });
    showToast('Account banned');
    const el=document.getElementById('admd-'+uid); if(el) el.dataset.open='0';
    _adminUserDetail(uid);
  } catch(e){ showToast('Failed: ' + e.message); }
}

async function _adminUnban(uid){
  if (!confirm('Unban this account?')) return;
  try {
    await _adminLog('unban', uid, '');
    await db.collection('users').doc(uid).collection('private').doc('main')
      .set({ banned:false, bannedReason:'' }, { merge:true });
    showToast('Account unbanned');
    const el=document.getElementById('admd-'+uid); if(el) el.dataset.open='0';
    _adminUserDetail(uid);
  } catch(e){ showToast('Failed: ' + e.message); }
}

// The age gate is one-way for the account holder on purpose, so a wrong date of
// birth can only be undone here. Without this the block is permanent and there
// is no support path at all.
async function _adminLiftAgeBlock(uid){
  if (!confirm('Lift the under-18 block? Only do this if you have checked their age.')) return;
  try {
    await _adminLog('lift_age_block', uid, '');
    await db.collection('users').doc(uid).collection('private').doc('main')
      .set({ underageBlocked:false }, { merge:true });
    showToast('Age block lifted — they must re-enter their date of birth');
    const el=document.getElementById('admd-'+uid); if(el) el.dataset.open='0';
    _adminUserDetail(uid);
  } catch(e){ showToast('Failed: ' + e.message); }
}

// Everything that turns a signed-in account into a running app. Split out so
// the age gate can hold it back and then run it once the date of birth checks
// out — the gate is not skippable, so nothing below may start before it.
function _bootApp(){
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display  = 'block';
  isGuestMode = false; _clearGuestSession(); _setTopbarMode('user');
  if (typeof startNotificationsListener === 'function') startNotificationsListener();
  startDaresListener();
  startMyProofsListener();     // keeps my own proof statuses in step
  // Admin is a token claim, so it has to be read from the token, not guessed
  // from a uid. The sidebar entry stays hidden for everyone else.
  _resolveAdmin().then(ok => {
    const b = document.getElementById('sbAdmin');
    if (b) b.classList.toggle('nav-hidden', !ok);
  });
  AdManager.initScrollAds();   // start scroll ad tracker
  _bootRoute();                // open the page/modal the URL points to (deep-link / refresh)
}

// ══════════════════════════════════════════════════════════════════════════
//  18+ AGE GATE
//
//  Asked once, on the first sign-in where the account has no date of birth —
//  so existing accounts get it the next time they open the app, and nobody is
//  ever asked twice. Not dismissible: no close button, no backdrop click, and
//  the app itself does not start until it is answered.
// ══════════════════════════════════════════════════════════════════════════
function _ageFromDob(dobStr){
  const d = new Date(dobStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;   // birthday not reached this year
  return age;
}

function _ageGateShow(mode){
  _bootSkelHide();
  const app = document.getElementById('appScreen'); if (app) app.style.display = 'none';
  const auth_ = document.getElementById('authScreen'); if (auth_) auth_.style.display = 'none';

  const blocked = (mode === 'blocked');
  document.getElementById('ageTitle').textContent = blocked
    ? 'Thanks for stopping by' : 'One quick thing';
  document.getElementById('ageText').textContent = blocked
    ? 'Misnivo is only available to people 18 and older. Thank you for your interest.'
    : 'Misnivo is only for people 18 and older. Please enter your date of birth.';
  document.getElementById('ageForm').style.display    = blocked ? 'none' : 'block';
  document.getElementById('ageSignOut').style.display = blocked ? 'flex' : 'none';
  document.getElementById('ageErr').textContent = '';

  const inp = document.getElementById('ageDob');
  if (inp && !blocked) _dtSet(inp, '');               // the wheel cannot offer a future year
  document.getElementById('ageGate').style.display = 'flex';
  document.body.classList.add('age-gated');
}

function _ageGateHide(){
  const g = document.getElementById('ageGate');
  if (g) g.style.display = 'none';
  document.body.classList.remove('age-gated');
}

async function _ageSubmit(){
  const inp = document.getElementById('ageDob');
  const err = document.getElementById('ageErr');
  const btn = document.getElementById('ageBtn');
  const dob = (_dtValue('ageDob') || '').trim();
  const say = m => { err.textContent = m; };

  if (!dob) return say('Please enter your date of birth.');
  const age = _ageFromDob(dob);
  if (age === null)        return say('That date does not look right.');
  if (age < 0)             return say('That date is in the future.');
  if (age > 120)           return say('Please check the year.');

  say('');
  btn.disabled = true; btn.textContent = 'Saving...';
  const stamp = firebase.firestore.FieldValue.serverTimestamp();

  try {
    if (age >= 18){
      await _privRef().set({ dateOfBirth: dob, ageVerifiedAt: stamp }, { merge:true });
      user.dateOfBirth = dob;
      _ageGateHide();
      _bootApp();
      return;
    }
    // Under 18. Save the block first — if this write fails the account is still
    // kept out of the app for this session, it just is not remembered yet.
    await _privRef().set({ dateOfBirth: dob, underageBlocked: true, blockedAt: stamp }, { merge:true });
    user.dateOfBirth = dob; user.underageBlocked = true;
    _ageGateShow('blocked');
  } catch(e){
    console.error('age gate save failed:', e);
    if (age < 18){ user.underageBlocked = true; _ageGateShow('blocked'); return; }
    btn.disabled = false; btn.textContent = 'Continue';
    say('Could not save that — please check your connection and try again.');
  }
}

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
    // The ENTIRE boot waits on this one read — _bootRoute, and therefore the
    // first page, sits behind it — so a slow server held the boot skeleton for
    // as long as the server took. Fall back to the cached copy once the wait is
    // long enough to notice.
    let snap = await Promise.race([ ref.get(), new Promise(r => setTimeout(() => r(null), 2500)) ]);
    if (!snap) {
      // A cache MISS must never look like a first login: that branch CREATES the
      // user document and would reset a real account's wallet. Only a cached HIT
      // is allowed to short-circuit; anything else waits for the server.
      try { const c = await ref.get({ source:'cache' }); if (c.exists) snap = c; } catch(_) {}
    }
    if (!snap) snap = await ref.get();

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
      // public half — no email, no wallet
      batch.set(db.collection('users').doc(user.uid), {
        name: user.name,
        photoURL: user.picture || '',
        username: handle, bio: '', website: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // private half — owner only
      batch.set(_privRef(user.uid), { email: user.email, wallet,
        acceptedDares, pinnedDares: [], likedProofs: [], settings: {} });
      batch.set(db.collection('usernames').doc(handle), { uid: user.uid });
      await batch.commit();
    } else {
      const d   = snap.data();
      // Anything still at the top level belongs in private/ — move it, then read
      // the drawer. A returning account migrates itself on this one sign-in.
      const moved = await _migratePrivate(user.uid, d);
      let priv = {};
      try { const ps = await _privRef(user.uid).get(); if (ps.exists) priv = ps.data() || {}; } catch(e){}
      if (moved) priv = { ...moved, ...priv };

      user.email    = priv.email || user.email;   // falls back to the auth record
      wallet        = priv.wallet     || { balance:100000, pending:0, transactions:[] };
      // priv first, public second: the public copy is gone once this account has
      // migrated, and still there on the sign-in that migrates it.
      acceptedDares = priv.acceptedDares || d.acceptedDares || [];
      _reconcileTakerApprovals();   // in case dares already loaded
      pinnedDares   = priv.pinnedDares   || d.pinnedDares   || [];
      user.username = d.username || (user.name||'user').toLowerCase().replace(/[^a-z0-9_.]/g,'').slice(0,20);
      user.bio      = d.bio      || '';
      userLikes = priv.likedProofs || d.likedProofs || [];
      user.website  = d.website  || '';
      user.socials  = d.socials  || {};   // persist Instagram/X/YouTube links across reloads
      user.settings = priv.settings || d.settings || {};   // persist notif/privacy/autoplay across reloads
      user.dateOfBirth     = priv.dateOfBirth || null;   // set once, by the age gate
      user.underageBlocked = priv.underageBlocked === true;
      user.banned          = priv.banned === true;
      user.bannedReason    = priv.bannedReason || '';
      if (typeof _applyMotionPref === 'function') _applyMotionPref();   // motion pref before the first render
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
  if (typeof _sbSyncHeader === 'function') _sbSyncHeader();
}

// ════════════════════════════
//  REAL-TIME DARES LISTENER
// ════════════════════════════
let _daresLoaded = false;   // first snapshot arrived? (gates the skeleton loaders)
// Re-render only the active page, debounced so a burst of dare doc-changes rebuilds once
let _daresRerenderTO = null;
let _daresRowSig = '';      // last painted missions-row contents (see below)
function _daresRerenderDebounced(){
  if (_daresRerenderTO) clearTimeout(_daresRerenderTO);
  _daresRerenderTO = setTimeout(() => {
    const activePage = document.querySelector('.page.active');
    if (!activePage) return;
    if (activePage.id === 'pageDares')    renderDaresPage();
    if (activePage.id === 'pageAccepted') renderAcceptedPage();
    if (activePage.id === 'pageProfile' && user){ _renderMyDares(); _renderAcceptedDares(); }
    // Same story as the feed: only rebuild the missions row when its contents
    // actually changed, otherwise every dare-doc write reloads those thumbnails.
    if (activePage.id === 'pageHome'){
      const r = document.getElementById('homeDaresRow');
      const sig = (dares||[]).filter(d=>!d.completed).map(d=>d.id).join(',');
      if (r && sig !== _daresRowSig){ _daresRowSig = sig; r.outerHTML = _homeDaresHtml(); }
      else if (!r && sig !== _daresRowSig){ _daresRowSig = sig; _homeRenderFeed(true); }
    }
  }, 180);
}
// ══════════════════════════════════════════════════════════════════════════
//  The taker keeps their OWN record straight
//
//  A mission creator cannot write to the taker's user document — that is
//  someone else's document, and the rules refuse it. So the proof itself is the
//  single source of truth for its status, and the taker's client mirrors it
//  into their own acceptedDares. Live, through a listener, so "Under Review"
//  becomes "Approved" the moment the creator approves it.
//
//  Same idea as _reconcileTakerApprovals, which already does this for being
//  picked for a mission.
// ══════════════════════════════════════════════════════════════════════════
let myProofsUnsub = null;

function _reconcileMyProofs(proofs){
  if (!user || !Array.isArray(acceptedDares) || !acceptedDares.length) return false;
  // dareId -> the status of MY proof for it
  const byDare = {};
  (proofs||[]).forEach(p => { if (p.dareId) byDare[p.dareId] = p.status; });

  let changed = false;
  acceptedDares.forEach(a => {
    const st = byDare[a.dareId];
    if (!st) return;
    // rejected sends it back to "To Submit" so the taker can try again —
    // matching what the creator's client used to write directly
    const want = st === 'approved' ? 'approved' : st === 'rejected' ? 'pending' : 'submitted';
    if (a.proofStatus !== want){
      a.proofStatus = want;
      if (want === 'pending') a.proofFilename = '';
      changed = true;
    }
  });
  if (changed) _privRef(user.uid).set({ acceptedDares }, { merge:true }).catch(()=>{});
  return changed;
}

const MY_PROOFS_MAX = 500;   // newest own-proofs the listener holds
function startMyProofsListener(){
  if (myProofsUnsub) myProofsUnsub();
  if (!user) return;
  // Newest MY_PROOFS_MAX only. This is one person's own proofs, so it was never
  // going to reach the size of an open collection — but it had no ceiling at
  // all, and "small because of how people behave" is not a limit.
  // orderBy needs the composite index in firestore.indexes.json (takerId +
  // createdAtMs). Safe to sort on: the proofs collection was empty when this
  // went in, so there is no older document lacking createdAtMs for Firestore
  // to silently drop out of the result.
  myProofsUnsub = db.collection('proofs').where('takerId','==',user.uid)
    .orderBy('createdAtMs','desc').limit(MY_PROOFS_MAX)
    .onSnapshot(snap => {
      const mine = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      if (_reconcileMyProofs(mine)){
        if (typeof _renderAcceptedDares === 'function') _renderAcceptedDares();
        if (typeof renderAcceptedPage  === 'function' && _curPage === 'accepted') renderAcceptedPage();
      }
    }, err => console.error('My proofs listener error:', err));
}

// How many missions the live listener is currently holding. It starts at one
// page and grows when "Load more missions" is pressed. Before this the limit
// was a hard 60 with no way past it, so mission number 61 and everything older
// was unreachable from the app — not slow to reach, unreachable.
// Growing the SAME listener rather than adding a second paged query is
// deliberate: everything downstream reads the one `dares` array, and a second
// array would have to be merged, de-duplicated and kept live by hand.
const DARES_PAGE = 60;
let _daresLimit  = DARES_PAGE;
let _daresMaybeMore = false;   // last snapshot came back full → older ones exist
let _daresLoadingMore = false;

function startDaresListener() {
  if (daresUnsub) daresUnsub();
  daresUnsub = db.collection('dares')
    .orderBy('createdAt', 'desc')
    .limit(_daresLimit)              // newest N — cap the payload as the collection grows
    .onSnapshot((snap) => {
      dares = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      _daresMaybeMore   = snap.size >= _daresLimit;   // full page → there may be more
      _daresLoadingMore = false;
      _daresLoaded = true;
      _reconcileTakerApprovals();   // creator picked me? → unlock Submit Proof
      _scrubLegacyEmails();         // one-shot: drop email from my old dares/proofs
      if (typeof _maybeInitialRoute === 'function') _maybeInitialRoute();   // deep-link /dare/:id
      _daresRerenderDebounced();    // batch bursts of doc changes into one rebuild
    }, (err) => {
      _daresLoadingMore = false;
      console.error('Missions listener error:', err);
      showToast('Connection issue — please refresh');
    });
}

// "Load more missions" — widen the window and re-subscribe. The already-loaded
// missions stay on screen until the bigger snapshot lands, so nothing blinks.
function loadMoreDares(){
  if (_daresLoadingMore || !_daresMaybeMore) return;
  _daresLoadingMore = true;
  _daresLimit += DARES_PAGE;
  const btn = document.getElementById('daresMoreBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'Loading…'; }
  startDaresListener();
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
    _splashDone();
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
// Clearing `user` does not clear the pixels. Every surface below was drawn
// from the signed-in account and will keep showing it until something re-runs,
// which nothing does for a page that is off screen. Both sign-out and guest
// entry wipe them, so neither can inherit the last session's face.
function _clearAccountUI(){
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const html = (id, h)  => { const el = document.getElementById(id); if (el) el.innerHTML = h; };

  set('profName', '—');
  set('profHandle', '@—');
  html('profPic', '');
  const bio = document.getElementById('profBio');
  if (bio) { bio.textContent = ''; bio.style.display = 'none'; }
  html('profSocials', '');
  html('profSocialsBar', '');
  set('tVideos', '0');
  set('walletBal', '0');
  html('notifList', '');

  // the toggles keep their positions too, and the next account would see the
  // last one's choices sitting there before its own settings loaded
  [['setNotifLikes',true],['setNotifFollow',true],['setNotifDares',true],
   ['setPrivate',false],['setAutoplay',true],['setPageAnim',true]]
    .forEach(([id,def]) => { const el = document.getElementById(id); if (el) el.checked = def; });
  document.body.classList.remove('no-anim');
  try { _applyMotionPref(); } catch(e){}
}

async function logout() {
  if (daresUnsub) { daresUnsub(); daresUnsub = null; }
  if (myProofsUnsub) { myProofsUnsub(); myProofsUnsub = null; }
  // the notifications listener was never torn down — it kept running against
  // the signed-out uid and left the last user's rows in memory
  if (notifUnsub) { notifUnsub(); notifUnsub = null; }
  if (_notifCountUnsub) { _notifCountUnsub(); _notifCountUnsub = null; }
  notifications = []; notifUnread = 0; notifLoaded = false;
  if (typeof _updateNotifBadge === 'function') _updateNotifBadge();
  await auth.signOut();
  user = null; dares = []; wallet = { balance:100000, pending:0, transactions:[] }; acceptedDares = [];
  // Everything the signed-in session had open has to go with it. Settings used
  // to stay on screen over the sign-in page, and edits made there were then
  // applied to the NEXT account that signed in.
  try { _ovCloseAllSilent(); } catch(e){}
  ['legalPage','adminPanel','page404'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  ['legal-open','admin-open','nf-open','ov-open'].forEach(c => document.body.classList.remove(c));
  try { closeFeedback(); } catch(e){}
  try { _agreementHide(); } catch(e){}
  // the date wheel is its own overlay, not a .overlay — _ovCloseAllSilent misses it
  try { closeDatePicker(); } catch(e){}
  _clearAccountUI();
  // onAuthStateChanged is what normally swaps the screens, but it is a round
  // trip to Firebase — for that second or two the whole signed-in app stayed on
  // screen after the tap. Swap it here; the listener arriving later is a no-op.
  // Signing out returns to browsing, not to a sign-up wall — the same thing a
  // first-time visitor sees. The auth listener firing later re-enters guest
  // mode properly (listeners, routing); this is only the instant repaint so the
  // signed-in app is not left on screen during the round trip to Firebase.
  const _app = document.getElementById('appScreen');
  const _authS = document.getElementById('authScreen');
  if (_authS) _authS.style.display = 'none';
  if (_app)   _app.style.display  = 'block';
  _wantsAuthScreen = false;
  _isAdmin = false;
  const _ab = document.getElementById('sbAdmin'); if (_ab) _ab.classList.add('nav-hidden');
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
// No /chat. Private messaging was removed: a side deal struck in a DM cannot be
// seen or moderated, and that is not a risk this platform can carry. Mission
// comments remain, and they are public.
const _PAGE_URL  = { home:'/', explore:'/explore', dares:'/dares', accepted:'/accepted', wallet:'/wallet', profile:'/profile', leaderboard:'/leaderboard' };
// Bottom-nav order, left to right. Drives BOTH the swipe direction and which
// way a page slides in: moving right in this list slides in from the right,
// moving left slides in from the left. Anything not listed keeps the old
// forward/back behaviour.
const _TABS = ['home','dares','accepted','profile'];
const _MODAL_URL = { postOverlay:'/post', proofOverlay:'/submit-proof', settingsOverlay:'/settings',
  notifSettingsOverlay:'/settings/notifications', moreSettingsOverlay:'/settings/more',
  depositOverlay:'/wallet/deposit', withdrawOverlay:'/wallet/withdraw',
  kycOverlay:'/wallet/kyc', methodOverlay:'/wallet/account', pinOverlay:'/wallet/pin',
  txnDetailOverlay:'/wallet/transaction', followListOverlay:'/followers', photoViewer:'/profile/photo',
  reviewOverlay:'/review-proofs', rejectOverlay:'/reject-proof', reportOverlay:'/report',
  selectTakersOverlay:'/select-takers', videoPlayOverlay:'/play',
  searchOverlay:'/search', sFilterSheet:'/search/filters' };
const _URL_PAGE  = Object.fromEntries(Object.entries(_PAGE_URL ).map(([k,v])=>[v,k]));
const _URL_MODAL = Object.fromEntries(Object.entries(_MODAL_URL).map(([k,v])=>[v,k]));

// Reveal the shell here rather than at the definition: _bootShell reads _URL_PAGE
// to decide WHICH page's skeleton to paint, and a const is in the temporal dead
// zone until this line. Same synchronous tick, so nothing is delayed by it.
_bootShell();

function goPage(pg, _fromPop) {
  if (pg === 'wallet' && !WALLET_ENABLED) pg = 'home';   // paused: /wallet lands on home
  // GUEST_BLOCKED_PAGES was written but never read, so the pages it names — the
  // profile and the accepted list, both of which are about *an account* — opened
  // for guests and showed whatever the last session had left painted there.
  if (isGuestMode && GUEST_BLOCKED_PAGES.includes(pg)) {
    showGuestPrompt(GUEST_ACTION_MSGS[pg] || GUEST_ACTION_MSGS.default, true);
    return;
  }
  _searchReturn = null;
  // Navigating to a page closes any open page-modal (its history entry gets REPLACED below)
  const _ovWasOpen = (!_fromPop && !_navBack && _ovStack.length) ? _ovCloseAllSilent() : false;
  try{ _pvStop(); }catch(e){}
  try{ _pauseAllMedia(false); }catch(e){}   // leaving a page stops everything it was playing
  document.body.classList.remove('tb-hide');        // fresh page → topbar visible
  document.body.classList.remove('search-open');    // leaving the results → normal topbar back
  if (typeof _notifCloseNow === 'function') _notifCloseNow();
  if (typeof _closeDetailOverlays === 'function') _closeDetailOverlays();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page' + pg.charAt(0).toUpperCase() + pg.slice(1));
  if (el) {
    el.classList.remove('nav-fwd','nav-back');
    el.classList.add('active');
    // Slide direction. Between bottom-nav tabs it follows their left-to-right
    // order, so tapping a button to the LEFT of the current one slides in from
    // the left — it used to always come from the right, which read as "forward"
    // even when you were going back. Off the tab strip: back (popstate) = L→R.
    if (_pageNavInit && !_motionOff()) {
      const from = _TABS.indexOf(_curPage), to = _TABS.indexOf(pg);
      const back = (from >= 0 && to >= 0) ? (to < from) : !!_fromPop;
      el.classList.add(back ? 'nav-back' : 'nav-fwd');
    }
  }
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = document.getElementById('nav-' + pg);
  if (nav) nav.classList.add('active');
  // desktop icon rail carries its own copy of the nav
  document.querySelectorAll('.sb-rail [data-pg]').forEach(n => n.classList.toggle('active', n.dataset.pg === pg));
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
  // Boot skeleton hands over to the page's own render. A pending deep link is
  // the exception — goPage('home') runs first there and the watch/dare view
  // opens once its data lands, so the skeleton stays until _maybeInitialRoute.
  if (typeof _bootSkelHide === 'function' && !_deepLinkPath) _bootSkelHide();
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
// Safety cap on the shared video pool. These queries used to ask Firestore for
// EVERY approved proof with no limit at all — and this runs for every visitor
// on every open, not once in an admin panel. At today's size the cap changes
// nothing; it exists so the app cannot quietly turn into a full-database
// download the day the videos pile up.
// Deliberately NOT ordered: proofs carry `createdAtMs`, but a few older ones
// may pre-date that field and Firestore drops any document missing the field
// it is told to sort by — silently hiding those videos. Once the pool is
// genuinely near this number it needs real paging (an ordered query plus a
// composite index), and that is the moment to backfill the field first.
const PROOF_POOL_LIMIT = 300;
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
// showKind → stamps "Mission" on the thumbnail. Search results use it because
// they dropped the "MISSIONS (n)" section label, so the card has to say what it is.
function _activeDareCard(d, showKind){
  const cat = d.tags?.[0]||d.cat||'fitness';
  const title = d.caption||d.title||'Untitled Mission';
  const reward = d.rewardAmount ?? d.bounty ?? 0;
  const thumb = d.thumbnailURL||'';
  const color = CAT_C[cat]||'#FFFFFF', icon = CAT_I[cat]||'bolt';
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
    ? `<button onclick="event.stopPropagation();_closeAdcMenus();openSelectTakersModal('${d.id}')"><span class="mi">how_to_reg</span>Choose takers</button>
       <button onclick="event.stopPropagation();_closeAdcMenus();openEditDare('${d.id}')"><span class="mi">edit</span>Edit</button>`
    : `<button onclick="event.stopPropagation();_closeAdcMenus();openReportModal('dare','${d.id}','${safe}')"><span class="mi">flag</span>Report</button>`;
  return `<div class="active-dare-card" onclick="openDareDetail('${d.id}')">
    <div class="adc-thumb">${inner}${showKind?'<span class="adc-kind">Mission</span>':''}${pinned}${expiry}<span class="adc-bounty">$${reward.toLocaleString('en-IN')}</span></div>
    <div class="yt-info">
      <div class="yt-av">${cAv}</div>
      <div class="yt-meta">
        <div class="yt-title">${escHtml(title)}</div>
        <div class="yt-sub"><span>@${escHtml(uname)}</span><span class="yt-dot"></span><span>${accepted} accepted</span><span class="yt-dot"></span><span>${_relTimeStr(d.createdAt || d.date)}</span></div>
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

// ══════════════════════════════════════════════════════════════════════════
//  BOOT SKELETON — every page loads in its own shape
//
//  Refreshing on /wallet used to show the HOME feed skeleton, because the only
//  boot skeleton there was filled #homeVideoGrid. Now the URL decides the shape.
//
//  It lives inside <main>, so it inherits the content area's exact margins and
//  padding at every breakpoint — no fixed positioning or offset maths to keep
//  in sync with the topbar.
//
//  Rule for every skeleton in this file: it is REPLACED by real content, never
//  hidden. A display:none skeleton keeps its compositor layer and keeps its
//  sweep running forever — the same shape as the backdrop-filter bug that cost
//  68ms a frame. .page:not(.active) .skel::before in the CSS is the backstop.
// ══════════════════════════════════════════════════════════════════════════
// mission / accepted card — .active-dare-card geometry (16:9 thumb + av + 2 lines)
function _skelDareCards(n){
  let c='';
  for(let i=0;i<(n||2);i++){
    c+=`<div class="active-dare-card skel-yt">
      <div class="adc-thumb"><span class="skel skel-fill"></span></div>
      <div class="yt-info">
        <div class="yt-av"><span class="skel" style="display:block;width:100%;height:100%;border-radius:50%;"></span></div>
        <div class="yt-meta" style="flex:1;min-width:0;">
          <span class="skel skel-line" style="display:block;width:74%;"></span>
          <span class="skel skel-line" style="display:block;width:52%;height:11px;margin-top:9px;"></span>
        </div></div></div>`;
  }
  return `<div class="active-dare-grid">${c}</div>`;
}
// section header — "Missions … View All →"
function _skelSecHdr(w, right){
  return `<div class="home-sec-hdr">
    <span class="skel skel-line" style="width:${w};height:17px;"></span>
    ${right?`<span class="skel" style="width:${right};height:16px;border-radius:8px;margin-left:auto;"></span>`:''}
  </div>`;
}
// comment rows — .vd-comment geometry, so it lands wherever comments do
function _skelComments(n){
  const body=[92,74,86,66], meta=[38,30,42,34];
  let r='';
  for(let i=0;i<(n||4);i++){
    r+=`<div class="vd-comment sk-cmt">
      <div class="vd-comment-av"><span class="skel" style="display:block;width:100%;height:100%;border-radius:50%;"></span></div>
      <div class="vd-comment-body">
        <span class="skel skel-line" style="display:block;width:${meta[i%4]}%;height:10px;"></span>
        <span class="skel skel-line" style="display:block;width:${body[i%4]}%;margin-top:9px;"></span>
        <span class="skel skel-line" style="display:block;width:34%;height:10px;margin-top:10px;"></span>
      </div></div>`;
  }
  return r;
}
// leaderboard entries are boxed cards (.dare-mini), not bare rows
function _skelRankRows(n){
  let r='';
  for(let i=0;i<(n||6);i++){
    r+=`<div class="dare-mini" style="margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0;">
        <span class="skel" style="width:32px;height:26px;flex:none;"></span>
        <span class="skel" style="width:42px;height:42px;border-radius:50%;flex:none;"></span>
        <div style="flex:1;min-width:0;">
          <span class="skel skel-line" style="display:block;width:44%;height:13px;"></span>
          <span class="skel skel-line" style="display:block;width:62%;height:10px;margin-top:8px;"></span>
        </div></div>
      <span class="skel" style="width:78px;height:20px;flex:none;"></span></div>`;
  }
  return r;
}
// wallet history rows — .txn-icon is 40px at radius 12, not a circle
function _skelTxnRows(n){
  let r='';
  for(let i=0;i<(n||5);i++){
    r+=`<div class="sk-txn">
      <span class="skel" style="width:40px;height:40px;border-radius:12px;flex:none;"></span>
      <div style="flex:1;min-width:0;">
        <span class="skel skel-line" style="display:block;width:58%;height:12px;"></span>
        <span class="skel skel-line" style="display:block;width:34%;height:10px;margin-top:8px;"></span>
      </div>
      <span class="skel" style="width:70px;height:18px;flex:none;"></span></div>`;
  }
  return r;
}

// ONE shape per feed, used by the boot skeleton and by the page's own renderer.
// They used to differ: refreshing /explore painted the explore skeleton, then
// renderExplorer replaced it with _skelCards() — the HOME feed shape. Two
// skeletons back to back, the second one belonging to a different page.
function _skelFeed(pg){
  switch(pg){
    case 'explore':  return _skelCards(3);
    case 'dares':
    case 'accepted': return _skelDareCards(3);
    default:         return _skelSecHdr('96px','82px') + _skelDareCards(2)
                          + `<div style="margin-top:26px;">${_skelSecHdr('72px')}</div>` + _skelCards(2);
  }
}

// A loader that appears and disappears inside a blink is a flash, not feedback —
// and on a warm cache that is every single navigation. So: paint the skeleton
// only once the wait is long enough to be worth telling someone about.
// The exception is boot, where a skeleton is already on screen; there the page's
// own copy must paint immediately or the handover leaves a blank gap.
const _SKEL_DELAY = 320;
function _skelAfter(el, html){
  if (!el) return () => {};
  if (document.body.classList.contains('boot-skel')){ el.innerHTML = html; return () => {}; }
  const t = setTimeout(() => { el.innerHTML = html; }, _SKEL_DELAY);
  return () => clearTimeout(t);
}

function _bootSkelKind(){
  const path = (location.pathname || '/').replace(/\/+$/,'') || '/';
  const m = path.match(_DEEP_RE);
  if (m){ const v = _SEG_VIEW[m[1]] || m[1];
    return v==='shorts' ? 'shorts' : v==='u' ? 'profile' : 'detail'; }
  if (_URL_PAGE[path]) return (_URL_PAGE[path] === 'wallet' && !WALLET_ENABLED) ? 'home' : _URL_PAGE[path];
  // a modal URL (/wallet/deposit, /settings) restores onto its base page
  if (_URL_MODAL[path]) return (path.startsWith('/wallet') && WALLET_ENABLED) ? 'wallet'
                             : path.startsWith('/profile') ? 'profile' : 'home';
  return 'home';
}

function _skelLine(w,h,mt){
  return `<span class="skel skel-line" style="display:block;width:${w};${h?'height:'+h+';':''}${mt?'margin-top:'+mt+';':''}"></span>`;
}

function _bootSkelHtml(kind){
  const chips = `<div class="sk-chips">${'<span class="skel sk-chip"></span>'.repeat(5)}</div>`;
  switch(kind){
    // Mission and long-video pages share this: full-bleed player, one-line title,
    // creator row ending in Follow, a left action + four icon buttons on the
    // right, then the Comments card and the More Missions / Related card.
    case 'detail': return `<div class="sk-detail">
      <div class="skel sk-hero"></div>
      <div class="sk-dbody">
        ${_skelLine('46%','15px')}
        <div class="sk-creator"><span class="skel sk-av40"></span>
          <span class="skel skel-line" style="width:150px;height:13px;"></span>
          <span class="skel sk-pill"></span></div>
        <div class="sk-actions">
          <span class="skel sk-accept"></span>
          <span class="sk-acts-r">${'<span class="skel sk-aicon"></span>'.repeat(4)}</span>
        </div>
        <div class="dd-bar">${_skelLine('96px','13px')}${_skelLine('62%','12px','14px')}</div>
        <div class="dd-bar">${_skelLine('126px','13px')}
          <div style="margin-top:14px;">${_skelDareCards(1)}</div></div>
      </div></div>`;

    case 'shorts': return `<div class="sk-shorts"><span class="skel skel-fill"></span></div>`;

    // mobile profile runs its own topbar, so the skeleton carries one too --
    // otherwise the site topbar flashes in and straight back out
    case 'profile': return `<div class="sk-profile">
      <div class="sk-phead"><span class="skel sk-av92"></span>
        <div class="sk-cmeta">${_skelLine('52%','18px')}${_skelLine('36%','12px','11px')}</div></div>
      <div class="sk-ptabs"><span class="skel"></span><span class="skel"></span></div>
      <div class="sk-fchips">${'<span class="skel sk-fchip"></span>'.repeat(3)}</div>
      ${_skelDareCards(2)}</div>`;

    case 'wallet': return `<div class="sk-wallet">
      ${_skelLine('86px','20px')}
      <div class="wallet-card sk-wcard">
        ${_skelLine('132px','10px')}${_skelLine('212px','34px','14px')}${_skelLine('200px','10px','12px')}
        <div class="sk-wrow"><span class="skel sk-wstat"></span><span class="skel sk-wstat"></span></div>
        <div class="sk-wrow sk-wbtns"><span class="skel sk-wbtn"></span><span class="skel sk-wbtn"></span></div>
      </div>
      ${_skelLine('92px','17px','26px')}
      <div class="wstat-card sk-wstats">
        <div class="sk-wrow" style="margin-top:0;">
          <span class="skel sk-wsbox"></span><span class="skel sk-wsbox"></span><span class="skel sk-wsbox"></span></div>
        <div class="skel sk-wchart"></div>
      </div>
      ${_skelLine('178px','17px','26px')}
      <div class="skel sk-wacct"></div>
      ${_skelLine('132px','16px','26px')}
      ${_skelTxnRows(5)}</div>`;

    case 'leaderboard': return `<div class="sk-lb">${_skelLine('132px','20px')}
      <div style="margin-top:20px;">${_skelRankRows(5)}</div></div>`;

    case 'explore': return `${_skelLine('120px','16px')}<div class="sk-chips" style="margin-top:16px;">${'<span class="skel sk-chip"></span>'.repeat(5)}</div>${_skelFeed('explore')}`;

    // both open on a section header with an action on the right
    case 'dares':    return _skelSecHdr('150px','118px') + _skelFeed('dares');
    case 'accepted': return _skelSecHdr('212px') + _skelFeed('accepted');

    // home leads with the Missions shelf, then the Videos header and the feed
    default: return chips + _skelFeed('home');
  }
}

function _bootSkelShow(kind){
  const main = document.querySelector('.main'); if (!main) return;
  const html = _bootSkelHtml(kind); if (!html) return;
  let el = document.getElementById('bootSkel');
  if (!el){ el = document.createElement('div'); el.id = 'bootSkel'; main.appendChild(el); }
  el.innerHTML = html;
  document.body.classList.add('boot-skel', 'boot-skel-' + kind);
  // The watch/mission view and the mobile profile each drop the site topbar.
  // Reuse the app's own classes rather than re-deriving those rules, or the bar
  // flashes in and out around the skeleton.
  if (kind === 'profile') document.body.classList.add('profile-open');
  if (kind === 'detail') document.body.classList.add('detail-open');
  if (kind === 'shorts') document.body.classList.add('shorts-open');
  // A deep link to a deleted video never resolves, and a stuck skeleton is worse
  // than a stuck empty state — it promises content that is never coming.
  clearTimeout(_bootSkelTO);
  _bootSkelTO = setTimeout(_bootSkelHide, 12000);
}

function _bootSkelHide(){
  _bootDone = true;                       // and disarm the not-yet-shown one
  clearTimeout(_bootSkelArm); _bootSkelArm = null;
  clearTimeout(_bootSkelTO); _bootSkelTO = null;
  [...document.body.classList].filter(c => c.indexOf('boot-skel') === 0)
    .forEach(c => document.body.classList.remove(c));
  // Hand the chrome back only if nothing real is using it — by the time goPage
  // calls this it has already set profile-open for the page it landed on, and a
  // deep link opens its overlay before this runs.
  if (typeof _curPage === 'undefined' || _curPage !== 'profile') document.body.classList.remove('profile-open');
  if (!document.querySelector('.video-detail-overlay.open')) document.body.classList.remove('detail-open');
  if (!document.querySelector('.shorts-overlay.open')) document.body.classList.remove('shorts-open');
  const el = document.getElementById('bootSkel');
  if (el) el.remove();              // removed, not hidden — see the rule above
}

let _homeCancelSkel = () => {};
async function renderHome(cat) {
  if (cat) homeFilterCat = cat;
  const grid = document.getElementById('homeVideoGrid');
  _homeCancelSkel();                     // a re-entry must not leave an old timer armed

  // 1) INSTANT paint from what we already have (memory this session, else the local
  //    IndexedDB cache) — no waiting on the network for repeat opens.
  if (homeProofs && homeProofs.length) {
    _homeRenderFeed();
  } else {
    _homeCancelSkel = _skelAfter(grid, _skelFeed('home'));
    try {
      const c = await db.collection('proofs').where('status','==','approved').limit(PROOF_POOL_LIMIT).get({ source:'cache' });
      if (!c.empty) { homeProofs = c.docs.map(d=>({id:d.id,...d.data()})); allProofs = homeProofs;
        _homeCancelSkel();
        if (typeof _maybeInitialRoute === 'function') _maybeInitialRoute(); _homeRenderFeed(); }
    } catch(e){}
  }

  // 2) REFRESH from the server in the background (stale-while-revalidate)
  try {
    const snap = await db.collection('proofs').where('status','==','approved').limit(PROOF_POOL_LIMIT).get();
    homeProofs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allProofs = homeProofs; // sync for explorer/search/related
    _homeCancelSkel();
    if (typeof _maybeInitialRoute === 'function') _maybeInitialRoute();   // deep-link /watch|/shorts
    _homeRenderFeed();
  } catch(e) {
    if (grid && !(homeProofs && homeProofs.length)) grid.innerHTML = `<div class="empty">
      <span class="mi">error_outline</span>
      <div class="empty-title">Load Error</div>
      <p class="empty-desc">${e.message}</p></div>`;
  }
}
// ── Why the thumbnails used to blink ──
// renderHome() paints up to three times on one visit: once from memory, once
// from the Firestore IndexedDB cache, once from the server snapshot. Each paint
// did container.innerHTML = …, which throws every <img> away and builds a new
// one — the browser then re-decodes the image, and that gap is the blink. The
// three paints almost always carry identical data, so the fix is to skip a
// repaint whose result would be byte-for-byte what is already on screen.
let _feedSig = '';
function _homeFeedSig(){
  return homeFilterCat
    + '§' + (homeProofs||[]).map(p => p.id).join(',')
    + '§' + (dares||[]).filter(d => !d.completed).map(d => d.id).join(',');
}

function _homeRenderFeed(force) {
  const sig  = _homeFeedSig();
  const grid = document.getElementById('homeVideoGrid');
  // :not(.skel-yt) matters — the skeleton also uses .yt-card, and counting it as
  // "painted" would strand the loader on screen when the feed comes back empty
  const painted = grid && grid.querySelector('.yt-card:not(.skel-yt), .active-dare-card, .short-card');
  if (!force && painted && sig === _feedSig) return;   // nothing changed — leave the DOM alone
  _feedSig = sig;

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
    const color = CAT_C[cat] || '#FFFFFF';
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
        <div class="short-title">${p.dareTitle||'Mission Clip'}</div>
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

  const cards = active.map(d => _activeDareCard(d, true)).join('');

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
  if (feed && !_daresLoaded){ feed.innerHTML = _skelFeed('dares'); return; }   // still loading (snapshot re-renders)
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

  // The button is built once and used by BOTH branches below. The empty branch
  // needs it too: if every one of the newest 60 missions happens to be finished
  // or expired, this page says "No Active Missions" while live ones sit just
  // outside the window — without the button there is no way to reach them.
  const moreBtn = _daresMaybeMore
    ? `<button class="notif-more" id="daresMoreBtn" onclick="loadMoreDares()">Load older missions</button>`
    : '';

  if (!active.length) {
    feed.innerHTML = `
      <div class="empty">
        <span class="mi">bolt</span>
        <div class="empty-title">No Active Missions</div>
        <p class="empty-desc">No active missions yet. Post the first mission!</p>
        <button class="btn-empty" onclick="openPost()"><span class="mi">add_circle</span>Post a Mission</button>
      </div>` + moreBtn;
    return;
  }

  // Sort: pinned first, then by createdAt desc
  active.sort((a, b) => {
    const aPinned = pinnedDares.includes(a.id) ? 1 : 0;
    const bPinned = pinnedDares.includes(b.id) ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;
    return 0; // already sorted by createdAt desc from listener
  });

  feed.innerHTML = `<div class="active-dare-grid">${active.map(d => _activeDareCard(d, false)).join('')}</div>` + moreBtn;
}

// ════════════════════════════
//  ACCEPTED DARES PAGE
// ════════════════════════════
function renderAcceptedPage() {
  const _f = document.getElementById('acceptedPageFeed');
  // dares still streaming in — without this the page claims "No Accepted
  // Missions" for a moment before the first snapshot lands
  if (_f && !_daresLoaded){ _f.innerHTML = _skelFeed('accepted'); return; }
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
    return _activeDareCard(d, true);
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
    if (q.length >= _S_MIN) _showSuggestions(q); else _hideSuggestions();
  }, _S_DEBOUNCE);
}
function handleSearchImmediate() {
  // Immediate search (for Enter key, button click, suggestion tap)
  if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null; }
  _handleSearchNow();
}
function _handleSearchNow() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  if (!q) { document.getElementById('searchInput').focus(); _hideSuggestions(); return; }
  if (q.length < _S_MIN) { _hideSuggestions(); return; }

  saveSearchHistory(document.getElementById('searchInput').value.trim());
  _hideSuggestions();
  closeMobileSearch();
  // Delegate to the v32 search engine: Dares/Videos toggle + scored relevance
  // + Active/Completed sections + search tracking. (Was previously dead code.)
  _doSearch(q);
}

// ════════════════════════════════════════════════════════════════════
//  OPEN / CLOSE POST DARE MODAL
// ════════════════════════════════════════════════════════════════════
// Shown BEFORE the form, not after it: nobody should fill in a mission they were
// never allowed to ask for. The record is written first — if that write fails the
// form does not open, which is the whole point of having a gate.
function openPost() {
  if (typeof guestCheck === 'function' && guestCheck('post')) return;
  if (bannedCheck()) return;
  showAgreementModal('create', () => {
    // The form used to wait for the agreement to finish saving before it would
    // open — a database round trip with nothing on screen, which is the three
    // seconds of dead air after tapping Agree. The record still has to exist,
    // but not before the person can start typing: it is written in parallel and
    // collected at submit, by which time it has long since landed.
    _postAgreementId = null;
    _postAgreementP  = _recordAgreement('mission_create', null)
      .then(id => { _postAgreementId = id; return id; })
      .catch(e => { console.error('creator agreement save failed:', e); return null; });
    _doOpenPost();
  });
}
// openEditDare fills the same form itself and does not come through here, so
// editing an existing mission is not re-gated.
// What the post form will accept. A reward of 0 used to post happily, and a
// caption had no limit at all, so 600 characters went into a card built for one
// line.
const MIN_REWARD  = 1;
const MAX_REWARD  = 1000000;
const MAX_CAPTION = 120;
const MAX_DESC    = 2000;
let _postAgreementId = null;
let _postAgreementP  = null;   // the in-flight save; submitDare waits on this
function _doOpenPost() {
  // Post modal (z9500) opens ON TOP of the current page — don't close/leave it
  editingDareId = null;
  // Reset all state
  postTags = []; postRules = []; selectedThumb = null;
  selectedPreviewVid = null; capturedFrameBlob = null;
  currentMediaTab = 'image'; currentVis = 'now';
  currentTakerMode = 'creator_picks'; currentExpiryDate = null;

  // Clear text inputs
  ['pCaption','pReward','pDesc','tagInput']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['scheduleDate','pExpiry'].forEach(id => {          // label AND machine value
    const el = document.getElementById(id); if (el) _dtSet(el, '');
  });


  // Reset media panel to image tab
  switchMediaTab('image');
  _resetThumbUI();
  _resetVideoUI();

  renderPostTags();
  renderPostRules();
  switchVis('now');

  // Modal title
  const titleEl = document.getElementById('postTitle');
  if (titleEl) titleEl.textContent = 'Post a New Mission';

  const btn = document.getElementById('submitDareBtn');
  if (btn) { btn.disabled = false; btn.innerHTML = '<span class="mi">bolt</span> Post Mission'; }

  _ovOpen('postOverlay');
  document.querySelector('#postOverlay .pd-form')?.scrollTo(0, 0);
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
  // Math.max(0, ...) used to sit here, which turned -500 into 0 without a word
  // and let a mission be posted offering nothing. Read it as typed and judge it
  // below instead of quietly rewriting what the person entered.
  const rewardRaw = document.getElementById('pReward').value.trim();
  const reward    = parseInt(rewardRaw, 10);
  const desc    = document.getElementById('pDesc').value.trim();
  const rules   = postRules.map(r => r.trim()).filter(Boolean);
  const tags    = postTags.length ? [...postTags] : ['general'];

  if (!caption) { showToast('Please add a caption'); return; }
  if (caption.length > MAX_CAPTION) { showToast('Caption is too long — keep it under ' + MAX_CAPTION + ' characters'); return; }
  if (!desc)    { showToast('Please add a description'); return; }
  if (desc.length > MAX_DESC) { showToast('Description is too long — keep it under ' + MAX_DESC + ' characters'); return; }
  // A mission with no reward is not a mission, and one with a made-up number is
  // not either. Both used to go straight through.
  if (!rewardRaw || !Number.isFinite(reward)) { showToast('Please enter a reward amount'); return; }
  if (reward < MIN_REWARD) { showToast('Reward must be at least Rs.' + MIN_REWARD); return; }
  if (reward > MAX_REWARD) { showToast('Reward cannot be more than Rs.' + MAX_REWARD.toLocaleString('en-IN')); return; }

  // SAFETY GATE — before anything uploads, and before the mission is written.
  // submitDare handles BOTH posting and editing, so this covers the "post
  // something harmless, then edit it into something dangerous" route too.
  const _safety = checkMissionSafety(caption, desc, rules, tags);
  if (!_safety.safe) {
    _logSafetyBlock(caption, desc, _safety.category, 'keyword', null, rules, tags);
    _showSafetyBlock(_safety.category);
    return;
  }
  // Balance gating is part of the wallet, so it pauses with it. The reward
  // amount is still collected and still shown on the mission — it just is not
  // charged to anything yet.
  if (WALLET_ENABLED) {
    if (!editingDareId && reward > wallet.balance) {
      showToast('Insufficient wallet balance'); return;
    }
    if (editingDareId) {   // editing: only the reward *increase* needs more balance
      const _oldD = dares.find(d=>d.id===editingDareId);
      const _oldR = _oldD ? (_oldD.rewardAmount ?? _oldD.bounty ?? 0) : 0;
      if (reward - _oldR > wallet.balance) { showToast('Insufficient balance to raise the reward'); return; }
    }
  }

  // Expiry
  let expiresAt = null;
  const expiryVal = _dtValue('pExpiry');
  if (expiryVal) {
    const expDate = new Date(expiryVal);
    if (expDate <= new Date()) { showToast('Expiry must be a future date/time'); return; }
    expiresAt = expDate;
  }

  let scheduledAt = null;
  if (currentVis === 'scheduled') {
    const dateVal = _dtValue('scheduleDate');
    if (!dateVal) { showToast('Please select a schedule date and time'); return; }
    scheduledAt = new Date(dateVal);
    if (scheduledAt <= new Date()) { showToast('Please select a future date and time'); return; }
  }

  const btn = document.getElementById('submitDareBtn');
  const _btnIdle = editingDareId
    ? '<span class="mi">bolt</span> Save Changes'
    : '<span class="mi">bolt</span> Post Mission';
  const _btnRelease = () => { btn.disabled = false; btn.innerHTML = _btnIdle; };

  // SAFETY GATE, STAGE 2 — the model. Last thing before the uploads start, so a
  // mission that is going to be blocked never costs one. Runs on edit too:
  // submitDare is both paths.
  btn.disabled = true;
  btn.innerHTML = '<span class="mi">hourglass_empty</span> Checking mission safety...';
  const _ai = await checkMissionSafetyAI(caption, desc, rules, tags);

  if (!_ai.ok) {
    // Could not reach a verdict. Blocking is the only honest answer — passing
    // here would mean the check is decorative the moment the API has a bad day.
    _btnRelease();
    showToast("Safety check couldn't complete. Please try again.");
    return;
  }
  if (!_ai.safe) {
    _logSafetyBlock(caption, desc, _ai.concern || 'none', 'ai', _ai, rules, tags);
    if (_ai.disagreed) _logManualReview(caption, desc, _ai, rules, tags);
    _btnRelease();
    _showSafetyBlock(_ai.concern, _ai.reason
      ? _ai.reason + " This mission can't be posted on Misnivo."
      : null);
    return;
  }

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
      if (WALLET_ENABLED && _delta !== 0) {   // keep escrow accounting in sync
        wallet.balance -= _delta;
        wallet.transactions = wallet.transactions || [];
        wallet.transactions.unshift({
          id:'w'+Date.now()+Math.floor(Math.random()*1000), ts:Date.now(), status:'completed',
          type: _delta>0?'debit':'credit', category: _delta>0?'dare_posted':'refund',
          title: (_delta>0?'Reward raised: ':'Reward lowered (refund): ') + caption.substring(0,25),
          amount: Math.abs(_delta), ref:'REF'+Date.now().toString(36).toUpperCase(), date: todayStr()
        });
        await _privRef().set({ wallet }, { merge:true });
      }
      closePost();
      showToast('Mission updated successfully!');
      editingDareId = null;
    } else {
      // ── CREATE MODE: new dare ─────────────────────────────────────────────
      // The agreement was sent off when the form opened rather than blocking it.
      // Collect it here — by now it has almost always landed, and if it has not,
      // this is the moment to wait, because the mission must carry the record.
      if (_postAgreementP && !_postAgreementId) {
        try { _postAgreementId = await _postAgreementP; } catch(e){ _postAgreementId = null; }
      }
      if (!_postAgreementId) {                      // the save genuinely failed
        try { _postAgreementId = await _recordAgreement('mission_create', null); }
        catch(e){
          showToast('Could not record your agreement — check your connection and try again');
          const _b = document.getElementById('submitDareBtn');
          if (_b) { _b.disabled = false; _b.innerHTML = '<span class="mi">bolt</span> Post Mission'; }
          return;                                   // no mission without the record
        }
      }
      const _newDare = await db.collection('dares').add({
        ...dareData,
        creatorAgreementId: _postAgreementId || null,
        creator:        user.name,
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

      // The agreement was recorded before the mission existed, so close the loop
      // now that it does. Best-effort: the acceptance itself is already on file.
      if (_postAgreementId) {
        db.collection('agreements').doc(_postAgreementId)
          .update({ missionId: _newDare.id }).catch(()=>{});
        _postAgreementId = null;
      }
      _postAgreementP = null;      // this mission's record is closed out

      if (WALLET_ENABLED && reward > 0) {
        wallet.balance -= reward;
        wallet.transactions.unshift({
          id:'w'+Date.now()+Math.floor(Math.random()*1000), ts:Date.now(), status:'completed',
          type:'debit', category:'dare_posted',
          title:'Mission Posted: ' + caption.substring(0,30),
          amount: reward, ref:'REF'+Date.now().toString(36).toUpperCase(), date: todayStr()
        });
        await _privRef().set({ wallet }, { merge:true });
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
// GATE A — every existing caller of acceptDare() now hits the agreement first;
// the real work moved to _doAcceptDare() so no call site had to change.
function acceptDare(id) {
  if (typeof guestCheck === 'function' && guestCheck('accept')) return;
  if (bannedCheck()) return;
  const d = dares.find(x => x.id === id);
  if (!d) return;
  if (acceptedDares.find(a => a.dareId === id)) {
    showToast('You already applied or accepted this mission!'); return;
  }
  showAgreementModal('accept', async () => {
    try {
      await _recordAgreement('mission_accept', id);
    } catch (e) {
      console.error('agreement save failed:', e);
      showToast('Could not record your agreement — please check your connection and try again');
      return;                                      // mission is NOT accepted
    }
    _doAcceptDare(id);
  });
}

async function _doAcceptDare(id) {
  const d = dares.find(x => x.id === id);
  if (!d) return;

  const isCreatorPicks = d.takerSelectionMode === 'creator_picks';
  const reward = d.rewardAmount ?? d.bounty ?? 0;

  try {
    // Always write to applicants subcollection (for creator to see)
    const applicantRef = db.collection('dares').doc(id)
      .collection('applicants').doc(user.uid);
    // How many missions this applicant has already completed. Bounded: the
    // documents behind the number were never read, only counted.
    const compSnap = await db.collection('proofs')
      .where('takerId','==', user.uid)
      .where('status','==','approved').limit(500).get();
    const completionRate = compSnap.size; // number of approved proofs

    await applicantRef.set({
      uid:            user.uid,
      name:           user.name,
      // No email. It moved to users/{uid}/private/main precisely so that other
      // people's documents stop carrying it, and the creator reads this one.
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
    await _privRef(user.uid).set({ acceptedDares }, { merge:true });

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
  'Video is at least 10 seconds long'
];

// ── Open proof modal ─────────────────────────────────────────────────────────
function openProof(dareId) {
  const d = dares.find(x => x.id === dareId);
  if (!d) { showToast('Mission not found'); return; }

  // A finished mission takes no more proof. The rule refuses it too — that is
  // the real gate — but a `permission-denied` arriving AFTER someone has
  // filmed, trimmed and uploaded a video is a cruel way to say no. Say it
  // before they start.
  // A completed mission is not in the missions feed, but it stays on the
  // Accepted page of everyone who took it, with this button live, which is how
  // a normal person reaches this.
  if (d.completed) {
    showToast('This mission is already completed — no more proof can be sent');
    return;
  }

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
  _proofTermsAcceptedAt = null;
  _proofAgreementId     = null;

  // Dare info
  document.getElementById('proofDareTitle').textContent  = d.caption  || d.title;
  document.getElementById('proofDareBounty').textContent =
    'Rs. ' + ((d.rewardAmount ?? d.bounty) || 0).toLocaleString('en-IN');

  // Rules — dare-specific if the creator added them, else generic requirements.
  // Each one is now a checkbox: you must tick every rule before you can submit,
  // the same way the checklist below already works.
  const creatorRules = (d.rules || []).filter(r => r.trim());
  const heading      = document.getElementById('proofRulesHeading');
  const genericRules = [
    'Video must clearly show you completing the mission',
    'Your face must be visible throughout',
    'No cuts or edits — single continuous recording',
    'Minimum 10 seconds, maximum 10 minutes'
  ];
  heading.textContent = creatorRules.length ? 'Creator Rules' : 'Proof Requirements';
  _renderProofRules(creatorRules.length ? creatorRules : genericRules);

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
  document.getElementById('vdzSub').textContent               = 'MP4, MOV, AVI — Max 100MB';
  document.getElementById('videoFileInput').value             = '';
  document.getElementById('proofNote').value                  = '';
  document.getElementById('noteCharCount').textContent        = '0 / 200';
  document.getElementById('proofFrameCaptured').style.display = 'none';
  document.getElementById('uploadWrap').style.display         = 'none';
  document.getElementById('uploadBar').style.width            = '0%';
  document.getElementById('uploadPct').textContent            = '0%';
  document.getElementById('uploadSpeedText').textContent      = '';
  const _errEl = document.getElementById('proofSubmitError'); if (_errEl) _errEl.style.display = 'none';

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

// ── Rules — the same tick-before-you-can-submit pattern as the checklist,
//    applied to this dare's specific rules (or the generic requirements when
//    the creator didn't add any).
let proofRuleCheckState = [];
function _renderProofRules(rules) {
  proofRuleCheckState = rules.map(() => false);
  document.getElementById('proofRulesList').innerHTML =
    rules.map((r, i) => `
      <div class="proof-check-item" id="prci-${i}" onclick="toggleProofRuleCheck(${i})">
        <span class="mi proof-check-icon" id="prcicon-${i}">check_box_outline_blank</span>
        <span class="proof-check-text">${escHtml(r)}</span>
      </div>`).join('');
}

function toggleProofRuleCheck(i) {
  proofRuleCheckState[i] = !proofRuleCheckState[i];
  const icon = document.getElementById('prcicon-' + i);
  const row  = document.getElementById('prci-'   + i);
  if (proofRuleCheckState[i]) {
    icon.textContent = 'check_box';
    icon.style.color = '#fff';
    row.classList.add('checked');
  } else {
    icon.textContent = 'check_box_outline_blank';
    icon.style.color = 'var(--t4)';
    row.classList.remove('checked');
  }
  _updateProofSubmitBtn();
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
    icon.style.color = '#fff';
    row.classList.add('checked');
  } else {
    icon.textContent = 'check_box_outline_blank';
    icon.style.color = 'var(--t4)';
    row.classList.remove('checked');
  }
  _updateProofSubmitBtn();
}

// Submit button enables only when: all rules ticked + all checklist items ticked + video selected
function _updateProofSubmitBtn() {
  const rulesTicked = proofRuleCheckState.length > 0 && proofRuleCheckState.every(Boolean);
  const allTicked   = proofCheckState.length > 0 && proofCheckState.every(Boolean);
  const hasVideo    = !!selectedVideo;
  document.getElementById('btnSubmitProof').disabled = !(rulesTicked && allTicked && hasVideo);
}

// ── Video selected handler ────────────────────────────────────────────────────
// Keeps AdManager + Shorts logic intact while adding v0.16 features
function onVideoSelected(e) {
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('video/')) { showToast('Please select a valid video file'); return; }
  if (file.size > 100 * 1024 * 1024)  {
    const _msg = 'File too large — maximum 100MB allowed';
    showToast(_msg); _showProofSubmitError(_msg); return;
  }
  // a fresh selection clears whatever error the last attempt left behind
  const _errEl0 = document.getElementById('proofSubmitError'); if (_errEl0) _errEl0.style.display = 'none';
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
    if (selectedVideoDuration < 10) {
      warn.className   = 'dur-warn dur-warn--error';
      warn.innerHTML   = `<span class="mi">warning</span> Too short (${selectedVideoDuration}s) — minimum 10 seconds required`;
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
      <span class="mi" style="font-size:18px;color:#fff;">upload</span>
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
// Tapping "Submit Proof" validates the form, then hands off to the terms
// agreement — the actual upload (_doSubmitProof) only runs if that's accepted.
// Any error blocking submission — not just upload failures — shows here too,
// right next to the button, not only as a toast that can fade before it's read.
function _showProofSubmitError(msg) {
  const errEl = document.getElementById('proofSubmitError'); if (!errEl) return;
  errEl.innerHTML = `<span class="mi">error</span>${escHtml(msg)}`;
  errEl.style.display = 'flex';
}

// ── STEP 3 — AUDIT TRAIL ────────────────────────────────────────────────────
// One record per acceptance, in its own 'agreements' collection. Stores the
// version AND a hash of the exact text shown, so a later dispute can prove
// which wording was on screen — not just that "an agreement" was accepted.
// Written before the action it authorises; a failure here stops that action.
async function _recordAgreement(type, missionId) {
  // version + hash of the document THIS type shows — never a global default, or
  // a creator acceptance would be filed under the taker agreement's wording
  const doc = _agreementDoc(type);
  const ref = await db.collection('agreements').add({
    userId:           user.uid,
    userEmail:        user.email || '',
    type,                        // 'mission_create' | 'mission_accept' | 'proof_submission'
    missionId:        missionId || null,     // create: unknown until the mission exists
    proofId:          null,                  // filled in later for proof_submission
    agreementVersion: doc.version(),
    agreementHash:    _agreementHash(doc.text()),
    acceptedAt:       firebase.firestore.FieldValue.serverTimestamp(),
    userAgent:        navigator.userAgent || ''
  });
  return ref.id;
}

function submitProof() {
  if (typeof guestCheck === 'function' && guestCheck('proof')) return;
  if (bannedCheck()) return;
  if (!selectedVideo || !proofDareId) return;

  // Hard block: duration out of range
  if (selectedVideoDuration > 0 && selectedVideoDuration < 10) {
    const _msg = 'Video is too short — minimum 10 seconds required';
    showToast(_msg); _showProofSubmitError(_msg); return;
  }
  if (selectedVideoDuration > 600) {
    const _msg = 'Video is too long — maximum 10 minutes allowed';
    showToast(_msg); _showProofSubmitError(_msg); return;
  }

  const d = dares.find(x => x.id === proofDareId);
  if (!d) return;

  // Checked again here, not only in openProof: the creator can approve someone
  // else's proof while this modal is open, and the live listener will have
  // updated `dares` underneath it. Without this the upload runs to completion
  // and then the rule refuses the write.
  if (d.completed) {
    const _msg = 'This mission was completed while you were here — no more proof can be sent';
    showToast(_msg); _showProofSubmitError(_msg); return;
  }

  // a retry after a previous failure shouldn't carry that old error forward
  const errEl = document.getElementById('proofSubmitError');
  if (errEl) errEl.style.display = 'none';

  // GATE B — the mission agreement, before anything uploads
  showAgreementModal('proof', _recordThenUpload);
}

let _proofTermsAcceptedAt = null;   // ms timestamp, mirrored onto the proof doc
let _proofAgreementId     = null;   // id of this submission's 'agreements' record

// Agreed: write the agreement record FIRST. If that write fails the upload does
// not start — an unrecorded acceptance is exactly what this feature exists to
// prevent.
async function _recordThenUpload() {
  try {
    _proofAgreementId = await _recordAgreement('proof_submission', proofDareId);
  } catch (e) {
    console.error('agreement save failed:', e);
    const msg = 'Could not record your agreement — please check your connection and try again';
    showToast(msg); _showProofSubmitError(msg);
    return;                                        // upload does NOT start
  }
  _proofTermsAcceptedAt = Date.now();
  _doSubmitProof();
}

async function _doSubmitProof() {
  if (!selectedVideo || !proofDareId) return;
  const d = dares.find(x => x.id === proofDareId);
  if (!d) return;

  const btn = document.getElementById('btnSubmitProof');
  btn.disabled = true;
  btn.innerHTML = '<span class="mi">hourglass_empty</span>Preparing...';
  document.getElementById('uploadWrap').style.display = 'block';
  document.getElementById('videoDZ')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    const _proofRef = await db.collection('proofs').add({
      dareId: proofDareId,
      dareTitle:        d.caption  || d.title,
      dareBounty:       d.rewardAmount ?? d.bounty ?? 0,
      posterId:         d.creatorUid,

      takerId:          user.uid,
      takerName:        user.name,
      takerUsername:    user.username || (user.name||'user').toLowerCase().replace(/[^a-z0-9_.]/g,''),

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
      rejectionReason:  '',
      termsAcceptedAt:  _proofTermsAcceptedAt,  // when this specific submission's agreement was accepted
      agreementId:      _proofAgreementId       // → the 'agreements' record for this submission
    });
    // close the loop: the agreement record now points at the proof it authorised
    if (_proofAgreementId) {
      db.collection('agreements').doc(_proofAgreementId)
        .update({ proofId: _proofRef.id }).catch(() => {});
    }

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
    await _privRef(user.uid).set({ acceptedDares }, { merge:true });

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
      _showProofSubmitError(friendly);   // the toast fades; this stays next to the button
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
  document.getElementById('rvProofsList').innerHTML   = _skelRows(3);

  _ovOpen('reviewOverlay');

  try {
    // One mission's proofs. Bounded already by the mission, but a popular one
    // could still collect thousands and this list is judged by hand anyway.
    const snap = await db.collection('proofs').where('dareId','==', dareId).limit(200).get();
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
    ? `<span class="status-badge" style="background:rgba(255,255,255,.10);color:#fff;border:1px solid rgba(255,255,255,.28);">Rejected</span>`
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
    <div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:8px;padding:8px 12px;background:rgba(255,255,255,.06);border-radius:8px;border:1px solid rgba(255,255,255,.14);">
      <strong>Reason:</strong> ${p.rejectionReason}
    </div>` : '';

  return `
  <div class="proof-item ${isApproved?'approved':isRejected?'rejected':''}">
    <div class="proof-item-header">
      <div class="taker-info">
        <div class="taker-av">${_avHtml(p.takerPhotoURL, p.takerName)}</div>
        <div>
          <div class="taker-name">${p.takerName||'Unknown'}</div>
          <div class="taker-date">${_relTimeStr(p.submittedAt)} · @${escHtml(p.takerUsername||'user')}</div>
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
  if (proof.status !== 'submitted') { showToast('This proof has already been ' + proof.status); return; }
  if (!confirm(WALLET_ENABLED
      ? `Approve and transfer Rs.${(proof.dareBounty||0).toLocaleString('en-IN')} to ${proof.takerName}?`
      : `Approve ${proof.takerName}'s proof?`)) return;

  try {
    // ONE batch: the proof and the mission move together or not at all. This
    // used to be three separate awaits with a write to the TAKER's user document
    // in the middle — which security rules correctly refuse, since it is someone
    // else's document. The proof was already approved by then and the mission
    // never got closed, so a failure left the two halves disagreeing.
    //
    // The taker's own copy is no longer written from here at all. Their client
    // reconciles it from the proof itself (_reconcileMyProofs), the same way
    // _reconcileTakerApprovals already handles being picked for a mission.
    const batch = db.batch();
    batch.update(db.collection('proofs').doc(proofId), { status: 'approved' });
    batch.update(db.collection('dares').doc(proof.dareId), { completed: true });
    await batch.commit();

    currentProofs = currentProofs.map(p => p.id === proofId ? {...p, status:'approved'} : p);
    renderProofsList();
    showToast(WALLET_ENABLED
      ? `Rs.${(proof.dareBounty||0).toLocaleString('en-IN')} ${proof.takerName} sent successfully!`
      : `Proof approved — ${proof.takerName} completed the mission`);
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
  if (proof.status !== 'submitted') { showToast('This proof has already been ' + proof.status); return; }

  try {
    // Same shape as approve: one batch, and nothing written to the taker's
    // document. Their client puts the mission back to "To Submit" itself once
    // it sees the rejected proof.
    const batch = db.batch();
    batch.update(db.collection('proofs').doc(rejectProofId),
                 { status: 'rejected', rejectionReason: reason });
    batch.update(db.collection('dares').doc(proof.dareId),
                 { proofCount: firebase.firestore.FieldValue.increment(-1) });
    await batch.commit();

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
  const _cancel = _skelAfter(el, _skelRankRows(5));   // entries are boxed cards, not bare rows
  try {
    // Honest about what this is: a leaderboard adds up EVERY approved proof, so
    // a cap makes it approximate the day the platform outgrows the cap. It was
    // unbounded before, which is worse — the whole collection downloaded into a
    // phone every time someone opened this tab. A true all-time leaderboard has
    // to be totalled on a server and stored, not recomputed on each client.
    const snap = await db.collection('proofs').where('status','==','approved').limit(500).get();
    const map  = {};
    snap.docs.forEach(doc => {
      const p = doc.data();
      if (!map[p.takerId]) map[p.takerId] = { name: p.takerName, earned: 0, count: 0 };
      map[p.takerId].earned += p.dareBounty || 0;
      map[p.takerId].count++;
    });
    _cancel();
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
          <div style="width:42px;height:42px;border-radius:50%;background:#1a1a1a;border:1px solid rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;color:#fff;font-size:17px;font-weight:700;flex-shrink:0;">
            ${p.name[0].toUpperCase()}</div>
          <div>
            <div style="font-size:14px;font-weight:600;">${p.name}</div>
            <div style="font-size:12px;color:var(--t3);">${p.count} mission${p.count>1?'s':''} completed</div>
          </div>
        </div>
        <div style="font-size:20px;font-weight:700;color:var(--green);">Rs.${p.earned.toLocaleString('en-IN')}</div>
      </div>`).join('');
  } catch(e) {
    _cancel();
    el.innerHTML = `<div class="empty"><span class="mi">error_outline</span><div class="empty-title">Error</div><p class="empty-desc">${e.message}</p></div>`;
  }
}

// ════════════════════════════
//  SHARE DARE
// ════════════════════════════
function shareDare(dareId, title) {
  const url = window.location.href.split('?')[0] + '?dare=' + dareId;
  if (navigator.share) {
    navigator.share({ title:'Misnivo', text:`"${title}" — bounty up for grabs!`, url });
  } else {
    navigator.clipboard.writeText(url).then(() => showToast('Link copied to clipboard!'));
  }
}

// ════════════════════════════
//  PROFILE
// ════════════════════════════
function renderProfile() {
  if (!user) { _clearAccountUI(); return; }   // blank it, don't leave the last face up
  const pic = document.getElementById('profPic');
  if (user.picture) { pic.innerHTML = `<img src="${user.picture}" alt="av"/>`; }
  else { pic.textContent = user.name[0].toUpperCase(); }

  document.getElementById('profName').textContent     = user.name;
  document.getElementById('profHandle').textContent   = '@' + (user.username || '—');
  _ppUid = null;   // own-profile context for follow lists
  // The two follows queries that used to run here filled #profFollowers and
  // #profFollowing — spans marked hidden, that nothing read. The stat grid does
  // its own lookup and actually shows the numbers, so this was the same pair of
  // reads twice per profile visit for a result nobody could see.

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
        'background:none;border:none;color:#fff;font-weight:600;cursor:pointer;' +
        'font-size:inherit;padding:0;font-family:inherit;font-weight:600;';
      const renderShort = () => {
        bioEl.innerHTML = '';
        const s = document.createElement('span'); s.textContent = shortText + ' ';
        const more = document.createElement('button'); more.textContent = '...more';
        more.style.cssText = 'background:none;border:none;color:#fff;font-weight:600;cursor:pointer;font-size:inherit;padding:0;font-family:inherit;font-weight:600;';
        more.onclick = renderFull;
        bioEl.appendChild(s); bioEl.appendChild(more);
      };
      const renderFull = () => {
        bioEl.innerHTML = '';
        const s = document.createElement('span'); s.textContent = fullText + ' ';
        const less = document.createElement('button'); less.textContent = 'show less';
        less.style.cssText = 'background:none;border:none;color:#fff;font-weight:600;cursor:pointer;font-size:inherit;padding:0;font-family:inherit;font-weight:600;';
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
  if(_pAccFilter==='completed') _renderProfileVideos();
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
    const snap = await db.collection('proofs').where('status','==','approved').limit(PROOF_POOL_LIMIT).get();
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
  const color=CAT_C[cat]||'#FFFFFF', icon=CAT_I[cat]||'bolt';
  const inner=thumb?`<img src="${thumb}" loading="lazy" decoding="async"/>`:`<div class="adc-thumb-bg" style="background:linear-gradient(135deg,${color}22,${color}55);"><span class="mi" style="color:${color};">${icon}</span></div>`;
  const isPinned=(typeof pinnedDares!=='undefined'&&pinnedDares.includes(d.id));
  const proofs=d.proofCount||0;
  const cAv=_avHtml(d.creatorPhotoURL||(user&&user.picture),d.creator||user?.name);
  const statusPill=d.completed?'<span class="pdc-status done">Completed</span>':'<span class="pdc-status live">Active</span>';
  // Choosing takers had a modal but no way in — openSelectTakersModal had no
  // call site anywhere. With every mission now creator-picks, a mission without
  // this entry can never be finished by anyone.
  const menu=`<div class="adc-menu pdc-menu">
    <button onclick="event.stopPropagation();_closeAdcMenus();openSelectTakersModal('${d.id}')"><span class="mi">how_to_reg</span> Choose takers${d.takers?` (${d.takers})`:''}</button>
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
        <div class="yt-sub"><span>${d.takers||0} accepted</span><span class="yt-dot"></span><span>${proofs} proofs</span><span class="yt-dot"></span><span>${_relTimeStr(d.createdAt || d.date)}</span></div></div>
    </div>
  </div>`;
}
// ── Profile accepted card — thumbnail + status + submit-proof ──
function _profileAcceptedCard(a){
  const d=(dares||[]).find(x=>x.id===a.dareId)||{};
  const title=a.dareTitle||d.caption||'Mission';
  const reward=a.bounty ?? d.rewardAmount ?? d.bounty ?? 0;
  const thumb=d.thumbnailURL||a.thumbnailURL||'';
  const cat=d.tags?.[0]||d.cat||a.cat||'fitness'; const color=CAT_C[cat]||'#FFFFFF', icon=CAT_I[cat]||'bolt';
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
  if(!_daresLoaded){ el.innerHTML=_skelDareCards(2); return; }   // dares still loading (slow network)
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
  if(!_daresLoaded){ el.innerHTML=_skelDareCards(2); return; }   // matches _renderMyDares
  const stOf=a=> a.applicantStatus==='pending'?'applied' : a.proofStatus==='approved'?'approved' : a.proofStatus==='submitted'?'review' : 'tosubmit';
  const _at=a=> new Date(a.acceptedDate||a.date||0).getTime()||0;
  let list=[...(acceptedDares||[])].sort((a,b)=>_at(b)-_at(a));   // latest first
  if(_pAccFilter!=='all') list=list.filter(a=>stOf(a)===_pAccFilter);
  const chips=[['all','All'],['completed','Completed'],['tosubmit','To Submit'],['review','Under Review'],['approved','Approved']]
    .map(([k,l])=>`<button class="pfilter ${_pAccFilter===k?'active':''}" onclick="_setAccFilter('${k}')">${l}</button>`).join('');
  const head=`<div class="pfilter-row">${chips}</div>`;
  // Completed is the proof-video grid that used to be its own tab — same
  // renderer, it just fills the panel this bar sits in now.
  if(_pAccFilter==='completed'){
    el.innerHTML = head + '<div id="tVideos"></div>';
    _renderProfileVideos();
    return;
  }
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
    // Two numbers on a profile header used to cost every single follow row of
    // that account, downloaded. Bounded now — a well-followed account cannot
    // pull ten thousand rows into a phone to print "10K". The trade is that
    // both numbers stop being exact past 1000, which is the same limit the
    // SDK's missing count() would have removed.
    const [a, b] = await Promise.all([
      db.collection('follows').where('targetUid','==',uid).limit(1000).get(),
      db.collection('follows').where('followerUid','==',uid).limit(1000).get()
    ]);
    return { followers: a.size, following: b.size };
  }catch(e){ return { followers:0, following:0 }; }
}

// ── Profile: Videos tab (your completed-dare proof videos) ──
function _renderProfileVideos(){
  const el = document.getElementById('tVideos'); if (!el) return;
  const pool = (typeof allProofs!=='undefined' && allProofs.length) ? allProofs : homeProofs;
  const _vt = p => p.createdAtMs || (p.createdAt?.toDate?.()?.getTime()) || (p.submittedAt ? new Date(p.submittedAt).getTime() : 0) || 0;
  const mine = (pool||[]).filter(p => p.takerId === user.uid).sort((a,b)=>_vt(b)-_vt(a));  // latest first
  if (!mine.length){
    el.innerHTML = '';                 // blank, not a pitch
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
  // The document stores photoURL — saveProfile writes it, initUser reads it.
  // 'picture' only ever exists on the in-memory user object, so reading it off a
  // fetched document was always undefined and every public avatar fell back to
  // an initial.
  if (pic){ pic.innerHTML = u?.photoURL ? `<img src="${u.photoURL}" alt="av"/>` : name[0].toUpperCase(); }
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
    del.innerHTML = active.length?`<div class="active-dare-grid">${active.map(d => _activeDareCard(d, false)).join('')}</div>`
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
  if(navigator.share){ navigator.share({title:'Misnivo — '+name, url}).catch(()=>{}); }
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
    // Who I already follow, so each row shows Follow or Following. Bounded —
    // this is a lookup set, not a list anyone reads.
    if(user){ try{ const mine=await db.collection('follows').where('followerUid','==',user.uid).limit(1000).get();
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
      <div class="fl-av">${_avHtml(u.photoURL,u.name)}</div>
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
  // Phone and desktop both come through here, so this is the one place that can
  // guarantee the Edit Profile form is never put in front of anyone empty.
  if (secId === 'secEdit' && typeof _fillProfileEdit === 'function') _fillProfileEdit();
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
  _applyMotionPref();
  _privRef(user.uid).set({ settings:user.settings }, { merge:true }).catch(()=>{});
}

// One switch, one body class. The Accessibility toggle used to govern only the
// page slide; body.no-anim now also silences the drawer, the search page, the
// notification panel, the filter sheet and the thumbnail hero flight, so
// turning it off actually stops everything moving. Also honours the OS-level
// reduce-motion setting, which the toggle can't override.
function _applyMotionPref(){
  let off = !!(user && user.settings && user.settings.pageAnim === false);
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) off = true; } catch(e){}
  document.body.classList.toggle('no-anim', off);
}
function _motionOff(){ return document.body.classList.contains('no-anim'); }

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
  ['tMyDares','tAccepted','tTxns'].forEach(id => {
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
  if (typeof guestCheck === 'function' && guestCheck('profile')) return;
  if (!user) return;
  _fillProfileEdit();
  openSettings();
  _tpSecById('secEdit');           // desktop: right pane · mobile: its own page
}

// Putting the account's current details into the form. This used to be the body
// of openProfileEdit — which nothing calls any more, because Edit Profile became
// a section of Settings and people reach it by tapping that section, not through
// the old opener. So the form came up completely blank: no name, no handle, no
// bio, no avatar. Worse than looking wrong — saveProfile writes whatever the
// fields hold, so saving that blank form would have erased the bio, website and
// social links of anyone who used it.
function _fillProfileEdit() {
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
  // "Private profile" lives on the Privacy section — the duplicate toggle on the
  // old visibility page is gone with it
}
function cancelProfileEdit() {
  // The form is a settings section now: on mobile that is a page to close, on
  // desktop it is just the right pane and there is nothing to dismiss.
  peSelectedPhotoFile = null;
  if (window.innerWidth <= 768) { try { closeSetSec(); } catch(e){} }
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
// Whatever was picked becomes a small JPEG before it is uploaded. Two reasons,
// and the second is the one that actually bites:
//   1. A phone camera photo is several thousand pixels wide and this is shown
//      as a small circle. Uploading the original is waste on the wire, on the
//      storage bill and on every profile view afterwards.
//   2. The Cloudinary preset accepts a short list of formats, and phones hand
//      over `.webp` and `.heic`. Converting here means the format the phone
//      happened to use never reaches Cloudinary at all — so tightening that
//      list cannot lock a real person out of setting their own picture.
// The mission and proof thumbnails already came out of a canvas as jpeg; the
// profile photo was the one image path that still uploaded the raw file.
const AVATAR_MAX_PX = 512;
function _toJpegFile(file, maxPx, name){
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, (maxPx || 512) / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width  * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      // JPEG cannot hold transparency, so a PNG's clear pixels have to become
      // SOMETHING. Black on purpose — avatars sit on black in this app, so the
      // default white would show as a bright ring around the picture.
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      c.toBlob(b => b ? resolve(new File([b], name || 'photo.jpg', { type:'image/jpeg' }))
                      : reject(new Error('encode failed')), 'image/jpeg', 0.9);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

async function onProfilePhotoSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please select an image'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Photo must be under 5 MB'); return; }

  let photo;
  try { photo = await _toJpegFile(file, AVATAR_MAX_PX, 'avatar.jpg'); }
  catch(err){ showToast('Could not read that image — try a JPG or PNG'); return; }

  peSelectedPhotoFile = photo;
  const url = URL.createObjectURL(photo);
  const peAv = document.getElementById('peAvatar');
  peAv.innerHTML = `<img src="${url}" alt="preview" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
}

// ── Save profile ──────────────────────────────────────────────────────────────
async function saveProfile() {
  // This used to reach `user.picture` with no account and fail on the null.
  // A thrown TypeError is not an access check — say no properly.
  if (typeof guestCheck === 'function' && guestCheck('profile')) return;
  if (!user) { showToast('Sign in first'); return; }
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
    if (typeof _sbSyncHeader === 'function') _sbSyncHeader();

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
// The picker this drove is gone, but the function stays: it is the one place
// that sets the mode, and an older mission being edited still passes through it.
function switchTakerMode(mode) {
  currentTakerMode = mode;
}

// ── EDIT DARE ────────────────────────────────────────────────────────
async function openEditDare(id) {
  const _d = dares.find(x=>x.id===id); if(_d && _d.completed){ showToast('Completed missions cannot be edited'); return; }
  // The rules freeze the terms once anyone has accepted. Say so here rather
  // than opening a form whose Save will be refused.
  if (_d && ((_d.takers||0) > 0 || (_d.approvedTakers||[]).length > 0)) {
    showToast('Someone has already accepted this mission — the reward and details are locked now');
    return;
  }
  const d = dares.find(x => x.id === id);
  // Silent return was the worst part of this: the edit form never opened, and
  // then Save posted a NEW mission because editingDareId was still null. Say
  // what happened instead. The list is the newest 60, so an older mission or a
  // half-loaded session both land here.
  if (!d) { showToast(_daresLoaded ? 'Could not open that mission for editing'
                                   : 'Still loading — try again in a moment'); return; }

  editingDareId = id;
  postTags = d.tags ? [...d.tags] : [];
  postRules = d.rules ? [...d.rules] : [];
  selectedThumb = null; selectedPreviewVid = null;
  capturedFrameBlob = null;
  currentMediaTab = 'image';
  currentVis = d.visibility || 'now';
  // An older mission keeps the mode it was posted under — editing it should not
  // quietly change the deal for someone who already accepted it.
  currentTakerMode = d.takerSelectionMode || 'open';

  // Fill form
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val||''; };
  set('pCaption', d.caption || d.title);
  set('pReward',  d.rewardAmount ?? d.bounty ?? 0);
  set('pDesc',    d.description || d.desc);

  if (d.expiresAt) {
    const exp = d.expiresAt.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt);
    const _e = document.getElementById('pExpiry');
    if (_e) _dtSet(_e, exp.getFullYear() + '-' + String(exp.getMonth()+1).padStart(2,'0') + '-' +
                       String(exp.getDate()).padStart(2,'0') + 'T' +
                       String(exp.getHours()).padStart(2,'0') + ':' + String(exp.getMinutes()).padStart(2,'0'));
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

  const titleEl = document.getElementById('postTitle');
  if (titleEl) titleEl.textContent = 'Edit Mission';

  const btn = document.getElementById('submitDareBtn');
  if (btn) { btn.disabled=false; btn.innerHTML='<span class="mi">save</span> Save Changes'; }

  _ovOpen('postOverlay');
  document.querySelector('#postOverlay .pd-form')?.scrollTo(0, 0);
}

// ── DELETE DARE ──────────────────────────────────────────────────────
async function deleteDare(id) {
  const _dd = dares.find(x=>x.id===id); if(_dd && _dd.completed){ showToast('Completed missions cannot be deleted'); return; }
  const d = dares.find(x => x.id === id);
  if (!d) return;
  const title = d.caption || d.title || 'this mission';
  if (!confirm(`Delete "${title}"?` + (WALLET_ENABLED
      ? '\n\nIf you set a reward, it will be refunded to your wallet.' : ''))) return;
  try {
    await db.collection('dares').doc(id).delete();
    // Refund reward if dare was not completed
    const reward = d.rewardAmount ?? d.bounty ?? 0;
    if (WALLET_ENABLED && reward > 0 && !d.completed) {
      wallet.balance += reward;
      wallet.transactions.unshift({ id:'w'+Date.now()+Math.floor(Math.random()*1000), ts:Date.now(), status:'completed',
        type:'credit', category:'refund', title:'Mission Deleted (Refund): '+title.slice(0,25), amount:reward,
        ref:'REF'+Date.now().toString(36).toUpperCase(), date:todayStr() });
      await _privRef().set({ wallet }, { merge:true });
    }
    showToast('Mission deleted' + (WALLET_ENABLED && reward>0 && !d.completed
      ? ` · Rs.${reward.toLocaleString('en-IN')} refunded` : ''));
    renderProfile();
  } catch(e) { showToast('Error: '+e.message); }
}

// ── PIN / UNPIN DARE (max 3) ─────────────────────────────────────────
async function pinDare(id) {
  if (pinnedDares.includes(id)) { showToast('Already pinned!'); return; }
  if (pinnedDares.length >= 3)  { showToast('Maximum 3 missions can be pinned. Unpin one first.'); return; }
  pinnedDares.push(id);
  try {
    await _privRef(user.uid).set({ pinnedDares }, { merge:true });
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
    await _privRef(user.uid).set({ pinnedDares }, { merge:true });
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

// The old "Admin Reports" overlay lived here. Removed 25 Aug 2026: it was
// gated on ADMIN_UID, which was never filled in, so it refused everyone
// including the owner. The Reports tab in the real admin panel does the same
// job and does it better — 100 reports rather than 50, an age badge that
// flags anything open past 24 hours, and a View / Remove / Ignore row that
// writes to admin_actions first. The old resolveReport/dismissReport wrote
// status straight to the document with no record of who did it.

// ── SELECT TAKERS MODAL ───────────────────────────────────────────────
async function openSelectTakersModal(dareId) {
  selectTakersDareId = dareId;
  const d = dares.find(x => x.id === dareId);
  if (!d) return;

  document.getElementById('selectTakersDareTitle').textContent = d.caption||d.title||'Mission';
  _ovOpen('selectTakersOverlay');
  document.getElementById('applicantsList').innerHTML =
    _skelRows(4);
  const _ac = document.getElementById('applicantCount');
  if (_ac) _ac.innerHTML = _skelLine('180px', '11px');

  // Reset random panel
  document.getElementById('randomPanel')?.classList.remove('open');

  try {
    // Oldest first, capped: whoever applied first is who the creator should be
    // choosing between, and a mission that catches on should not drop several
    // thousand documents into a sheet the moment it is opened. One extra is
    // fetched so the count can say "200+" rather than quietly claiming 200 is
    // all there is.
    const snap = await db.collection('dares').doc(dareId).collection('applicants')
      .orderBy('appliedAt','asc').limit(APPLICANTS_MAX + 1).get();
    _applicantsCapped = snap.size > APPLICANTS_MAX;
    currentApplicants = snap.docs.slice(0, APPLICANTS_MAX).map(doc=>({id:doc.id,...doc.data()}));
    const approvedTakers = d.approvedTakers || [];
    renderApplicantsList(currentApplicants, approvedTakers);
  } catch(e) {
    document.getElementById('applicantsList').innerHTML =
      `<div class="empty"><span class="mi">error</span><div class="empty-title">Error: ${e.message}</div></div>`;
  }
}

const APPLICANTS_MAX = 200;   // how many applicants one sheet will hold
let _applicantsCapped = false;
function renderApplicantsList(applicants, approvedTakers) {
  const el = document.getElementById('applicantsList');
  const _n = applicants.length + (_applicantsCapped ? '+' : '');
  document.getElementById('applicantCount').textContent =
    `${_n} applicant${applicants.length!==1?'s':''} · ${approvedTakers.length} approved`;

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
               style="background:#fff;color:#000;border:none;
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
  if (changed) _privRef(user.uid).set({ acceptedDares }, { merge:true }).catch(()=>{});
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

// ── Close new modals on overlay click ─────────────────────
['reportOverlay','selectTakersOverlay'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', function(e) {
    if (e.target === this) {
      if (id === 'reportOverlay')        closeReportModal2();
      else if (id === 'selectTakersOverlay') closeSelectTakersModal();
    }
  });
});


// ════════════════════════════════════════════════════════════
//  MOBILE SIDEBAR TOGGLE + BOTTOM NAV SYNC (v0.19 merge)
// ════════════════════════════════════════════════════════════

let _sidebarOpen = false;

// PURPOSE: Hamburger tap → slide the drawer in/out. Same on every width:
//   on desktop it floats over the page (the .sb-rail gutter stays put), so
//   opening it never resizes the feed the way the old expanding rail did.
function toggleSidebar() {
  if (_sidebarOpen) closeSidebar(); else openSidebar();
}

// PURPOSE: Open the mobile drawer (hamburger tap OR edge-swipe). One history
//          entry per open, so the phone back button just closes it.
let _sbPushed = false;      // did opening the drawer add a history entry?

function openSidebar() {
  const sb      = document.getElementById('sidebar');
  const overlay = document.getElementById('sbOverlay');
  if (!sb) return;
  const was = _sidebarOpen;
  _sidebarOpen = true;
  _sbClearDragStyles();
  sb.classList.add('open');
  if (overlay) overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  _sbSyncHeader();
  if (!was) _sbPushed = _dmPush();   // only claim a rewind if the entry really landed
}

// PURPOSE: Close sidebar (overlay tap / ESC / nav item click / swipe back)
function closeSidebar() {
  const sb      = document.getElementById('sidebar');
  const overlay = document.getElementById('sbOverlay');
  _sidebarOpen  = false;
  _sbPushed     = false;
  _sbClearDragStyles();
  if (sb)      sb.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
  document.body.style.overflow = '';
}

// PURPOSE: User dismissed the drawer (✕ / tap-outside / swipe shut) without
//   navigating. Rewind the entry opening it pushed, so the phone back button
//   never needs a dead press — popstate closes it (see the handler below).
function _sbDismiss() {
  if (_sidebarOpen && _sbPushed) { _sbPushed = false; try { history.back(); return; } catch (e) {} }
  closeSidebar();
}

// PURPOSE: Drawer header = the profile link — avatar, display name, @handle.
//   (It replaced the old bottom "Profile" row; tapping it opens the profile.)
function _sbSyncHeader() {
  const av = document.getElementById('sbHeadAv');
  if (av) {
    if (user && user.picture)   av.innerHTML   = `<img src="${user.picture}" alt="av"/>`;
    else if (user && user.name) av.textContent = user.name[0].toUpperCase();
    else                        av.innerHTML   = '<span class="mi">person</span>';
  }
  const nm = document.getElementById('sbHeadName');
  if (nm) nm.textContent = (user && user.name) || 'Guest';
  const hd = document.getElementById('sbHeadHandle');
  if (hd) hd.textContent = (user && user.username) ? '@' + user.username : 'View your profile';
}

// ════════════════════════════════════════════════════════════════════
//  MOBILE SWIPE GESTURES
//    left→right, left HALF of the screen, home page  = drag the drawer open
//                                                      (it follows the finger)
//    right→left while the drawer is open             = drag it shut
//    right→left anywhere else in the app             = go back
//  The open-pull deliberately starts INSIDE the screen, not at the very edge:
//  Android's own gesture-back owns that strip, so an edge swipe never reached
//  the page.
// ════════════════════════════════════════════════════════════════════
const _SB_DEAD     = 44;    // px of left edge left to the system back gesture
const _SB_SLOP     = 10;    // px of movement before the direction is locked
const _SB_TAKE     = 0.35;  // past this fraction of the width it settles open
const _SB_BACK_MIN = 70;    // px of right→left travel that counts as "go back"
let _sbDrag = null;

// Elements that own horizontal dragging themselves — never steal from them
const _SB_SKIP = '.chips-bar,.shorts-row,.pfilter-row,.exp-tabs,.wallet-filters,' +
                 '.dd-rel-shortsrow,input,textarea,select,[contenteditable]';

// Full-screen views with their own left/right swipes (details drawer, shorts nav)
function _sbOverlayOwnsSwipe() {
  return ['dareDetailOverlay', 'videoDetailOverlay', 'shortsOverlay']
    .some(id => { const el = document.getElementById(id); return el && el.classList.contains('open'); });
}

function _sbClearDragStyles() {
  const sb = document.getElementById('sidebar'), ov = document.getElementById('sbOverlay');
  document.body.classList.remove('sb-dragging');
  if (sb) { sb.style.transform = ''; }
  if (ov) { ov.style.opacity = ''; }
}

function _sbDragStart(e) {
  if (_sbDrag) return;                                   // already dragging — ignore extra fingers
  if (window.innerWidth > 768 || e.touches.length !== 1) return;
  if (_sbOverlayOwnsSwipe()) return;
  if (e.target.closest && e.target.closest(_SB_SKIP)) return;

  const t  = e.touches[0];
  const sb = document.getElementById('sidebar');
  const home = document.getElementById('pageHome');
  const canOpen = !_sidebarOpen
    && !!(home && home.classList.contains('active'))                  // home page only
    && !document.body.classList.contains('ov-open')                   // not under a popup
    && !(typeof _ovStack !== 'undefined' && _ovStack.length)
    && t.clientX > _SB_DEAD && t.clientX < window.innerWidth * 0.5;   // left half, inside the edge

  _sbDrag = {
    x: t.clientX, y: t.clientY, lastX: t.clientX, t: Date.now(),
    mode: null, canOpen, wasOpen: _sidebarOpen, p: _sidebarOpen ? 1 : 0,
    w: (sb && sb.getBoundingClientRect().width) || Math.min(300, window.innerWidth * 0.84)
  };
}

function _sbDragMove(e) {
  if (!_sbDrag) return;
  const t = e.touches[0];
  if (!t) return;
  const dx = t.clientX - _sbDrag.x, dy = t.clientY - _sbDrag.y;
  _sbDrag.lastX = t.clientX;

  if (!_sbDrag.mode) {
    if (Math.abs(dx) < _SB_SLOP && Math.abs(dy) < _SB_SLOP) return;
    if (Math.abs(dy) >= Math.abs(dx)) { _sbDrag = null; return; }     // vertical scroll wins
    if (dx > 0) {
      // Home keeps the drawer pull; on any later tab a right swipe walks BACK
      // one tab (Profile → Chat → Missions → Home).
      if (_sbDrag.canOpen)            _sbDrag.mode = 'drawer';
      else if (_sbCurrentTab() > 0)   _sbDrag.mode = 'tabprev';
      else { _sbDrag = null; return; }
    } else {
      _sbDrag.mode = _sbDrag.wasOpen ? 'drawer' : 'back';
    }
    if (_sbDrag.mode === 'drawer') {
      document.body.classList.add('sb-dragging');
      const ov = document.getElementById('sbOverlay');
      if (ov) ov.classList.add('show');      // the dim fades in with the drag
    }
  }

  if (_sbDrag.mode !== 'drawer') return;     // a back-swipe needs no live feedback
  const p = Math.max(0, Math.min(1, (_sbDrag.wasOpen ? 1 : 0) + dx / _sbDrag.w));
  _sbDrag.p = p;
  const sb = document.getElementById('sidebar'), ov = document.getElementById('sbOverlay');
  if (sb) sb.style.transform = `translateX(${(p - 1) * 100}%)`;
  if (ov) ov.style.opacity   = String(p);
  e.preventDefault();                        // we own this gesture now
}

// Which bottom-nav tab is showing, or -1 when we're off the tab strip
function _sbCurrentTab(){
  for (let i = 0; i < _TABS.length; i++){
    const id = 'page' + _TABS[i].charAt(0).toUpperCase() + _TABS[i].slice(1);
    const el = document.getElementById(id);
    if (el && el.classList.contains('active')) return i;
  }
  return -1;
}

function _sbDragEnd() {
  const d = _sbDrag; _sbDrag = null;
  if (!d || !d.mode) return;
  const dx = d.lastX - d.x;

  if (d.mode === 'back') {
    if (dx > -_SB_BACK_MIN) return;
    // On a bottom-nav tab a left swipe walks to the NEXT tab instead of going
    // back — Home → Missions → Chat → Profile. goPage picks the slide direction
    // from the same list, so it comes in from the right.
    const t = _sbCurrentTab();
    if (t >= 0 && t < _TABS.length - 1) { goPage(_TABS[t + 1]); return; }
    if (t === _TABS.length - 1) return;                       // last tab: nothing to the right
    try { history.back(); } catch (e) {}
    return;
  }
  if (d.mode === 'tabprev') {
    if (dx >= _SB_BACK_MIN) {
      const t = _sbCurrentTab();
      if (t > 0) goPage(_TABS[t - 1]);
    }
    return;
  }
  // a quick flick wins over the distance threshold
  const vx    = dx / Math.max(1, Date.now() - d.t);      // px/ms
  const fling = Math.abs(vx) > 0.4;
  // settling shut leaves the inline transform in place for a frame — the
  // popstate close then animates it away from exactly where the finger left it
  if (fling ? vx > 0 : d.p > _SB_TAKE) openSidebar(); else _sbDismiss();
}

document.addEventListener('touchstart',  _sbDragStart, { passive: true  });
document.addEventListener('touchmove',   _sbDragMove,  { passive: false });
document.addEventListener('touchend',    _sbDragEnd,   { passive: true  });
document.addEventListener('touchcancel', _sbDragEnd,   { passive: true  });

// PURPOSE: Sync bottom nav highlight when page changes
function syncBottomNav(pg) {
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
  const map = { home:'bn-home', dares:'bn-dares', accepted:'bn-accepted',
                profile:'bn-profile', leaderboard:'bn-leaderboard' };
  const el = map[pg] ? document.getElementById(map[pg]) : null;
  if (el) el.classList.add('active');
  closeSidebar();   // the drawer is an overlay on desktop too now
}

// PURPOSE: Mobile search icon tap → go to dares page + focus search
function openMobileSearch() {
  _ovOpen('searchOverlay', '/search');
  const inp = document.getElementById('mSearchInput');
  if (inp){ inp.value = document.getElementById('searchInput')?.value || ''; setTimeout(()=>inp.focus(), 80); }
  _sSyncFilterBadge();
  _sRenderPanel();   // history when idle, suggestions once 2+ chars are typed
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
  if (v.length < _S_MIN) return;
  saveSearchHistory(v);
  const main = document.getElementById('searchInput'); if (main) main.value = v;
  closeWalletModal('searchOverlay');
  handleSearchImmediate();
}

// ════════════════════════════════════════════════════════════════════
//  SEARCH ENGINE v2 — YouTube-style: live suggestions · history · filters
//
//  Everything runs against the `dares` / `allProofs` arrays the app already
//  keeps in memory, so it is instant and works offline. The UI only ever talks
//  to the exported surface below — searchMissions / searchVideos /
//  searchCreators / getSuggestions / applyFilters / *SearchHistory. Moving to a
//  hosted index later (Meilisearch, Algolia) means reimplementing those few
//  functions; nothing that renders needs to change. Hashtag / trending / AI
//  search are deliberately NOT built yet — they slot in as extra sources
//  inside getSuggestions() and as extra `type` values in the filters.
// ════════════════════════════════════════════════════════════════════
const _S_MIN      = 2;      // start searching at 2 characters
const _S_DEBOUNCE = 300;    // ms after the last keystroke
const _S_HIST_KEY = 'mm_search_history';
const _S_HIST_MAX = 15;
let   _sTypeTimer = null;

/* ── text normalisation: everything is compared case-insensitively with
      punctuation flattened, so "Push-up Challenge" ⇒ "push up challenge" and
      a search for "push" hits it. ── */
function _sNorm(s){ return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
function _sWords(s){ const n = _sNorm(s); return n ? n.split(' ') : []; }
function _sTitleCase(s){ return String(s||'').replace(/\b[a-z]/g, c => c.toUpperCase()); }
// Safe JS string literal for an inline on* attribute
function _sQ(s){
  return "'" + String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/&(?!quot;|lt;)/g,'&amp;') + "'";
}

// One query word against one field. Prefix beats substring, so "dan" ranks
// "Dance" above "Sundance", and word-level prefixes catch "push" → "pushups".
function _sFieldScore(text, qWords, weight){
  const t = _sNorm(text); if (!t) return 0;
  const words = t.split(' ');
  let s = 0;
  for (const q of qWords){
    if      (t === q)                                                   s += weight * 4;
    else if (t.startsWith(q))                                           s += weight * 2.5;
    else if (words.some(w => w.startsWith(q)))                          s += weight * 2;
    else if (words.some(w => w.length >= 3 && q.startsWith(w)))         s += weight * 1.2;  // typed "pushups", stored "push"
    else if (t.includes(q))                                             s += weight;
  }
  return s;
}

const _S_MISSION_FIELDS = [['caption',10],['title',10],['description',4],['rules',2],['creator',6],['creatorUsername',7],['cat',5]];
const _S_VIDEO_FIELDS   = [['dareTitle',10],['note',4],['takerName',6],['takerUsername',7],['cat',5]];

function _sScoreMission(d, qw){
  let s = 0;
  for (const [f,w] of _S_MISSION_FIELDS) s += _sFieldScore(d[f], qw, w);
  (d.tags||[]).forEach(t => { s += _sFieldScore(t, qw, 8); });
  return s;
}
function _sScoreVideo(p, qw){
  let s = 0;
  for (const [f,w] of _S_VIDEO_FIELDS) s += _sFieldScore(p[f], qw, w);
  return s;
}
function _sVideoPool(){ return (allProofs && allProofs.length) ? allProofs : (homeProofs || []); }

function searchMissions(q, filters){
  const qw = _sWords(q); if (!qw.length) return [];
  const hits = (dares||[]).map(d => Object.assign({}, d, { _score:_sScoreMission(d, qw) })).filter(d => d._score > 0);
  return applyFilters(hits, 'mission', filters);
}
function searchVideos(q, filters){
  const qw = _sWords(q); if (!qw.length) return [];
  const hits = _sVideoPool().map(p => Object.assign({}, p, { _score:_sScoreVideo(p, qw) })).filter(p => p._score > 0);
  return applyFilters(hits, 'video', filters);
}

// People index — creators come from missions, takers from proofs. Someone can
// be both, so they are merged on uid and carry a role set.
function _sPeopleIndex(){
  const map = new Map();
  const add = (uid, name, username, photo, role) => {
    if (!name && !username) return;
    const key = uid || ('@' + String(username || name).toLowerCase());
    const e = map.get(key) || { uid:uid||'', name:name||username, username:username||'', photo:photo||'', roles:{}, missions:0, videos:0 };
    if (name)     e.name     = name;
    if (username) e.username = username;
    if (photo)    e.photo    = photo;
    e.roles[role] = true;
    if (role === 'creators') e.missions++; else e.videos++;
    map.set(key, e);
  };
  (dares||[]).forEach(d => add(d.creatorUid, d.creator, d.creatorUsername, d.creatorPhotoURL, 'creators'));
  _sVideoPool().forEach(p => add(p.takerUid, p.takerName, p.takerUsername, p.takerPhotoURL, 'takers'));
  return Array.from(map.values());
}
function searchCreators(q, role){
  const qw = _sWords(q); if (!qw.length) return [];
  return _sPeopleIndex()
    .filter(p => !role || p.roles[role])
    .map(p => Object.assign({}, p, { _score: _sFieldScore(p.name, qw, 10) + _sFieldScore(p.username, qw, 12) }))
    .filter(p => p._score > 0)
    .sort((a,b) => b._score - a._score);
}

/* ── suggestion vocabulary: real words from the content plus a seed list, so
      suggestions still work on a fresh/empty account ── */
const _S_SEED_WORDS = ['fitness','funny','gaming','dance','dancing','food','public','outdoor','extreme','challenge',
                       'pushups','workout','prank','reaction','trending','mission','missions','video','videos',
                       'creator','stunt','comedy','talent','adventure','tips'];
const _S_SUFFIX = ['challenge','missions','videos','creator','tips'];
let _sVocabCache = null, _sVocabStamp = -1;
function _sVocab(){
  const stamp = (dares ? dares.length : 0) * 100000 + _sVideoPool().length;
  if (_sVocabCache && _sVocabStamp === stamp) return _sVocabCache;
  const set = new Set(_S_SEED_WORDS);
  (dares||[]).forEach(d => {
    _sWords(d.caption || d.title).forEach(w => { if (w.length >= 3) set.add(w); });
    (d.tags||[]).forEach(t => _sWords(t).forEach(w => { if (w.length >= 3) set.add(w); }));
    if (d.cat) _sWords(d.cat).forEach(w => { if (w.length >= 3) set.add(w); });
  });
  _sVideoPool().forEach(p => _sWords(p.dareTitle).forEach(w => { if (w.length >= 3) set.add(w); }));
  _sVocabCache = Array.from(set).filter(Boolean);
  _sVocabStamp = stamp;
  return _sVocabCache;
}

// "fit" → Fitness · Fitness Challenge · Fitness Missions …  Prefix matches on
// the LAST word typed, so "funny d" still suggests "Funny Dance".
function getSuggestions(q, limit){
  limit = limit || 10;
  const qn = _sNorm(q); if (qn.length < _S_MIN) return [];
  const qw   = qn.split(' ');
  const last = qw[qw.length - 1];
  const stem = qw.slice(0, -1).join(' ');
  const out = [], seen = new Set();
  const push = (text, type, icon) => {
    const k = _sNorm(text);
    if (!k || seen.has(k)) return;
    seen.add(k); out.push({ text, type, icon: icon || 'search' });
  };

  // 1) vocabulary words the last token is a prefix of — shortest first
  const vocab = _sVocab();
  const bases = vocab.filter(w => w.startsWith(last)).sort((a,b) => a.length - b.length).slice(0, 4);
  bases.forEach(w => push(_sTitleCase((stem ? stem + ' ' : '') + w), 'term'));

  // 2) things that actually exist — mission titles, then people
  searchMissions(q, {}).slice(0, 4).forEach(d => push(d.caption || d.title || '', 'mission'));
  searchCreators(q).slice(0, 2).forEach(p => push('@' + (p.username || p.name), 'creator', 'person'));

  // 3) templated expansions off the best base word
  if (bases[0]) _S_SUFFIX.forEach(sfx => push(_sTitleCase((stem ? stem + ' ' : '') + bases[0] + ' ' + sfx), 'term'));

  return out.slice(0, limit);
}

// Nearest vocabulary words — powers the "did you mean" chips on an empty result
function _sLev(a,b){
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({length:n+1}, (_,i) => i), cur = new Array(n+1);
  for (let i=1;i<=m;i++){
    cur[0] = i;
    for (let j=1;j<=n;j++){
      cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1] + (a[i-1]===b[j-1]?0:1));
    }
    const t = prev; prev = cur; cur = t;
  }
  return prev[n];
}
function _sNearby(q, limit){
  const qn = (_sNorm(q).split(' ').pop() || '');
  if (qn.length < 2) return [];
  return _sVocab()
    .filter(w => w !== qn)
    .map(w => ({ w, d:_sLev(w, qn) }))
    .filter(x => x.d <= 2 || x.w.startsWith(qn.slice(0,2)))
    .sort((a,b) => a.d - b.d)
    .slice(0, limit || 4)
    .map(x => _sTitleCase(x.w));
}

/* ── search history (last 15, newest first, stored locally) ── */
function getSearchHistory(){
  try { const a = JSON.parse(localStorage.getItem(_S_HIST_KEY) || '[]'); return Array.isArray(a) ? a : []; }
  catch(e){ return []; }
}
function _sHistWrite(a){ try { localStorage.setItem(_S_HIST_KEY, JSON.stringify(a.slice(0, _S_HIST_MAX))); } catch(e){} }
function saveSearchHistory(q){
  const t = String(q||'').trim(); if (t.length < _S_MIN) return;
  const a = getSearchHistory().filter(x => _sNorm(x) !== _sNorm(t));
  a.unshift(t); _sHistWrite(a);
}
function deleteSearchHistory(q){
  _sHistWrite(getSearchHistory().filter(x => _sNorm(x) !== _sNorm(q)));
  _sRenderPanel();
}
function clearSearchHistory(){ _sHistWrite([]); _sRenderPanel(); }

/* ── filters ── */
const _S_FILTER_DEFAULT = { type:'all', sort:'relevance', cat:'', reward:'any', duration:'any' };
let _sFilters = Object.assign({}, _S_FILTER_DEFAULT);

// The app's own categories are fitness/food/adventure/comedy/talent/socialgood
// while tags are free text, so each chip matches a small synonym set instead of
// one exact value — that way "Funny" also finds anything tagged comedy/prank.
const _S_CAT_SYN = {
  fitness:['fitness','workout','gym','pushup','pushups'],
  funny:  ['funny','comedy','prank','humour','humor'],
  gaming: ['gaming','game','gamer','esports'],
  dance:  ['dance','dancing','dancer'],
  food:   ['food','eating','foodie','cooking'],
  public: ['public','reaction','publicreaction','street'],
  outdoor:['outdoor','adventure','travel','nature'],
  extreme:['extreme','stunt','danger','daring','risky']
};
const _S_FILTER_GROUPS = [
  { key:'type',     label:'Content type', opts:[['all','All'],['missions','Missions'],['videos','Videos'],['creators','Creators'],['takers','Takers']] },
  { key:'sort',     label:'Sort by',      opts:[['relevance','Relevance'],['latest','Latest'],['popular','Most popular'],['reward','Highest reward']] },
  { key:'cat',      label:'Category',     opts:[['','Any'],['fitness','Fitness'],['funny','Funny'],['gaming','Gaming'],['dance','Dance'],['food','Food'],['public','Public'],['outdoor','Outdoor'],['extreme','Extreme']] },
  { key:'reward',   label:'Reward',       opts:[['any','Any'],['0-500','Rs. 0–500'],['500-1000','Rs. 500–1000'],['1000+','Rs. 1000+']] },
  { key:'duration', label:'Duration',     opts:[['any','Any'],['30','Under 30 sec'],['60','Under 1 min'],['60+','Over 1 min']] }
];

function _sReward(it){ return Number(it.rewardAmount != null ? it.rewardAmount : (it.bounty != null ? it.bounty : (it.dareBounty || 0))) || 0; }
function _sStamp(it){ return (it.createdAt && it.createdAt.seconds) ? it.createdAt.seconds * 1000 : (it.ts || 0); }

function applyFilters(items, kind, filters){
  const f = filters || _sFilters;
  let out = items || [];

  if (f.cat){
    const syn = _S_CAT_SYN[f.cat] || [f.cat];
    out = out.filter(it => {
      const hay = _sNorm([it.cat, it.caption, it.title, it.dareTitle, (it.tags||[]).join(' ')].join(' '));
      return syn.some(s => hay.indexOf(s) >= 0);
    });
  }
  if (f.reward && f.reward !== 'any'){
    out = out.filter(it => {
      const v = _sReward(it);
      if (f.reward === '0-500')    return v <= 500;
      if (f.reward === '500-1000') return v > 500 && v <= 1000;
      return v > 1000;
    });
  }
  if (kind === 'video' && f.duration && f.duration !== 'any'){
    out = out.filter(it => {
      const d = Number(it.videoDuration || 0); if (!d) return false;
      if (f.duration === '30') return d < 30;
      if (f.duration === '60') return d < 60;
      return d >= 60;
    });
  }

  if      (f.sort === 'latest')  out = out.slice().sort((a,b) => _sStamp(b) - _sStamp(a));
  else if (f.sort === 'popular') out = out.slice().sort((a,b) => (b.viewCount||b.takers||0) - (a.viewCount||a.takers||0));
  else if (f.sort === 'reward')  out = out.slice().sort((a,b) => _sReward(b) - _sReward(a));
  else                           out = out.slice().sort((a,b) => (b._score||0) - (a._score||0));
  return out;
}

function _sActiveFilterCount(){
  return Object.keys(_S_FILTER_DEFAULT).filter(k => _sFilters[k] !== _S_FILTER_DEFAULT[k]).length;
}
function _sSyncFilterBadge(){
  const n = _sActiveFilterCount();
  document.querySelectorAll('.msearch-filter, .sres-filter-btn').forEach(b => {
    b.classList.toggle('has-filters', n > 0);
    b.setAttribute('data-count', n ? String(n) : '');
  });
}

function openSearchFilters(){ _sRenderFilters(); _ovOpen('sFilterSheet', '/search/filters'); }
function closeSearchFilters(){ closeWalletModal('sFilterSheet'); }
function resetSearchFilters(){ _sFilters = Object.assign({}, _S_FILTER_DEFAULT); _sRenderFilters(); _sFiltersChanged(); }
function setSearchFilter(key, val){ _sFilters[key] = val; _sRenderFilters(); _sFiltersChanged(); }

function _sRenderFilters(){
  const box = document.getElementById('sFilterBody'); if (!box) return;
  box.innerHTML = _S_FILTER_GROUPS.map(g => `
    <div class="sfilter-group">
      <div class="sfilter-label">${g.label}</div>
      <div class="sfilter-chips">
        ${g.opts.map(([v,l]) => `<button class="sfilter-chip ${_sFilters[g.key] === v ? 'active' : ''}"
            onclick="setSearchFilter('${g.key}',${_sQ(v)})">${escHtml(l)}</button>`).join('')}
      </div>
    </div>`).join('');
}
// "Apply instantly" — if a result list is already on screen, re-run it now.
function _sFiltersChanged(){
  _sSyncFilterBadge();
  const q = (document.getElementById('searchInput')?.value || '').trim();
  const onResults = document.getElementById('pageDares')?.classList.contains('active');
  if (q.length >= _S_MIN && onResults) _doSearch(q.toLowerCase());
}

/* ── the search page panel: history when idle, suggestions while typing ── */
function _sPanelType(){ clearTimeout(_sTypeTimer); _sTypeTimer = setTimeout(_sRenderPanel, _S_DEBOUNCE); }
function _sQuery(){ return (document.getElementById('mSearchInput')?.value || '').trim(); }

function _sRun(text){
  const inp = document.getElementById('mSearchInput'); if (inp) inp.value = text;
  _mSearchGo();
}
function _sFill(text){
  const inp = document.getElementById('mSearchInput');
  if (inp){ inp.value = text; inp.focus(); }
  _sRenderPanel();
}

function _sRowHtml(text, icon, withDelete){
  return `<div class="srow" onclick="_sRun(${_sQ(text)})">
    <span class="mi srow-ic">${icon}</span>
    <span class="srow-txt">${escHtml(text)}</span>
    ${withDelete ? `<button class="srow-del" onclick="event.stopPropagation();deleteSearchHistory(${_sQ(text)})" aria-label="Remove"><span class="mi">close</span></button>` : ''}
    <button class="srow-fill" onclick="event.stopPropagation();_sFill(${_sQ(text)})" aria-label="Put in search box"><span class="mi">north_west</span></button>
  </div>`;
}

function _sRenderPanel(){
  const box = document.getElementById('mSearchPanel'); if (!box) return;
  const q = _sQuery();

  if (q.length < _S_MIN){
    const h = getSearchHistory();
    box.innerHTML = h.length
      ? `<div class="srow-hdr"><span>Recent searches</span><button class="srow-clear" onclick="clearSearchHistory()">Clear all</button></div>`
        + h.map(t => _sRowHtml(t, 'history', true)).join('')
      : `<div class="msearch-hint">Search mission titles, video titles, categories ya @username</div>`;
    return;
  }

  const sug = getSuggestions(q);
  if (!sug.length){
    const near = _sNearby(q);
    box.innerHTML = `<div class="snores">
      <span class="mi">search_off</span>
      <div class="snores-t">No results found</div>
      <div class="snores-d">Nothing matches “${escHtml(q)}”</div>
      ${near.length ? `<div class="snores-sug">${near.map(t => `<button class="snores-chip" onclick="_sRun(${_sQ(t)})">${escHtml(t)}</button>`).join('')}</div>` : ''}
    </div>`;
    return;
  }
  box.innerHTML = sug.map(s => _sRowHtml(s.text, s.icon, false)).join('');
}

// Patch goPage to also call syncBottomNav
(function() {
  const _orig = window.goPage;
  if (typeof _orig === 'function') {
    window.goPage = function(pg) { _orig(pg); syncBottomNav(pg); };
  }
})();

// The drawer is the same overlay on every width, so a resize just closes it
// rather than leaving it half-styled between the two layouts.
window.addEventListener('resize', () => { if (_sidebarOpen) closeSidebar(); });

// ESC closes sidebar
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') _sbDismiss();
});


// ═══════ ENGAGEMENT STATE (exact from v20) ═══════
let isGuestMode   = false;
// Set by leaveGuestMode() when someone deliberately asks for the sign-in screen,
// so the auth listener does not immediately put them back into guest browsing.
let _wantsAuthScreen = false;
let guestTimer    = null;
let guestInterval = null;
let notifications   = [];
let notifUnread     = 0;
let notifUnsub      = null;
let notifLoaded     = false;   // first snapshot in? drives the skeleton state
let _notifPushed    = false;   // did opening the panel add a history entry?
let activeProof     = null;
let commentsProofId = null;
let commentsCache   = {};
let replyingToCommentId = null;   // video-detail: comment being replied to
let shortsReplyingTo    = null;   // shorts: comment being replied to
let searchType      = 'all';   // 'all' | 'dares' | 'videos' — set from the ⋮ menu
let searchDebounceTimer = null;
let activeExpTab    = 'all';
// icon = a Material Symbols name, not an emoji: the theme is black and white,
// and three of these were blank strings anyway, so the slot jumped about.
const GUEST_ACTION_MSGS = {
  post:        { icon:'bolt',         title:'Post Missions', msg:'Create a free account to set bounties and challenge others.' },
  accept:      { icon:'task_alt',     title:'Accept Missions', msg:'Sign up to accept missions and earn real money.' },
  proof:       { icon:'videocam',     title:'Submit Proof', msg:'Create an account to submit video proof and claim your reward.' },
  profile:     { icon:'person',       title:'Your Profile', msg:'Sign up to build your profile, track earnings, and manage your wallet.' },
  accepted:    { icon:'checklist',    title:'Accepted Missions', msg:'Create an account to track and manage the missions you have accepted.' },
  leaderboard: { icon:'leaderboard',  title:'Leaderboard', msg:'Join to see top earners and compete for the highest rewards.' },
  comment:     { icon:'chat_bubble',  title:'Join the conversation', msg:'Create a free account to comment and reply.' },
  feedback:    { icon:'feedback',     title:'Send feedback', msg:'Create a free account so we can reply to you about it.' },
  like:        { icon:'thumb_up',     title:'Like this', msg:'Sign up to like missions and proofs, and keep what you like.' },
  default:     { icon:'lock',         title:'Create a free account', msg:'Sign up to unlock all features — post missions, accept challenges, and earn money.' },
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
// Milestones moved to the onProofUpdated Cloud Function. Deciding them in each
// viewer's tab double-fired when two people liked at the same moment, and fired
// not at all when nobody had the tab open — the server sees every write exactly
// once and dedupes on (proof, metric, threshold).
// Kept as no-ops so the existing call sites need no changes.
async function _checkMilestone(){ return null; }
async function _checkCommentMilestone(){ return null; }
async function _checkLikeMilestone(){    return null; }
async function _checkViewMilestone(){    return null; }

// Guest browsing has no clock any more, so there is nothing left to tear down.
// Kept because four call sites still tidy up through it, and because a future
// guest-side timer should have exactly one place to be cancelled.
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

  // Mobile swaps the app topbar for a YouTube-style results bar (back · query · ⋮)
  document.body.classList.add('search-open');
  const tsr = document.getElementById('tsrText'); if (tsr) tsr.textContent = q;
  _sCloseResMenu();
  _sSyncTypeMenu();

  // Content type comes from the filter sheet; 'all' defers to the ⋮ menu choice
  const type = _sFilters.type === 'all'
    ? (searchType === 'videos' ? 'videos' : (searchType === 'dares' ? 'missions' : 'all'))
    : _sFilters.type;
  const nFilters = _sActiveFilterCount();

  const typeBar=`
    <button class="search-back-btn" onclick="_searchBack()"><span class="mi">arrow_back</span> Back</button>
    <div class="search-type-bar">
      ${_sFilters.type === 'all' ? `
      <button class="search-type-btn ${searchType==='all'?'active':''}" onclick="setSearchType('all')">
        <span class="mi">apps</span> All
      </button>
      <button class="search-type-btn ${searchType==='dares'?'active':''}" onclick="setSearchType('dares')">
        <span class="mi">bolt</span> Missions
      </button>
      <button class="search-type-btn ${searchType==='videos'?'active':''}" onclick="setSearchType('videos')">
        <span class="mi">play_circle</span> Videos
      </button>` : ''}
      <button class="search-type-btn sres-filter-btn ${nFilters?'has-filters':''}" onclick="openSearchFilters()">
        <span class="mi">tune</span> Filters${nFilters?` (${nFilters})`:''}
      </button>
    </div>`;

  const emptyBlock = (what) => {
    const near = _sNearby(q);
    return `<div class="empty"><span class="mi">search_off</span>
      <div class="empty-title">No results found</div>
      <p class="empty-desc">Nothing in ${what} matches "${escHtml(q)}"</p>
      ${near.length ? `<div class="snores-sug">${near.map(t=>`<button class="snores-chip" onclick="_sResearch(${_sQ(t)})">${escHtml(t)}</button>`).join('')}</div>` : ''}
    </div>`;
  };

  // No result counts and no section labels — the mission cards carry their own
  // "Mission" tag on the thumbnail, so the feed reads clean like YouTube's.
  if (type === 'creators' || type === 'takers') {
    const people = searchCreators(q, type);
    feed.innerHTML = typeBar + (people.length
      ? `<div class="sppl-list">${people.map(_sPersonCard).join('')}</div>`
      : emptyBlock(type));
  } else if (type === 'videos') {
    const results = searchVideos(q);
    feed.innerHTML = typeBar + (results.length
      ? _mixedVideoFeedHtml(results, 'No videos')
      : emptyBlock('videos'));
  } else if (type === 'all') {
    // Everything in one feed, the way the home page mixes them
    const ms = searchMissions(q), vs = searchVideos(q);
    feed.innerHTML = (!ms.length && !vs.length)
      ? typeBar + emptyBlock('missions or videos')
      : typeBar
        + (vs.length ? _mixedVideoFeedHtml(vs, 'No videos') : '')
        + (ms.length ? `<div class="active-dare-grid">${ms.map(d=>_searchDareCard(d)).join('')}</div>` : '');
  } else {
    const results = searchMissions(q);
    feed.innerHTML = results.length
      ? typeBar + `<div class="active-dare-grid">${results.map(d=>_searchDareCard(d)).join('')}</div>`
      : typeBar + emptyBlock('missions');
  }
  _trackSearch(q);
}

// Re-run the current results page with a different term (the "did you mean" chips)
function _sResearch(text){
  const main = document.getElementById('searchInput'); if (main) main.value = text;
  saveSearchHistory(text);
  _doSearch(String(text).toLowerCase().trim());
}

function _sPersonCard(p){
  const uid = p.uid || '';
  const sub = [p.missions ? p.missions + ' mission' + (p.missions!==1?'s':'') : '',
               p.videos   ? p.videos   + ' video'   + (p.videos!==1?'s':'')   : ''].filter(Boolean).join(' · ');
  return `<div class="sppl-row"${uid?` onclick="openPublicProfile('${escHtml(uid)}')"`:''}>
    <div class="sppl-av">${_avHtml(p.photo, p.name)}</div>
    <div class="sppl-meta">
      <div class="sppl-name">${escHtml(p.name||'Creator')}</div>
      <div class="sppl-sub">@${escHtml(p.username||'user')}${sub?' · '+sub:''}</div>
    </div>
  </div>`;
}

function _explorerDareCard(d) {
  return _activeDareCard(d, true);
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

// _onGuestExpired and _startGuestCountdown lived here. Guest browsing has no
// time limit now, so there is no session to expire and no clock to paint. The
// account is asked for by guestCheck() when an action actually needs one.

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
// Re-rendering a whole comment list means every avatar <img> is destroyed and
// rebuilt, and the browser repaints them a frame later — that gap is the blink
// after every like. Liking only ever changes one button, so patch that button.
function _patchCmtLike(commentId, c){
  const liked = !!(user && (c.likedBy||[]).includes(user.uid));
  const n = c.likeCount || 0;
  document.querySelectorAll('[data-cmt-like="' + commentId + '"]').forEach(function(btn){
    btn.classList.toggle('liked', liked);
    btn.innerHTML = '<span class="mi">thumb_up</span>' + (n > 0 ? ' ' + _fmtCount(n) : '');
  });
}

async function likeComment(commentId) {
  if (typeof guestCheck === 'function' && guestCheck('like')) return;
  if (!user) { showToast('Sign in to like'); return; }
  const lists = [commentsCache[commentsProofId], _shortsComments];
  let c = null;
  for (const l of lists) { if (l) { const f = l.find(x=>x.id===commentId); if (f) { c = f; break; } } }
  if (!c) return;
  c.likedBy = c.likedBy || [];
  const liked = c.likedBy.includes(user.uid);
  if (liked) { c.likedBy = c.likedBy.filter(u=>u!==user.uid); c.likeCount = Math.max(0,(c.likeCount||0)-1); }
  else { c.likedBy.push(user.uid); c.likeCount = (c.likeCount||0)+1; }
  _patchCmtLike(commentId, c);   // patch the one button, don't rebuild the list
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

// Placeholder rows while the first Firestore snapshot is still in flight, so the
// panel never opens on a blank sheet.
function _notifSkeletonHtml(n){
  return Array.from({length:n||7}, () => `
    <div class="notif-item nskel">
      <div class="nskel-ic"></div>
      <div class="nskel-lines"><div class="nskel-bar nskel-b1"></div><div class="nskel-bar nskel-b2"></div></div>
    </div>`).join('');
}

function _renderNotifications() {
  const el=document.getElementById('notifList'); if(!el) return;
  if (!notifLoaded && user){ el.innerHTML=_notifSkeletonHtml(); return; }
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
    </div>`).join('')
    + (_notifMore ? `<button class="notif-more" id="notifMoreBtn" onclick="loadMoreNotifications()">Load older notifications</button>` : '');
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
      .then(()=>{const n=(p.viewCount||0)+1;p.viewCount=n;const m=document.getElementById('vdMeta');if(m)m.textContent=`${_relTime(p)} • ${n.toLocaleString('en-IN')} views`;_checkViewMilestone(p.id,n,p.takerId,p.dareTitle);}).catch(()=>{});
  }
  // video src is set by openVideoDetail (after ad) — not here
  document.getElementById('vdTitle').textContent = p.dareTitle||'Mission Video';
  const _vdCap=document.getElementById('vdDescCap'); if(_vdCap) _vdCap.textContent = p.dareTitle||'Mission Video';
  document.getElementById('vdMeta').textContent  = `${_relTime(p)} • ${(p.viewCount||0).toLocaleString('en-IN')} views`;
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
  _vdRepairCounts(p);
  const disliked = user && (p.dislikedBy||[]).includes(user.uid);
  btn.classList.toggle('liked', !!disliked);
  const c=document.getElementById('vdDislikeCount'); if(c) c.textContent=_fmtCount(p.dislikeCount||0);
}
// Same floor the missions got: increment(-1) used to fire on a stored zero.
function _vdRepairCounts(p){
  const fix={};
  if((p.likeCount||0)    < 0){ p.likeCount=0;    fix.likeCount=0; }
  if((p.dislikeCount||0) < 0){ p.dislikeCount=0; fix.dislikeCount=0; }
  if(Object.keys(fix).length) db.collection('proofs').doc(p.id).update(fix).catch(()=>{});
}
async function dislikeProof(){
  if (typeof guestCheck === 'function' && guestCheck('like')) return;
  if(!user){ showToast('Sign in to dislike'); return; }
  const p=activeProof; if(!p) return;
  p.dislikedBy=p.dislikedBy||[]; const d=p.dislikedBy.includes(user.uid);
  const _wasD=p.dislikeCount||0;
  if(d){ p.dislikedBy=p.dislikedBy.filter(u=>u!==user.uid); p.dislikeCount=Math.max(0,_wasD-1); }
  else { p.dislikedBy.push(user.uid); p.dislikeCount=_wasD+1; }
  _vdUpdateDislikeUI(p);
  db.collection('proofs').doc(p.id).update({ dislikedBy:d?firebase.firestore.FieldValue.arrayRemove(user.uid):firebase.firestore.FieldValue.arrayUnion(user.uid), dislikeCount:d?_decCount(_wasD):firebase.firestore.FieldValue.increment(1) }).catch(()=>{});
  // mutually exclusive: a new dislike clears an existing like
  if(!d && userLikes.includes(p.id)){
    userLikes=userLikes.filter(id=>id!==p.id);
    const _wasL=p.likeCount||0; p.likeCount=Math.max(0,_wasL-1);
    db.collection('proofs').doc(p.id).update({likeCount:_decCount(_wasL)}).catch(()=>{});
    _privRef(user.uid).set({likedProofs:userLikes}, { merge:true }).catch(()=>{});
    _updateLikeBtn(p.id, p.likeCount);
  }
}
function _vdReport(){
  if(!activeProof) return;
  document.querySelectorAll('#videoDetailOverlay .dd-action-menu.open').forEach(m=>m.classList.remove('open'));
  openReportModal('video', activeProof.id, activeProof.dareTitle||'this video');
}
// Long video: the native controls fade out, so a paused video showed nothing at
// all to press. This badge stays put for as long as it is paused.
let _vdBountyT = null;
function _vdSyncPaused(){
  const v = document.getElementById('vdPlayer'), w = document.getElementById('vdPlayerWrap');
  if (!v || !w) return;
  w.classList.toggle('is-paused', v.paused || v.ended);
  if (typeof _vpSyncIcons === 'function') _vpSyncIcons();
  _vdBountySync();
}
// Visible while paused; on play it pops in for five seconds and then leaves the
// picture alone.
function _vdBountySync(){
  const v = document.getElementById('vdPlayer'), w = document.getElementById('vdPlayerWrap');
  if (!v || !w) return;
  clearTimeout(_vdBountyT);
  w.classList.add('bounty-on');
  if (!v.paused && !v.ended) _vdBountyT = setTimeout(()=>w.classList.remove('bounty-on'), 5000);
}
function _vdTogglePlay(){
  const v = document.getElementById('vdPlayer'); if (!v) return;
  if (v.paused || v.ended) { const q = v.play(); if (q && q.catch) q.catch(()=>{}); } else v.pause();
  _vdSyncPaused();
}

// The drawer should begin just under the thumbnail rather than under the topbar,
// so it never covers the picture. The thumbnail moves with the page, so its
// position is measured at the moment the drawer opens rather than guessed.
function _ddDrawerTop(scope){
  const hero = document.querySelector(scope + ' .dd-hero');
  const col  = document.querySelector(scope + ' .dd-col2');
  if (!col) return;
  let top = 56;                                       // fallback: under the topbar
  if (hero){
    const b = hero.getBoundingClientRect();
    if (b.height > 0) top = Math.max(0, Math.round(b.bottom));
  }
  col.style.setProperty('--dd-top', top + 'px');
}

// Description/rules toggle — desktop reveals the middle column (3 cols); mobile = drawer
function openVideoDesc(){
  if (window.innerWidth > 768) return;                 // desktop keeps the box open permanently
  _ddDrawerTop('#videoDetailOverlay');
  document.querySelector('#videoDetailOverlay .dd-col2')?.classList.add('open');
  _subOpen('vdDetailsDrawer');
}
function closeVideoDesc(){
  _subDrop('vdDetailsDrawer');
  const ov=document.getElementById('videoDetailOverlay'); if(!ov) return;
  ov.querySelector('.dd-col2')?.classList.remove('open'); ov.classList.remove('vd-show-desc');
}
function dismissVideoDesc(){ _subDismiss('vdDetailsDrawer', closeVideoDesc); }
// The caption is the way in now, so this is open/close rather than a class flip.
function toggleVideoDesc(){
  const col2=document.querySelector('#videoDetailOverlay .dd-col2'); if(!col2) return;
  if (col2.classList.contains('open')) dismissVideoDesc(); else openVideoDesc();
}
// Scroll-to-top for the video page
function _vdScroller(){ const ov=document.getElementById('videoDetailOverlay'); if(!ov) return null; if(window.innerWidth>=769){ const c=ov.querySelector('.dd-col1'); if(c) return c; } return ov; }
function _vdScrollTop(){ const sc=_vdScroller(); if(sc) sc.scrollTo({top:0,behavior:'smooth'}); }
function _vdBindScroll(){
  const sc=_vdScroller(); const btn=document.getElementById('vdScrollTop'); if(!sc) return;
  const on=()=>{
    if(btn) btn.classList.toggle('show', sc.scrollTop>500);
    _vdParkPlayer();
  };
  if(sc._vdSH) sc.removeEventListener('scroll',sc._vdSH);
  sc._vdSH=on; sc.addEventListener('scroll',on);
  if(btn) btn.classList.remove('show');
  _vdParkPlayer();
}
// Mobile keeps the player pinned to the top while you read. Once Related has
// scrolled up to touch it there is nothing left to read past it, so the player
// slides away with the page and pauses rather than covering the list.
function _vdParkPlayer(){
  const w=document.getElementById('vdPlayerWrap'); if(!w) return;
  if(w.classList.contains('vp-fs')){ w.style.transform=''; return; }   // fullscreen does not park
  if(window.innerWidth>768){ w.style.transform=''; return; }
  const rel=document.querySelector('#videoDetailOverlay .dd-col3');
  const h=w.offsetHeight; if(!rel||!h){ w.style.transform=''; return; }
  const push=Math.min(h, Math.max(0, h - rel.getBoundingClientRect().top));
  w.style.transform = push ? 'translateY('+(-push)+'px)' : '';
  if(push>0){
    const v=document.getElementById('vdPlayer');
    if(v && !v.paused && !v._vdParked){ v._vdParked=true; try{ v.pause(); }catch(e){} _vdSyncPaused(); }
  } else {
    const v=document.getElementById('vdPlayer'); if(v) v._vdParked=false;
  }
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
  return _activeDareCard(d, true);   // tag it "Mission" — results have no section labels
}

// Notifications are created by Cloud Functions ONLY — firestore.rules denies
// `create` on /notifications to every client. Letting the browser write them
// meant anyone could post any message to anyone's bell straight from devtools.
// Kept as a no-op so the old call sites stay harmless.
async function _sendNotification(){ return null; }

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

// Desktop topbar dropdown — same engine as the mobile search page, so both
// surfaces stay in sync. Empty box shows recent searches, like YouTube.
function _showSuggestions(q) {
  const sugEl = document.getElementById('searchSuggestions'); if (!sugEl) return;
  const rows = [];

  if (String(q||'').trim().length < _S_MIN) {
    getSearchHistory().slice(0, 8).forEach(t => rows.push({ text:t, type:'recent', icon:'history', hist:true }));
  } else {
    getSuggestions(q, 8).forEach(s => rows.push(s));
  }
  if (!rows.length) { _hideSuggestions(); return; }

  sugEl.innerHTML = rows.map(s => `
    <div class="sug-item" onmousedown="applySuggestion(${_sQ(String(s.text).replace(/^#/,''))})">
      <span class="mi" style="font-size:14px;color:var(--t4);">${s.icon||'search'}</span>
      <span>${escHtml(s.text)}</span>
      ${s.hist ? `<button class="sug-del" onmousedown="event.stopPropagation();event.preventDefault();deleteSearchHistory(${_sQ(s.text)});_showSuggestions('')" aria-label="Remove"><span class="mi">close</span></button>`
               : `<span class="sug-type">${s.type}</span>`}
    </div>`).join('');
  sugEl.style.display = 'block';
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
  const mi=btn.querySelector('.mi'); if(mi) mi.style.color='';   // .liked drives the FILL axis
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
  _ovSync('guestPrompt');
  const _gp = document.getElementById('guestPrompt');
  _gp.style.display = 'none';
  _gp.classList.remove('open');
}

// UI-driven close (back arrow / ✕ / outside tap) rewinds the entry the open
// pushed, so the phone back button never needs a dead press.
function closeNotifPanel() {
  const panel = document.getElementById('notifPanel');
  const wasOpen = panel?.classList.contains('open');
  if (wasOpen && _notifPushed) { _notifPushed = false; try { history.back(); return; } catch(e){} }
  _notifCloseNow();
}
function _notifCloseNow() {
  _notifPushed = false;
  document.getElementById('notifPanel')?.classList.remove('open');
  document.body.classList.remove('notif-open');
}

function closeVideoDetail() {
  if (typeof _vpIsFs === 'function' && _vpIsFs()) _vpExitFs();   // else vp-fs-on strands the app with no chrome
  const _vp = document.getElementById('vdPlayer');
  if (_vp) _vp.playbackRate = 1;                 // speed resets when you leave, like YouTube
  if (typeof _vpCloseMenu === 'function') _vpCloseMenu();
  document.getElementById('videoDetailOverlay').classList.remove('open');
  document.body.style.overflow='';
  document.body.classList.remove('detail-open');
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

// ════════════════════════════════════════════════════════════════════
//  SHARED ELEMENT TRANSITION (hero)
//
//  The thumbnail you tapped flies into the player slot instead of the page
//  cutting to a new screen. FLIP: measure the thumb, clone it as one fixed
//  layer, animate transform + border-radius to the destination box. Only
//  transform and radius animate, so the whole thing stays on the compositor —
//  no layout, no paint, 60fps. The real destination is hidden for the flight so
//  there is never a duplicate on screen, and it is restored on a timer as well
//  as on transitionend so a dropped event can't strand a blank player.
// ════════════════════════════════════════════════════════════════════
const _HERO_MS   = 420;
const _HERO_EASE = 'cubic-bezier(.25,.8,.25,1)';
let _heroSrc = null;

// Capture phase — runs before the card's own onclick navigates, which is the
// last moment the thumbnail is still on screen to measure.
document.addEventListener('click', (e) => {
  _heroSrc = null;
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('button, .adc-menu-wrap, .adc-dots, .dd-action-menu')) return;  // menus aren't navigation
  const card = t.closest('.active-dare-card, .yt-card, .exp-card, .dare-list-card, .short-card');
  if (!card) return;
  const thumb = card.querySelector('.adc-thumb, .yt-thumb, .dare-list-thumb, .short-thumb');
  if (!thumb) return;
  const img = thumb.querySelector('img');
  const url = img && (img.currentSrc || img.src);
  // No image on this card. A mission or a proof posted without a thumbnail —
  // both are optional — shows a placeholder tile instead, and that tile is
  // still the thing the person tapped. Fly a copy of it rather than skipping
  // the animation, which is why this only ever worked on older content.
  // A short's thumbnail is 9:16 and its player is not, so flying the picture
  // means watching it stretch on the way. A plain black box lands cleanly.
  const plain = !!card.closest('.short-card') || card.classList.contains('short-card');
  let node = null;
  if (!url && !plain) {
    node = thumb.cloneNode(true);
    // the badges are absolutely positioned and would grow to full size on the
    // way up; the tile itself is what should travel
    node.querySelectorAll('.adc-bounty,.adc-kind,.adc-status,.pdc-status,.pdc-proofs,' +
      '.yt-dur,.yt-bounty,.short-bounty-tag,.dd-expiry-badge,.adc-menu-wrap,img')
      .forEach(n => n.remove());
    node.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;margin:0;border-radius:0;';
    if (!node.children.length && !node.textContent.trim()) node = null;   // truly empty
  }
  if (!url && !node && !plain) return;
  const r = thumb.getBoundingClientRect();
  if (!r.width || !r.height) return;
  _heroSrc = { r, url: plain ? null : url, node: plain ? null : node, plain,
               radius:getComputedStyle(thumb).borderRadius, t:Date.now() };
}, true);

function _heroFly(destEl){
  const s = _heroSrc; _heroSrc = null;
  if (!s || !destEl) return false;
  if (Date.now() - s.t > 1200) return false;          // stale: the click didn't lead here
  if (_motionOff()) return false;                     // Settings → Page animations, or OS reduce-motion

  const d = destEl.getBoundingClientRect();
  if (!d.width || !d.height) return false;
  // Shapes far enough apart that even cropping looks wrong → cut instead
  const ratio = (s.r.width / s.r.height) / (d.width / d.height);
  if (ratio < 0.4 || ratio > 2.5) return false;

  const sx = d.width / s.r.width, sy = d.height / s.r.height;

  // Two layers. The frame carries position and size; the picture inside is
  // counter-scaled so the IMAGE always grows uniformly and gets cropped by the
  // frame — exactly what object-fit:cover does. A single layer scaled (sx,sy)
  // would stretch the photo whenever the two shapes differ, which is very
  // visible going from a 9:16 short into a full-height player.
  const u  = Math.max(sx, sy);
  const fly = document.createElement('div');
  fly.className = 'hero-fly';
  fly.style.top    = s.r.top + 'px';
  fly.style.left   = s.r.left + 'px';
  fly.style.width  = s.r.width + 'px';
  fly.style.height = s.r.height + 'px';
  fly.style.borderRadius = s.radius;

  const pic = document.createElement('div');
  pic.className = 'hero-fly-pic';
  if (s.plain)    pic.style.background = '#000';   // shorts: a black box, no stretching
  else if (s.url) pic.style.backgroundImage = 'url("' + String(s.url).replace(/"/g, '%22') + '")';
  else            pic.appendChild(s.node);         // placeholder tile: fly the tile itself
  fly.appendChild(pic);
  document.body.appendChild(fly);

  const prevVis = destEl.style.visibility;
  destEl.style.visibility = 'hidden';                 // no duplicate during the flight

  const destRadius = getComputedStyle(destEl).borderRadius;
  requestAnimationFrame(() => {
    fly.style.transition   = `transform ${_HERO_MS}ms ${_HERO_EASE}, border-radius ${_HERO_MS}ms ${_HERO_EASE}`;
    fly.style.transform    = `translate(${d.left - s.r.left}px, ${d.top - s.r.top}px) scale(${sx}, ${sy})`;
    fly.style.borderRadius = destRadius;
    pic.style.transition   = `transform ${_HERO_MS}ms ${_HERO_EASE}`;
    pic.style.transform    = `scale(${u / sx}, ${u / sy})`;
  });

  let settled = false;
  const finish = () => {
    if (settled) return; settled = true;
    destEl.style.visibility = prevVis;
    fly.remove();
  };
  fly.addEventListener('transitionend', finish, { once:true });
  setTimeout(finish, _HERO_MS + 280);                 // belt and braces
  return true;
}

// Flight + the rest of the page rising underneath it, as one movement.
function _heroOpen(overlayEl, destEl){
  if (!_heroFly(destEl)) return;
  if (!overlayEl) return;
  overlayEl.classList.add('hero-in');
  setTimeout(() => overlayEl.classList.remove('hero-in'), _HERO_MS + 140);
}

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
  const color = CAT_C[cat] || '#FFFFFF', icon = CAT_I[cat] || 'bolt';

  document.getElementById('ddTopTitle').textContent = title;
  const ddTitleEl = document.getElementById('ddDareTitle'); if (ddTitleEl) ddTitleEl.textContent = title;
  const ddCapEl = document.getElementById('ddDescCap'); if (ddCapEl) ddCapEl.textContent = title;

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

  const ddMeta = `${_relTimeStr(d.createdAt || d.date)} · ${_fmtCount(d.viewCount||0)} views`;
  const creatorPic = d.creatorPhotoURL || (d.creatorUid === user?.uid ? (user?.picture||'') : '');
  const _ddCu = d.creatorUid||'';
  // Meta gets its own line under the title; this row is just the avatar and Follow.
  const _ddMetaEl = document.getElementById('ddMetaLine');
  if (_ddMetaEl) _ddMetaEl.textContent = ddMeta.replace(/\s*·\s*/g, ' • ');
  document.getElementById('ddCreator').innerHTML = `
    <div class="dd-creator-av" style="cursor:pointer" onclick="openPublicProfile('${_ddCu}')">${_avHtml(creatorPic, d.creator)}</div>
    <span class="dd-creator-nm" style="cursor:pointer" onclick="openPublicProfile('${_ddCu}')">${escHtml(d.creator||'Creator')}</span>
    ${d.creatorUid !== user?.uid ? `<button class="shorts-follow dd-follow" onclick="toggleFollow('${_ddCu}','creator')">Follow</button>` : ''}`;
  _ddSyncSave();

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
  _heroOpen(ov, document.getElementById('ddHero'));   // thumbnail flies into the hero slot
  closeDareDetails();
  _ddBindScrollTop(); _ddBindSwipe();
}
function closeDareDetail(){
  document.getElementById('dareDetailOverlay').classList.remove('open');
  document.body.style.overflow = '';
  document.body.classList.remove('detail-open');
  closeDareComments(); closeDareDetails();
  _ddCurrentId = null;
}
// Mobile: description/rules/tags live in a drawer revealed by a left-swipe
function openDareDetails(){
  if (window.innerWidth > 768) return;                 // desktop keeps the box open permanently
  _ddDrawerTop('#dareDetailOverlay');
  document.querySelector('#dareDetailOverlay .dd-col2')?.classList.add('open');
  _subOpen('ddDetailsDrawer');
}
function closeDareDetails(){
  _subDrop('ddDetailsDrawer');
  document.querySelector('#dareDetailOverlay .dd-col2')?.classList.remove('open');
}
function dismissDareDetails(){ _subDismiss('ddDetailsDrawer', closeDareDetails); }
let _ddTouchX=0, _ddTouchY=0, _ddTouchActive=false;
// Swipe-left opens Description & rules. Takes an overlay id now, so the
// long-video page gets the gesture the mission page and shorts already had.
function _ddBindSwipe(overlayId){
  const ov = document.getElementById(overlayId || 'dareDetailOverlay'); if (!ov || ov._ddSwipeBound) return;
  ov._ddSwipeBound = true;
  // A swipe that starts inside something that scrolls sideways — the shorts rail
  // in Related — is that rail's swipe, not the description drawer's.
  const _inSideScroller = el => {
    for (let n = el; n && n !== ov; n = n.parentElement){
      if (n.nodeType !== 1) continue;
      const s = getComputedStyle(n);
      if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 4) return true;
    }
    return false;
  };
  ov.addEventListener('touchstart', e=>{
    if (window.innerWidth>768) return;
    // scrubbing, double-tap seeking, tapping controls — none of that is a page
    // gesture, and reading a scrub as a swipe was opening the description
    if (e.target.closest && e.target.closest('.vd2-player-wrap, .dd-hero')) { _ddTouchActive=false; return; }
    if (_inSideScroller(e.target)) { _ddTouchActive=false; return; }
    const t=e.touches[0]; _ddTouchX=t.clientX; _ddTouchY=t.clientY; _ddTouchActive=true;
  }, {passive:true});
  ov.addEventListener('touchend', e=>{
    if (!_ddTouchActive || window.innerWidth>768) return; _ddTouchActive=false;
    const t=e.changedTouches[0]; const dx=t.clientX-_ddTouchX, dy=t.clientY-_ddTouchY;
    if (Math.abs(dx)<60 || Math.abs(dy)>Math.abs(dx)) return; // not a horizontal swipe
    const col2 = ov.querySelector('.dd-col2');
    const open = col2 && col2.classList.contains('open');
    // On the mission page go through the open/dismiss pair so the drawer keeps
    // its history entry — the caption is the only other way in now, and back
    // has to close the drawer rather than the whole mission.
    const isDare = ov.id === 'dareDetailOverlay';
    const openFn  = isDare ? openDareDetails    : openVideoDesc;
    const closeFn = isDare ? dismissDareDetails : dismissVideoDesc;
    if (dx<0 && col2 && !open) openFn();        // swipe left → open
    else if (dx>0 && open)     closeFn();       // swipe right → close
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
    document.body.classList.remove('detail-open');
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
function _dmPush(){ try{ history.pushState({dm:Date.now()},''); return true; }catch(e){ return false; } }   // for sub-layers (comment box etc.)

// ════════════════════════════════════════════════════════════════════
//  SUB-LAYER HISTORY — comment sheet, shorts details, collab sheet
//
//  These are UI state, not pages, so they must not leave entries behind. The
//  old code pushed on open and never rewound on close, so every open/close pair
//  stranded one entry: after N cycles it took N+1 back presses to leave the
//  page, and each of those presses re-routed from the URL, which is what
//  reloaded the comments and restarted the video. Two of the three layers were
//  worse — they never pushed at all, yet popstate pushed a fresh entry while
//  closing them, so backing out of them ADDED to the stack.
//
//  The contract now: an open pushes exactly one entry and remembers it. A
//  user-driven close rewinds that same entry (history.back()), and the popstate
//  it triggers performs the visual close. A back press closes the layer the
//  same way. Either route leaves the stack exactly where it started, so any
//  number of open/close cycles costs zero extra back presses.
// ════════════════════════════════════════════════════════════════════
const _subLive = {};                                  // id → its pushed entry is still live

function _subOpen(id){ if (!_subLive[id]) _subLive[id] = _dmPush(); }
function _subDrop(id){ _subLive[id] = false; }        // called by the plain close fns
// User tapped ✕ / the scrim / swiped: give the entry back instead of stranding it
function _subDismiss(id, closeFn){
  if (_subLive[id]){ _subLive[id] = false; try { history.back(); return; } catch(e){} }
  closeFn();
}
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
    try{ history.pushState({ dm:type, id }, '', '/'+(_VIEW_SEG[type]||type)+'/'+encodeURIComponent(id)); }catch(e){}
  }
}
// Open whatever view the current URL points to (back/forward + deep links)
function _dmRouteFromUrl(){
  _navBack = true;
  const m = (location.pathname||'').match(_DEEP_RE_ID);
  if (m){
    const id = decodeURIComponent(m[2]);
    const v  = _SEG_VIEW[m[1]] || m[1];
    if (v==='watch')       openVideoDetail(id);
    else if (v==='shorts') openShorts(id);
    else if (v==='u')      openPublicProfile(id);
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
  const m = src.match(_DEEP_RE_ID);
  if (!m){ _routedInitial = true; _bootSkelHide(); return; }
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
    _bootSkelHide();                       // the real view is up
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

  depositOverlay:       () => closeWalletModal('depositOverlay'),
  withdrawOverlay:      () => closeWalletModal('withdrawOverlay'),
  settingsOverlay:      () => { const e=document.getElementById('settingsOverlay'); if(e) e.classList.remove('open'); },
  // phase 2 — remaining popups (back closes one step; no shareable URL, they're contextual)
  photoViewer:          () => closePhotoViewer(),
  videoPlayOverlay:     () => closeVideoPlay(),
  reviewOverlay:        () => closeReview(),
  rejectOverlay:        () => closeRejectModal(),
  reportOverlay:        () => closeReportModal2(),
  guestPrompt:          () => closeGuestPrompt(),
  selectTakersOverlay:  () => closeSelectTakersModal(),
  followListOverlay:    () => closeWalletModal('followListOverlay'),
  kycOverlay:           () => closeWalletModal('kycOverlay'),
  methodOverlay:        () => closeWalletModal('methodOverlay'),
  pinOverlay:           () => closeWalletModal('pinOverlay'),
  txnDetailOverlay:     () => closeWalletModal('txnDetailOverlay'),
  searchOverlay:        () => closeWalletModal('searchOverlay'),
  sFilterSheet:         () => closeWalletModal('sFilterSheet'),
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
// Every path the app actually serves. Anything else is a wrong address and now
// says so instead of silently dropping the visitor on the home feed, which
// looks like the link worked and hides broken links from everyone.
function _isKnownPath(path){
  if (path === '/' || path === '/admin' || path === '/following') return true;
  if (_DEEP_RE.test(path)) return true;
  if (_URL_PAGE[path] || _URL_MODAL[path] || _URL_LEGAL[path]) return true;
  return false;
}

function show404(){
  const el = document.getElementById('page404'); if (!el) return;
  el.style.display = 'flex';
  document.body.classList.add('nf-open');
}
function close404(goHome){
  const el = document.getElementById('page404'); if (!el) return;
  el.style.display = 'none';
  document.body.classList.remove('nf-open');
  if (goHome){ try { history.replaceState({_page:'home'}, '', '/'); } catch(e){} goPage('home'); }
}

function _bootRoute(){
  let path=(location.pathname||'/').replace(/\/+$/,'')||'/';   // let: an old /shorts/ link is rewritten below
  if(_DEEP_RE.test(path)){
    // An old /shorts/<id> link still opens the same screen, and the bar is
    // corrected to /clips/ on the way in — so the old name is never handed back
    // out again from someone re-sharing what they see.
    if (path.indexOf('/shorts/') === 0){
      path = '/clips/' + path.slice(8);
      try{ history.replaceState(history.state, '', path); }catch(e){}
    }
    _deepLinkPath = path;          // goPage('home') replaces the URL with '/' — save it first
    goPage('home'); return;        // → _maybeInitialRoute opens it once the data loads
  }
  if(path==='/admin'){ goPage('home'); _resolveAdmin().then(ok=>{ if(ok) openAdmin(true); }); return; }
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
  if (!_isKnownPath(path)) show404();      // wrong address: say so
}
function _openModalById(id){
  // a refresh on /wallet/deposit must not resurrect a paused modal
  if (!WALLET_ENABLED && ['depositOverlay','withdrawOverlay','kycOverlay',
      'methodOverlay','pinOverlay','txnDetailOverlay'].indexOf(id) >= 0) return;
  switch(id){
    case 'settingsOverlay':      openSettings(); break;
    case 'notifSettingsOverlay': openNotifSettings(); break;
    case 'moreSettingsOverlay':  openMoreSettings(); break;
    case 'settingsOverlay':      openSettings(); break;
    case 'postOverlay':          openPost(); break;
    case 'depositOverlay':       openDepositModal(); break;
    case 'withdrawOverlay':      openWithdrawModal(); break;
    case 'kycOverlay':           openKycModal(); break;
    case 'methodOverlay':        openMethodModal(); break;
    case 'followListOverlay':    _ppFollowList('followers'); break;
    case 'photoViewer':          _viewProfilePhoto(); break;
    case 'searchOverlay':        openMobileSearch(); break;
    case 'sFilterSheet':         openSearchFilters(); break;
    // contextual — URL dikhta hai par refresh restore nahi (need a dare/proof/txn id):
    // proofOverlay, reviewOverlay, rejectOverlay, reportOverlay,
    // selectTakersOverlay, videoPlayOverlay, pinOverlay, txnDetailOverlay
  }
}

window.addEventListener('popstate', function(e){
  if(_adminOpen()){ closeAdmin(true); return; }          // topmost layer goes first
  if(_legalOpen){ closeLegal(true); return; }
  if(_ovInPop){ _ovInPop = false; return; }              // our own _ovSync rewind — already handled
  // The notification panel sits at z-index 9650, above every tracked modal at
  // 9500, and it is opened from the topbar — which stays reachable while one of
  // those modals is up. So when it is open it is the newest and topmost thing on
  // screen and must close first. Checked below the stack, back closed the page
  // UNDER it instead: open Post, open notifications, press back, and the post
  // form vanished while the notifications stayed.
  if(document.getElementById('notifPanel')?.classList.contains('open')){ _notifCloseNow(); return; }
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
  // no _dmPush() here any more — re-pushing while closing is what made backing
  // out of these layers grow the stack instead of shrink it
  if (isOpen('ddCommentsBox')){ closeDareComments(); return; }
  if (isOpen('ddDetailsDrawer')){ closeDareDetails(); return; }
  if (isOpen('vdDetailsDrawer')){ closeVideoDesc(); return; }
  if (isOpen('shortsDetailsDrawer')){ shortsCloseDetails(); return; }
  if (isOpen('collabModal')){ closeCollabModal(); return; }
  // (notifPanel is handled above the stack check — it is always the topmost layer)
  if (typeof _sidebarOpen!=='undefined' && _sidebarOpen){ closeSidebar(); return; }
  if (e && e.state && e.state._page){ goPage(e.state._page, true); return; }   // back between main pages
  _dmRouteFromUrl();   // the URL is the source of truth — open/close to match it
});
// 3-dots on the dare actions row → Share / Report menu
function _ddCloseActionMenus(){
  document.querySelectorAll('.dd-action-menu.open').forEach(m=>{
    m.classList.remove('open'); m.style.cssText='';
  });
}
function _ddToggleActionMenu(btn){
  const menu = btn.nextElementSibling; if (!menu) return;
  const wasOpen = menu.classList.contains('open');
  _ddCloseActionMenus();
  if (wasOpen) return;
  menu.classList.add('open');
  // On desktop this row sits inside a column with overflow-y:auto, which clips
  // an absolutely positioned child. Pin the menu to the viewport instead.
  const r = btn.getBoundingClientRect();
  const down = r.top < 240;                       // too near the top to open upward
  menu.style.position = 'fixed';
  menu.style.left = 'auto';
  menu.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  menu.style.top    = down ? (r.bottom + 8) + 'px' : 'auto';
  menu.style.bottom = down ? 'auto' : (window.innerHeight - r.top + 8) + 'px';
  menu.style.zIndex = '11500';
}
// Picking an item closes the menu; so does clicking anywhere outside it.
document.addEventListener('click', (e)=>{
  const t = e.target; if (!t || !t.closest) return;
  if (t.closest('.dd-more > button')) return;                 // the toggle owns that click
  if (t.closest('.dd-action-menu')) { setTimeout(_ddCloseActionMenus, 0); return; }
  _ddCloseActionMenus();
});
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
  document.body.classList.remove('search-open');   // goPage does this too, the detail path doesn't
  _sCloseResMenu();
  _hideSuggestions();
  if (r && r.dareId && (dares||[]).some(d=>d.id===r.dareId)) { openDareDetail(r.dareId); return; }
  goPage((r && r.page) ? r.page : 'home');
}
function _ddReport(){
  const d = dares.find(x=>x.id===_ddCurrentId); if (!d) return;
  openReportModal('dare', _ddCurrentId, d.caption || d.title || 'this mission');
}
// Same actions, same handlers — rendered as icon-only pills so the five action
// buttons in the row are one size. The label survives as title/aria-label.
function _ddCtaHtml(d){
  const isMine = d.creatorUid === user?.uid;
  const myEntry = (acceptedDares||[]).find(a=>a.dareId===d.id);
  const pill = (cls, icon, label, onclick) =>
    `<button class="vd-action-btn dd-cta-btn ${cls}" aria-label="${label}"${onclick?` onclick="${onclick}"`:''}><span class="mi">${icon}</span>${label}</button>`;
  if (isMine) return pill('is-mine', 'workspace_premium', 'Your mission', '');
  if (myEntry){
    if (myEntry.proofStatus==='submitted' || myEntry.proofStatus==='approved')
      return pill('is-done', 'check_circle', 'Submitted', '');
    if (myEntry.applicantStatus==='pending')
      return pill('is-done', 'hourglass_empty', 'Applied', '');
    return pill('is-cta', 'video_call', 'Submit proof', `openProof('${d.id}')`);
  }
  return pill('is-cta', 'add', 'Accept', `acceptDare('${d.id}')`);
}

// Bookmark = the existing pin, just surfaced as an icon in the top row
function _ddToggleSave(){
  if (!_ddCurrentId) return;
  const pinned = typeof pinnedDares !== 'undefined' && pinnedDares.includes(_ddCurrentId);
  if (pinned) unpinDare(_ddCurrentId); else pinDare(_ddCurrentId);
  setTimeout(_ddSyncSave, 150);
}
function _ddSyncSave(){
  const b = document.getElementById('ddSaveBtn'); if (!b) return;
  const pinned = !!(_ddCurrentId && typeof pinnedDares !== 'undefined' && pinnedDares.includes(_ddCurrentId));
  b.classList.toggle('on', pinned);
  const i = b.querySelector('.mi'); if (i) i.textContent = pinned ? 'bookmark' : 'bookmark_border';
  const l = document.getElementById('ddSaveLbl'); if (l) l.textContent = pinned ? 'Saved' : 'Save';
}
// increment(-1) on a zero used to push the stored count below zero — clamp what
// we show and repair the document once so the -1 does not come back.
function _ddRepairCounts(d){
  const fix = {};
  if ((d.likeCount||0)    < 0){ d.likeCount    = 0; fix.likeCount    = 0; }
  if ((d.dislikeCount||0) < 0){ d.dislikeCount = 0; fix.dislikeCount = 0; }
  if (Object.keys(fix).length) db.collection('dares').doc(d.id).update(fix).catch(()=>{});
}
function _ddUpdateLikeUI(d){
  _ddRepairCounts(d);
  const liked = user && (d.likedBy||[]).includes(user.uid);
  const disliked = user && (d.dislikedBy||[]).includes(user.uid);
  const _lb = document.getElementById('ddLikeBtn'), _db = document.getElementById('ddDislikeBtn');
  _lb.classList.toggle('liked', !!liked);
  _db.classList.toggle('liked', !!disliked);
  // The glyph never changes now — .liked drives the FILL axis, so "outlined"
  // and "solid" are the same icon rather than two names that can disagree.
  document.getElementById('ddLikeCount').textContent = _fmtCount(d.likeCount||0);
  document.getElementById('ddDislikeCount').textContent = _fmtCount(d.dislikeCount||0);
}
// Zero is the floor: below it there is nothing to give back, so write the floor
// rather than an increment that would keep digging.
function _decCount(current){
  return current > 0 ? firebase.firestore.FieldValue.increment(-1) : 0;
}
async function likeDare(){
  if (typeof guestCheck === 'function' && guestCheck('like')) return;
  if (!user) { showToast('Sign in to like'); return; }
  const d = dares.find(x=>x.id===_ddCurrentId); if (!d) return;
  d.likedBy = d.likedBy||[]; d.dislikedBy = d.dislikedBy||[];
  const liked = d.likedBy.includes(user.uid);
  const upd = {};
  if (liked){
    // second tap on Like just takes the like back — it never becomes a dislike
    const was = d.likeCount||0;
    d.likedBy = d.likedBy.filter(u=>u!==user.uid); d.likeCount = Math.max(0, was-1);
    upd.likedBy = firebase.firestore.FieldValue.arrayRemove(user.uid); upd.likeCount = _decCount(was);
  } else {
    d.likedBy.push(user.uid); d.likeCount = (d.likeCount||0)+1;
    upd.likedBy = firebase.firestore.FieldValue.arrayUnion(user.uid); upd.likeCount = firebase.firestore.FieldValue.increment(1);
    if (d.dislikedBy.includes(user.uid)){ const wasD = d.dislikeCount||0;
      d.dislikedBy = d.dislikedBy.filter(u=>u!==user.uid); d.dislikeCount = Math.max(0, wasD-1);
      upd.dislikedBy = firebase.firestore.FieldValue.arrayRemove(user.uid); upd.dislikeCount = _decCount(wasD); }
  }
  _ddUpdateLikeUI(d);
  db.collection('dares').doc(d.id).update(upd).catch(()=>{});
}
async function dislikeDare(){
  if (typeof guestCheck === 'function' && guestCheck('like')) return;
  if (!user) { showToast('Sign in to dislike'); return; }
  const d = dares.find(x=>x.id===_ddCurrentId); if (!d) return;
  d.likedBy = d.likedBy||[]; d.dislikedBy = d.dislikedBy||[];
  const disliked = d.dislikedBy.includes(user.uid);
  const upd = {};
  if (disliked){
    const was = d.dislikeCount||0;
    d.dislikedBy = d.dislikedBy.filter(u=>u!==user.uid); d.dislikeCount = Math.max(0, was-1);
    upd.dislikedBy = firebase.firestore.FieldValue.arrayRemove(user.uid); upd.dislikeCount = _decCount(was);
  } else {
    d.dislikedBy.push(user.uid); d.dislikeCount = (d.dislikeCount||0)+1;
    upd.dislikedBy = firebase.firestore.FieldValue.arrayUnion(user.uid); upd.dislikeCount = firebase.firestore.FieldValue.increment(1);
    if (d.likedBy.includes(user.uid)){ const wasL = d.likeCount||0;
      d.likedBy = d.likedBy.filter(u=>u!==user.uid); d.likeCount = Math.max(0, wasL-1);
      upd.likedBy = firebase.firestore.FieldValue.arrayRemove(user.uid); upd.likeCount = _decCount(wasL); }
  }
  _ddUpdateLikeUI(d);
  db.collection('dares').doc(d.id).update(upd).catch(()=>{});
}
// Dare comments reuse the comments collection (proofId = dareId).
// Top-liked first; if a comment has no likes, latest first. Replies nested
// (same sort). Desktop: show ALL. Mobile: top 1 + tap-anywhere/"View all", close btn.
let _ddComments = [];        // ALL comments for the current dare (top-level + replies)
                             // null WHILE loading — the sheet shows a skeleton for that
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
  if (el) el.innerHTML = _skelComments(1);            // card preview shows one
  const _box = document.getElementById('ddBoxList');  // sheet may already be open
  if (_box) _box.innerHTML = _skelComments(4);
  _ddComments = null;                     // null = fetch still out; [] = came back empty
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
      <button class="cmt-act${liked?' liked':''}" data-cmt-like="${c.id}" onclick="event.stopPropagation();likeDareComment('${c.id}')"><span class="mi">thumb_up</span>${likeN>0?' '+_fmtCount(likeN):''}</button>
      <button class="cmt-act" onclick="event.stopPropagation();startDareReply('${c.id}','${safeName}')">Reply</button>
      <span class="cmt-more"><button class="cmt-3dots" onclick="event.stopPropagation();_ddToggleCmtMenu(this)"><span class="mi">more_vert</span></button>
        <span class="cmt-menu">${pinItem}<button onclick="event.stopPropagation();reportComment('${c.id}','${safeName}')"><span class="mi">flag</span> Report</button></span></span>
    </div>`;
  const pinBadge = (c.pinned && replies!==null) ? `<span class="cmt-pinned"><span class="mi">push_pin</span> Pinned</span>` : '';
  // Replies are HIDDEN by default behind a "Show N replies" toggle
  let repToggle = '', repHtml = '';
  if (replies && replies.length){
    [repToggle, repHtml] = _repMarkup(c.id, replies, replies.slice(0, _repShown[c.id] || _REP_PAGE).map(r=>_ddCommentHtml(r,null)).join(''), 'vd-replies');
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
// Which threads the user has expanded. Held OUTSIDE the markup because every
// render rebuilds the HTML from scratch — posting a reply re-rendered the list
// and collapsed the thread you were replying in, so you had to hit "Show
// replies" again every single time.
const _repOpen = new Set();

function _ddToggleReplies(id, btn){
  // The replies div is the button's own next sibling. It used to be looked up
  // with getElementById('reps-'+id), but the dare comment box and the shorts
  // list can both hold the same comment id at once — getElementById returns
  // whichever is first in the DOM, which is why the shorts toggle did nothing.
  const box = btn.nextElementSibling; if (!box) return;
  const show = box.style.display === 'none';
  box.style.display = show ? '' : 'none';
  if (show) _repOpen.add(id);
  else { _repOpen.delete(id); delete _repShown[id]; }   // collapsed → next open starts at 10 again
  const n = box.children.length;
  btn.innerHTML = show
    ? '<span class="mi">expand_less</span> Hide replies'
    : `<span class="mi">expand_more</span> Show ${n} repl${n>1?'ies':'y'}`;
}

// How many replies of a thread are on screen. A thread with 60 replies used to
// dump all 60 the moment it opened; it now shows ten and grows in tens.
const _REP_PAGE = 10;
const _repShown = {};                      // comment id -> replies currently rendered
// Collapse from the bottom button: fold the thread and put the top toggle back
// to its 'Show N replies' state.
function _repHide(id, btn){
  _repOpen.delete(id); delete _repShown[id];
  const box = btn.closest('.vd-replies, .shorts-replies');
  if (box && box.closest('#shortsCommentsList, .shorts-rowcmts')) _renderShortsCommentsList();
  else _renderDareCommentsBox();
}
function _repMore(id, btn){
  _repShown[id] = (_repShown[id] || _REP_PAGE) + _REP_PAGE;
  const box = btn.closest('.vd-replies, .shorts-replies');
  // re-render through whichever list owns this thread
  if (box && box.closest('#shortsCommentsList, .shorts-rowcmts')) _renderShortsCommentsList();
  else _renderDareCommentsBox();
}

// Shared toggle + container markup, so both comment lists respect _repOpen
function _repMarkup(id, replies, inner, cls){
  if (!replies || !replies.length) return ['',''];
  const open = _repOpen.has(id), n = replies.length;
  const label = open ? '<span class="mi">expand_less</span> Hide replies'
                     : `<span class="mi">expand_more</span> Show ${n} repl${n>1?'ies':'y'}`;
  const shown = Math.min(n, _repShown[id] || _REP_PAGE);
  // More to load → a Show button. Everything already on screen and the thread
  // is long enough to have scrolled the top toggle away → a Hide down here too.
  const more = n > shown
    ? `<button class="cmt-repmore" onclick="event.stopPropagation();_repMore('${id}',this)">Show ${Math.min(_REP_PAGE, n-shown)} more repl${(n-shown)>1?'ies':'y'}</button>`
    : (n > _REP_PAGE
        ? `<button class="cmt-repmore cmt-rephide" onclick="event.stopPropagation();_repHide('${id}',this)"><span class="mi">expand_less</span> Hide replies</button>`
        : '');
  return [
    `<button class="cmt-reptoggle" onclick="event.stopPropagation();_ddToggleReplies('${id}',this)">${label}</button>`,
    `<div class="${cls}" id="reps-${id}"${open?'':' style="display:none;"'}>${inner}${more}</div>`
  ];
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
  if (_ddComments === null){ el.innerHTML = _skelComments(4); return; }   // fetch still out
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
  _subOpen('ddCommentsBox');
  const sheet = box.querySelector('.dd-cbox');
  _dockToCol1(sheet, _ddHostOverlayId, true);   // desktop: dock over column 1
  _cboxFit(_ddHostOverlayId);                   // mobile: start at the picture's bottom edge
  _cboxBindGrip(sheet, 'ddCommentsBox', dismissDareComments);
}
function closeDareComments(){                    // plain visual close (page teardown, popstate)
  _subDrop('ddCommentsBox');
  const box = document.getElementById('ddCommentsBox');
  if (box){ box.classList.remove('open'); box.querySelector('.dd-cbox')?.classList.remove('cbox-full'); }
  cancelDareReply();
}
// ✕ / tap-outside — hands the pushed entry back so it never piles up
function dismissDareComments(){ _subDismiss('ddCommentsBox', closeDareComments); }
function _ddToggleCmtMenu(btn){
  const menu = btn.nextElementSibling; if (!menu) return;
  const open = menu.classList.contains('open');
  document.querySelectorAll('.cmt-menu.open').forEach(m=>m.classList.remove('open')); // any container (dd box / shorts)
  if (!open) menu.classList.add('open');
}
async function likeDareComment(commentId){
  if (typeof guestCheck === 'function' && guestCheck('like')) return;
  if (!user){ showToast('Sign in to like'); return; }
  const c = (_ddComments||[]).find(x=>x.id===commentId); if (!c) return;
  c.likedBy = c.likedBy || [];
  const liked = c.likedBy.includes(user.uid);
  if (liked){ c.likedBy = c.likedBy.filter(u=>u!==user.uid); c.likeCount = Math.max(0,(c.likeCount||0)-1); }
  else { c.likedBy.push(user.uid); c.likeCount = (c.likeCount||0)+1; }
  _patchCmtLike(commentId, c);   // patch the one button, don't rebuild the list
  _ddUpdateCount();
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
  if (typeof guestCheck === 'function' && guestCheck('comment')) return;
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
    if (parentId) _repOpen.add(parentId);   // keep the thread you just replied in open
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
  el.innerHTML = `<div class="active-dare-grid">${active.map(d => _activeDareCard(d, true)).join('')}</div>`;
}

function doTrendingSearch(term){document.getElementById('searchInput').value=term;searchType='dares';handleSearchImmediate();}

function enterGuestMode() {
  isGuestMode  = true;
  // A guest may be arriving straight off someone's sign-out, so start from a
  // blank account rather than whatever is still painted.
  user = null;
  _clearAccountUI();
  _wantsAuthScreen = false;

  // Show app, hide auth
  document.getElementById('authScreen').style.display  = 'none';
  document.getElementById('appScreen').style.display   = 'block';
  _setTopbarMode('guest');

  _clearGuestSession();   // nothing to run on a clock any more

  // Load dares (public read — no auth needed for Firestore read)
  startDaresListener();
  AdManager.initScrollAds();
  _bootRoute();   // respect a shared deep link (/watch/...) instead of always landing home
}

// Banned accounts can still sign in and read — they simply cannot add anything.
// Security rules are what actually stop the write; this exists so the person is
// told why rather than watching a button do nothing.
function bannedCheck(){
  if (!user || !user.banned) return false;
  showToast(user.bannedReason
    ? 'Your account is suspended: ' + user.bannedReason
    : 'Your account is suspended and cannot post or accept missions.');
  return true;
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
  _wantsAuthScreen = true;   // asked for this screen — do not bounce back to guest
  closeGuestPrompt();
  document.getElementById('appScreen').style.filter     = '';
  document.getElementById('appScreen').style.pointerEvents = '';
  document.getElementById('appScreen').style.display    = 'none';
  document.getElementById('authScreen').style.display   = 'flex';
  switchTab(tab || 'login');
}

async function loadComments(proofId) {
  commentsProofId=proofId;
  // #vdComments no longer exists — the watch page shares the mission comment
  // sheet (see _ddHostOverlayId). Kept working, but it must not throw if revived.
  const el=document.getElementById('vdComments'); const cnt=document.getElementById('vdCommentCount');
  if(!el) return;
  el.innerHTML=_skelComments(4);
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
  // thumbnail flies into the player box; the video loads underneath it below
  _heroOpen(vov, vov.querySelector('.vd2-player-wrap'));
  _vdBindScroll();
  _vpInit();                            // our control bar replaces the browser's
  _vdSyncPaused();                      // badge on from the start; the play event hides it after 5s
  _ddBindSwipe('videoDetailOverlay');   // swipe-left opens Description & rules here too
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
      <span class="mi" style="font-size:48px;color:#fff;">bolt</span>
      <div class="vd-ad-title">Misnivo</div>
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

let _expSearches = [];        // last known trending searches, so a tab switch repaints instantly

async function renderExplorer() {
  const container=document.getElementById('explorerContent'); if(!container) return;

  // 1) INSTANT paint from whatever we already have — this session's memory, else
  //    the local IndexedDB cache. Explore was the one feed with no cache-first
  //    path: a direct refresh waited on a cold network round trip (no timeout),
  //    while arriving from home was instant because home had filled allProofs.
  let cancelSkel = () => {};
  if (typeof allProofs!=='undefined' && allProofs.length) {
    _explorerPaint();
  } else {
    cancelSkel = _skelAfter(container, _skelFeed('explore'));
    try {
      const c = await db.collection('proofs').where('status','==','approved').limit(100).get({source:'cache'});
      if (!c.empty){ allProofs = c.docs.map(d=>({id:d.id,...d.data()})); cancelSkel(); _explorerPaint(); }
    } catch(e){}
  }

  // 2) REFRESH from the server in the background (stale-while-revalidate)
  try {
    const snap=await db.collection('proofs').where('status','==','approved').limit(100).get();
    allProofs=snap.docs.map(doc=>({id:doc.id,...doc.data()}));
    try{const ss=await db.collection('searches').orderBy('count','desc').limit(10).get();_expSearches=ss.docs.map(d=>d.data());}catch(_){}
    cancelSkel();
    _explorerPaint();
  }catch(e){
    cancelSkel();
    // only surface the error if there is nothing on screen to keep
    if(!(typeof allProofs!=='undefined' && allProofs.length))
      container.innerHTML=`<div class="empty"><span class="mi">error_outline</span><div class="empty-title">Error loading trending</div><p class="empty-desc">${e.message}</p></div>`;
  }
}

// The cache paint and the server paint both rewrote the container, so every
// image was destroyed and re-created a second time — which is the double blink.
// If the second paint would draw exactly the same thing, don't draw it.
let _expSig = '', _expSearchSig = '';
// The trending rows on their own, so the second fetch can refresh just them
// instead of rewriting the container and rebuilding every thumbnail with it.
function _expSearchRows(){
  const t = _expSearches || [];
  if (!t.length) return '<div class="exp-empty">Search for something to start tracking!</div>';
  return t.map((s,i)=>`<div class="trending-search-row" onclick="doTrendingSearch('${escHtml(s.term||'')}')"><span class="trending-rank">${i<3?['🥇','🥈','🥉'][i]:'#'+(i+1)}</span><span class="trending-term">${escHtml(s.term||'')}</span><span class="trending-count">${(s.count||0).toLocaleString('en-IN')} searches</span><span class="mi" style="color:var(--t4);margin-left:auto;font-size:14px;">arrow_forward_ios</span></div>`).join('');
}
function _explorerPaint(){
    const container=document.getElementById('explorerContent'); if(!container) return;
    // Two signatures on purpose. The trending list arrives on a SECOND fetch, so
    // it is normally the only thing that differs between the cache paint and the
    // server paint — and rewriting the whole container for it threw away and
    // rebuilt every thumbnail, which is the double blink. Swap just that list.
    const contentSig = activeExpTab
      + '|' + (allProofs||[]).map(p=>p.id+':'+(p.viewCount||0)+':'+(p.likeCount||0)).join(',')
      + '|' + (dares||[]).filter(d=>!d.completed).map(d=>d.id+':'+(d.takers||0)).join(',');
    const searchSig = (_expSearches||[]).map(s=>s.term+':'+s.count).join(',');
    if (contentSig === _expSig && container.children.length) {
      if (searchSig !== _expSearchSig) {
        _expSearchSig = searchSig;
        const list = document.getElementById('expSearchList');
        if (list) list.innerHTML = _expSearchRows();
      }
      return;                                   // images stay exactly where they are
    }
    _expSig = contentSig; _expSearchSig = searchSig;
    const topSearches = _expSearches;
    const mostViewed  =[...allProofs].sort((a,b)=>(b.viewCount||0)-(a.viewCount||0)).slice(0,12);
    const mostAccepted=[...dares].filter(d=>!d.completed).sort((a,b)=>(b.takers||0)-(a.takers||0)).slice(0,6);
    const mostLiked   =[...allProofs].sort((a,b)=>(b.likeCount||0)-(a.likeCount||0)).slice(0,12);
    const showAll=activeExpTab==='all';
    container.innerHTML=`
      ${showAll||activeExpTab==='viewed'?`<div class="exp-section"><div class="exp-sec-hdr"><span class="exp-fire"></span><div><div class="exp-sec-title">Most Viewed Today</div><div class="exp-sec-sub">Top taker videos</div></div></div>${_mixedVideoFeedHtml(mostViewed,'Complete missions to see videos here!')}</div>`:''}
      ${showAll||activeExpTab==='accepted'?`<div class="exp-section"><div class="exp-sec-hdr"><span class="exp-fire"></span><div><div class="exp-sec-title">Most Accepted Missions</div><div class="exp-sec-sub">Missions everyone wants to try</div></div></div>${mostAccepted.length?`<div class="active-dare-grid">${mostAccepted.map(d=>_explorerDareCard(d)).join('')}</div>`:`<div class="exp-empty">No active missions!</div>`}</div>`:''}
      ${showAll||activeExpTab==='liked'?`<div class="exp-section"><div class="exp-sec-hdr"><span class="exp-fire"></span><div><div class="exp-sec-title">Most Liked Videos</div><div class="exp-sec-sub">Community favorites</div></div></div>${_mixedVideoFeedHtml(mostLiked.filter(p=>(p.likeCount||0)>0),'Like videos to see them here!')}</div>`:''}
      ${showAll||activeExpTab==='searched'?`<div class="exp-section"><div class="exp-sec-hdr"><span class="exp-fire"></span><div><div class="exp-sec-title">Trending Searches</div><div class="exp-sec-sub">What people are looking for</div></div></div><div class="trending-searches-list" id="expSearchList">${_expSearchRows()}</div></div>`:''}`;
}

function setSearchType(type) {
  searchType=type;
  _sCloseResMenu();
  const q=(document.getElementById('searchInput').value||'').toLowerCase().trim();
  if (q) _doSearch(q);
}

// ── Results-page ⋮ menu (mobile): All · Missions · Videos · Filters ──
function _sToggleResMenu(){
  const m = document.getElementById('tsrMenu'); if (!m) return;
  m.classList.toggle('open');
  _sSyncTypeMenu();
}
function _sCloseResMenu(){ document.getElementById('tsrMenu')?.classList.remove('open'); }
function _sSyncTypeMenu(){
  ['all','dares','videos'].forEach(t => {
    document.getElementById('tsrMi-'+t)?.classList.toggle('active', searchType === t);
  });
}
function _sMenuFilters(){ _sCloseResMenu(); openSearchFilters(); }
// The results field is a display only — tapping ✕ goes back to the search page
function _searchClear(){
  const inp = document.getElementById('searchInput'); if (inp) inp.value = '';
  openMobileSearch();
}
document.addEventListener('click', e => {
  if (!e.target.closest || !e.target.closest('.tsr-menu-wrap')) _sCloseResMenu();
});

function showGuestPrompt(info, dismissible) {
  // info.icon is one of our own constants above, never user text
  document.getElementById('guestPromptIcon').innerHTML =
    '<span class="mi">' + String(info.icon || 'lock').replace(/[^a-z_]/g,'') + '</span>';
  document.getElementById('guestPromptTitle').textContent = info.title;
  document.getElementById('guestPromptMsg').textContent   = info.msg;
  const dismissBtn = document.getElementById('guestPromptDismiss');
  dismissBtn.style.display = dismissible ? 'block' : 'none';
  const _gp = document.getElementById('guestPrompt');
  _gp.style.display = 'flex';
  // Tracked, so the phone back button dismisses it instead of navigating away.
  // No URL of its own — it is a nudge, not a place — so _ovOpen keeps the
  // current path and only pushes the entry that back needs.
  _ovOpen('guestPrompt');
}

const NOTIF_PAGE = 30;
let _notifLastDoc = null;      // cursor for "load older"
let _notifMore    = false;     // is there another page?
let _notifCountUnsub = null;

function startNotificationsListener() {
  if (!user) return;
  if (notifUnsub) notifUnsub();
  notifLoaded = false; _notifLastDoc = null; _notifMore = false;

  notifUnsub = db.collection('notifications')
    .where('toUserId','==',user.uid).orderBy('createdAt','desc').limit(NOTIF_PAGE)
    .onSnapshot(snap=>{
      notifications = snap.docs.map(doc=>({id:doc.id,...doc.data()}));
      _notifLastDoc = snap.docs.length ? snap.docs[snap.docs.length-1] : null;
      _notifMore    = snap.docs.length === NOTIF_PAGE;
      notifUnread   = notifications.filter(n=>!n.read).length;
      notifLoaded   = true;
      _updateNotifBadge();
      if (document.getElementById('notifPanel')?.classList.contains('open')) _renderNotifications();
    },()=>{ notifLoaded = true; _renderNotifications(); });   // error → drop the skeleton, don't spin forever

  // The badge used to be counted from the loaded page only, so it capped out and
  // lied past 30 unread. Cloud Functions keep a real counter on the user doc.
  if (_notifCountUnsub) _notifCountUnsub();
  _notifCountUnsub = db.collection('users').doc(user.uid)
    .onSnapshot(d=>{
      const c = d.exists ? d.data().unreadCount : null;
      if (typeof c === 'number'){ notifUnread = Math.max(0, c); _updateNotifBadge(); }
    },()=>{});

  _registerPushToken();
}

// Older notifications, one page at a time (the live listener only holds 30).
async function loadMoreNotifications(){
  if (!user || !_notifLastDoc) return;
  const btn = document.getElementById('notifMoreBtn');
  if (btn){ btn.disabled = true; btn.textContent = 'Loading…'; }
  try{
    const snap = await db.collection('notifications')
      .where('toUserId','==',user.uid).orderBy('createdAt','desc')
      .startAfter(_notifLastDoc).limit(NOTIF_PAGE).get();
    notifications = notifications.concat(snap.docs.map(d=>({id:d.id,...d.data()})));
    if (snap.docs.length) _notifLastDoc = snap.docs[snap.docs.length-1];
    _notifMore = snap.docs.length === NOTIF_PAGE;
  }catch(e){ _notifMore = false; }
  _renderNotifications();
}

// ── Web push (FCM) ──────────────────────────────────────────────────────────
// Tokens live in users/{uid}/tokens/{token}, which only the owner can write and
// only Cloud Functions read — they are not on the world-readable user document.
const FCM_VAPID_KEY = '';   // ← Firebase console → Cloud Messaging → Web Push certificates

async function _registerPushToken(){
  try{
    if (!user || !FCM_VAPID_KEY) return;                       // not configured yet
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return;
    if (!firebase.messaging || !firebase.messaging.isSupported) return;
    if (!(await firebase.messaging.isSupported())) return;
    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'default'){
      if ((await Notification.requestPermission()) !== 'granted') return;
    }
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: FCM_VAPID_KEY, serviceWorkerRegistration: reg });
    if (!token) return;

    await db.collection('users').doc(user.uid).collection('tokens').doc(token)
      .set({ createdAt: firebase.firestore.FieldValue.serverTimestamp(),
             ua: (navigator.userAgent||'').slice(0,160) }, { merge:true });

    // Foreground: the OS banner is suppressed, so surface it in-app instead
    messaging.onMessage(p => {
      const n = (p && p.notification) || {};
      if (n.title) showToast(n.title);
    });
  }catch(e){ /* push is a bonus — never let it break sign-in */ }
}

async function submitComment() {
  if (typeof guestCheck === 'function' && guestCheck('comment')) return;
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
    // Recount for the badge. This used to download EVERY comment on the video
    // after each new one — on a video with a thousand comments, a thousand
    // documents fetched to learn a single number, once per comment posted.
    // Bounded; past 500 the badge stops climbing, which is a badge being
    // slightly wrong rather than a page pulling the collection down.
    const snap=await db.collection('comments').where('proofId','==',commentsProofId).limit(500).get();
    const total = snap.size;
    db.collection('proofs').doc(commentsProofId).update({commentCount:total}).catch(()=>{});
    const p=homeProofs.find(x=>x.id===commentsProofId)||allProofs.find(x=>x.id===commentsProofId);
    if(p) await _checkCommentMilestone(commentsProofId,total,p.takerId,p.dareTitle);
  }catch(e){showToast('Could not post comment — try again');}
}

function switchExpTab(el,tab) {
  activeExpTab=tab;
  document.querySelectorAll('.exp-tab').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  renderExplorer();
}

async function toggleLike(proofId) {
  if (typeof guestCheck === 'function' && guestCheck('like')) return;
  if(!proofId) return;
  if(!user){showToast('Please sign in to like');return;}
  const isLiked=userLikes.includes(proofId);
  const p=homeProofs.find(x=>x.id===proofId)||allProofs.find(x=>x.id===proofId);
  let newCount=0;
  if(isLiked){
    userLikes=userLikes.filter(id=>id!==proofId);
    const _wasL=p?(p.likeCount||0):1;
    if(p){p.likeCount=Math.max(0,_wasL-1);newCount=p.likeCount;}
    db.collection('proofs').doc(proofId).update({likeCount:_decCount(_wasL)}).catch(()=>{});
  } else {
    userLikes.push(proofId);
    if(p){p.likeCount=(p.likeCount||0)+1;newCount=p.likeCount;}
    db.collection('proofs').doc(proofId).update({likeCount:firebase.firestore.FieldValue.increment(1)})
      .then(()=>_checkLikeMilestone(proofId,newCount,p?.takerId,p?.dareTitle)).catch(()=>{});
    // mutually exclusive: liking clears an existing dislike
    if(p && (p.dislikedBy||[]).includes(user.uid)){
      const _wasD=p.dislikeCount||0;
      p.dislikedBy=p.dislikedBy.filter(u=>u!==user.uid);
      p.dislikeCount=Math.max(0,_wasD-1);
      db.collection('proofs').doc(proofId).update({dislikedBy:firebase.firestore.FieldValue.arrayRemove(user.uid),dislikeCount:_decCount(_wasD)}).catch(()=>{});
      if(activeProof && activeProof.id===proofId) _vdUpdateDislikeUI(p);
    }
  }
  _privRef(user.uid).set({likedProofs:userLikes}, { merge:true }).catch(()=>{});
  _updateLikeBtn(proofId,newCount);
}

function toggleNotifPanel() {
  const panel=document.getElementById('notifPanel'); if(!panel) return;
  if (panel.classList.contains('open')) { closeNotifPanel(); return; }

  panel.classList.add('open');
  document.body.classList.add('notif-open');
  _renderNotifications();
  // one history entry per open → on mobile (full page) the phone back closes it
  if (!_notifPushed) _notifPushed = _dmPush();

  // Mark-as-read in ONE batched write instead of N separate updates
  const unread = notifications.filter(n=>!n.read);
  if (unread.length){
    try{
      const batch = db.batch();
      unread.forEach(n => batch.update(db.collection('notifications').doc(n.id), { read:true }));
      batch.commit().catch(()=>{});
    }catch(e){
      unread.forEach(n=>db.collection('notifications').doc(n.id).update({read:true}).catch(()=>{}));
    }
  }
  notifUnread=0; _updateNotifBadge();
}

// ═══════════════════════════════════════════════════════════════════
// VERTICAL CLIP PLAYER
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
  // the tapped thumbnail expands into the full-height player
  const _sStage = document.querySelectorAll('#shortsSnapContainer .shorts-snap-item')[shortsIndex];
  _heroOpen(document.getElementById('shortsOverlay'),
            (_sStage && _sStage.querySelector('.shorts-snap-video')) || document.getElementById('shortsSnapContainer'));
}

function closeShorts() {
  const ov = document.getElementById('shortsOverlay');
  if (typeof shortsCloseMenu === 'function') shortsCloseMenu();
  _shortsSpeedIdx = 3;                       // speed is per sitting, not per video
  ov.classList.remove('open', 'comments-open');
  shortsCloseDetails();
  document.body.style.overflow = '';
  document.body.classList.remove('shorts-open');
  _shortsKillVideos();
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
        onclick="_shortsTap(this)" ontimeupdate="shortsSlideOnTime(this)"
        onpause="_shortsSlideSyncIcons(this)" onplay="_shortsSlideSyncIcons(this)"></video>
      <button class="shorts-center-play" onclick="shortsSlideTogglePlay(this)" aria-label="Play"><span class="mi">play_arrow</span></button>
      <span class="shorts-dbl-heart"><span class="mi">bolt</span></span>

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
        <button class="shorts-act shorts-dislike-btn ${(user && (p.dislikedBy||[]).includes(user.uid))?'liked':''}" onclick="shortsDislikeSlide('${p.id}', this)"><span class="mi">thumb_down</span></button>
        <span class="shorts-act-lbl shorts-dislike-count">${_fmtCount(p.dislikeCount || 0)}</span>
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
          <input class="vd-comment-input" id="rowinp-${p.id}" placeholder="Add a comment..." maxlength="500" autocomplete="off" autocorrect="off" enterkeyhint="send"
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
  try{ history.replaceState({ dm:'shorts', id:p.id }, '', '/clips/'+encodeURIComponent(p.id)); }catch(e){}

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
  _subOpen('shortsDetailsDrawer');
}
function shortsCloseDetails(){ _subDrop('shortsDetailsDrawer'); document.getElementById('shortsDetailsDrawer')?.classList.remove('open'); }
function dismissShortsDetails(){ _subDismiss('shortsDetailsDrawer', shortsCloseDetails); }
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
    else if(dx>0 && open) dismissShortsDetails();
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
  if (typeof guestCheck==='function' && guestCheck('like')) return;
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
  it.classList.toggle('is-paused', !!v.paused);   // drives the big centre play badge
}

// Single tap = play/pause, double tap = like. 260ms is the usual gap between
// the two taps of a double, so a single tap waits that long before acting.
let _shTapTO = null, _shTapAt = 0;
function _shortsTap(v){
  const now = Date.now();
  if (now - _shTapAt < 260){                     // second tap -> it was a double
    clearTimeout(_shTapTO); _shTapAt = 0;
    const it = v.closest('.shorts-snap-item'); if (!it) return;
    const btn = it.querySelector('.shorts-like-btn');
    const pid = it.dataset.proofId;   // the slide carries data-proof-id
    if (pid && btn && !(typeof userLikes !== 'undefined' && userLikes.includes(pid))) shortsLikeSlide(pid, btn);
    const h = it.querySelector('.shorts-dbl-heart');
    if (h){ h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop'); }
    return;
  }
  _shTapAt = now;
  _shTapTO = setTimeout(function(){ _shTapAt = 0; shortsSlideTogglePlay(v); }, 260);
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
  if (typeof guestCheck === 'function' && guestCheck('like')) return;
  if (typeof toggleLike === 'function') await toggleLike(proofId);
  const p = (allProofs.find(x=>x.id===proofId)) || (homeProofs.find(x=>x.id===proofId));
  btn.classList.toggle('liked', (typeof userLikes!=='undefined') && userLikes.includes(proofId));
  const it = btn.closest('.shorts-snap-item');
  const lc = it ? it.querySelector('.shorts-like-count') : null;
  if (lc && p) lc.textContent = _fmtCount(p.likeCount || 0);
  _shortsSyncVote(it, p);
}

// The rail's dislike was a stub -- onclick="showToast('Disliked')" -- so it never
// wrote anything anywhere. Real toggle now, and the two are mutually exclusive in
// BOTH directions (toggleLike already dropped a dislike; nothing dropped a like).
async function shortsDislikeSlide(proofId, btn){
  if (typeof guestCheck === 'function' && guestCheck('like')) return;
  if (!user){ showToast('Sign in to dislike'); return; }
  const p = (allProofs.find(x=>x.id===proofId)) || (homeProofs.find(x=>x.id===proofId));
  if (!p) return;
  p.dislikedBy = p.dislikedBy || [];
  const had = p.dislikedBy.includes(user.uid);
  // shorts writes the same proof docs the video page reads, so it needs the
  // same floor — otherwise a count repaired here comes back negative from there
  const _wasD = p.dislikeCount||0;
  if (had){ p.dislikedBy = p.dislikedBy.filter(u=>u!==user.uid); p.dislikeCount = Math.max(0,_wasD-1); }
  else    { p.dislikedBy.push(user.uid);                         p.dislikeCount = _wasD+1; }
  db.collection('proofs').doc(proofId).update({
    dislikedBy: had ? firebase.firestore.FieldValue.arrayRemove(user.uid) : firebase.firestore.FieldValue.arrayUnion(user.uid),
    dislikeCount: had ? _decCount(_wasD) : firebase.firestore.FieldValue.increment(1)
  }).catch(()=>{});
  if (!had && typeof userLikes !== 'undefined' && userLikes.includes(proofId)){
    userLikes = userLikes.filter(id => id !== proofId);
    const _wasL = p.likeCount||0; p.likeCount = Math.max(0,_wasL-1);
    db.collection('proofs').doc(proofId).update({ likeCount: _decCount(_wasL) }).catch(()=>{});
    _privRef(user.uid).set({ likedProofs:userLikes }, { merge:true }).catch(()=>{});
  }
  _shortsSyncVote(btn.closest('.shorts-snap-item'), p);
}

function _shortsSyncVote(it, p){
  if (!it || !p) return;
  const liked    = typeof userLikes !== 'undefined' && userLikes.includes(p.id);
  const disliked = !!(user && (p.dislikedBy||[]).includes(user.uid));
  const lb = it.querySelector('.shorts-like-btn');      if (lb) lb.classList.toggle('liked', liked);
  const dbn = it.querySelector('.shorts-dislike-btn');  if (dbn) dbn.classList.toggle('liked', disliked);
  const lc = it.querySelector('.shorts-like-count');    if (lc) lc.textContent = _fmtCount(p.likeCount || 0);
  const dc = it.querySelector('.shorts-dislike-count'); if (dc) dc.textContent = _fmtCount(p.dislikeCount || 0);
}
function shortsOpenMenu(proofId){
  const menu = document.getElementById('shortsMenu');
  if (menu.classList.contains('open')){ shortsCloseMenu(); return; }
  const p = (allProofs.find(x=>x.id===proofId)) || (homeProofs.find(x=>x.id===proofId)); if (!p) return;
  _shortsBuildMenu(p);
  _shortsPlaceMenu();
  menu.classList.add('open');
  _shortsSetDotsIcon(true);
  _shortsLockFeed(true);          // the sheet belongs to THIS short — hold the feed still
}
// Beside the dots that opened it, inside the player — not parked in a corner.
function _shortsPlaceMenu(){
  const menu = document.getElementById('shortsMenu'); if (!menu) return;
  const items = document.querySelectorAll('#shortsSnapContainer .shorts-snap-item');
  const dots = items[shortsIndex] && items[shortsIndex].querySelector('.shorts-dots');
  if (!dots){ menu.style.cssText = ''; return; }
  // anchored by its right edge, so the menu's own width never has to be guessed
  const r = dots.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
  menu.style.left  = 'auto';
  menu.style.top   = (r.bottom + 8) + 'px';
  menu.style.bottom = 'auto';
  menu.style.maxHeight = Math.max(200, window.innerHeight - r.bottom - 24) + 'px';
  menu.style.overflowY = 'auto';
  menu.style.zIndex = '2147483000';
}
function shortsCloseMenu(){
  const menu = document.getElementById('shortsMenu'); if (!menu) return;
  menu.classList.remove('open');
  menu.style.cssText = '';
  _shortsSetDotsIcon(false);
  _shortsLockFeed(false);
}
// Scrolling away while the sheet is open was the bug: the sheet stayed, but it
// was still wired to the short you opened it on, so the next change landed on a
// video you were no longer watching. YouTube simply does not let the feed move.
function _shortsLockFeed(lock){
  const c = document.getElementById('shortsSnapContainer'); if (!c) return;
  c.style.overflowY = lock ? 'hidden' : '';
  c.style.scrollSnapType = lock ? 'none' : '';
}
function shortsOpenComments(proofId){
  const ov = document.getElementById('shortsOverlay');
  ov.dataset.proofId = proofId;
  const p = (allProofs.find(x=>x.id===proofId)) || (homeProofs.find(x=>x.id===proofId));
  if (p) ov.dataset.takerId = p.takerId || '';
  shortsCommentsOpen = true;
  ov.classList.add('comments-open');
  _cboxBindGrip(ov.querySelector('.shorts-comments'), 'shortsOverlay', shortsToggleComments);
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
  _shortsMenuP = p;
  const _sp = _SHORTS_SPEEDS[_shortsSpeedIdx];
  document.getElementById('shortsMenuBody').innerHTML = `
    <button class="shorts-menu-action" onclick="event.stopPropagation();_shortsMenuSpeed()"><span class="mi">speed</span> Playback speed <span class="vp-menu-val">${_sp===1?'Normal':_sp+'×'}</span></button>
    <button class="shorts-menu-action" onclick="event.stopPropagation();_shortsMenuQuality()"><span class="mi">tune</span> Quality <span class="vp-menu-val" id="shortsQLbl">${_vqLabel()}</span></button>
    <button class="shorts-menu-action" onclick="event.stopPropagation();shortsToggleAutoScroll()"><span class="mi">smart_display</span> Auto-scroll <span class="vp-menu-val" id="shortsAutoLbl">${_shortsAutoScroll?'On':'Off'}</span></button>
    <button class="shorts-menu-action" onclick="event.stopPropagation();shortsPiP()"><span class="mi">picture_in_picture_alt</span> Picture-in-picture</button>
    <button class="shorts-menu-report" onclick="event.stopPropagation();openReportModal('proof','${p.id}')"><span class="mi">flag</span> Report</button>
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
const _SHORTS_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];   // same ladder as the long player
let _shortsSpeedIdx = 3;                                            // → Normal
let _shortsAutoScroll = false;
function shortsToggleAutoScroll(){
  _shortsAutoScroll = !_shortsAutoScroll;
  const lbl = document.getElementById('shortsAutoLbl'); if (lbl) lbl.textContent = _shortsAutoScroll ? 'On' : 'Off';
  showToast(_shortsAutoScroll ? 'Auto-scroll on — next short plays automatically' : 'Auto-scroll off');
  const v = _shortsCurrentVideo(); if (v){ v.loop = !_shortsAutoScroll; }
}
let _shortsMenuP = null;
function _shortsMenuRoot(){ if (_shortsMenuP) _shortsBuildMenu(_shortsMenuP); }
// Submenus, not a cycling label — the same shape the long player's ⋮ uses.
function _shortsMenuSpeed(){
  const body = document.getElementById('shortsMenuBody'); if (!body) return;
  const cur = _SHORTS_SPEEDS[_shortsSpeedIdx];
  body.innerHTML = '<button class="shorts-menu-action vp-menu-back" onclick="event.stopPropagation();_shortsMenuRoot()"><span class="mi">arrow_back</span> Playback speed</button>'
    + _SHORTS_SPEEDS.map(s =>
        '<button class="shorts-menu-action' + (s === cur ? ' sel' : '') + '" onclick="event.stopPropagation();_shortsSetSpeed(' + s + ')">'
        + '<span class="mi">' + (s === cur ? 'check' : 'speed') + '</span> '
        + (s === 1 ? 'Normal' : s + '×') + '</button>').join('');
}
function _shortsSetSpeed(s){
  _shortsSpeedIdx = Math.max(0, _SHORTS_SPEEDS.indexOf(s));
  const v = _shortsCurrentVideo(); if (v) v.playbackRate = s;
  _shortsMenuRoot();
  // no toast: the menu already shows the tick against what you picked
}
function _shortsMenuQuality(){
  const body = document.getElementById('shortsMenuBody'); if (!body) return;
  const v = _shortsCurrentVideo();
  let opts = [1080, 720, 480, 360];
  if (v && v._hls && v._hls.levels && v._hls.levels.length){
    const set = [...new Set(v._hls.levels.map(L=>Math.min(L.width||0, L.height||0) || L.height || 0))].filter(Boolean);
    if (set.length) opts = set.sort((a,b)=>b-a);
  }
  const cur = String(_vqPref);
  const row = (val, lbl) =>
    '<button class="shorts-menu-action' + (cur === String(val) ? ' sel' : '') + '" onclick="event.stopPropagation();_shortsSetQuality(\'' + val + '\')">'
    + '<span class="mi">' + (cur === String(val) ? 'check' : (val === 'auto' ? 'autorenew' : 'high_quality')) + '</span> '
    + lbl + '</button>';
  body.innerHTML = '<button class="shorts-menu-action vp-menu-back" onclick="event.stopPropagation();_shortsMenuRoot()"><span class="mi">arrow_back</span> Quality</button>'
    + row('auto', 'Auto') + opts.map(o => row(o, o + 'p')).join('');
}
function _shortsSetQuality(val){
  _vqTarget = _shortsCurrentVideo();
  if (typeof _vqChoose === 'function') _vqChoose(val);
  _shortsMenuRoot();
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
  if (guestCheck('like')) return;
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
  const sheet = ov.querySelector('.shorts-comments');
  if (sheet && !shortsCommentsOpen) sheet.classList.remove('cbox-full');
  if (shortsCommentsOpen) {
    _cboxBindGrip(sheet, 'shortsOverlay', shortsToggleComments);
    const pid = ov.dataset.proofId;
    loadShortsComments(pid);
  }
}

let _shortsComments = [];
let _shortsCommentsProofId = null;

// quiet = we already have this proof's comments on screen; refresh underneath
// instead of blanking to 'Loading...'. Posting a comment called this and the
// whole list flashed away and back every time.
async function loadShortsComments(proofId, quiet) {
  const box = document.getElementById('shortsCommentsList');
  if (box && !quiet) box.innerHTML = _skelComments(4);
  try {
    const snap = await db.collection('comments').where('proofId','==',proofId).limit(80).get();
    _shortsComments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    _shortsCommentsProofId = proofId;
    _renderShortsCommentsList();
  } catch(e) {
    if (box && !quiet) box.innerHTML = '<div style="color:var(--t3);text-align:center;padding:20px;">Could not load comments</div>';
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
    [repToggle, repHtml] = _repMarkup(c.id, replies, replies.slice(0, _repShown[c.id] || _REP_PAGE).map(r=>_shortsReplyHtml(r)).join(''), 'shorts-replies');
  }
  return `<div class="shorts-comment ${c.pinned?'pinned':''}">
    <div class="shorts-comment-av">${_avHtml(c.userPhotoURL, c.userName)}</div>
    <div class="shorts-comment-body">
      ${c.pinned?'<span class="cmt-pinned"><span class="mi">push_pin</span> Pinned</span>':''}
      <div class="shorts-comment-head">@${escHtml(c.userName||'user')}</div>
      <div class="shorts-comment-text">${escHtml(c.text||'')}</div>
      <div class="shorts-comment-acts vd-comment-acts">
        <button class="cmt-act ${liked?'liked':''}" data-cmt-like="${c.id}" onclick="likeComment('${c.id}')"><span class="mi">thumb_up</span>${likeN>0?' '+_fmtCount(likeN):''}</button>
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
        <button class="cmt-act ${liked?'liked':''}" data-cmt-like="${c.id}" onclick="likeComment('${c.id}')"><span class="mi">thumb_up</span>${likeN>0?' '+_fmtCount(likeN):''}</button>
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
  if (guestCheck('comment')) return;
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
  if (parentId) _repOpen.add(parentId);     // keep the thread you just replied in open
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
    // show it straight away, then reconcile with the server without a flash
    _shortsComments = (_shortsComments || []).concat([{
      id: 'tmp_' + Date.now(), proofId: pid, userId: user.uid, userName: user.name || 'user',
      userPhotoURL: user.picture || '', text, likes: 0, likeCount: 0, likedBy: [], parentId,
      pinned: false, createdAt: firebase.firestore.Timestamp.now()
    }]);
    _renderShortsCommentsList();
    loadShortsComments(pid, true);
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
// Anything outside the sheet closes it — the ✕ inside it and the dots that
// opened it are the two exceptions.
document.addEventListener('click', e => {
  const m = document.getElementById('shortsMenu');
  if (!m || !m.classList.contains('open')) return;
  if (e.target.closest && (e.target.closest('#shortsMenu') || e.target.closest('.shorts-dots'))) return;
  shortsCloseMenu();
});
function shortsToggleMenu() {
  const m = document.getElementById('shortsMenu');
  if (m.classList.contains('open')) { shortsCloseMenu(); return; }
  _shortsPlaceMenu();
  m.classList.add('open'); _shortsSetDotsIcon(true); _shortsLockFeed(true);
}
// Toggle the 3-dots icon → "close" (X) while the menu is open
function _shortsSetDotsIcon(open){
  const icon = open ? 'close' : 'more_vert';
  document.querySelectorAll('.shorts-dots .mi').forEach(el=>el.textContent=icon);
  const more = document.querySelector('#shortsFxMoreBtn .mi'); if (more) more.textContent = icon;
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
  if (!WALLET_ENABLED) return;   // paused: nothing is written to the wallet field
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
  if (user) _privRef().set({ wallet }, { merge:true }).catch(()=>{});
}

// Auto-refund: your own dares that expired without being completed → bounty back
async function _walletReconcileExpired(){
  if (!WALLET_ENABLED) return false;          // no refunds to reconcile while paused
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
  if (changed) _privRef().set({ wallet }, { merge:true }).catch(()=>{});
  return changed;
}

function renderWallet() {
  if (!WALLET_ENABLED) return;
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
  if (!WALLET_ENABLED) return;
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
  if (!WALLET_ENABLED) return;
  if(!user){ showToast('Sign in first'); return; }
  const inp=document.getElementById('depositAmt'); if(inp) inp.value='';
  const chips=document.getElementById('depositChips');
  if(chips) chips.innerHTML=[500,1000,5000,10000].map(a=>`<button class="wchip" onclick="document.getElementById('depositAmt').value=${a}">+Rs.${a.toLocaleString('en-IN')}</button>`).join('');
  _ovOpen('depositOverlay');
  setTimeout(()=>inp&&inp.focus(),50);
}
function doDeposit(){
  if (!WALLET_ENABLED) return;
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
  if (!WALLET_ENABLED) return;
  if(!user){ showToast('Sign in first'); return; }
  const inp=document.getElementById('withdrawAmt'); if(inp) inp.value='';
  const av=document.getElementById('withdrawAvail'); if(av) av.textContent='Available: Rs. '+(wallet.balance||0).toLocaleString('en-IN');
  _ovOpen('withdrawOverlay');
  setTimeout(()=>inp&&inp.focus(),50);
}
function doWithdraw(){
  if (!WALLET_ENABLED) return;
  const amt=Math.floor(+document.getElementById('withdrawAmt').value||0);
  if(amt<=0){ showToast('Enter a valid amount'); return; }
  if(amt>(wallet.balance||0)){ showToast('Insufficient available balance'); return; }
  if(((wallet.kyc&&wallet.kyc.status)||'none')!=='verified'){ closeWalletModal('withdrawOverlay'); showToast('Complete KYC to withdraw'); openKycModal(); return; }
  if(!(wallet.methods||[]).length){ closeWalletModal('withdrawOverlay'); showToast('Add a bank/UPI account first'); openMethodModal(); return; }
  const exec=()=>_executeWithdraw(amt);
  if(wallet.pin){ closeWalletModal('withdrawOverlay'); _pinVerify(exec); } else exec();
}
function _executeWithdraw(amt){
  if (!WALLET_ENABLED) return;
  wallet.balance-=amt;
  const tx={ id:'w'+Date.now()+Math.floor(Math.random()*1000), ts:Date.now(), status:'processing',
    type:'debit', category:'withdraw', title:'Withdrawal to '+((wallet.methods||[])[0]?.label||'bank'), amount:amt,
    ref:'REF'+Date.now().toString(36).toUpperCase(), date:todayStr() };
  wallet.transactions=wallet.transactions||[]; wallet.transactions.unshift(tx);
  if(user) _privRef().set({ wallet }, { merge:true }).catch(()=>{});
  closeWalletModal('withdrawOverlay');
  showToast('Withdrawal initiated · processing');
  renderWallet();
  setTimeout(()=>{ tx.status='completed';                       // testnet: simulate settlement
    if(user) _privRef().set({ wallet }, { merge:true }).catch(()=>{});
    const wp=document.getElementById('pageWallet'); if(wp&&wp.classList.contains('active')) renderWallet();
    _walletNotify('Withdrawal completed', `Rs.${amt.toLocaleString('en-IN')} sent to your account`, false);
    showToast('Withdrawal completed');
  }, 4000);
}
function claimPending(){
  if (!WALLET_ENABLED) return;
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
  if (!WALLET_ENABLED) return;
  if(!user){ showToast('Sign in first'); return; }
  wallet.kyc = wallet.kyc || { status:'none' };
  if(wallet.kyc.status==='verified'){ showToast('KYC already verified ✓'); return; }
  document.getElementById('kycName').value = wallet.kyc.name||'';
  document.getElementById('kycPan').value  = wallet.kyc.pan||'';
  _ovOpen('kycOverlay');
}
function submitKyc(){
  if (!WALLET_ENABLED) return;
  const name=(document.getElementById('kycName').value||'').trim();
  const pan=(document.getElementById('kycPan').value||'').trim().toUpperCase();
  if(name.length<3){ showToast('Enter your full name'); return; }
  if(!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)){ showToast('Enter a valid PAN (ABCDE1234F)'); return; }
  wallet.kyc={ status:'verified', name, pan };          // testnet: instant approval
  if(user) _privRef().set({ wallet }, { merge:true }).catch(()=>{});
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
  if (!WALLET_ENABLED) return;
  if(!user){ showToast('Sign in first'); return; }
  ['mUpi','mBankName','mBankNum','mBankIfsc'].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=''; });
  _methodTab('upi'); _ovOpen('methodOverlay');
}
function addMethod(){
  if (!WALLET_ENABLED) return;
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
  if(user) _privRef().set({ wallet }, { merge:true }).catch(()=>{});
  closeWalletModal('methodOverlay'); showToast('Account added'); renderWallet();
}
function removeMethod(id){
  if (!WALLET_ENABLED) return;
  wallet.methods=(wallet.methods||[]).filter(m=>m.id!==id);
  if(user) _privRef().set({ wallet }, { merge:true }).catch(()=>{});
  renderWallet();
}

// ── Transaction PIN (set / verify) ──
let _pinCb=null, _pinMode='set';
function openPinModal(){
  if (!WALLET_ENABLED) return;
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
  if (!WALLET_ENABLED) return;
  const v=(document.getElementById('pinInput').value||'').trim();
  if(!/^\d{4}$/.test(v)){ showToast('Enter a 4-digit PIN'); return; }
  if(_pinMode==='verify'){
    if(v!==wallet.pin){ showToast('Incorrect PIN'); return; }
    closeWalletModal('pinOverlay'); const cb=_pinCb; _pinCb=null; if(cb) cb();
  } else {
    wallet.pin=v;
    if(user) _privRef().set({ wallet }, { merge:true }).catch(()=>{});
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
  if (!WALLET_ENABLED) return;
  const txns=(wallet.transactions||[]).slice().sort((a,b)=>_wtxnTs(b)-_wtxnTs(a));
  if(!txns.length){ showToast('No transactions to export'); return; }
  const esc=s=>`"${(''+s).replace(/"/g,'""')}"`;
  const rows=[['Date','Type','Category','Title','Amount (Rs)','Status','Reference']];
  txns.forEach(t=>{ const cat=_wtxnCat(t), meta=_WTXN_CATS[cat]||_WTXN_CATS.other, credit=(t.type||meta.type)==='credit';
    rows.push([t.date||'', credit?'Credit':'Debit', meta.label, t.title||'', (credit?'+':'-')+(t.amount||0), t.status||'completed', t.ref||'']); });
  const csv=rows.map(r=>r.map(esc).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}), url=URL.createObjectURL(blob);
  // The saved file carries the app's name onto the person's own device, so it
  // was the last place the old one was still being handed out.
  const a=document.createElement('a'); a.href=url; a.download='misnivo-statement-'+todayStr().replace(/\s+/g,'-')+'.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  showToast('Statement downloaded');
}

// ── Wallet event notification (self) ──
// No-op since /notifications is server-write-only. Every wallet event is
// already listed in the wallet's own transaction history, so nothing is lost;
// re-opening writes to clients just to notify yourself is not worth the hole.
function _walletNotify(){ return; }

// Smart router: shorts (<60s) open Shorts player, long videos open YouTube watch page
function openVideo(proofId) {
  const pool = (typeof allProofs !== 'undefined' && allProofs.length) ? allProofs : homeProofs;
  const p = (pool||[]).find(x => x.id === proofId);
  const isShort = _isShortVideo(p);
  if (isShort) openShorts(proofId);
  else openVideoDetail(proofId);
}

// Relative time for video cards: "3 days ago", "2 months ago", "1 year ago"
function _relTimeStr(when) {
  if (!when) return '';
  // Firestore Timestamp | Date | ISO string | plain "YYYY-MM-DD".
  // The last one has no time in it at all, which is exactly why a fresh mission
  // used to read as several hours old: it was measured from midnight UTC.
  let d;
  if (when && typeof when.toDate === 'function') d = when.toDate();
  else if (when instanceof Date)                 d = when;
  else                                           d = new Date(when);
  if (isNaN(d)) return String(when);
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
  _subOpen('collabModal');
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
function closeCollabModal() {                     // plain visual close (popstate)
  _subDrop('collabModal');
  const cm = document.getElementById('collabModal');
  if (cm) { cm.classList.remove('open'); cm.style.display = 'none'; const s=cm.querySelector('.collab-sheet'); if(s) s.style.cssText=''; }
}
function dismissCollabModal(){ _subDismiss('collabModal', closeCollabModal); }

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
      <span class="home-sec-title">Missions</span>
      <span class="home-sec-viewall" onclick="goPage('dares')">View All →</span>
    </div>
    <div class="active-dare-grid">${active.map(d => _activeDareCard(d, true)).join('')}</div>
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
      <span class="home-sec-title">Videos</span>
    </div>`;
  if (!_feedLong.length && !_feedShorts.length) {
    // Live missions only. The 'No Videos Yet' pitch that used to sit under them
    // filled the screen with an apology for something nobody had asked for yet;
    // an empty space says the same thing without taking up the page.
    container.innerHTML = _homeDaresHtml();
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
    ${noHdr ? '' : `<div class="home-sec-hdr"><span class="mi" style="color:#fff;font-size:22px;">play_circle</span><span class="home-sec-title">Clips</span></div>`}
    <div class="shorts-row">${shorts.map(p=>{
      const t = vidThumb(p, 360);
      const _w = (p.dareTitle||'Clip').trim().split(/\s+/);
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
// Stop and unload every short. Detaching a playing <video> does not silence it,
// so this has to run BEFORE the container is rewritten, not after.
function _shortsKillVideos(){
  const c = document.getElementById('shortsSnapContainer');
  if (c) c.querySelectorAll('video').forEach(v => {
    try {
      _vqDestroy(v);                                    // HLS keeps buffering on its own
      v.pause(); v.removeAttribute('src'); v.srcObject = null; v.load();
    } catch(e){}
  });
}

function _renderShortsSnapStack() {
  const c = document.getElementById('shortsSnapContainer');
  if (!c) return;
  _shortsKillVideos();                    // silence the outgoing stack first
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
      // The CURRENT short autoplays through _playSmart, which only starts once
      // the source is really attached (for HLS, after the manifest loads).
      // Neighbours just preload.
      if (!v._vqLoaded && v.dataset.src){ v._vqLoaded = true; _playSmart(v, v.dataset.src, { autoplay: i === shortsIndex, maxW:720 }); }
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
      v.muted = false;
      try { if (v.readyState >= 1) v.currentTime = 0; } catch(e){}  // seeking before metadata throws
      v.playbackRate = _SHORTS_SPEEDS[_shortsSpeedIdx] || 1;
      v.loop = !_shortsAutoScroll;                                  // auto-scroll → don't loop
      v.onended = () => { if (_shortsAutoScroll) shortsNav(1); };   // …advance to next short

      // A bare play() here fired BEFORE the source finished attaching, so it
      // rejected and the short sat paused until you tapped it — which is why
      // only the first short of a session ever started on its own (its file was
      // already warm from the feed preview). Retry once the element is ready.
      const kick = () => { const q = v.play(); if (q && q.catch) q.catch(()=>{}); _shortsSlideSyncIcons(v); };
      kick();
      v.addEventListener('loadeddata', kick, { once:true });
      v.addEventListener('canplay',    kick, { once:true });
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
  if (typeof _fsAdopt === 'function') _fsAdopt(w);   // fullscreen paints only its own subtree
  w.style.zIndex = '2147483000';
  w.classList.add('open');
}
function closeQualityMenu(){ const w=document.getElementById('vqWrap'); if(w) w.classList.remove('open'); }
function _vqChoose(val){
  _vqPref = (val==='auto') ? 'auto' : +val;
  try{ localStorage.setItem('dm_vq', String(_vqPref)); }catch(e){}
  if(_vqTarget) _vqApply(_vqTarget);
  const l = document.getElementById('shortsQLbl'); if(l) l.textContent = _vqLabel();
  closeQualityMenu();
  // no toast: the menu already shows the tick against what you picked
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
// An installed PWA that sits in the background for days never reloads, so it
// keeps whatever worker it started with. Ask for an update whenever it comes
// back to the foreground, and reload once if a newer one takes over — otherwise
// a resumed app can keep serving the build it was opened with.
// A build older than the one on the server is the 'my old UI came back' bug:
// a chat page and a post form that were deleted days ago cannot come from code
// that no longer contains them, so they can only come from something cached.
// Asking the worker to update relies on the worker; this does not. It reads the
// version this page is actually running, asks the server what it should be, and
// if they disagree it empties every cache, drops the worker and reloads once.
const _MY_VER = (() => {
  const s = [...document.querySelectorAll('script[src*="app.js"]')].pop();
  const m = s && s.src.match(/[?&]v=([^&]+)/);
  return m ? m[1] : null;
})();
let _verFixing = false;
async function _checkBuildFresh(){
  if (!_MY_VER || _verFixing || !navigator.onLine) return;
  let live = null;
  try {
    const r = await fetch('/?v=' + Date.now(), { cache:'no-store' });
    if (!r.ok) return;
    const m = (await r.text()).match(/app.js?v=([^"'&]+)/);
    live = m ? m[1] : null;
  } catch(e){ return; }                       // offline or blocked: leave it alone
  if (!live || live === _MY_VER) return;
  _verFixing = true;
  try { for (const k of await caches.keys()) await caches.delete(k); } catch(e){}
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  } catch(e){}
  location.reload();
}

if ('serviceWorker' in navigator) {
  try {
    const _swHadController = !!navigator.serviceWorker.controller;
    let _swReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!_swHadController || _swReloaded) return;   // first install: nothing to replace
      _swReloaded = true;
      location.reload();
    });
    navigator.serviceWorker.register('/sw.js').then(reg => {
      const check = () => { try { reg.update(); } catch(e){} _checkBuildFresh(); };
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      window.addEventListener('online', check);
      window.addEventListener('pageshow', e => { if (e.persisted) check(); });
      setTimeout(_checkBuildFresh, 4000);        // and once shortly after this open
    }).catch(()=>{});
  } catch(e){}
}

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

// ════════════════════════════════════════════════════════════════════
//  LONG-VIDEO PLAYER — ours, not the browser's
//
//  The native control bar carries a ⋮ that belongs to Chrome: it cannot be
//  added to, which is why Quality could never live there. Dropping `controls`
//  and drawing the bar ourselves is what YouTube does, and it is the only way
//  to own that menu. Everything the native bar gave us is rebuilt here —
//  scrub, time, volume, fullscreen — plus Quality, speed and PiP behind a ⋮.
// ════════════════════════════════════════════════════════════════════
let _vpHideT = null, _vpBound = false, _vpTapT = null, _vpLastTap = 0;
const _VP_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function _vpEls(){
  return {
    w: document.getElementById('vdPlayerWrap'),
    v: document.getElementById('vdPlayer'),
    seek: document.getElementById('vpSeek'),
    menu: document.getElementById('vpMenu')
  };
}
function _vpFmt(t){
  if (!isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t/3600), m = Math.floor(t%3600/60), s = Math.floor(t%60);
  return (h ? h + ':' + String(m).padStart(2,'0') : String(m)) + ':' + String(s).padStart(2,'0');
}

// ── show / auto-hide ──────────────────────────────────────────────────
function _vpShow(sticky){
  const {w, v} = _vpEls(); if (!w) return;
  w.classList.add('vp-show');
  clearTimeout(_vpHideT);
  if (sticky) return;
  // longer on touch: there is no hover to bring them back, so a fumbled tap
  // should not cost you the whole bar
  const _wait = window.innerWidth <= 768 ? 4000 : 2800;
  if (v && !v.paused && !v.ended) _vpHideT = setTimeout(()=>_vpHide(), _wait);
}
function _vpHide(){
  const {w} = _vpEls(); if (!w) return;
  if (document.querySelector('.vp-menu.open')) return;   // never yank the menu away
  w.classList.remove('vp-show');
}

// ── painting ──────────────────────────────────────────────────────────
function _vpPaint(){
  const {v, seek} = _vpEls(); if (!v || !seek) return;
  const d = v.duration || 0, pct = d ? (v.currentTime / d) * 100 : 0;
  seek.querySelector('.vp-seek-fill').style.width = pct + '%';
  seek.querySelector('.vp-seek-knob').style.left  = pct + '%';
  let buf = 0;
  try { if (v.buffered.length) buf = (v.buffered.end(v.buffered.length-1) / d) * 100; } catch(e){}
  seek.querySelector('.vp-seek-buf').style.width = (isFinite(buf) ? buf : 0) + '%';
  const c = document.getElementById('vpCur'), dd = document.getElementById('vpDur');
  if (c)  c.textContent  = _vpFmt(v.currentTime);
  if (dd) dd.textContent = _vpFmt(d);
}
function _vpSyncIcons(){
  const {v, w} = _vpEls(); if (!v || !w) return;
  const pb = document.getElementById('vpPlay'), mb = document.getElementById('vpMute');
  const paused = v.paused || v.ended;
  if (pb) pb.querySelector('.mi').textContent = paused ? 'play_arrow' : 'pause';
  if (mb) mb.querySelector('.mi').textContent = v.muted || !v.volume ? 'volume_off' : 'volume_up';
  const fs = document.getElementById('vpFs');
  if (fs) fs.querySelector('.mi').textContent = _vpIsFs() ? 'fullscreen_exit' : 'fullscreen';
  // the centre button is the pause control on phones, so it has to say which
  const cp = w.querySelector('.vd-center-play .mi');
  if (cp) cp.textContent = paused ? 'play_arrow' : 'pause';
  if (paused) _vpShow(true);          // stays up while stopped
  else        _vpShow();              // playing → arm the fade-out again
}

// ── the ⋮ menu ────────────────────────────────────────────────────────
function _vpMenuRoot(){
  const {v, menu} = _vpEls(); if (!menu) return;
  const rate = v ? v.playbackRate : 1;
  menu.innerHTML =
    '<button onclick="event.stopPropagation();_vpMenuSpeed()"><span class="mi">speed</span>Playback speed'
      + '<span class="vp-menu-val">' + (rate === 1 ? 'Normal' : rate + '×') + '</span></button>'
    + '<button onclick="event.stopPropagation();_vpMenuQuality()"><span class="mi">tune</span>Quality'
      + '<span class="vp-menu-val">' + (typeof _vqLabel === 'function' ? _vqLabel() : 'Auto') + '</span></button>'
    + '<button onclick="_vpPiP()"><span class="mi">picture_in_picture_alt</span>Picture-in-picture</button>';
}
function _vpMenuSpeed(){
  const {v, menu} = _vpEls(); if (!menu) return;
  const rate = v ? v.playbackRate : 1;
  menu.innerHTML = '<button class="vp-menu-back" onclick="event.stopPropagation();_vpMenuRoot()"><span class="mi">arrow_back</span>Playback speed</button>'
    + _VP_SPEEDS.map(s =>
        '<button class="' + (s === rate ? 'sel' : '') + '" onclick="event.stopPropagation();_vpSetSpeed(' + s + ')">'
        + '<span class="mi">' + (s === rate ? 'check' : 'speed') + '</span>'
        + (s === 1 ? 'Normal' : s + '×') + '</button>').join('');
}
function _vpSetSpeed(s){
  const {v} = _vpEls(); if (v) v.playbackRate = s;
  _vpMenuRoot(); _vpShow(true);
  // no toast: the menu already shows the tick against what you picked
}
// The old route opened a separate centred/bottom sheet, which on a phone landed
// nowhere near the button. Same list, rendered in place.
function _vpMenuQuality(){
  const {v, menu} = _vpEls(); if (!menu) return;
  let opts = [1080, 720, 480, 360];
  if (v && v._hls && v._hls.levels && v._hls.levels.length){
    const set = [...new Set(v._hls.levels.map(L=>Math.min(L.width||0, L.height||0) || L.height || 0))].filter(Boolean);
    if (set.length) opts = set.sort((a,b)=>b-a);
  }
  const cur = String(_vqPref);
  const row = (val, lbl) =>
    '<button class="' + (cur === String(val) ? 'sel' : '') + '" onclick="event.stopPropagation();_vpSetQuality(\'' + val + '\')">'
    + '<span class="mi">' + (cur === String(val) ? 'check' : (val === 'auto' ? 'autorenew' : 'high_quality')) + '</span>'
    + lbl + '</button>';
  menu.innerHTML = '<button class="vp-menu-back" onclick="event.stopPropagation();_vpMenuRoot()"><span class="mi">arrow_back</span>Quality</button>'
    + row('auto', 'Auto') + opts.map(o => row(o, o + 'p')).join('');
}
function _vpSetQuality(val){
  const {v} = _vpEls();
  _vqTarget = v;
  if (typeof _vqChoose === 'function') _vqChoose(val);
  _vpMenuRoot(); _vpShow(true);
}
function _vpPiP(){
  const {v} = _vpEls(); _vpCloseMenu(); if (!v) return;
  try {
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    else if (v.requestPictureInPicture) v.requestPictureInPicture();
    else showToast('Picture-in-picture is not supported here');
  } catch(e){ showToast('Picture-in-picture is not supported here'); }
}
// Where a popup has to live to be visible right now.
// <html> being the fullscreen element is the normal case now, and popups still
// belong in <body> then — only a fullscreened element deeper in the tree needs
// them moved.
function _fsHost(){
  const fe = document.fullscreenElement;
  return (fe && fe !== document.documentElement && fe !== document.body) ? fe : document.body;
}
// Move a popup into the fullscreen element (or back out again) without losing it.
function _fsAdopt(el){
  if (!el) return;
  const host = _fsHost();
  if (el.parentElement !== host) host.appendChild(el);
}
function _vpToggleMenu(){
  const {menu, w} = _vpEls(); if (!menu) return;
  if (menu.classList.contains('open')) { _vpCloseMenu(); return; }
  _vpMenuRoot();
  // Anchored to the button and parented to the top of the tree: no scrolling
  // column can clip it and no stacking context can bury it.
  const btn = document.getElementById('vpMore');
  _fsAdopt(menu);
  if (btn){
    const r = btn.getBoundingClientRect();
    const above = r.top - 16;                       // room between the button and the top
    menu.style.position = 'fixed';
    menu.style.right  = Math.max(8, window.innerWidth - r.right) + 'px';
    menu.style.left   = 'auto';
    menu.style.overflowY = 'auto';
    if (above >= 220){                              // opens upward and still fits
      menu.style.bottom = (window.innerHeight - r.top + 8) + 'px';
      menu.style.top = 'auto';
      menu.style.maxHeight = above + 'px';
    } else {                                        // no room — drop below instead
      menu.style.top = (r.bottom + 8) + 'px';
      menu.style.bottom = 'auto';
      menu.style.maxHeight = Math.max(160, window.innerHeight - r.bottom - 24) + 'px';
    }
    menu.style.zIndex = '2147483000';
  }
  menu.classList.add('open'); _vpShow(true);
}
function _vpCloseMenu(){
  const {menu} = _vpEls(); if (menu) menu.classList.remove('open');
  _vpShow();
}

// ── fullscreen (iOS only ever fullscreens the video element itself) ────
/* ── 3. Fullscreen the way the rest of the app moves: the picture grows into
      place instead of snapping. The browser gives no transition of its own, so
      this is the same FLIP the thumbnails use — measure before, let fullscreen
      happen, then animate from the old rect to the new one. Playback holds
      still while it runs, because a video that keeps playing under a scaling
      transform is what makes these look cheap. ── */
let _vpWasPlaying = false;
function _vpIsFs(){ const w = _vpEls().w; return !!(w && w.classList.contains('vp-fs')); }
function _vpFullscreen(){
  const {w, v} = _vpEls(); if (!w) return;
  if (_vpIsFs()){ _vpExitFs(); return; }

  _vpWasPlaying = v && !v.paused && !v.ended;
  if (_vpWasPlaying) { try { v.pause(); } catch(e){} }

  const from = w.getBoundingClientRect();
  // <html> goes fullscreen, not the player: the page is already viewport-sized
  // so the browser has nothing of its own to animate, and every popup keeps
  // painting because the whole document is still the fullscreen subtree.
  const el = document.documentElement;
  try{
    if (el.requestFullscreen) el.requestFullscreen().catch(()=>{});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    else if (v && v.webkitEnterFullscreen){ v.webkitEnterFullscreen(); if(_vpWasPlaying) v.play().catch(()=>{}); return; }
  }catch(e){}
  try{ if (window.innerWidth <= 768 && screen.orientation && screen.orientation.lock)
         screen.orientation.lock('landscape').catch(()=>{}); }catch(e){}

  w.classList.add('vp-fs');
  document.body.classList.add('vp-fs-on');
  _vpFly(w, from);
  _vpShow(true);
}
function _vpExitFs(){
  const {w} = _vpEls(); if (!w) return;
  const from = w.getBoundingClientRect();
  try{ if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); }catch(e){}
  try{
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
    else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
  }catch(e){}
  w.classList.remove('vp-fs');
  document.body.classList.remove('vp-fs-on');
  _vpFly(w, from);
}
// Escape and the system back button leave fullscreen without going through us.
document.addEventListener('fullscreenchange', ()=>{
  if (!document.fullscreenElement && _vpIsFs()) _vpExitFs();
});
// FLIP: the element is already at its destination, so invert to where it was
// and let it play forward.
function _vpFly(w, from){
  const v = document.getElementById('vdPlayer');
  const done = ()=>{
    w.style.transform = '';
    // mobile pins the player with a transform of its own — hand it back
    if (typeof _vdParkPlayer === 'function') _vdParkPlayer();
    if (_vpWasPlaying && v){ v.play().catch(()=>{}); _vpWasPlaying = false; }
  };
  if (!from || (typeof _motionOff === 'function' && _motionOff())){ done(); return; }
  const to = w.getBoundingClientRect();
  if (!to.width || !to.height){ done(); return; }
  const sx = from.width / to.width, sy = from.height / to.height;
  const dx = from.left - to.left + (from.width  - to.width)  / 2;
  const dy = from.top  - to.top  + (from.height - to.height) / 2;
  const a = w.animate(
    [{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')', borderRadius: '14px' },
     { transform: 'none', borderRadius: '0px' }],
    { duration: 520, easing: 'cubic-bezier(.25,.8,.25,1)' });
  a.onfinish = a.oncancel = done;
}

// ── seeking ───────────────────────────────────────────────────────────
function _vpSeekTo(e){
  const {v, seek} = _vpEls(); if (!v || !seek || !v.duration) return;
  const r = seek.getBoundingClientRect();
  const x = Math.min(Math.max(0, (e.clientX - r.left) / r.width), 1);
  v.currentTime = x * v.duration;
  _vpPaint();
}
function _vpSkip(sec){
  const {v, w} = _vpEls(); if (!v || !v.duration) return;
  v.currentTime = Math.min(Math.max(0, v.currentTime + sec), v.duration);
  const el = w.querySelector('.vp-skip.' + (sec < 0 ? 'back' : 'fwd'));
  if (el){ el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('on'), 450); }
  _vpPaint(); _vpShow();
}

// ── wiring, once ──────────────────────────────────────────────────────
function _vpInit(){
  const {w, v, seek, menu} = _vpEls();
  if (!w || !v || _vpBound) { _vpPaint(); _vpSyncIcons(); return; }
  _vpBound = true;

  v.removeAttribute('controls');

  v.addEventListener('timeupdate', _vpPaint);
  v.addEventListener('progress',   _vpPaint);
  v.addEventListener('durationchange', _vpPaint);
  ['play','pause','ended','volumechange','ratechange'].forEach(ev => v.addEventListener(ev, _vpSyncIcons));
  document.addEventListener('fullscreenchange', _vpSyncIcons);

  document.getElementById('vpPlay').onclick = e => { e.stopPropagation(); _vdTogglePlay(); _vpShow(); };
  document.getElementById('vpMute').onclick = e => { e.stopPropagation(); v.muted = !v.muted; _vpShow(); };
  document.getElementById('vpFs').onclick   = e => { e.stopPropagation(); _vpFullscreen(); };
  document.getElementById('vpMore').onclick = e => { e.stopPropagation(); _vpToggleMenu(); };
  const vol = document.getElementById('vpVol');
  if (vol) vol.oninput = () => { v.volume = vol.value / 100; v.muted = !+vol.value; };

  // scrub — pointer events cover mouse and touch with one path
  let dragging = false;
  seek.addEventListener('pointerdown', e => {
    dragging = true; seek.classList.add('drag'); seek.setPointerCapture(e.pointerId);
    _vpSeekTo(e); _vpShow(true); e.stopPropagation();
  });
  seek.addEventListener('pointermove', e => { if (dragging) _vpSeekTo(e); });
  seek.addEventListener('pointerup',   e => {
    dragging = false; seek.classList.remove('drag');
    try { seek.releasePointerCapture(e.pointerId); } catch(err){}
    _vpShow();
  });

  // tapping the picture: desktop toggles playback, phones reveal the bar first,
  // and a quick second tap on either side jumps ten seconds
  w.addEventListener('click', e => {
    if (e.target.closest('.vp-bar, .vp-menu, .vd-center-play, .dd-bounty-badge')) return;
    if (document.querySelector('.vp-menu.open')) { _vpCloseMenu(); return; }
    const now = Date.now();
    if (now - _vpLastTap < 300){              // second tap: jump ten seconds
      _vpLastTap = 0;
      const r = w.getBoundingClientRect();
      _vpSkip(e.clientX - r.left < r.width / 2 ? -10 : 10);
      return;
    }
    _vpLastTap = now;
    if (window.innerWidth > 768){ _vdTogglePlay(); _vpShow(); return; }
    // phones: show the controls, or put them away again. Pause is the centre
    // button — a tap anywhere stopping the video is what made this unusable.
    if (w.classList.contains('vp-show')) _vpHide(); else _vpShow();
  });
  w.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') _vpShow(); });
  // MOUSE only. A touch pointer is destroyed the moment the finger lifts, which
  // fires pointerleave after every single tap — so on a phone this was hiding
  // the bar again the instant a tap revealed it, and no control was ever on
  // screen long enough to be pressed.
  w.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !v.paused) _vpHide(); });

  // keyboard, only while the watch page is the thing on screen
  document.addEventListener('keydown', e => {
    const ov = document.getElementById('videoDetailOverlay');
    if (!ov || !ov.classList.contains('open')) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    switch (e.key) {
      case ' ': case 'k': e.preventDefault(); _vdTogglePlay(); _vpShow(); break;
      case 'ArrowLeft':   e.preventDefault(); _vpSkip(-5); break;
      case 'ArrowRight':  e.preventDefault(); _vpSkip(5);  break;
      case 'f': _vpFullscreen(); break;
      case 'm': v.muted = !v.muted; _vpShow(); break;
      default: return;
    }
  });

  document.addEventListener('click', e => {
    const m = document.querySelector('.vp-menu.open'); if (!m) return;
    // NOT e.target.closest(): rebuilding the menu detaches the clicked node
    // mid-dispatch and a detached node has no ancestors to walk.
    const path = (e.composedPath && e.composedPath()) || [];
    if (path.some(n => n && n.nodeType === 1 &&
        (n.classList && n.classList.contains('vp-menu') || n.id === 'vpMore'))) return;
    _vpCloseMenu();
  });

  _vpPaint(); _vpSyncIcons(); _vpShow(true);
}

// ════════════════════════════════════════════════════════════════════
//  COMMENT SHEETS — shared sizing and the grip gesture
//  One handler for all three sheets: mission, long video and shorts.
// ════════════════════════════════════════════════════════════════════

// The sheet starts where the picture ends. Requested for the mission and long
// video pages: the sheet should touch the bottom of the thumbnail / player
// rather than being a fixed fraction of the screen.
function _cboxFit(hostId){
  const sheet = document.querySelector('#ddCommentsBox .dd-cbox');
  if (!sheet) return;
  if (window.innerWidth > 768){ return; }             // desktop docks over column 1 instead
  sheet.classList.remove('cbox-full');
  const media = document.querySelector('#' + hostId + ' .vd2-player-wrap')
             || document.querySelector('#' + hostId + ' .dd-hero');
  const bottom = media ? media.getBoundingClientRect().bottom : 0;
  // never past half the screen, so the sheet is always worth opening; and never
  // negative, which is what a thumbnail scrolled off the top would give
  const top = Math.max(0, Math.min(bottom, window.innerHeight * 0.5));
  sheet._restTop = Math.round(top);
  _cboxSetTop(sheet, top);
}

// The sheet is sized by its top edge, with the bottom pinned — so dragging the
// grip resizes it rather than sliding the whole thing around.
function _cboxSetTop(sheet, top){
  sheet.style.top = Math.round(top) + 'px';
  sheet.style.bottom = '0';
  sheet.style.height = 'auto';
}
const _CBOX_SNAP = 60;                       // how far past the resting edge counts as a decision
function _cboxBindGrip(sheet, scope, onClose){
  if (!sheet) return;
  const grip = sheet.querySelector('.cbox-grip'); if (!grip) return;
  // resting height comes from whoever opened it; shorts has no measured edge, so
  // it keeps the 70% it always had
  if (sheet._restTop == null) sheet._restTop = Math.round(window.innerHeight * 0.3);
  if (sheet._gripBound) return;
  sheet._gripBound = true;

  let startY = 0, startTop = 0, dragging = false;
  const scopeEl = () => document.getElementById(scope) || document.body;

  grip.addEventListener('pointerdown', e => {
    if (window.innerWidth > 768) return;
    dragging = true;
    startY = e.clientY;
    startTop = sheet.getBoundingClientRect().top;
    scopeEl().classList.add('cbox-dragging');
    try { grip.setPointerCapture(e.pointerId); } catch (err) {}
  });

  grip.addEventListener('pointermove', e => {
    if (!dragging) return;
    // 0 = full screen, larger = shorter. Follows the finger all the way up.
    _cboxSetTop(sheet, Math.max(0, Math.min(startTop + (e.clientY - startY), window.innerHeight - 60)));
  });

  const end = e => {
    if (!dragging) return;
    dragging = false;
    scopeEl().classList.remove('cbox-dragging');
    try { grip.releasePointerCapture(e.pointerId); } catch (err) {}
    const top = sheet.getBoundingClientRect().top;
    const rest = sheet._restTop;
    if (top > rest + _CBOX_SNAP || top > window.innerHeight * 0.75){   // pulled down → close
      _cboxSetTop(sheet, rest); sheet.classList.remove('cbox-full');
      onClose(); return;
    }
    if (top < rest - _CBOX_SNAP){ _cboxSetTop(sheet, 0); sheet.classList.add('cbox-full'); return; }
    _cboxSetTop(sheet, rest); sheet.classList.remove('cbox-full');      // not far enough → snap back
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}
