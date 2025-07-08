// scripts/generate-key.ts

// Generate a secure API key using Bun's crypto API
const generateApiKey = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  // Convert to base64url
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const apiKey = generateApiKey();
console.log('Generated API Key:', apiKey);
console.log('\nAdd this to your .env file:');
console.log(`WORKER_API_KEY=${apiKey}`);
