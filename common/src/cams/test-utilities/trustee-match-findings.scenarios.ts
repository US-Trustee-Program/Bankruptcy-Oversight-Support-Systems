/**
 * Fixture inputs for the trustee-match pipeline, one per identity-task shape the seeds and UI tests
 * need. Plain data only: no faker and no backend import, so the app bundle (mock-api2) and
 * dev-tools can import what is generated from it.
 *
 * The findings themselves are never written by hand. The backend test
 * trustee-match-findings.generator.test.ts runs runTrusteeMatchPipeline over each scenario and
 * writes the serialized states to trustee-match-findings.generated.json. To regenerate after
 * changing a scenario or a scorer, run `npm test -- -u trustee-match-findings.generator` in
 * backend/.
 *
 * Every scenario must leave the pipeline unresolved, since a resolved match writes an appointment,
 * not an identity task. That constrains the shapes:
 *   - A sole candidate with an exact name resolves (resolveByNameOnly) unless its state conflicts
 *     or it has no contact data, so a one-candidate task with an exact name always has a state
 *     difference or nothing to compare.
 *   - A passing name plus an exact phone, a matching email, or 3+ address points resolves.
 *   - An outright surname match with an agreeing state resolves (resolveByStateOnly).
 */
import { DxtrTrusteeParty } from '../dataflow-events';
import { Address } from '../contact';
import { computeTrusteeName, Trustee } from '../trustees';

export type TrusteeMatchFindingsScenario = {
  /** The DXTR source record, before the sync attaches legacy.parsedCityStateZip. */
  source: DxtrTrusteeParty;
  /** Every CAMS trustee in the pool the pipeline searches. Each scenario's pool is searched on its
   * own, so keep surnames distinct across scenarios that a seed inserts together. */
  trustees: Trustee[];
  expectedCandidateCount: number;
};

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

const NO_ADDRESS: Address = {
  address1: '',
  city: '',
  state: '',
  zipCode: '',
  countryCode: 'US',
};

function camsTrustee(fields: {
  trusteeId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  address?: Omit<Address, 'countryCode'>;
  phone?: string;
  email?: string;
}): Trustee {
  const { trusteeId, firstName, middleName, lastName, address, phone, email } = fields;
  return {
    id: trusteeId,
    trusteeId,
    firstName,
    ...(middleName ? { middleName } : {}),
    lastName,
    name: computeTrusteeName(firstName, middleName, lastName),
    status: 'active',
    public: {
      address: address ? { ...address, countryCode: 'US' } : NO_ADDRESS,
      ...(phone ? { phone: { number: phone } } : {}),
      ...(email ? { email } : {}),
    },
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: SEEDER,
  };
}

const TAYLOR_MULTIMATCH = camsTrustee({
  trusteeId: 'seed-trustee-match-multi-a',
  firstName: 'Taylor',
  lastName: 'Multimatch',
  address: { address1: '300 Match Ave', city: 'New York', state: 'NY', zipCode: '10003' },
  phone: '212-555-3000',
  email: 'taylor.multimatch@example.com',
});

const TYLER_MULTIMATCH = camsTrustee({
  trusteeId: 'seed-trustee-match-multi-b',
  firstName: 'Tyler',
  lastName: 'Multimatch',
  address: { address1: '301 Match Ave', city: 'New York', state: 'NY', zipCode: '10003' },
  phone: '212-555-3001',
  email: 'tyler.multimatch@example.com',
});

const SAM_SEEDTRUSTEE = camsTrustee({
  trusteeId: 'seed-trustee-active-001',
  firstName: 'Sam',
  lastName: 'Seedtrustee',
  address: { address1: '200 Trustee Ave', city: 'New York', state: 'NY', zipCode: '10002' },
  phone: '212-555-0200',
  email: 'sam.seedtrustee@example.com',
});

const PAT_SEEDTRUSTEE = {
  ...camsTrustee({
    trusteeId: 'seed-trustee-inactive-001',
    firstName: 'Pat',
    lastName: 'Seedtrustee',
    address: { address1: '300 Trustee Blvd', city: 'New York', state: 'NY', zipCode: '10003' },
    phone: '212-555-0300',
    email: 'pat.seedtrustee@example.com',
  }),
  status: 'inactive',
} satisfies Trustee;

