// scripts/build.ts

export {};

console.log(' Building Cloudflare Worker with Bun...');

// Build the worker bundle
const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'browser',
  format: 'esm',
  splitting: false,
  sourcemap: 'external',
  minify: { whitespace: true, identifiers: false, syntax: true },
  external: [
    // Cloudflare Workers runtime APIs
    'node:*',
    'cloudflare:*'
  ]
});

if (!result.success) {
  console.error(' Build failed:', result.logs);
  process.exit(1);
}

console.log(' Build completed successfully!');
console.log(' Output files:', result.outputs.map(o => o.path));

// Copy wrangler config to dist for deployment convenience
const wranglerConfig = Bun.file('wrangler.jsonc');
if (await wranglerConfig.exists()) {
  await Bun.write('dist/wrangler.jsonc', wranglerConfig);
}

console.log(' Ready for deployment!');
