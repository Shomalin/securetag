import { waitForUser, logout, claimTag, setStatus, markRead, watch } from './store.js';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const user = await waitForUser();
if (!user) location.href = 'login.html';
$('hi').textContent = 'Hi, ' + (user.displayName || 'owner');
$('out').onclick = async () => { await logout(); location.href = 'index.html'; };
const base = location.href.replace(/[^/]*$/, '') + 'finder.html?t=';

function render(tags, msgs) {
  $('tags').innerHTML = tags.length ? tags.map(t => `<div class="panel"><div class="row">
    <div><strong>${esc(t.itemName)}</strong> <span class="pill ${t.status}">${t.status}</span>
    <div class="muted">${esc(base + t.id)}</div></div>
    <div><button class="btn sm alt" data-copy="${esc(t.id)}">Copy link</button>
    <button class="btn sm" data-toggle="${esc(t.id)}" data-s="${t.status}">${t.status === 'lost' ? 'I found it' : 'Mark as lost'}</button></div></div></div>`).join('')
    : '<p>No tags yet. Activate your first tag above.</p>';
  $('msgs').innerHTML = msgs.length ? msgs.map(m => `<div class="msgitem ${m.read ? '' : 'unread'}">
    <div class="muted">${new Date(m.createdAt).toLocaleString()} about ${esc(tags.find(t => t.id === m.tagId)?.itemName || '')}</div>
    <p>${esc(m.text)}</p>${m.contact ? `<p><strong>Finder shared:</strong> ${esc(m.contact)}</p>` : ''}
    ${m.read ? '' : `<button class="btn sm alt" data-read="${m.id}">Mark as read</button>`}</div>`).join('')
    : '<p class="muted">No messages yet. When someone scans your tag, their message shows up here.</p>';
}
document.addEventListener('click', async e => {
  const d = e.target.dataset;
  try {
    if (d.toggle) await setStatus(d.toggle, d.s === 'lost' ? 'active' : 'lost');
    if (d.read) await markRead(d.read);
    if (d.copy) navigator.clipboard.writeText(base + d.copy);
  } catch (err) { alert(err.message); }
});
$('add').onclick = async () => {
  try { await claimTag($('tid').value.trim(), $('iname').value.trim() || 'My item', $('note').value.trim());
    $('tid').value = $('iname').value = $('note').value = ''; $('addErr').hidden = true;
  } catch (e) { $('addErr').textContent = e.message; $('addErr').hidden = false; }
};
watch(user.uid, render); // live: no refresh or polling needed
