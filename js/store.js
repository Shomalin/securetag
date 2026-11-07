// Firebase version of the data layer. Same function names as before,
// so finder.js and login.js work unchanged.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const friendly = e => {
  const m = { 'auth/invalid-credential': 'Email or password is wrong.', 'auth/email-already-in-use': 'That email is already registered.',
    'auth/weak-password': 'Password needs at least 6 characters.', 'auth/invalid-email': 'Enter a valid email address.',
    'permission-denied': 'Not allowed. Check the tag ID or log in again.' };
  return new Error(m[e.code] || e.message);
};
const run = async fn => { try { return await fn(); } catch (e) { throw e instanceof Error && !e.code ? e : friendly(e); } };

// Resolves once Firebase knows if someone is logged in (user object or null)
export const waitForUser = () => new Promise(res => { const off = onAuthStateChanged(auth, u => { off(); res(u); }); });
export const logout = () => signOut(auth);

export const register = (name, email, pw) => run(async () => {
  const c = await createUserWithEmailAndPassword(auth, email, pw);
  await updateProfile(c.user, { displayName: name });
  await setDoc(doc(db, 'users', c.user.uid), { name, email, createdAt: Date.now() });
});
export const login = (email, pw) => run(() => signInWithEmailAndPassword(auth, email, pw));

// Public: only fields that are safe to show a stranger
export const getTag = id => run(async () => {
  const s = await getDoc(doc(db, 'tags', id));
  if (!s.exists()) return null;
  const t = s.data();
  return { id, itemName: t.itemName, status: t.status, publicNote: t.publicNote };
});
export const sendMessage = (tagId, text, contact) => run(async () => {
  const s = await getDoc(doc(db, 'tags', tagId));
  if (!s.exists() || s.data().status === 'unclaimed') throw new Error('This tag is not active.');
  await addDoc(collection(db, 'messages'), { tagId, ownerId: s.data().ownerId, text: text.slice(0, 500),
    contact: (contact || '').slice(0, 100), read: false, createdAt: Date.now() });
});

// Owner only
export const claimTag = (id, itemName, publicNote) => run(async () => {
  const ref = doc(db, 'tags', id), s = await getDoc(ref);
  if (!s.exists()) throw new Error('Tag ID not found. Check the packaging.');
  if (s.data().ownerId) throw new Error('This tag is already activated.');
  await updateDoc(ref, { itemName, publicNote, status: 'active', ownerId: auth.currentUser.uid });
});
export const setStatus = (id, status) => run(() => updateDoc(doc(db, 'tags', id), { status }));
export const markRead = id => run(() => updateDoc(doc(db, 'messages', id), { read: true }));

// Live updates: calls cb(tags, messages) whenever either changes
export function watch(uid, cb) {
  let tags = [], msgs = [];
  const push = () => cb(tags, msgs);
  const a = onSnapshot(query(collection(db, 'tags'), where('ownerId', '==', uid)), s => { tags = s.docs.map(d => ({ id: d.id, ...d.data() })); push(); });
  const b = onSnapshot(query(collection(db, 'messages'), where('ownerId', '==', uid)), s => { msgs = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((x, y) => y.createdAt - x.createdAt); push(); });
  return () => { a(); b(); };
}
