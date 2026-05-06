const esbuild = require('esbuild');
const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const ctx = esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  outfile: 'out/extension.js',
  sourcemap: !isProduction,
  minify: isProduction,
});

if (isWatch) {
  ctx.then(c => c.watch());
} else {
  ctx.then(c => c.rebuild().then(() => c.dispose()));
}
