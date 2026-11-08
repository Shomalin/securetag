// Admin portal: create batches of tags, then export QR codes and claim codes.
import { auth, db } from './firebase.js';
import { waitForUser, logout } from './store.js';
import { doc, getDoc, updateDoc, collection, getDocs, onSnapshot, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { $, esc, finderUrl, showBanner, download } from './ui.js';
import { generateTagId, generateClaimCode, formatClaimCode } from './codes.js';
import { qrSvg } from './qr.js';

let allTags = [];   // every tag, kept up to date live

// ---------- Only admins get in ----------
$('logout').onclick = async () => { await logout(); location.href = 'index.html'; };

const user = await waitForUser();
if (!user) location.href = 'login.html';

// An admin is an account that has a document in the "admins" collection
const adminDoc = await getDoc(doc(db, 'admins', user.uid)).catch(() => null);
if (adminDoc && adminDoc.exists()) {
  $('gate').hidden = true;
  $('main').hidden = false;
  watchTags();
} else {
  $('gate').innerHTML = '<div class="banner lost">This account is not an admin.</div>';
}

// ---------- The tag list ----------
function watchTags() {
  onSnapshot(collection(db, 'tags'), snap => {
    allTags = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                       .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    refreshBatchFilter();
    renderList();
  }, error => showBanner($('generateMessage'), error.message));

  $('batchFilter').onchange = renderList;
  $('statusFilter').onchange = renderList;
}

function refreshBatchFilter() {
  const select = $('batchFilter');
  const selected = select.value;
  const batches = [...new Set(allTags.map(t => t.batch).filter(Boolean))];

  select.innerHTML = '<option value="">All batches</option>' +
    batches.map(b => `<option>${esc(b)}</option>`).join('');
  select.value = selected;
}

// The tags that match the current filters
function filteredTags() {
  const batch = $('batchFilter').value;
  const status = $('statusFilter').value;
  return allTags.filter(t => (!batch || t.batch === batch) && (!status || t.status === status));
}

function renderList() {
  const tags = filteredTags();
  $('total').textContent = `(${tags.length} of ${allTags.length})`;

  const rows = tags.slice(0, 100).map(tag => `
    <div class="msgitem">
      <div class="row">
        <div>
          <strong>${esc(tag.id)}</strong>
          <span class="pill ${esc(tag.status)}">${esc(tag.status)}</span>
          <div class="muted">${esc(tag.itemName || 'not claimed')}${tag.batch ? ' · ' + esc(tag.batch) : ''}</div>
        </div>
        <div>
          <button class="btn sm alt" data-copy="${esc(tag.id)}">Copy link</button>
          <button class="btn sm alt" data-toggle="${esc(tag.id)}">${tag.status === 'disabled' ? 'Enable' : 'Disable'}</button>
        </div>
      </div>
    </div>`);

  const more = tags.length > 100 ? '<p class="muted">Showing the first 100. Use the filters or exports for the rest.</p>' : '';
  $('list').innerHTML = rows.join('') + more;
}

document.addEventListener('click', async event => {
  const data = event.target.dataset;
  try {
    if (data.copy) navigator.clipboard.writeText(finderUrl(data.copy));
    if (data.toggle) await toggleDisabled(data.toggle);
  } catch (error) {
    alert(error.message);
  }
});

// Disable a tag, or bring it back (to "active" if it has an owner, otherwise "unclaimed")
async function toggleDisabled(tagId) {
  const tag = allTags.find(t => t.id === tagId);
  const restoredStatus = tag.ownerId ? 'active' : 'unclaimed';
  await updateDoc(doc(db, 'tags', tagId), { status: tag.status === 'disabled' ? restoredStatus : 'disabled' });
}

// ---------- Generate a batch ----------
$('generate').onclick = async () => {
  const count = Math.min(200, Math.max(1, parseInt($('count').value) || 0));
  const label = $('batchLabel').value.trim() || 'Untitled batch';

  // Make sure every ID in the batch is different
  const ids = new Set();
  while (ids.size < count) ids.add(generateTagId());

  try {
    const batch = writeBatch(db);
    const now = Date.now();

    for (const id of ids) {
      // The public tag: nothing secret in here
      batch.set(doc(db, 'tags', id), {
        itemName: '', ownerId: null, publicNote: '', status: 'unclaimed', batch: label, createdAt: now
      });
      // The secret claim code: only admins can read this collection
      batch.set(doc(db, 'claimCodes', id), { code: generateClaimCode(), createdAt: now });
    }
    await batch.commit();

    $('generateMessage').className = 'banner ok';
    showBanner($('generateMessage'), `Created ${count} tags in "${label}". Use the export buttons below.`);
    $('batchFilter').value = label;
    renderList();
  } catch (error) {
    $('generateMessage').className = 'banner lost';
    showBanner($('generateMessage'), error.message);
  }
};

// ---------- Exports ----------
// Tags that can still be used on a sticker (not disabled)
const printableTags = () => filteredTags().filter(t => t.status !== 'disabled');

// 1. One SVG per tag, zipped. Give these to the designers.
$('exportSvg').onclick = async () => {
  const tags = printableTags();
  if (!tags.length) return alert('No tags match the current filters.');

  const zip = new JSZip();
  for (const tag of tags) zip.file(`${tag.id}.svg`, qrSvg(finderUrl(tag.id)));
  download('securetag-qr-svg.zip', await zip.generateAsync({ type: 'blob' }));
};

// 2. A spreadsheet linking each tag to its claim code (for the packaging). Keep it private.
$('exportCsv').onclick = async () => {
  const tags = filteredTags();
  if (!tags.length) return alert('No tags match the current filters.');

  const codeSnap = await getDocs(collection(db, 'claimCodes'));
  const codes = Object.fromEntries(codeSnap.docs.map(d => [d.id, d.data().code]));

  const cell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const lines = tags.map(tag =>
    [tag.id, finderUrl(tag.id), codes[tag.id] ? formatClaimCode(codes[tag.id]) : '', tag.status, tag.batch]
      .map(cell).join(','));

  const csv = 'tag_id,url,claim_code,status,batch\n' + lines.join('\n');
  download('securetag-tags.csv', new Blob([csv], { type: 'text/csv' }));
};

// 3. A quick printable sheet of QR codes
$('printSheet').onclick = () => {
  const tags = printableTags();
  if (!tags.length) return alert('No tags match the current filters.');
  if (tags.length > 100 && !confirm(`Print ${tags.length} QR codes?`)) return;

  $('sheet').innerHTML = tags.map(tag =>
    `<div class="cell">${qrSvg(finderUrl(tag.id))}<br>${esc(tag.id)}</div>`).join('');
  setTimeout(() => window.print(), 300);
};
