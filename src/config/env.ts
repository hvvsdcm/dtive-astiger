import { z } from 'zod';

// CSP has no 'unsafe-eval'; stop zod from probing `new Function` on first parse.
z.config({ jitless: true });

const schema = z.object({
  VITE_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_BASE_PATH: z
    .string()
    .regex(/^\/(.*\/)?$/, 'must start and end with "/"')
    .default('/'),
  VITE_SITE_URL: z
    .url({ protocol: /^https?$/ })
    .refine((value) => !value.endsWith('/'), 'must not end with "/"'),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  const fields = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment (see .env.example)\n${fields.join('\n')}`);
}

export const env = {
  supabaseUrl: parsed.data.VITE_SUPABASE_URL.replace(/\/+$/, ''),
  supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY,
  basePath: parsed.data.VITE_BASE_PATH,
  siteUrl: parsed.data.VITE_SITE_URL,
} as const;
