/**
 * Scenario: trustee-fuzzy-search
 * Database: cams only
 *
 * Seeds trustees to exercise all name search behaviors:
 *
 *   EXACT MATCHES
 *   - Search "Adams" finds Adams, Adamson, McAdams (substring via prefix/exact)
 *   - Search "Adams" does NOT find Green or Doyaga (the original bug)
 *
 *   PHONETIC VARIANTS (same sound, different spelling)
 *   - "Jon" finds both Jon Whitfield and John Whitmore (JN metaphone)
 *   - "Kathy" finds both Kathy Moore and Cathy Morrison (K0 metaphone, diff initial letter)
 *   - "Steven" finds both Steven and Stephen Harris (STFN metaphone)
 *   - "Smith" finds both Smith and Smyth (SM0 metaphone)
 *
 *   NICKNAME EXPANSION
 *   - "Mike" finds Michael Robertson (nickname relationship)
 *   - "Bob" finds Robert Nguyen (nickname relationship)
 *
 *   PREFIX MATCHING
 *   - "John" finds Johnson (prefix: "john" starts "johnson")
 *   - "Sing" finds Singleassistant (prefix)
 *
 *   TRUSTEES WITHOUT phoneticTokens (regression for CAMS-763 fix)
 *   - These trustees have no phoneticTokens field — search must still find them
 *     via the notExists() pre-filter bypass
 *
 *   SHOULD NOT MATCH (false positive guards)
 *   - "Adams" must NOT return Garcia, Patel, or Nguyen
 *   - "iam" must NOT return Liam (not a prefix, not a word)
 *   - Short common tokens must not produce noise
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import { generateSearchTokens } from '../lib/phonetic-tokens.js';

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

function trustee(opts: {
  id: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  courtId?: string;
  withTokens?: boolean; // default true
}): Record<string, unknown> {
  const name = opts.middleName
    ? `${opts.lastName}, ${opts.firstName} ${opts.middleName}`
    : `${opts.lastName}, ${opts.firstName}`;

  const base = {
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
    updatedOn: '2026-01-01T00:00:00.000Z',
    updatedBy: SEEDER,
  };

  // withTokens defaults to true — only seed without tokens when explicitly testing that scenario
  if (opts.withTokens === false) {
    return base;
  }

  return { ...base, phoneticTokens: generateSearchTokens(name) };
}

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        // ── EXACT / SUBSTRING MATCHES ──────────────────────────────────────────
        // Search "Adams" should return these three
        trustee({ id: 'fzs-adams-john', firstName: 'John', lastName: 'Adams' }),
        trustee({ id: 'fzs-adamson-mary', firstName: 'Mary', lastName: 'Adamson' }),
        trustee({ id: 'fzs-mcadams-rob', firstName: 'Robert', lastName: 'McAdams' }),

        // Search "Adams" must NOT return these (original CAMS-763 false positives)
        trustee({ id: 'fzs-doyaga-david', firstName: 'David', lastName: 'Doyaga' }),
        trustee({ id: 'fzs-green-david', firstName: 'David', middleName: 'M.', lastName: 'Green' }),

        // ── PHONETIC VARIANTS ──────────────────────────────────────────────────
        // Jon vs John — both metaphone "JN", similar length (3 vs 4, both <=4, diff=1)
        trustee({ id: 'fzs-jon-whitfield', firstName: 'Jon', lastName: 'Whitfield' }),
        trustee({ id: 'fzs-john-whitmore', firstName: 'John', lastName: 'Whitmore' }),

        // Kathy vs Cathy — different initial letter, same metaphone "K0"
        trustee({ id: 'fzs-kathy-moore', firstName: 'Kathy', lastName: 'Moore' }),
        trustee({ id: 'fzs-cathy-morrison', firstName: 'Cathy', lastName: 'Morrison' }),

        // Steven vs Stephen — same metaphone "STFN"
        trustee({ id: 'fzs-steven-harris', firstName: 'Steven', lastName: 'Harris' }),
        trustee({ id: 'fzs-stephen-harris', firstName: 'Stephen', lastName: 'Harris' }),

        // Smith vs Smyth — same metaphone "SM0"
        trustee({ id: 'fzs-smith-jane', firstName: 'Jane', lastName: 'Smith' }),
        trustee({ id: 'fzs-smyth-jane', firstName: 'Jane', lastName: 'Smyth' }),

        // Phillip vs Philip — same metaphone "FLP"
        trustee({ id: 'fzs-phillip-evans', firstName: 'Phillip', lastName: 'Evans' }),
        trustee({ id: 'fzs-philip-evans', firstName: 'Philip', lastName: 'Evans' }),

        // ── NICKNAME EXPANSION ─────────────────────────────────────────────────
        // Search "Mike" should find Michael (nickname relationship)
        trustee({ id: 'fzs-michael-rob', firstName: 'Michael', lastName: 'Robertson' }),

        // Search "Bob" should find Robert (nickname relationship)
        trustee({ id: 'fzs-robert-nguyen', firstName: 'Robert', lastName: 'Nguyen' }),

        // Search "Liz" should find Elizabeth (nickname relationship)
        trustee({ id: 'fzs-elizabeth-cho', firstName: 'Elizabeth', lastName: 'Cho' }),

        // ── PREFIX MATCHING ────────────────────────────────────────────────────
        // Search "John" prefix-matches "Johnson"
        trustee({ id: 'fzs-johnson-carl', firstName: 'Carl', lastName: 'Johnson' }),

        // Search "Sing" prefix-matches "Singleassistant"
        trustee({ id: 'fzs-liam-single', firstName: 'Liam', lastName: 'Singleassistant' }),

        // Search "Will" prefix-matches "Williams"
        trustee({ id: 'fzs-williams-pat', firstName: 'Patricia', lastName: 'Williams' }),

        // ── TRUSTEES WITHOUT phoneticTokens (CAMS-763 regression guard) ────────
        // These must still appear in search results despite missing phoneticTokens.
        // The pre-filter bypasses them via notExists(), and the score stage finds
        // exact/prefix matches on the name field directly.
        trustee({
          id: 'fzs-no-tokens-garcia',
          firstName: 'Maria',
          lastName: 'Garcia',
          withTokens: false,
        }),
        trustee({
          id: 'fzs-no-tokens-patel',
          firstName: 'Priya',
          lastName: 'Patel',
          withTokens: false,
        }),
        trustee({
          id: 'fzs-no-tokens-chen',
          firstName: 'Wei',
          lastName: 'Chen',
          withTokens: false,
        }),
        trustee({
          id: 'fzs-no-tokens-liam',
          firstName: 'Liam',
          lastName: 'Notoken',
          withTokens: false,
        }),

        // ── HYPHENATED NAMES ───────────────────────────────────────────────────
        // Hyphens are treated as word separators — "Smith" should find "Smith-Jones"
        trustee({ id: 'fzs-smith-jones', firstName: 'Mary', lastName: 'Smith-Jones' }),

        // ── SPECIAL CHARACTERS ────────────────────────────────────────────────
        // Accented characters are normalized — "Jose" should find "José"
        trustee({ id: 'fzs-jose-garcia', firstName: 'José', lastName: 'García' }),

        // ── FALSE POSITIVE GUARDS ──────────────────────────────────────────────
        // These should never appear in searches that don't target them.
        // Included so manual testing can verify absence in results.
        trustee({ id: 'fzs-unrelated-xyz', firstName: 'Zara', lastName: 'Xylophones' }),
      ],
    },
  ];
}
