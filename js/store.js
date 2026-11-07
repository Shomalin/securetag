// TEMPORARY data layer using localStorage (data stays in this one browser).
// Later we replace the insides of these functions with Firebase calls.
// The pages only talk to these functions, so they won't need to change.
const K = { users: 'st_users', tags: 'st_tags', msgs: 'st_msgs', session: 'st_session' };
const load = (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

if (!localStorage.getItem(K.tags)) {
  const blank = { itemName: '', status: 'unclaimed', ownerId: null, publicNote: '' };
  save(K.tags, { 'demo-wallet-01': { ...blank }, 'demo-bag-02': { ...blank } });
}

export const currentUser = () => load(K.session, null);
export const logout = () => localStorage.removeItem(K.session);

export async function register(name, email, pw) {
  const users = load(K.users, {});
  if (users[email]) throw new Error('That email is already registered.');
  users[email] = { id: 'u' + Date.now(), name, email, pw }; // real auth will hash this for us
  save(K.users, users); save(K.session, users[email]);
}
export async function login(email, pw) {
  const u = load(K.users, {})[email];
  if (!u || u.pw !== pw) throw new Error('Email or password is wrong.');
  save(K.session, u);
}

// Public: returns only fields safe to show a stranger
export async function getTag(id) {
  const t = load(K.tags, {})[id];
  return t ? { id, itemName: t.itemName, status: t.status, publicNote: t.publicNote } : null;
}
export async function sendMessage(tagId, text, contact) {
  const tags = load(K.tags, {}), t = tags[tagId];
  if (!t || t.status === 'unclaimed') throw new Error('This tag is not active.');
  const msgs = load(K.msgs, []);
  msgs.push({ id: 'm' + Date.now(), tagId, ownerId: t.ownerId, text: text.slice(0, 500), contact: (contact || '').slice(0, 100), read: false, createdAt: Date.now() });
  save(K.msgs, msgs);
}

// Owner only
export async function myTags() {
  const me = currentUser(), tags = load(K.tags, {});
  return Object.entries(tags).filter(([, t]) => t.ownerId === me.id).map(([id, t]) => ({ id, ...t }));
}
export async function claimTag(id, itemName, publicNote) {
  const tags = load(K.tags, {}), t = tags[id];
  if (!t) throw new Error('Tag ID not found. Check the packaging.');
  if (t.ownerId) throw new Error('This tag is already activated.');
  tags[id] = { itemName, publicNote, status: 'active', ownerId: currentUser().id };
  save(K.tags, tags);
}
export async function setStatus(id, status) {
  const tags = load(K.tags, {}); tags[id].status = status; save(K.tags, tags);
}
export async function myMessages() {
  const me = currentUser();
  return load(K.msgs, []).filter(m => m.ownerId === me.id).sort((a, b) => b.createdAt - a.createdAt);
}
export async function markRead(id) {
  const msgs = load(K.msgs, []); msgs.forEach(m => { if (m.id === id) m.read = true; }); save(K.msgs, msgs);
}
