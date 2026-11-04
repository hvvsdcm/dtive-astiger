/*
 * Clickjacking guard. A <meta> CSP cannot set frame-ancestors and GitHub Pages cannot send
 * X-Frame-Options, so the app refuses to run inside any frame. Imported first by main.tsx: the
 * throw stops every later module (including the email-link handling in features/auth/session)
 * from running. Frames this app embeds itself (Kakao postcode) are other pages and unaffected.
 */
if (window.top !== window.self) {
  throw new Error('This site cannot be opened inside a frame.');
}

export {};
