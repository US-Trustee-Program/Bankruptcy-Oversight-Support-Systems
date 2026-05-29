/**
 * Scenario: admin-data
 * Database: cams only
 *
 * Seeds the admin-section entities needed to exercise bank and bankruptcy
 * software routes:
 *
 *   - One active bank (SEED Active Bank)
 *   - One inactive bank (SEED Inactive Bank)
 *   - One active bankruptcy software entry (SEED Active Software)
 *   - One inactive bankruptcy software entry (SEED Inactive Software)
 *
 * No DXTR data needed — these entities are Cosmos-only.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    // ── Cosmos: active bank ──────────────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'banks',
      data: [
        {
          id: 'seed-bank-active-001',
          documentType: 'BANK_PROFILE',
          name: 'Test Bank of America',
          status: 'active',
          updatedOn: '2025-04-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: inactive bank ────────────────────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'banks',
      data: [
        {
          id: 'seed-bank-inactive-001',
          documentType: 'BANK_PROFILE',
          name: 'SEED Inactive Bank',
          status: 'inactive',
          updatedOn: '2025-04-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: active bankruptcy software ───────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'bankruptcy-software',
      data: [
        {
          id: 'seed-software-active-001',
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'BestCase Pro',
          status: 'active',
          contact: {
            contactNames: ['Seed Support Team'],
            address: {
              address1: '400 Software Lane',
              city: 'New York',
              state: 'NY',
              zipCode: '10004',
              countryCode: 'US',
            },
            phone: { number: '212-555-0400' },
            emails: ['support@seedsoftware.example.com'],
            website: 'https://seedsoftware.example.com',
          },
          associatedBanks: [
            {
              bankId: 'seed-bank-active-001',
              bankName: 'Test Bank of America',
              status: 'active',
            },
          ],
          updatedOn: '2025-04-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },

    // ── Cosmos: inactive bankruptcy software ─────────────────────────────────
    {
      db: 'cams',
      collectionOrTable: 'bankruptcy-software',
      data: [
        {
          id: 'seed-software-inactive-001',
          documentType: 'BANKRUPTCY_SOFTWARE',
          name: 'SEED Inactive Software',
          status: 'inactive',
          updatedOn: '2025-04-01T00:00:00.000Z',
          updatedBy: SEEDER,
        },
      ],
    },
  ];
}
