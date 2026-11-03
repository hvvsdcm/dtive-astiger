#!/usr/bin/env node
// Downloads the local seed photos listed in scripts/seed-images.json into supabase/seed-assets.
//
//   node scripts/fetch-seed-images.mjs           # skip files that already exist
//   node scripts/fetch-seed-images.mjs --force   # re-download everything
//
// Each entry becomes two objects that match the app's storage convention:
//   supabase/seed-assets/{bucket}/{owner}/{uuid}.webp    (2000px wide)
//   supabase/seed-assets/{bucket}/{owner}/{uuid}_m.webp  (800px wide)
// Resizing and WebP encoding are done by the Unsplash image CDN (imgix parameters), so the
// script needs no npm dependencies. `supabase db reset` / `supabase start` upload the folders to
// the local Storage buckets configured in supabase/config.toml ([storage.buckets.*].objects_path);
// `supabase seed buckets` re-uploads them without resetting the database.
// It also regenerates supabase/seed-assets/CREDITS.md from the same JSON.

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'supabase', 'seed-assets');
const force = process.argv.includes('--force');
const CONCURRENCY = 4;

const manifest = JSON.parse(await readFile(join(root, 'scripts', 'seed-images.json'), 'utf8'));

const exists = async (path) => {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
};

const download = async (url, dest) => {
  if (!force && (await exists(dest))) return 'skipped';
  const res = await fetch(url, { headers: { Accept: 'image/webp' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} ${url}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/webp'))
    throw new Error(`unexpected content-type "${type}" for ${url}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return 'downloaded';
};

const jobs = manifest.images.flatMap((image) => {
  const base = join(assetsDir, image.bucket, image.object);
  const url = (template) => template.replace('{unsplash_photo}', image.unsplash_photo);
  return [
    { url: url(manifest.download.large), dest: `${base}.webp` },
    { url: url(manifest.download.medium), dest: `${base}_m.webp` },
  ];
});

let done = 0;
let failed = 0;
const queue = [...jobs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const result = await download(job.url, job.dest);
        done += 1;
        console.log(`${result.padEnd(10)} ${job.dest.slice(root.length + 1)}`);
      } catch (error) {
        failed += 1;
        console.error(`failed     ${job.dest.slice(root.length + 1)}: ${error.message}`);
      }
    }
  }),
);

const rows = manifest.images.map(
  (i) =>
    `| ${i.bucket}/${i.object} | ${i.usage} | [${i.title}](${i.page}) | [${i.author}](${i.author_url}) |`,
);
const credits = `# Seed image credits

Local development seed photos, downloaded by \`scripts/fetch-seed-images.mjs\` from Unsplash.
All photos are published under the [Unsplash License](https://unsplash.com/license): free to use
for commercial and non-commercial purposes, attribution not required. They are placeholders and
must be replaced with real product photography before launch.

Generated from \`scripts/seed-images.json\`; edit that file, not this one.

| Object (without \`.webp\` / \`_m.webp\`) | Used for | Photo | Photographer |
| --- | --- | --- | --- |
${rows.join('\n')}
`;
await writeFile(join(assetsDir, 'CREDITS.md'), credits);

console.log(`\n${done} files ok, ${failed} failed, CREDITS.md written`);
if (failed > 0) process.exit(1);
