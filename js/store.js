// Everything the finder and owner pages need from Firebase.
// Pages call these functions and never touch Firestore directly.
import { auth, db } from './firebase.js';
import {
  onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { normalizeClaimCode } from './codes.js';

// ---------- Error messages people can understand ----------
const FRIENDLY_ERRORS = {
  'auth/invalid-credential':   'Email or password is wrong.',
  'auth/email-already-in-use': 'That email is already registered.',
  'auth/weak-password':        'Password needs at least 6 characters.',
  'auth/invalid-email':        'Enter a valid email address.',
  'permission-denied':         'Not allowed. Please log in again.'
};

// Runs a function and turns Firebase errors into readable ones
async function attempt(work) {
  try {
    return await work();
  } catch (error) {
    if (!error.code) throw error;   // our own readable error, pass it on
    throw new Error(FRIENDLY_ERRORS[error.code] || error.message);
  }
}

// ---------- Accounts ----------
// Resolves with the logged-in user, or null, once Firebase has checked
export const waitForUser = () => new Promise(resolve => {
  const stop = onAuthStateChanged(auth, user => { stop(); resolve(user); });
});

export const logout = () => signOut(auth);

export const register = (name, email, password) => attempt(async () => {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: name });
  await setDoc(doc(db, 'users', user.uid), { name, email, createdAt: Date.now() });
});

export const login = (email, password) => attempt(() => signInWithEmailAndPassword(auth, email, password));

// ---------- Finder side (no login needed) ----------
// Returns only what is safe to show a stranger, or null if the tag does not exist
export const getTag = tagId => attempt(async () => {
  const snap = await getDoc(doc(db, 'tags', tagId));
  if (!snap.exists()) return null;
  const tag = snap.data();
  return { id: tagId, itemName: tag.itemName, status: tag.status, publicNote: tag.publicNote };
});

export const sendMessage = (tagId, text, contact) => attempt(async () => {
  const snap = await getDoc(doc(db, 'tags', tagId));
  const tag = snap.exists() ? snap.data() : null;
  if (!tag || (tag.status !== 'active' && tag.status !== 'lost')) {
    throw new Error('This tag is not active.');
  }
  await addDoc(collection(db, 'messages'), {
    tagId,
    ownerId: tag.ownerId,
    text: text.slice(0, 500),
    contact: (contact || '').slice(0, 100),
    read: false,
    createdAt: Date.now()
  });
});

// ---------- Owner side (login required) ----------
// Activating a tag takes two steps:
//   1. Save a "claim" proving you know the secret code. Firestore compares it with
//      the real code, which only admins can read (see firestore.rules).
//   2. Fill in the tag and mark it active.
export const claimTag = (tagId, claimCode, itemName, publicNote) => attempt(async () => {
  const me = auth.currentUser.uid;
  const tagRef = doc(db, 'tags', tagId);
  const claimRef = doc(db, 'claims', tagId);

  const tagSnap = await getDoc(tagRef);
  if (!tagSnap.exists()) throw new Error('Tag ID not found. Check the packaging.');
  if (tagSnap.data().ownerId) throw new Error('This tag has already been activated.');

  // Step 1: prove the code (skip if an earlier attempt already got this far)
  const existingClaim = await getDoc(claimRef).catch(() => null);
  if (!existingClaim) throw new Error('This tag has already been activated.');
  if (!existingClaim.exists()) {
    try {
      await setDoc(claimRef, { ownerId: me, code: normalizeClaimCode(claimCode), createdAt: Date.now() });
    } catch {
      throw new Error('That claim code is not correct for this tag.');
    }
  }

  // Step 2: activate
  await updateDoc(tagRef, { ownerId: me, status: 'active', itemName, publicNote });
});

export const setStatus = (tagId, status) => attempt(() => updateDoc(doc(db, 'tags', tagId), { status }));
export const markRead  = messageId => attempt(() => updateDoc(doc(db, 'messages', messageId), { read: true }));

// Live updates: calls onChange(tags, messages) now and every time either list changes
export function watchMyData(uid, onChange) {
  let tags = [];
  let messages = [];

  const stopTags = onSnapshot(query(collection(db, 'tags'), where('ownerId', '==', uid)), snap => {
    tags = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onChange(tags, messages);
  });
  const stopMessages = onSnapshot(query(collection(db, 'messages'), where('ownerId', '==', uid)), snap => {
    messages = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);
    onChange(tags, messages);
  });

  return () => { stopTags(); stopMessages(); };
}
