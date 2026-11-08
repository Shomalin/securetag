// The page a finder sees after scanning a tag.
import { getTag, sendMessage } from './store.js';
import { $, esc, showBanner } from './ui.js';

const app = $('app');
const tagId = new URLSearchParams(location.search).get('t');

// ---------- The different screens ----------
function showNotFound() {
  app.innerHTML = `
    <div class="panel">
      <h1>Tag not found</h1>
      <p>Check that the link or QR code was scanned completely.</p>
    </div>`;
}

function showNotActivated() {
  app.innerHTML = `
    <div class="panel">
      <h1>This tag is not activated</h1>
      <p>Are you the owner? <a href="login.html">Log in</a> and activate it.</p>
    </div>`;
}

function showDisabled() {
  app.innerHTML = `
    <div class="panel">
      <h1>This tag has been disabled</h1>
      <p>Messages can no longer be sent through this tag.</p>
    </div>`;
}

function showMessageForm(tag) {
  const lostBanner = tag.status === 'lost'
    ? '<div class="banner lost">The owner is looking for this item. Thank you for helping.</div>'
    : '';
  const note = tag.publicNote ? `<p>${esc(tag.publicNote)}</p>` : '';

  app.innerHTML = `
    ${lostBanner}
    <div class="panel">
      <h1>You found: ${esc(tag.itemName)}</h1>
      ${note}
      <p class="muted">Your message goes to the owner. They never see your number unless you share it.</p>
      <div id="error" class="banner lost" hidden></div>

      <label for="text">Message to the owner</label>
      <textarea id="text" rows="4" maxlength="500" placeholder="Where did you find it? Where can they meet you?"></textarea>

      <label for="contact">Your contact (optional)</label>
      <input id="contact" maxlength="100" placeholder="Phone or email, only if you want to share">

      <input class="hp" id="trap" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p><button class="btn" id="send">Send message</button></p>
    </div>`;

  $('send').onclick = () => submitMessage();
}

// ---------- Sending ----------
async function submitMessage() {
  if ($('trap').value) return;   // bots fill the hidden field, humans never see it

  const text = $('text').value.trim();
  if (text.length < 5) {
    showBanner($('error'), 'Write a short message so the owner knows where you found it.');
    return;
  }

  try {
    await sendMessage(tagId, text, $('contact').value.trim());
    app.innerHTML = '<div class="banner ok">Message sent. The owner has been notified. Thank you!</div>';
  } catch (error) {
    showBanner($('error'), error.message);
  }
}

// ---------- Start ----------
async function start() {
  const tag = tagId ? await getTag(tagId) : null;

  if (!tag)                         return showNotFound();
  if (tag.status === 'unclaimed')   return showNotActivated();
  if (tag.status === 'disabled')    return showDisabled();
  showMessageForm(tag);
}

start();
