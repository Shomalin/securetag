// Creates and cleans up tag IDs and claim codes.
// Both use letters and digits without look-alikes (no 0/O, 1/I/L).

const TAG_ID_LETTERS = 'abcdefghjkmnpqrstuvwxyz23456789';
const CLAIM_LETTERS  = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Random text using the browser's secure random generator
function randomText(letters, length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => letters[byte % letters.length]).join('');
}

export const generateTagId     = () => randomText(TAG_ID_LETTERS, 10);   // goes in the QR link
export const generateClaimCode = () => randomText(CLAIM_LETTERS, 8);     // printed on the packaging

// "abcd-efgh " or "ABCD EFGH" -> "ABCDEFGH" (how codes are stored and compared)
export const normalizeClaimCode = input => input.toUpperCase().replace(/[^A-Z0-9]/g, '');

// "ABCDEFGH" -> "ABCD-EFGH" (how codes are shown to people)
export const formatClaimCode = code => code.slice(0, 4) + '-' + code.slice(4);
