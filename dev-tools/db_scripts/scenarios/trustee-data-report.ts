/**
 * Scenario: trustee-data-report
 * Databases: TOD (ATS: TRUSTEES, CHAPTER_DETAILS) and cams (trustees)
 *
 * Seeds linked CAMS and TOD trustees so the Admin → Trustee Data Report shows every kind of
 * result. The cases and their data come from the integration harness
 * (test/integration/trustee-data-report, scenario IDs in brackets), moved into the reserved TOD
 * ID range (lib/tod-seed-ids.ts) with the harness ID as the last digits. All data is invented.
 *
 * Expected results from these trustees alone (other TOD and CAMS trustees in the environment add
 * to the counts):
 *   - 7 trustees compared: 1 exact match [S01] and 6 that each differ in one field: name [S12],
 *     company name [S13], public address [S14], internal address [S15], phone [S16], email [S17]
 *   - 3 in TOD only: active [S20], active only through 12CBC status 2 [S44], and an empty status,
 *     flagged "Status missing, needs review" [S41]
 *   - 1 in CAMS only: a CAMS trustee whose TOD ID does not exist in TOD
 *
 * Unseed removes the TOD rows by ID range and the CAMS trustees by their seed- ids.
 */

import type { SeedOperation } from '../../runner.js';
import { generateSearchTokens } from '../lib/phonetic-tokens.js';
import { TOD_SEED_ID_MIN } from '../lib/tod-seed-ids.js';

type Address = {
  address1: string;
  city: string;
  state: string;
  zipCode: string;
  countryCode: 'US';
};

type TodTrustee = {
  harnessId: number;
  lastName: string;
  firstName: string;
  company?: string;
  street: string;
  zip?: string;
  internalStreet?: string;
  internalZip?: string;
  phone: string;
  email: string;
  chapter: string;
  status: string;
};

type CamsProfile = {
  name: string;
  firstName: string;
  lastName: string;
  public: { address: Address; phone?: { number: string }; email?: string; companyName?: string };
  internal?: { address: Address };
};

export const todId = (harnessId: number) => TOD_SEED_ID_MIN + harnessId;

const springfield = (address1: string, zipCode = '62701'): Address => ({
  address1,
  city: 'Springfield',
  state: 'IL',
  zipCode,
  countryCode: 'US',
});

const linkedTod = (
  harnessId: number,
  firstName: string,
  lastName: string,
  contact: Partial<TodTrustee>,
): TodTrustee => ({
  harnessId,
  firstName,
  lastName,
  street: '',
  phone: '',
  email: '',
  chapter: '7',
  status: 'PA',
  ...contact,
});

/** The TOD record and the CAMS trustee linked to it, with the CAMS profile as stored. */
const LINKED: { slug: string; tod: TodTrustee; cams: CamsProfile }[] = [
  {
    slug: 'exact-match',
    tod: linkedTod(10, 'Avery', 'Exact', {
      street: '100 Main St',
      phone: '217-555-0110',
      email: 'avery.exact@example.com',
    }),
    cams: {
      name: 'Avery Exact',
      firstName: 'Avery',
      lastName: 'Exact',
      public: {
        address: springfield('100 Main St'),
        phone: { number: '217-555-0110' },
        email: 'avery.exact@example.com',
      },
    },
  },
  {
    slug: 'name',
    tod: linkedTod(21, 'Robert', 'Browne', {
      street: '2100 Name St',
      phone: '217-555-0121',
      email: 'robert.browne@example.com',
    }),
    cams: {
      name: 'Robert Brown',
      firstName: 'Robert',
      lastName: 'Brown',
      public: {
        address: springfield('2100 Name St'),
        phone: { number: '217-555-0121' },
        email: 'robert.browne@example.com',
      },
    },
  },
  {
    slug: 'company',
    tod: linkedTod(22, 'Jamie', 'Firm', {
      company: 'Old Firm LLP',
      street: '2200 Company St',
      phone: '217-555-0122',
      email: 'jamie.firm@example.com',
    }),
    cams: {
      name: 'Jamie Firm',
      firstName: 'Jamie',
      lastName: 'Firm',
      public: {
        address: springfield('2200 Company St'),
        phone: { number: '217-555-0122' },
        email: 'jamie.firm@example.com',
        companyName: 'New Firm LLP',
      },
    },
  },
  {
    slug: 'public-address',
    tod: linkedTod(23, 'Kai', 'Mover', {
      street: '500 Pine St',
      phone: '217-555-0123',
      email: 'kai.mover@example.com',
    }),
    cams: {
      name: 'Kai Mover',
      firstName: 'Kai',
      lastName: 'Mover',
      public: {
        address: springfield('501 Pine St'),
        phone: { number: '217-555-0123' },
        email: 'kai.mover@example.com',
      },
    },
  },
  {
    slug: 'internal-address',
    tod: linkedTod(24, 'Lane', 'Backoffice', {
      street: '2400 Front St',
      internalStreet: '600 Back St',
      internalZip: '62703',
      phone: '217-555-0124',
      email: 'lane.backoffice@example.com',
    }),
    cams: {
      name: 'Lane Backoffice',
      firstName: 'Lane',
      lastName: 'Backoffice',
      public: {
        address: springfield('2400 Front St'),
        phone: { number: '217-555-0124' },
        email: 'lane.backoffice@example.com',
      },
      internal: { address: springfield('601 Back St', '62703') },
    },
  },
  {
    slug: 'phone',
    tod: linkedTod(25, 'Morgan', 'Caller', {
      street: '2500 Ring Rd',
      phone: '217-555-0125',
      email: 'morgan.caller@example.com',
    }),
    cams: {
      name: 'Morgan Caller',
      firstName: 'Morgan',
      lastName: 'Caller',
      public: {
        address: springfield('2500 Ring Rd'),
        phone: { number: '217-555-0199' },
        email: 'morgan.caller@example.com',
      },
    },
  },
  {
    slug: 'email',
    tod: linkedTod(26, 'Noel', 'Mailer', {
      street: '2600 Post Rd',
      phone: '217-555-0126',
      email: 'noel.mailer@example.com',
    }),
    cams: {
      name: 'Noel Mailer',
      firstName: 'Noel',
      lastName: 'Mailer',
      public: {
        address: springfield('2600 Post Rd'),
        phone: { number: '217-555-0126' },
        email: 'noel.mailer@example.org',
      },
    },
  },
];

