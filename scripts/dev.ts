// scripts/dev.ts

console.log(' Starting development server...');

// Start wrangler dev server
const wrangler = Bun.spawn(['bunx', 'wrangler', 'dev', '--local', '--env', 'development'], {
  stdout: 'inherit',
  stderr: 'inherit',
  stdin: 'inherit'
});

console.log(' Watching for changes...');

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n Shutting down...');
  wrangler.kill();
  process.exit(0);
});
