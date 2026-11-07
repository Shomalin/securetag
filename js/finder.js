import { getTag, sendMessage } from './store.js';
const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const id = new URLSearchParams(location.search).get('t');

(async () => {
  const tag = id && await getTag(id);
  if (!tag) { app.innerHTML = '<div class="panel"><h1>Tag not found</h1><p>Check that the link or QR code was scanned completely.</p></div>'; return; }
  if (tag.status === 'unclaimed') {
    app.innerHTML = '<div class="panel"><h1>This tag is not activated</h1><p>Are you the owner? <a href="login.html">Log in</a> and activate it with this ID: <strong>' + esc(id) + '</strong></p></div>'; return;
  }
  const lost = tag.status === 'lost';
  app.innerHTML = `
    ${lost ? '<div class="banner lost">The owner is looking for this item. Thank you for helping.</div>' : ''}
    <div class="panel"><h1>You found: ${esc(tag.itemName)}</h1>
    ${tag.publicNote ? `<p>${esc(tag.publicNote)}</p>` : ''}
    <p class="muted">Your message goes to the owner. They never see your number unless you share it.</p>
    <div id="err" class="banner lost" hidden></div>
    <label for="text">Message to the owner</label>
    <textarea id="text" rows="4" maxlength="500" placeholder="Where did you find it? Where can they meet you?"></textarea>
    <label for="contact">Your contact (optional)</label><input id="contact" maxlength="100" placeholder="Phone or email, only if you want to share">
    <input class="hp" id="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <p><button class="btn" id="send">Send message</button></p></div>`;
  document.getElementById('send').onclick = async () => {
    const text = document.getElementById('text').value.trim(), err = document.getElementById('err');
    if (document.getElementById('hp').value) return; // honeypot: bots fill this
    if (text.length < 5) { err.textContent = 'Write at least a short message so the owner knows where you found it.'; err.hidden = false; return; }
    try { await sendMessage(id, text, document.getElementById('contact').value.trim());
      app.innerHTML = '<div class="banner ok">Message sent. The owner has been notified. Thank you!</div>';
    } catch (e) { err.textContent = e.message; err.hidden = false; }
  };
})();
