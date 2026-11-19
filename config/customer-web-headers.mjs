// The response headers the public edge serves on the Customer Application's document and assets
// (ADR-F07 decision 1). Adapted from finapp-admin-panel/config/console-headers.mjs (ADR-F08).
//
// One definition: the catalogue preview and `vite preview` serve exactly these, so every component is
// proven under the production policy before the edge middleware exists. finapp copies the CSP into
// deploy/edge as the `customer-web-headers` middleware (FINAPP_BACKEND_WORK.md B1.2). The API routes keep
// their own `default-src 'none'`.

export const CUSTOMER_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "require-trusted-types-for 'script'",
  // No script may create a Trusted Types policy: the application needs none.
  "trusted-types 'none'",
].join('; ');

/** Every powerful feature off: the application uses none of them. */
export const CUSTOMER_PERMISSIONS_POLICY = [
  'accelerometer=()',
  'camera=()',
  'display-capture=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ');

/** @type {Readonly<Record<string, string>>} */
export const CUSTOMER_HEADERS = {
  'Content-Security-Policy': CUSTOMER_CSP,
  'Permissions-Policy': CUSTOMER_PERMISSIONS_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  // The preview's own; in production nginx sets Cache-Control per path and the edge sets none.
  'Cache-Control': 'no-store',
  // Ignored by browsers over plain HTTP (the local preview); in force behind the edge's TLS.
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
