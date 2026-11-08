import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const db = getFirestore(initializeApp(firebaseConfig)), auth = getAuth();
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const base = location.href.replace(/[^/]*$/, '') + 'finder.html?t=';
let all = [];

$('out').onclick = async () => { await signOut(auth); location.href = 'index.html'; };
const user = await new Promise(r => { const off = onAuthStateChanged(auth, u => { off(); r(u); }); });
if (!user) location.href = 'login.html';
let isAdmin = false;
try { isAdmin = (await getDoc(doc(db, 'admins', user.uid))).exists(); } catch (e) {}
if (!isAdmin) $('gate').innerHTML = '<div class="banner lost">This account is not an admin.</div>';
else { $('gate').hidden = true; $('main').hidden = false; start(); }

// 10 random characters from an alphabet without look-alikes (no 0/o, 1/l/i)
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => ALPHA[b % ALPHA.length]).join('');

function start() {
  onSnapshot(collection(db, 'tags'), s => {
    all = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const sel = $('batch'), cur = sel.value;
    sel.innerHTML = '<option value="">All batches</option>' + [...new Set(all.map(t => t.batch || ''))].filter(Boolean).map(b => `<option>${esc(b)}</option>`).join('');
    sel.value = cur; render();
  }, e => { $('list').innerHTML = '<div class="banner lost">' + esc(e.message) + '</div>'; });
  $('batch').onchange = $('stat').onchange = render;
}
const shown = () => all.filter(t => (!$('batch').value || t.batch === $('batch').value) && (!$('stat').value || t.status === $('stat').value));

function render() {
  const rows = shown();
  $('total').textContent = `(${rows.length} of ${all.length})`;
  $('list').innerHTML = rows.slice(0, 100).map(t => `<div class="msgitem"><div class="row"><div>
    <strong>${esc(t.id)}</strong> <span class="pill ${esc(t.status)}">${esc(t.status)}</span>
    <div class="muted">${esc(t.itemName || 'not claimed')} ${t.batch ? ' · ' + esc(t.batch) : ''}</div></div>
    <div><button class="btn sm alt" data-copy="${esc(t.id)}">Copy link</button>
    <button class="btn sm alt" data-tog="${esc(t.id)}" data-s="${esc(t.status)}">${t.status === 'disabled' ? 'Enable' : 'Disable'}</button></div></div></div>`).join('')
    + (rows.length > 100 ? '<p class="muted">Showing the first 100. Use the filters or CSV for the rest.</p>' : '');
}

document.addEventListener('click', async e => {
  const d = e.target.dataset;
  try {
    if (d.copy) navigator.clipboard.writeText(base + d.copy);
    if (d.tog) { // re-enable goes back to unclaimed or active depending on whether it has an owner
      const t = all.find(x => x.id === d.tog);
      await updateDoc(doc(db, 'tags', d.tog), { status: d.s === 'disabled' ? (t.ownerId ? 'active' : 'unclaimed') : 'disabled' });
    }
  } catch (err) { alert(err.message); }
});

$('gen').onclick = async () => {
  const n = Math.min(200, Math.max(1, parseInt($('count').value) || 0)), label = $('label').value.trim() || 'Untitled batch';
  const ids = new Set(); while (ids.size < n) ids.add(newId());
  try {
    const b = writeBatch(db), now = Date.now();
    ids.forEach(id => b.set(doc(db, 'tags', id), { itemName: '', ownerId: null, publicNote: '', status: 'unclaimed', batch: label, createdAt: now }));
    await b.commit();
    $('genMsg').textContent = `Created ${n} tags in "${label}". Filter by this batch to print or export them.`;
    $('genMsg').hidden = false; $('batch').value = label; render();
  } catch (err) { $('genMsg').className = 'banner lost'; $('genMsg').textContent = err.message; $('genMsg').hidden = false; }
};

$('csv').onclick = () => {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = 'tag_id,url,status,batch\n' + shown().map(t => [t.id, base + t.id, t.status, t.batch].map(q).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'securetag-tags.csv'; a.click();
};

$('print').onclick = () => {
  const rows = shown().filter(t => t.status === 'unclaimed' || t.status === 'active' || t.status === 'lost');
  if (!rows.length) return alert('No tags to print. Check your filters.');
  if (rows.length > 100 && !confirm(`Print ${rows.length} QR codes?`)) return;
  const sheet = $('sheet'); sheet.innerHTML = '';
  rows.forEach(t => {
    const c = document.createElement('div'); c.className = 'cell';
    new QRCode(c, { text: base + t.id, width: 130, height: 130, correctLevel: QRCode.CorrectLevel.M });
    c.append(document.createElement('br'), t.id); sheet.append(c);
  });
  setTimeout(() => window.print(), 300);
};
