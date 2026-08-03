import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(rootDir, 'build');

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

await writeFile(path.join(outDir, 'index.html'), `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1, maximum-scale=1">
    <meta charset="utf-8">
    <title>Crosswordle</title>
    <link rel="stylesheet" href="style/style.css">
    <link rel="shortcut icon" href="favicon.ico">
    <script type="module" defer src="src/game.js"></script>
    <script type="module" defer src="src/index.js"></script>
  </head>
  <body>
${(await import('node:fs/promises')).readFile(path.join(rootDir, 'index.html'), 'utf8').then(html => html.split('<body>')[1].split('</body>')[0].trim())}
  </body>
</html>
`);

await writeFile(path.join(outDir, '.nojekyll'), '');

console.log(`Built site into ${path.relative(rootDir, outDir)}`);
