#!/usr/bin/env ts-node
/**
 * Utility script to generate password hashes for DEV_USERS environment variable.
 *
 * Usage:
 *   tsx ops/scripts/generate-dev-oauth2-password-hash.ts <password>
 *
 * Example:
 *   tsx ops/scripts/generate-dev-oauth2-password-hash.ts mypassword123
 *
 * Output format: scrypt$<salt>$<hash>
 * This output can be used in the DEV_USERS environment variable as the passwordHash field.
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
    console.error('  tsx ops/scripts/generate-dev-oauth2-password-hash.ts <password>');
    console.error('');
    console.error('Example:');
    console.error('  tsx ops/scripts/generate-dev-oauth2-password-hash.ts mypassword123');
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
  console.log('Use this hash in your DEV_USERS environment variable:');
  console.log(
    `DEV_USERS='[{"username":"yourusername","passwordHash":"${hash}","name":"Your Name","roles":["TrialAttorney","PrivilegedIdentityUser"],"offices":["USTP_CAMS_Region_2_Office_Manhattan"]}]'`,
  );
}

main().catch((error) => {
  console.error('Error generating password hash:', error);
  process.exit(1);
});
