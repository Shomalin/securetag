// The owner's page: their tags, a form to activate new ones, and their messages.
import { waitForUser, logout, claimTag, setStatus, markRead, watchMyData } from './store.js';
import { $, esc, finderUrl, showBanner } from './ui.js';

// ---------- Must be logged in ----------
const user = await waitForUser();
if (!user) location.href = 'login.html';

$('greeting').textContent = 'Hi, ' + (user.displayName || 'owner');
$('logout').onclick = async () => { await logout(); location.href = 'index.html'; };

// ---------- Drawing the lists ----------
function tagHtml(tag) {
  const toggleLabel = tag.status === 'lost' ? 'I found it' : 'Mark as lost';
  const toggleButton = tag.status === 'disabled'
    ? ''
    : `<button class="btn sm" data-toggle="${esc(tag.id)}" data-status="${esc(tag.status)}">${toggleLabel}</button>`;

  return `
    <div class="panel">
      <div class="row">
        <div>
          <strong>${esc(tag.itemName)}</strong>
          <span class="pill ${esc(tag.status)}">${esc(tag.status)}</span>
          <div class="muted">${esc(finderUrl(tag.id))}</div>
        </div>
        <div>
          <button class="btn sm alt" data-copy="${esc(tag.id)}">Copy link</button>
          ${toggleButton}
        </div>
      </div>
    </div>`;
}

function messageHtml(message, tags) {
  const tag = tags.find(t => t.id === message.tagId);
  const contact = message.contact ? `<p><strong>Finder shared:</strong> ${esc(message.contact)}</p>` : '';
  const readButton = message.read ? '' : `<button class="btn sm alt" data-read="${esc(message.id)}">Mark as read</button>`;

  return `
    <div class="msgitem ${message.read ? '' : 'unread'}">
      <div class="muted">${new Date(message.createdAt).toLocaleString()} about ${esc(tag ? tag.itemName : '')}</div>
      <p>${esc(message.text)}</p>
      ${contact}
      ${readButton}
    </div>`;
}

function render(tags, messages) {
  $('tags').innerHTML = tags.length
    ? tags.map(tagHtml).join('')
    : '<p>No tags yet. Activate your first tag above.</p>';

  $('messages').innerHTML = messages.length
    ? messages.map(m => messageHtml(m, tags)).join('')
    : '<p class="muted">No messages yet. When someone scans your tag, their message shows up here.</p>';
}

// ---------- Buttons inside the lists ----------
document.addEventListener('click', async event => {
  const data = event.target.dataset;
  try {
    if (data.copy)   navigator.clipboard.writeText(finderUrl(data.copy));
    if (data.read)   await markRead(data.read);
    if (data.toggle) await setStatus(data.toggle, data.status === 'lost' ? 'active' : 'lost');
  } catch (error) {
    alert(error.message);
  }
});

// ---------- Activate form ----------
$('activate').onclick = async () => {
  try {
    await claimTag(
      $('tagId').value.trim().toLowerCase(),
      $('claimCode').value,
      $('itemName').value.trim() || 'My item',
      $('publicNote').value.trim()
    );
    for (const id of ['tagId', 'claimCode', 'itemName', 'publicNote']) $(id).value = '';
    $('activateError').hidden = true;
  } catch (error) {
    showBanner($('activateError'), error.message);
  }
};

// Updates by itself whenever data changes in Firebase
watchMyData(user.uid, render);
