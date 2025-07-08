// scripts/dev.ts

import { watch } from 'fs';

console.log('🔧 Starting development server...');

// Start wrangler dev server
const wrangler = Bun.spawn(['bunx', 'wrangler', 'dev', '--local'], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit'
});

// Watch for file changes
console.log('👀 Watching for changes...');

const srcDir = './src';
watch(srcDir, { recursive: true }, (event, filename) => {
  if (filename?.endsWith('.ts')) {
    console.log(`📝 File changed: ${filename}`);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  wrangler.kill();
  process.exit(0);
});