/** TOD trustees no CAMS trustee links to. */
const TOD_ONLY: TodTrustee[] = [
  linkedTod(30, 'Quinn', 'Todonly', {
    street: '3000 Lone Rd',
    phone: '217-555-0130',
    email: 'quinn.todonly@example.com',
  }),
  linkedTod(51, 'Hale', 'Emptystatus', {
    street: '5100 Code St',
    phone: '217-555-0151',
    email: 'hale.emptystatus@example.com',
    status: '',
  }),
  linkedTod(54, 'Kit', 'Casebycase', {
    street: '5400 Code St',
    phone: '217-555-0154',
    email: 'kit.casebycase@example.com',
    chapter: '12CBC',
    status: '2',
  }),
];

/** A TOD ID in the reserved range that no TOD row uses, for the CAMS-only trustee. */
export const MISSING_TOD_ID = todId(99);

const CAMS_ONLY: { slug: string; cams: CamsProfile; truIds: string[] } = {
  slug: 'cams-only',
  truIds: [String(MISSING_TOD_ID)],
  cams: {
    name: 'Xen Native',
    firstName: 'Xen',
    lastName: 'Native',
    public: { address: springfield('2900 New Rd'), phone: { number: '217-555-0129' } },
  },
};

function trusteeRow(tod: TodTrustee) {
  return {
    ID: todId(tod.harnessId),
    LAST_NAME: tod.lastName,
    FIRST_NAME: tod.firstName,
    MIDDLE: null,
    COMPANY: tod.company ?? null,
    STREET: tod.street,
    STREET1: null,
    CITY: 'Springfield',
    STATE: 'IL',
    ZIP: tod.zip ?? '62701',
    ZIP_PLUS: null,
    DISP_ON_WEB: 'Y',
    DISP_ON_WEB_A2: 'N',
    STREET_A2: tod.internalStreet ?? null,
    STREET1_A2: null,
    CITY_A2: tod.internalStreet ? 'Springfield' : null,
    STATE_A2: tod.internalStreet ? 'IL' : null,
    ZIP_A2: tod.internalZip ?? null,
    ZIP_PLUS_A2: null,
    TELEPHONE: tod.phone,
    EMAIL_ADDRESS: tod.email,
  };
}

function camsTrustee(slug: string, profile: CamsProfile, truIds: string[]) {
  const id = `seed-trustee-data-report-${slug}`;
  return {
    id,
    documentType: 'TRUSTEE',
    trusteeId: id,
    ...profile,
    phoneticTokens: generateSearchTokens(profile.name),
    status: 'active',
    legacy: { truIds },
  };
}

export async function generate(): Promise<SeedOperation[]> {
  const todTrustees = [...LINKED.map(({ tod }) => tod), ...TOD_ONLY];

  return [
    {
      db: 'ats',
      collectionOrTable: 'TRUSTEES',
      primaryKey: 'ID',
      data: todTrustees.map(trusteeRow),
    },
    {
      db: 'ats',
      collectionOrTable: 'CHAPTER_DETAILS',
      primaryKey: ['TRU_ID', 'CHAPTER'],
      data: todTrustees.map((tod) => ({
        TRU_ID: todId(tod.harnessId),
        CHAPTER: tod.chapter,
        STATUS: tod.status,
      })),
    },
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        ...LINKED.map(({ slug, tod, cams }) =>
          camsTrustee(slug, cams, [String(todId(tod.harnessId))]),
        ),
        camsTrustee(CAMS_ONLY.slug, CAMS_ONLY.cams, CAMS_ONLY.truIds),
      ],
    },
  ];
}
