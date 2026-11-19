import { cp, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const browser = new URL('../dist/browser/', import.meta.url);
const katex = new URL(import.meta.resolve('katex/package.json'));
const katexDist = new URL('./dist/', katex);
const stylesheet = await readFile(new URL('./katex.min.css', katexDist), 'utf8');
const layout = await readFile(new URL('../src/math.css', import.meta.url), 'utf8');

await mkdir(browser, { recursive: true });
await Promise.all([
  build({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/browser/index.js',
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
  }),
  writeFile(new URL('math.css', browser), `${stylesheet}\n${layout}`),
  cp(new URL('fonts/', katexDist), new URL('fonts/', browser), { recursive: true }),
  copyFile(new URL('LICENSE', katex), new URL('KATEX-LICENSE.txt', browser)),
]);
