/**
 * Scenario: trustee-bowden
 * Database: cams only
 *
 * Seeds a trustee with last name "Bowden" for manual search testing.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { generateSearchTokens } from '../lib/phonetic-tokens.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

function trustee(opts: {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
}): Record<string, unknown> {
  const name = opts.middleName
    ? `${opts.lastName}, ${opts.firstName} ${opts.middleName}`
    : `${opts.lastName}, ${opts.firstName}`;

  return {
    id: opts.id,
    documentType: 'TRUSTEE',
    trusteeId: opts.id,
    name,
    firstName: opts.firstName,
    ...(opts.middleName ? { middleName: opts.middleName } : {}),
    lastName: opts.lastName,
    status: 'active',
    public: {
      address: {
        address1: '1 Test St',
        city: 'Testville',
        state: 'NY',
        zipCode: '10001',
        countryCode: 'US',
      },
      phone: { number: '212-555-0000' },
      email: `${opts.id}@example.com`,
    },
    phoneticTokens: generateSearchTokens(name),
    updatedOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SEEDER,
  };
}

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [trustee({ id: 'seed-bowden-alex', firstName: 'Alex', lastName: 'Bowden' })],
    },
  ];
}
