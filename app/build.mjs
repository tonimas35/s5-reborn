// Construye la app: empaqueta src/ (con three.js) en server/web/app.js
// y copia los ficheros estáticos y las fuentes. El servidor Go los incrusta.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const out = 'server/web';
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'fonts'), { recursive: true });

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020', 'safari14'],
  outfile: join(out, 'app.js'),
  legalComments: 'linked',
  logLevel: 'info'
});

for (const f of readdirSync('static')) cpSync(join('static', f), join(out, f), { recursive: true });

const fontDir = 'node_modules/@fontsource/plus-jakarta-sans/files';
for (const w of [400, 500, 600, 700]) {
  const name = `plus-jakarta-sans-latin-${w}-normal.woff2`;
  cpSync(join(fontDir, name), join(out, 'fonts', name));
}
console.log('Listo: ' + out);
