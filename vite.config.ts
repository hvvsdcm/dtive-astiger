/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { publicKeyProblem } from './src/config/publicKey';

// Fixed nonce for the dev server only: Vite stamps it on the inline React Refresh preamble and on the
// <style> tags its client injects. Production builds have no inline scripts/styles and no nonce.
const DEV_NONCE = 'dtive-astiger-dev';

type Directives = Record<string, string[]>;

function supabaseOrigins(rawUrl: string | undefined) {
  if (!rawUrl) return null;
  const url = new URL(rawUrl);
  return {
    http: url.origin,
    ws: `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`,
    secure: url.protocol === 'https:',
  };
}

function contentSecurityPolicy(supabaseUrl: string | undefined, dev: boolean): string {
  const supabase = supabaseOrigins(supabaseUrl);
  const supabaseHttp = supabase ? [supabase.http] : [];
  const supabaseWs = supabase ? [supabase.ws] : [];
  const nonce = dev ? [`'nonce-${DEV_NONCE}'`] : [];
  // On an http origin (dev server, or a local build/preview against the http local Supabase) the
  // postcode script frames http://postcode.map.* (then 302 → https). Production (https) never does.
  const httpPostcodeFrames =
    dev || !supabase?.secure
      ? ['http://postcode.map.kakao.com', 'http://postcode.map.daum.net']
      : [];

  const directives: Directives = {
    'default-src': ["'self'"],
    // Daum/Kakao postcode API loader (domain moved to kakaocdn in 2026; daumcdn kept while both are served)
    'script-src': ["'self'", 'https://t1.kakaocdn.net', 'https://t1.daumcdn.net', ...nonce],
    'style-src': ["'self'", ...nonce],
    // Kakao postcode builds its widget in an about:blank frame/popup that inherits this policy and sizes it with style attributes; <style> elements stay blocked.
    'style-src-attr': ["'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', ...supabaseHttp, 'https://images.unsplash.com'],
    'font-src': ["'self'"],
    'connect-src': ["'self'", ...supabaseHttp, ...supabaseWs],
    'frame-src': [
      'https://postcode.map.kakao.com',
      'https://postcode.map.daum.net',
      ...httpPostcodeFrames,
    ],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (!dev && supabase?.secure) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

function cspPlugin(supabaseUrl: string | undefined): Plugin {
  let dev = false;
  return {
    name: 'dtive-astiger:csp',
    configResolved(config) {
      dev = config.command === 'serve' && !config.isProduction;
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace('%APP_CSP%', contentSecurityPolicy(supabaseUrl, dev));
      },
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build') {
    if (!env.VITE_SUPABASE_URL) {
      throw new Error('VITE_SUPABASE_URL is required to build (see .env.example)');
    }
    // The key is inlined into the bundle; refuse anything that is not a public client key.
    const keyProblem = publicKeyProblem(env.VITE_SUPABASE_ANON_KEY ?? '');
    if (keyProblem) throw new Error(`VITE_SUPABASE_ANON_KEY ${keyProblem} (see .env.example)`);
  }

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss(), cspPlugin(env.VITE_SUPABASE_URL)],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    html: command === 'serve' ? { cspNonce: DEV_NONCE } : undefined,
    // Must match supabase/config.toml [auth] site_url / additional_redirect_urls.
    server: { host: '127.0.0.1', port: 5174, strictPort: true },
    preview: { port: 4173, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  };
});
