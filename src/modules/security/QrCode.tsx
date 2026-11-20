// The setup key as a QR code an authenticator app can scan (D-J, approved 2026-11-21 with WP-10). The code is made in
// the browser from the otpauth link finapp returned once - nothing is fetched, stored or logged - and drawn as one SVG
// path: no injected markup, no inline style, no canvas (CSP `style-src 'self'`, Trusted Types).
import { encode } from 'uqr';

/** The SVG path of every dark module, one 1x1 square each, offset by the quiet zone. */
export function qrPath(data: readonly (readonly boolean[])[], quiet: number): string {
  const parts: string[] = [];
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
    });
  });
  return parts.join('');
}

const QUIET_ZONE = 4;

/**
 * Always dark on white, in both colour schemes: authenticator apps read dark modules on a light ground. The label
 * names what it is; the secret itself is never put into an attribute or text a screen reader would announce.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { data, size } = encode(value, { ecc: 'M', border: 0 });
  const extent = size + QUIET_ZONE * 2;
  return (
    <svg
      className="finapp-qr"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${extent} ${extent}`}
      width={200}
      height={200}
      shapeRendering="crispEdges"
    >
      <rect width={extent} height={extent} fill="#ffffff" />
      <path d={qrPath(data, QUIET_ZONE)} fill="#000000" />
    </svg>
  );
}
