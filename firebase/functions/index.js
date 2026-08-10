/**
 * MissionMarket — Cloud Functions
 *
 * Every notification in the app is created HERE, never by a browser. The client
 * has no write access to /notifications (see firestore.rules), so the only way
 * a bell rings is a trigger below reacting to something that actually happened.
 * That also makes milestones exactly-once: they used to be computed in each
 * viewer's tab, which double-fired when two people liked at the same moment and
 * silently missed when nobody had the tab open.
 *
 * Deploy:  firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin     = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const REGION = 'asia-south1';   // Mumbai — closest to the user base
const fn = functions.region(REGION);

// ────────────────────────────────────────────────────────────────────────────
//  Core: write a notification + push it
// ────────────────────────────────────────────────────────────────────────────

/**
 * @param {string} toUserId  recipient uid
 * @param {string} type      drives the icon/colour in the client
 * @param {string} title
 * @param {string} message
 * @param {string} refId     dare/proof id the notification points at
 * @param {string} dedupeKey optional — a stable id makes the write idempotent,
 *                           so a retried trigger cannot produce a duplicate
 */
async function createNotification({ toUserId, type, title, message, refId = '', dedupeKey = null }) {
  if (!toUserId) return null;

  const payload = {
    toUserId, type, title, message, refId,
    read: false,
    createdAt: FieldValue.serverTimestamp()
  };

  const ref = dedupeKey
    ? db.collection('notifications').doc(dedupeKey)
    : db.collection('notifications').doc();

  if (dedupeKey) {
    // create-if-absent: a retry of the same trigger is a no-op
    const existing = await ref.get();
    if (existing.exists) return null;
  }
  await ref.set(payload);
  return ref.id;
}

/** Respect the per-user toggles saved in Settings. */
async function wantsNotification(uid, type) {
  try {
    const snap = await db.collection('users').doc(uid).get();
    const s = (snap.exists && snap.data().settings) || {};
    if (type === 'like_milestone'    && s.notifLikes  === false) return false;
    if (type === 'comment_milestone' && s.notifLikes  === false) return false;
    if (type === 'new_follower'      && s.notifFollow === false) return false;
    if (type.startsWith('dare_')     && s.notifDares  === false) return false;
    return true;
  } catch (e) {
    return true;   // never drop a notification because a settings read failed
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Unread counter + push fan-out
//  The badge used to be counted from the 50 documents the client had loaded,
//  so it lied the moment someone had more than 50 unread. It is a real counter
//  on the user document now.
// ────────────────────────────────────────────────────────────────────────────

exports.onNotificationCreated = fn.firestore
  .document('notifications/{id}')
  .onCreate(async (snap) => {
    const n = snap.data();
    if (!n || !n.toUserId) return null;

    await db.collection('users').doc(n.toUserId)
      .set({ unreadCount: FieldValue.increment(1) }, { merge: true });

    await sendPush(n.toUserId, n);
    return null;
  });

exports.onNotificationUpdated = fn.firestore
  .document('notifications/{id}')
  .onUpdate(async (change) => {
    const before = change.before.data(), after = change.after.data();
    if (before.read === after.read) return null;
    const delta = after.read ? -1 : 1;
    return db.collection('users').doc(after.toUserId)
      .set({ unreadCount: FieldValue.increment(delta) }, { merge: true });
  });

exports.onNotificationDeleted = fn.firestore
  .document('notifications/{id}')
  .onDelete(async (snap) => {
    const n = snap.data();
    if (!n || n.read) return null;   // reading it already decremented
    return db.collection('users').doc(n.toUserId)
      .set({ unreadCount: FieldValue.increment(-1) }, { merge: true });
  });

/** Deliver to every device the user registered; prune tokens the FCM rejects. */
async function sendPush(uid, n) {
  const tokensSnap = await db.collection('users').doc(uid).collection('tokens').get();
  const tokens = tokensSnap.docs.map(d => d.id);
  if (!tokens.length) return;

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title: n.title || 'MissionMarket', body: n.message || '' },
    data: { type: n.type || '', refId: n.refId || '', url: '/' },
    webpush: {
      fcmOptions: { link: '/' },
      notification: { icon: '/icon.svg', badge: '/icon.svg' }
    }
  });

  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-argument') dead.push(tokens[i]);
  });
  await Promise.all(dead.map(t =>
    db.collection('users').doc(uid).collection('tokens').doc(t).delete().catch(() => {})
  ));
}

// ────────────────────────────────────────────────────────────────────────────
//  Triggers — the events that actually produce notifications
// ────────────────────────────────────────────────────────────────────────────

/** Someone accepted a mission → tell the creator. */
exports.onApplicantCreated = fn.firestore
  .document('dares/{dareId}/applicants/{uid}')
  .onCreate(async (snap, ctx) => {
    const a = snap.data() || {};
    const dareSnap = await db.collection('dares').doc(ctx.params.dareId).get();
    if (!dareSnap.exists) return null;
    const d = dareSnap.data();
    if (!d.creatorUid || d.creatorUid === ctx.params.uid) return null;
    if (!(await wantsNotification(d.creatorUid, 'dare_accepted'))) return null;

    return createNotification({
      toUserId: d.creatorUid,
      type: 'dare_accepted',
      title: `⚡ ${a.name || 'Someone'} accepted your mission!`,
      message: `"${(d.caption || d.title || '').slice(0, 40)}" has a new taker.`,
      refId: ctx.params.dareId,
      dedupeKey: `acc_${ctx.params.dareId}_${ctx.params.uid}`
    });
  });

