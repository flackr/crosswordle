import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(rootDir, 'build');
const sourceHtml = await readFile(path.join(rootDir, 'index.html'), 'utf8');
const builtHtml = sourceHtml
  .replace('<script defer src="src/game.js"></script>', '<script type="module" defer src="src/game.js"></script>')
  .replace('<script defer src="src/index.js"></script>', '<script type="module" defer src="src/index.js"></script>');

async function copy(relativePath) {
  await cp(path.join(rootDir, relativePath), path.join(outDir, relativePath), {
    recursive: true,
  });
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [
    path.join(rootDir, 'src/game.ts'),
    path.join(rootDir, 'src/index.ts'),
  ],
  outdir: path.join(outDir, 'src'),
  bundle: false,
  format: 'esm',
  target: 'es2020',
  sourcemap: false,
  logLevel: 'info',
});

await Promise.all([
  copy('src/lang'),
  copy('src/puzzles'),
  copy('style'),
  copy('third_party'),
  copy('favicon.ico'),
  copy('sw.js'),
]);

await writeFile(path.join(outDir, 'index.html'), builtHtml);
await writeFile(path.join(outDir, '.nojekyll'), '');

console.log(`Built site into ${path.relative(rootDir, outDir)}`);
