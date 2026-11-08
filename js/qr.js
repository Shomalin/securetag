// Turns a link into an SVG QR code (vector, so designers can scale and restyle it).
// Needs the "qrcode-generator" script loaded in the page (see admin.html).

const QUIET_ZONE = 4;   // blank border around the code, in modules. Scanners need it.

export function qrSvg(text) {
  const qr = qrcode(0, 'H');          // 'H' = highest error correction (~30% can be covered by art)
  qr.addData(text);
  qr.make();

  const modules = qr.getModuleCount();
  const size = modules + QUIET_ZONE * 2;

  // One 1x1 square per dark module, all joined into a single path
  let squares = '';
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.isDark(row, col)) squares += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
         `<rect width="${size}" height="${size}" fill="#fff"/>` +
         `<path d="${squares}" fill="#000"/></svg>`;
}
