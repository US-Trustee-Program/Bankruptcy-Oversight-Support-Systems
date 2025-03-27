import crypto from 'crypto';
// Generate a random 32-byte key (256 bits)
const apiKey = crypto.randomBytes(32).toString('hex');

console.log(`Generated API Key: ${apiKey}`);
process.exit(0);