export const TRUSTEE_MATCH_FINDINGS_SCENARIOS = {
  // No CAMS trustee shares any part of the name.
  noCandidates: {
    source: {
      firstName: 'Unique',
      lastName: 'Nomatch',
      fullName: 'Unique Nomatch',
      legacy: {
        address1: '1 Nowhere Rd',
        cityStateZipCountry: 'Albany NY 12207',
        phone: '518-555-0100',
      },
    },
    trustees: [],
    expectedCandidateCount: 0,
  },

  // "T" is an initial of both given names, and both share the source's city, state and zip but
  // not its street, so they tie at every resolver.
  multipleCandidates: {
    source: {
      firstName: 'T',
      lastName: 'Multimatch',
      fullName: 'T Multimatch',
      legacy: {
        address1: '1 Source St',
        cityStateZipCountry: 'New York NY 10003',
        phone: '212-555-9999',
      },
    },
    trustees: [TAYLOR_MULTIMATCH, TYLER_MULTIMATCH],
    expectedCandidateCount: 2,
  },

  // Exact name and city; the source sends no zip, street, phone or email, so the state is the only
  // difference, and it blocks resolveByNameOnly.
  oneCandidateStateDiffers: {
    source: {
      firstName: 'Morgan',
      lastName: 'Stateline',
      fullName: 'Morgan Stateline',
      legacy: { cityStateZipCountry: 'Texarkana TX' },
    },
    trustees: [
      camsTrustee({
        trusteeId: 'seed-trustee-match-stateline',
        firstName: 'Morgan',
        lastName: 'Stateline',
        address: {
          address1: '100 State Line Ave',
          city: 'Texarkana',
          state: 'AR',
          zipCode: '71854',
        },
        phone: '870-555-0100',
        email: 'morgan.stateline@example.com',
      }),
    ],
    expectedCandidateCount: 1,
  },

  // The street, city, zip and phone all differ. The surname is misspelled, so the name is only a
  // fuzzy match: an exact name would resolve on its own (see the file comment).
  oneCandidateAddressAndPhoneDiffer: {
    source: {
      firstName: 'Jordan',
      lastName: 'Imperfectmach',
      fullName: 'Jordan Imperfectmach',
      legacy: {
        address1: '12 Harbor Rd',
        cityStateZipCountry: 'Albany NY 12207',
        phone: '518-555-9999',
      },
    },
    trustees: [
      camsTrustee({
        trusteeId: 'seed-trustee-match-imperfect',
        firstName: 'Jordan',
        lastName: 'Imperfectmatch',
        address: { address1: '400 Match Blvd', city: 'New York', state: 'NY', zipCode: '10004' },
        phone: '212-555-4000',
        email: 'jordan.imperfectmatch@example.com',
      }),
    ],
    expectedCandidateCount: 1,
  },

  // A given-name initial, a different zip and a different email. The source's city line has no
  // state, so the agreeing city is the only address point.
  oneCandidateNameAddressEmailDiffer: {
    source: {
      firstName: 'Q',
      lastName: 'Lakeshore',
      fullName: 'Q Lakeshore',
      legacy: {
        cityStateZipCountry: 'Chicago 60611',
        email: 'q.lakeshore@example.org',
      },
    },
    trustees: [
      camsTrustee({
        trusteeId: 'seed-trustee-match-lakeshore',
        firstName: 'Quinn',
        lastName: 'Lakeshore',
        address: { address1: '900 Lake Shore Dr', city: 'Chicago', state: 'IL', zipCode: '60601' },
        phone: '312-555-0900',
        email: 'quinn.lakeshore@example.com',
      }),
    ],
    expectedCandidateCount: 1,
  },

  // Exact name, but the trustee has moved: every contact field differs, including the state.
  oneCandidateExactName: {
    source: {
      firstName: 'Rowan',
      lastName: 'Relocated',
      fullName: 'Rowan Relocated',
      legacy: {
        address1: '55 Desert Way',
        cityStateZipCountry: 'Phoenix AZ 85004',
        phone: '602-555-0155',
        email: 'rowan@relocated.example.com',
      },
    },
    trustees: [
      camsTrustee({
        trusteeId: 'seed-trustee-match-relocated',
        firstName: 'Rowan',
        lastName: 'Relocated',
        address: { address1: '10 Old Town Rd', city: 'Denver', state: 'CO', zipCode: '80202' },
        phone: '303-555-0110',
        email: 'rowan.relocated@example.com',
      }),
    ],
    expectedCandidateCount: 1,
  },

  // Exact name, and the CAMS trustee has no contact data at all, so nothing is compared and
  // resolveByNameOnly declines.
  oneCandidateNothingDiffers: {
    source: {
      firstName: 'Sky',
      lastName: 'Unlisted',
      fullName: 'Sky Unlisted',
      legacy: {
        address1: '1 Main St',
        cityStateZipCountry: 'Boston MA 02108',
        phone: '617-555-0100',
      },
    },
    trustees: [
      camsTrustee({
        trusteeId: 'seed-trustee-match-unlisted',
        firstName: 'Sky',
        lastName: 'Unlisted',
      }),
    ],
    expectedCandidateCount: 1,
  },

  // trustee-match-all-scenarios: a name-only source whose given name differs from the one
  // candidate sharing its surname. Its fingerprint keys three surrogate case appointments.
  multiCase: {
    source: { firstName: 'Casey', lastName: 'Multicasematch', fullName: 'Casey Multicasematch' },
    trustees: [
      camsTrustee({
        trusteeId: 'seed-trustee-match-multicase',
        firstName: 'Cassidy',
        lastName: 'Multicasematch',
        address: { address1: '700 Match Ln', city: 'New York', state: 'NY', zipCode: '10007' },
        phone: '212-555-7000',
        email: 'cassidy.multicasematch@example.com',
      }),
    ],
    expectedCandidateCount: 1,
  },

  // trustee-match-all-scenarios: the same shape as multiCase, for the division-mismatch task.
  divisionMismatch: {
    source: {
      firstName: 'Devon',
      lastName: 'Divisionmismatch',
      fullName: 'Devon Divisionmismatch',
    },
    trustees: [
      camsTrustee({
        trusteeId: 'seed-trustee-match-divisionmismatch',
        firstName: 'Dana',
        lastName: 'Divisionmismatch',
        address: { address1: '800 Match Pl', city: 'Buffalo', state: 'NY', zipCode: '14201' },
        phone: '716-555-8000',
        email: 'dana.divisionmismatch@example.com',
      }),
    ],
    expectedCandidateCount: 1,
  },

  // trustee-match-all-scenarios: same tie-at-every-resolver shape as multipleCandidates, for a
  // pending task the seed gives zero surrogate case appointments (a genuinely zero affected-case
  // count, not merely an unloaded one).
  multipleCandidatesNoCases: {
    source: {
      firstName: 'J',
      lastName: 'Nocasematch',
      fullName: 'J Nocasematch',
      legacy: {
        address1: '1 Source Way',
        cityStateZipCountry: 'New York NY 10009',
        phone: '212-555-9998',
      },
    },
    trustees: [
      camsTrustee({
        trusteeId: 'seed-trustee-match-nocases-a',
        firstName: 'Jamie',
        lastName: 'Nocasematch',
        address: { address1: '500 Nocase Ave', city: 'New York', state: 'NY', zipCode: '10009' },
        phone: '212-555-9001',
        email: 'jamie.nocasematch@example.com',
      }),
      camsTrustee({
        trusteeId: 'seed-trustee-match-nocases-b',
        firstName: 'Jesse',
        lastName: 'Nocasematch',
        address: { address1: '501 Nocase Ave', city: 'New York', state: 'NY', zipCode: '10009' },
        phone: '212-555-9002',
        email: 'jesse.nocasematch@example.com',
      }),
    ],
    expectedCandidateCount: 2,
  },

  // trustee-match-all-scenarios: same tie-at-every-resolver shape as multipleCandidates, for a
  // pending task that never had an originating case at all (CAMS-953 Slice 5, no caseId/courtId).
  multipleCandidatesCaseless: {
    source: {
      firstName: 'C',
      lastName: 'Caselessmatch',
      fullName: 'C Caselessmatch',
      legacy: {
        address1: '1 Source Pl',
        cityStateZipCountry: 'New York NY 10011',
        phone: '212-555-9997',
      },
    },
    trustees: [
      camsTrustee({
        trusteeId: 'seed-trustee-match-caseless-a',
        firstName: 'Casey',
        lastName: 'Caselessmatch',
        address: { address1: '502 Caseless Ave', city: 'New York', state: 'NY', zipCode: '10011' },
        phone: '212-555-9101',
        email: 'casey.caselessmatch@example.com',
      }),
      camsTrustee({
        trusteeId: 'seed-trustee-match-caseless-b',
        firstName: 'Carter',
        lastName: 'Caselessmatch',
        address: { address1: '503 Caseless Ave', city: 'New York', state: 'NY', zipCode: '10011' },
        phone: '212-555-9102',
        email: 'carter.caselessmatch@example.com',
      }),
    ],
    expectedCandidateCount: 2,
  },

  // trustee-match-all-scenarios: approved tasks whose pipeline run found no candidate.
  resolvedNoSurrogates: {
    source: { firstName: 'Riley', lastName: 'Resolvedmatch', fullName: 'Riley Resolvedmatch' },
    trustees: [],
    expectedCandidateCount: 0,
  },
  resolvedWithSnapshot: {
    source: { firstName: 'Drew', lastName: 'Snapshotmatch', fullName: 'Drew Snapshotmatch' },
    trustees: [],
    expectedCandidateCount: 0,
  },

  // trustee-data: a name-only source. Both trustees named Seedtrustee are recalled; "Samuel" and
  // "Sam" are a known nickname pair, "Pat" matches nothing.
  seedTrusteeNickname: {
    source: { firstName: 'Samuel', lastName: 'Seedtrustee', fullName: 'Samuel Seedtrustee' },
    trustees: [SAM_SEEDTRUSTEE, PAT_SEEDTRUSTEE],
    expectedCandidateCount: 2,
  },
} satisfies Record<string, TrusteeMatchFindingsScenario>;

export type TrusteeMatchScenarioKey = keyof typeof TRUSTEE_MATCH_FINDINGS_SCENARIOS;