/** Proof submitted → tell the mission creator. */
exports.onProofCreated = fn.firestore
  .document('proofs/{proofId}')
  .onCreate(async (snap, ctx) => {
    const p = snap.data() || {};
    if (!p.posterId || p.posterId === p.takerId) return null;
    if (!(await wantsNotification(p.posterId, 'proof_submitted'))) return null;

    return createNotification({
      toUserId: p.posterId,
      type: 'proof_submitted',
      title: '🎥 Proof submitted!',
      message: `${p.takerName || 'A taker'} submitted proof for "${(p.dareTitle || '').slice(0, 40)}".`,
      refId: ctx.params.proofId,
      dedupeKey: `sub_${ctx.params.proofId}`
    });
  });

/** Proof judged, and engagement milestones — both live on proof updates. */
exports.onProofUpdated = fn.firestore
  .document('proofs/{proofId}')
  .onUpdate(async (change, ctx) => {
    const before = change.before.data(), after = change.after.data();
    const proofId = ctx.params.proofId;
    const jobs = [];

    // ── verdict ──
    if (before.status !== after.status && after.takerId) {
      if (after.status === 'approved') {
        jobs.push(createNotification({
          toUserId: after.takerId,
          type: 'proof_approved',
          title: '✅ Proof approved!',
          message: `Rs.${(after.dareBounty || 0).toLocaleString('en-IN')} is on its way for "${(after.dareTitle || '').slice(0, 40)}".`,
          refId: proofId,
          dedupeKey: `apr_${proofId}`
        }));
      } else if (after.status === 'rejected') {
        jobs.push(createNotification({
          toUserId: after.takerId,
          type: 'proof_rejected',
          title: '❌ Proof rejected',
          message: after.rejectionReason
            ? `Reason: ${String(after.rejectionReason).slice(0, 80)}`
            : `Your proof for "${(after.dareTitle || '').slice(0, 40)}" was rejected.`,
          refId: proofId,
          dedupeKey: `rej_${proofId}`
        }));
      }
    }

    // ── milestones ──
    // Crossing a threshold is decided from the before/after pair, and the
    // dedupeKey pins one notification per (proof, metric, threshold) forever.
    const MILESTONES = [10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000];
    const metric = (field, type, label) => {
      const b = Number(before[field] || 0), a = Number(after[field] || 0);
      if (a <= b) return;
      MILESTONES.filter(m => b < m && a >= m).forEach(m => {
        jobs.push((async () => {
          if (!after.takerId) return null;
          if (!(await wantsNotification(after.takerId, type))) return null;
          return createNotification({
            toUserId: after.takerId,
            type,
            title: `🎉 ${m.toLocaleString('en-IN')} ${label}!`,
            message: `"${(after.dareTitle || 'Your video').slice(0, 40)}" hit ${m.toLocaleString('en-IN')} ${label}.`,
            refId: proofId,
            dedupeKey: `ms_${proofId}_${field}_${m}`
          });
        })());
      });
    };
    metric('likeCount',    'like_milestone',    'likes');
    metric('viewCount',    'view_milestone',    'views');
    metric('commentCount', 'comment_milestone', 'comments');

    await Promise.all(jobs);
    return null;
  });

/** New comment → tell the video owner (not yourself). */
exports.onCommentCreated = fn.firestore
  .document('comments/{commentId}')
  .onCreate(async (snap, ctx) => {
    const c = snap.data() || {};
    if (!c.proofId || !c.userId) return null;

    const proofSnap = await db.collection('proofs').doc(c.proofId).get();
    if (!proofSnap.exists) return null;          // dare comments reuse this id space
    const p = proofSnap.data();
    if (!p.takerId || p.takerId === c.userId) return null;
    if (!(await wantsNotification(p.takerId, 'comment_new'))) return null;

    return createNotification({
      toUserId: p.takerId,
      type: 'comment_milestone',
      title: `💬 ${c.userName || 'Someone'} commented`,
      message: String(c.text || '').slice(0, 90),
      refId: c.proofId,
      dedupeKey: `cmt_${ctx.params.commentId}`
    });
  });

/** New follower. */
exports.onFollowCreated = fn.firestore
  .document('follows/{followId}')
  .onCreate(async (snap) => {
    const f = snap.data() || {};
    if (!f.targetUid || !f.followerUid || f.targetUid === f.followerUid) return null;
    if (!(await wantsNotification(f.targetUid, 'new_follower'))) return null;

    const who = await db.collection('users').doc(f.followerUid).get();
    const name = (who.exists && who.data().name) || 'Someone';

    return createNotification({
      toUserId: f.targetUid,
      type: 'new_follower',
      title: `👤 ${name} started following you`,
      message: 'Tap to see their profile.',
      refId: f.followerUid,
      dedupeKey: `flw_${snap.id}`
    });
  });

// ────────────────────────────────────────────────────────────────────────────
//  Housekeeping
// ────────────────────────────────────────────────────────────────────────────

/** Keep the collection from growing forever: drop read notifications > 60 days. */
exports.pruneNotifications = fn.pubsub
  .schedule('every 24 hours')
  .timeZone('Asia/Kolkata')
  .onRun(async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 24 * 3600 * 1000);
    const snap = await db.collection('notifications')
      .where('read', '==', true).where('createdAt', '<', cutoff).limit(500).get();
    if (snap.empty) return null;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    return batch.commit();
  });

/** Wipe a user's notifications when the account goes. */
exports.onUserDeleted = fn.auth.user().onDelete(async (u) => {
  const snap = await db.collection('notifications').where('toUserId', '==', u.uid).limit(500).get();
  if (snap.empty) return null;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  return batch.commit();
});
