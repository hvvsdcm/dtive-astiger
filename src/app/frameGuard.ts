/*
 * Clickjacking guard. Cloudflare sends frame-ancestors/X-Frame-Options (public/_headers), but a
 * <meta> CSP cannot set frame-ancestors and other hosts or previews may not send the headers, so
 * the app also refuses to run inside any frame. Imported first by main.tsx: the throw stops every
 * later module (including the email-link handling in features/auth/session) from running. Frames
 * this app embeds itself (Kakao postcode) are other pages and unaffected.
 */
if (window.top !== window.self) {
  throw new Error('This site cannot be opened inside a frame.');
}

export {};
