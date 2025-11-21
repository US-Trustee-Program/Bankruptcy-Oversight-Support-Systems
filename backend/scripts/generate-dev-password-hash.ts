#!/usr/bin/env ts-node
/**
 * Utility script to generate password hashes for dev-users.json file.
 *
 * Usage:
 *   tsx scripts/generate-dev-password-hash.ts <password>
 *
 * Example:
 *   tsx scripts/generate-dev-password-hash.ts mypassword123
 *
 * Output format: scrypt$<salt>$<hash>
 * This output can be used in the dev-users.json file as the passwordHash field.
 */

import * as crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

async function generatePasswordHash(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString('base64')}$${derivedKey.toString('base64')}`;
}

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error('Error: Password argument is required');
    console.error('');
    console.error('Usage:');
    console.error('  tsx scripts/generate-dev-password-hash.ts <password>');
    console.error('');
    console.error('Example:');
    console.error('  tsx scripts/generate-dev-password-hash.ts mypassword123');
    process.exit(1);
  }

  if (password.length < 8) {
    console.warn(
      'Warning: Password is less than 8 characters. Consider using a stronger password.',
    );
    console.warn('');
  }

  const hash = await generatePasswordHash(password);

  console.log('Generated password hash:');
  console.log(hash);
  console.log('');
  console.log('Use this hash in your backend/dev-users.json file:');
  console.log('[');
  console.log('  {');
  console.log('    "username": "yourusername",');
  console.log(`    "passwordHash": "${hash}",`);
  console.log('    "name": "Your Name",');
  console.log('    "roles": ["TrialAttorney", "PrivilegedIdentityUser"],');
  console.log('    "offices": ["USTP_CAMS_Region_2_Office_Manhattan"]');
  console.log('  }');
  console.log(']');
}

main().catch((error) => {
  console.error('Error generating password hash:', error);
  process.exit(1);
});
