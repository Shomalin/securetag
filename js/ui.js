// Small helpers shared by all pages.

// Shortcut for document.getElementById
export const $ = id => document.getElementById(id);

// Makes text safe to put inside HTML (stops people injecting code through messages)
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = text => String(text).replace(/[&<>"']/g, ch => ESCAPES[ch]);

// The link a finder opens after scanning a tag, built from the current site address
export const finderUrl = tagId => location.href.replace(/[^/]*$/, '') + 'finder.html?t=' + tagId;

// Shows a hidden banner with some text
export function showBanner(element, text) {
  element.textContent = text;
  element.hidden = false;
}

// Saves a Blob (or text) as a file download
export function download(filename, blob) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
