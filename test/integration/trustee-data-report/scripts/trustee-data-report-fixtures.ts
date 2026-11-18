/**
 * CAMS trustees and expected results for the trustee data report harness. The TOD side of each
 * scenario is in ../seed/01-seed-trustees.sql (rows) and 02-seed-chapter-details.sql (statuses).
 *
 * Expected values are written out, not computed with transformTrusteeRecord, so a change to the
 * migration's cleanup shows up here as a failure instead of moving the expectation with it.
 * All data is synthetic.
 */

export type Field =
  'name' | 'companyName' | 'publicAddress' | 'internalAddress' | 'phone' | 'email';

export type ExpectedDifference =
  | { kind: 'field'; field: Field; camsValue?: string; todValue?: string; todIds: string[] }
  | { kind: 'tod-only'; trusteeName: string; todIds: string[] }
  | { kind: 'cams-only'; todIds: string[] };

type Address = {
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  countryCode: 'US';
};

export type CamsTrusteeFixture = {
  trusteeId: string;
  name: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  public: {
    address: Address;
    phone?: { number: string; extension?: string };
    email?: string;
    companyName?: string;
  };
  internal?: { address?: Address; phone?: { number: string }; email?: string };
  legacy?: { truIds: string[] };
};

export type Scenario = {
  id: string;
  title: string;
  /** The CAMS trustee, when the scenario has one. */
  cams?: CamsTrusteeFixture;
  /** TOD IDs whose TOD-only rows belong to this scenario. */
  todIds?: string[];
  /** Every difference the report should record for this scenario, and nothing else. */
  expected: ExpectedDifference[];
  /** Whether the run counts this CAMS trustee as compared. */
  compared?: boolean;
};

export const TRUSTEE_ID_PREFIX = 'TDR-';

function address(
  address1: string,
  city: string,
  state: string,
  zipCode: string,
  address2?: string,
): Address {
  return { address1, ...(address2 ? { address2 } : {}), city, state, zipCode, countryCode: 'US' };
}

const springfield = (street: string, zip = '62701') => address(street, 'Springfield', 'IL', zip);

function linked(
  id: string,
  firstName: string,
  lastName: string,
  todIds: string[],
  publicContact: CamsTrusteeFixture['public'],
  extra: Partial<CamsTrusteeFixture> = {},
): CamsTrusteeFixture {
  return {
    trusteeId: `${TRUSTEE_ID_PREFIX}${id}`,
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    public: publicContact,
    legacy: { truIds: todIds },
    ...extra,
  };
}

export const SCENARIOS: Scenario[] = [
  // ── Linked trustees whose profiles match ────────────────────────────────────
  {
    id: 'S01',
    title: 'Exact match reports nothing',
    cams: linked('S01', 'Avery', 'Exact', ['10'], {
      address: springfield('100 Main St'),
      phone: { number: '217-555-0110' },
      email: 'avery.exact@example.com',
    }),
    compared: true,
    expected: [],
  },
  {
    id: 'S02',
    title:
      'Formatting-only differences (padded and double-spaced values, phone punctuation, email case) are not reported',
    cams: linked('S02', 'Blake', 'Formatting', ['11'], {
      address: address('200 Oak Ave', 'Shelbyville', 'IL', '62565'),
      phone: { number: '217.555.0111' },
      email: 'blake.formatting@example.com',
    }),
    compared: true,
    expected: [],
  },
  {
    id: 'S03',
    title: 'Address line 2 and a separate ZIP_PLUS match the CAMS address',
    cams: linked('S03', 'Cameron', 'Suite', ['12'], {
      address: address('300 Elm Rd', 'Capital City', 'IL', '62702-1234', 'Suite 400'),
      phone: { number: '217-555-0112' },
      email: 'cameron.suite@example.com',
    }),
    compared: true,
    expected: [],
  },
  {
    id: 'S04',
    title: 'A ZIP with a leading zero and a ZIP_PLUS matches the formatted CAMS ZIP',
    cams: linked('S04', 'Dana', 'Zeroes', ['13'], {
      address: address('1 Harbor Way', 'Boston', 'MA', '02108-0001'),
      phone: { number: '617-555-0113' },
      email: 'dana.zeroes@example.com',
    }),
    compared: true,
    expected: [],
  },
  {
    id: 'S05',
    title: 'When only DISP_ON_WEB_A2 is y, the second address is the public one',
    cams: linked(
      'S05',
      'Emery',
      'Publictwo',
      ['14'],
      {
        address: address('401 Public Ave', 'Wilmington', 'DE', '19801', 'Suite 2'),
        phone: { number: '302-555-0114' },
        email: 'emery.publictwo@example.com',
      },
      { internal: { address: address('400 Private Rd', 'Dover', 'DE', '19901') } },
    ),
    compared: true,
    expected: [],
  },
  {
    id: 'S06',
    title: 'When both display flags are y, the first address stays public',
    cams: linked(
      'S06',
      'Finley',
      'Bothflags',
      ['15'],
      {
        address: address('500 First St', 'Madison', 'WI', '53703'),
        phone: { number: '608-555-0115' },
        email: 'finley.bothflags@example.com',
      },
      { internal: { address: address('502 Second St', 'Madison', 'WI', '53704') } },
    ),
    compared: true,
    expected: [],
  },
  {
    id: 'S07',
    title:
      'A TOD record with no name is compared as "Unknown", so a CAMS trustee with a real name gets a name difference (open question)',
    cams: {
      trusteeId: `${TRUSTEE_ID_PREFIX}S07`,
      name: 'Pat Noname',
      firstName: 'Pat',
      lastName: 'Noname',
      public: {
        address: address('600 Commerce Dr', 'Columbus', 'OH', '43215'),
        phone: { number: '614-555-0116' },
      },
      legacy: { truIds: ['16'] },
    },
    compared: true,
    expected: [
      {
        kind: 'field',
        field: 'name',
        camsValue: 'Pat Noname',
        todValue: 'Unknown',
        todIds: ['16'],
      },
    ],
  },
  {
    id: 'S08',
    title: 'A middle initial and a suffix in LAST_NAME match the CAMS name',
    cams: linked(
      'S08',
      'Mary',
      'Jones, Jr.',
      ['17'],
      {
        address: address('700 Maple Ln', 'Austin', 'TX', '78701'),
        phone: { number: '512-555-0117' },
        email: 'mary.jones@example.com',
      },
      { name: 'Mary K. Jones, Jr.', middleName: 'K.' },
    ),
    compared: true,
    expected: [],
  },
  {
    id: 'S09',
    title: 'Empty-string TOD columns match absent CAMS fields',
    cams: linked('S09', 'Gale', 'Blanks', ['18'], {
      address: address('800 Quiet Ct', 'Denver', 'CO', '80202'),
    }),
    compared: true,
    expected: [],
  },
  {
    id: 'S10',
    title:
      'A TOD phone with extension digits after the number matches the same number and extension in CAMS',
    cams: linked('S10', 'Harper', 'Extension', ['19'], {
      address: address('900 Dial Ave', 'Portland', 'OR', '97204'),
      phone: { number: '503-555-0119', extension: '204' },
      email: 'harper.extension@example.com',
    }),
    compared: true,
    expected: [],
  },
  {
    id: 'S11',
    title: 'An eleven-digit TOD phone with a country code matches the ten-digit CAMS phone',
    cams: linked('S11', 'Indigo', 'Country', ['20'], {
      address: address('1000 Coast Hwy', 'Seattle', 'WA', '98101'),
      phone: { number: '206-555-0120' },
      email: 'indigo.country@example.com',
    }),
    compared: true,
    expected: [],
  },

  // ── Linked trustees with one real difference each ───────────────────────────
  {
    id: 'S12',
    title: 'A different name is reported',
    cams: linked('S12', 'Robert', 'Brown', ['21'], {
      address: springfield('2100 Name St'),
      phone: { number: '217-555-0121' },
      email: 'robert.browne@example.com',
    }),
    compared: true,
    expected: [
      {
        kind: 'field',
        field: 'name',
        camsValue: 'Robert Brown',
        todValue: 'Robert Browne',
        todIds: ['21'],
      },
    ],
  },
  {
    id: 'S13',
    title: 'A different company name is reported',
    cams: linked('S13', 'Jamie', 'Firm', ['22'], {
      address: springfield('2200 Company St'),
      phone: { number: '217-555-0122' },
      email: 'jamie.firm@example.com',
      companyName: 'New Firm LLP',
    }),
    compared: true,
    expected: [
      {
        kind: 'field',
        field: 'companyName',
        camsValue: 'New Firm LLP',
        todValue: 'Old Firm LLP',
        todIds: ['22'],
      },
    ],
  },
  {
    id: 'S14',
    title: 'A different public address is reported',
    cams: linked('S14', 'Kai', 'Mover', ['23'], {
      address: springfield('501 Pine St'),
      phone: { number: '217-555-0123' },
      email: 'kai.mover@example.com',
    }),
    compared: true,
    expected: [
      {
        kind: 'field',
        field: 'publicAddress',
        camsValue: '501 Pine St, Springfield, IL, 62701',
        todValue: '500 Pine St, Springfield, IL, 62701',
        todIds: ['23'],
      },
    ],
  },
  {
    id: 'S15',
    title: 'A different internal address is reported',
    cams: linked(
      'S15',
      'Lane',
      'Backoffice',
      ['24'],
      {
        address: springfield('2400 Front St'),
        phone: { number: '217-555-0124' },
        email: 'lane.backoffice@example.com',
      },
      { internal: { address: springfield('601 Back St', '62703') } },
    ),
    compared: true,
    expected: [
      {
        kind: 'field',
        field: 'internalAddress',
        camsValue: '601 Back St, Springfield, IL, 62703',
        todValue: '600 Back St, Springfield, IL, 62703',
        todIds: ['24'],
      },
    ],
  },
  {
    id: 'S16',
    title: 'A different phone is reported',
    cams: linked('S16', 'Morgan', 'Caller', ['25'], {
      address: springfield('2500 Ring Rd'),
      phone: { number: '217-555-0199' },
      email: 'morgan.caller@example.com',
    }),
    compared: true,
    expected: [
      {
        kind: 'field',
        field: 'phone',
        camsValue: '217-555-0199',
        todValue: '217-555-0125',
        todIds: ['25'],
      },
    ],
  },
  {
    id: 'S17',
    title: 'A different email is reported',
    cams: linked('S17', 'Noel', 'Mailer', ['26'], {
      address: springfield('2600 Post Rd'),
      phone: { number: '217-555-0126' },
      email: 'noel.mailer@example.org',
    }),
    compared: true,
    expected: [
      {
        kind: 'field',
        field: 'email',
        camsValue: 'noel.mailer@example.org',
        todValue: 'noel.mailer@example.com',
        todIds: ['26'],
      },
    ],
  },

  // ── Links that only partly resolve ──────────────────────────────────────────
  {
    id: 'S18',
    title: 'A trustee linked to one existing and one missing TOD ID is compared, not CAMS only',
    cams: linked('S18', 'Oakley', 'Partial', ['27', '9998'], {
      address: springfield('2700 Half Way'),
      phone: { number: '217-555-0127' },
      email: 'oakley.partial@example.com',
    }),
    compared: true,
    expected: [],
  },
  {
    id: 'S19',
    title: 'A linked trustee with only inactive appointments is still compared',
    cams: linked('S19', 'Parker', 'Retired', ['28'], {
      address: springfield('2800 Rest Ave'),
      phone: { number: '217-555-0128' },
      email: 'parker.retired@example.com',
    }),
    compared: true,
    expected: [],
  },

  // ── TOD only ─────────────────────────────────────────────────────────────────
  {
    id: 'S20',
    title: 'An unlinked TOD trustee with an active appointment is TOD only',
    todIds: ['30'],
    expected: [{ kind: 'tod-only', trusteeName: 'Quinn Todonly', todIds: ['30'] }],
  },
  {
    id: 'S21',
    title: 'An unlinked TOD trustee with only inactive appointments is not reported',
    todIds: ['31'],
    expected: [],
  },
  {
    id: 'S22',
    title: 'An unlinked TOD trustee with no appointment rows is not reported',
    todIds: ['32'],
    expected: [],
  },
  {
    id: 'S23',
    title: 'The same person twice in TOD, neither record linked, is reported once per record',
    todIds: ['33', '34'],
    expected: [
      { kind: 'tod-only', trusteeName: 'Jordan Twin', todIds: ['33'] },
      { kind: 'tod-only', trusteeName: 'Jordan Twin', todIds: ['34'] },
    ],
  },
  {
    id: 'S24',
    title:
      'An unlinked TOD record for a person CAMS links to another record is TOD only; the linked one matches',
    cams: linked('S24', 'Casey', 'Namesake', ['36'], {
      address: springfield('3500 Same St'),
      phone: { number: '217-555-0135' },
      email: 'casey.namesake@example.com',
    }),
    todIds: ['35'],
    compared: true,
    expected: [{ kind: 'tod-only', trusteeName: 'Casey Namesake', todIds: ['35'] }],
  },
  {
    id: 'S25',
    title: "An unlinked TOD trustee active through a converted-case ('O') appointment is TOD only",
    todIds: ['37'],
    expected: [{ kind: 'tod-only', trusteeName: 'Tatum Converted', todIds: ['37'] }],
  },
  {
    id: 'S40',
    title: "An unlinked TOD trustee whose only status is inactive chapter 11 ('9') is not reported",
    todIds: ['50'],
    expected: [],
  },
  {
    id: 'S43',
    title: "An unlinked TOD trustee active through chapter 13 standing ('1') is TOD only",
    todIds: ['53'],
    expected: [{ kind: 'tod-only', trusteeName: 'Jade Standing', todIds: ['53'] }],
  },
  {
    id: 'S44',
    title: "An unlinked TOD trustee active through chapter 12 case-by-case ('2') is TOD only",
    todIds: ['54'],
    expected: [{ kind: 'tod-only', trusteeName: 'Kit Casebycase', todIds: ['54'] }],
  },
  {
    id: 'S41',
    title: 'An unlinked TOD trustee whose only status is empty is not reported',
    todIds: ['51'],
    expected: [],
  },

  // ── Merged trustees ──────────────────────────────────────────────────────────
  {
    id: 'S26',
    title:
      'A trustee merged from TOD records on different pages, holding the most complete record, reports nothing and is compared once',
    cams: linked('S26', 'Uma', 'Merged', ['40', '500'], {
      address: address('4000 Merge St', 'Springfield', 'IL', '62701-4000', 'Floor 3'),
      phone: { number: '217-555-0140' },
      email: 'uma.merged@example.com',
    }),
    compared: true,
    expected: [],
  },
  {
    id: 'S27',
    title:
      'A trustee merged across pages that holds the less complete record is reported against the most complete one (known caveat: migration page order)',
    cams: linked('S27', 'Vale', 'Pageorder', ['41', '501'], {
      address: springfield('4100 Merge St'),
      phone: { number: '217-555-0141' },
      email: 'vale.pageorder@example.com',
    }),
    compared: true,
    expected: [
      {
        kind: 'field',
        field: 'publicAddress',
        camsValue: '4100 Merge St, Springfield, IL, 62701',
        todValue: '4100 Merge St, Floor 4, Springfield, IL, 62701-4100',
        todIds: ['41', '501'],
      },
    ],
  },
  {
    id: 'S28',
    title:
      'A trustee merged from two records on the same page, holding the more complete one, reports nothing',
    cams: linked('S28', 'Wren', 'Samepage', ['42', '43'], {
      address: address('4200 Merge St', 'Springfield', 'IL', '62701-4200', 'Floor 2'),
      phone: { number: '217-555-0142' },
      email: 'wren.samepage@example.com',
    }),
    compared: true,
    expected: [],
  },

  {
    id: 'S42',
    title:
      'A trustee merged from three TOD records, two of them on page 2, holding the most complete one, reports nothing',
    cams: linked('S42', 'Iris', 'Triple', ['52', '502', '503'], {
      address: address('5200 Merge St', 'Springfield', 'IL', '62701-5200', 'Floor 5'),
      phone: { number: '217-555-0152' },
      email: 'iris.triple@example.com',
    }),
    compared: true,
    expected: [],
  },

  // ── Shapes from the ATS_SUB profile ──────────────────────────────────────────
  {
    id: 'S34',
    title: "When both display flags are 'N', the first address stays public and A2 is internal",
    cams: linked(
      'S34',
      'Ash',
      'Bothno',
      ['44'],
      {
        address: springfield('4400 Usual St'),
        phone: { number: '217-555-0144' },
        email: 'ash.bothno@example.com',
      },
      { internal: { address: springfield('4401 Back Ln', '62704') } },
    ),
    compared: true,
    expected: [],
  },
  {
    id: 'S35',
    title: "When DISP_ON_WEB is missing and DISP_ON_WEB_A2 is 'Y', the second address is public",
    cams: linked(
      'S35',
      'Bay',
      'Nullflag',
      ['45'],
      {
        address: springfield('4501 Web Ave', '62705'),
        phone: { number: '217-555-0145' },
        email: 'bay.nullflag@example.com',
      },
      { internal: { address: springfield('4500 Home St') } },
    ),
    compared: true,
    expected: [],
  },
  {
    id: 'S36',
    title: 'A TOD trustee with no address matches the empty CAMS address the migration wrote',
    cams: linked('S36', 'Cove', 'Noaddress', ['46'], {
      address: address('', '', '', ''),
      phone: { number: '217-555-0146' },
      email: 'cove.noaddress@example.com',
    }),
    compared: true,
    expected: [],
  },
  {
    id: 'S37',
    title: 'When the public address has no state, the state comes from the second address',
    cams: linked(
      'S37',
      'Dell',
      'Stateless',
      ['47'],
      {
        address: address('4700 Lake Rd', 'Madison', 'WI', '53703'),
        phone: { number: '608-555-0147' },
        email: 'dell.stateless@example.com',
      },
      { internal: { address: address('4701 Shore Dr', 'Madison', 'WI', '53704') } },
    ),
    compared: true,
    expected: [],
  },
  {
    id: 'S38',
    title: 'A ZIP_PLUS that is not four digits is dropped, matching a five-digit CAMS ZIP',
    cams: linked('S38', 'Eden', 'Shortplus', ['48'], {
      address: springfield('4800 Plus Ct'),
      phone: { number: '217-555-0148' },
      email: 'eden.shortplus@example.com',
    }),
    compared: true,
    expected: [],
  },
  {
    id: 'S39',
    title: 'A TOD phone with punctuation and no digits matches a CAMS trustee with no phone',
    cams: linked('S39', 'Fern', 'Nodigits', ['49'], {
      address: springfield('4900 Mute Rd'),
      email: 'fern.nodigits@example.com',
    }),
    compared: true,
    expected: [],
  },

  // ── CAMS only ────────────────────────────────────────────────────────────────
  {
    id: 'S29',
    title: 'A CAMS-native trustee with no TOD IDs is CAMS only',
    cams: {
      trusteeId: `${TRUSTEE_ID_PREFIX}S29`,
      name: 'Xen Native',
      firstName: 'Xen',
      lastName: 'Native',
      public: { address: springfield('2900 New Rd') },
    },
    expected: [{ kind: 'cams-only', todIds: [] }],
  },
  {
    id: 'S30',
    title: 'A trustee whose only TOD ID no longer exists is CAMS only',
    cams: linked('S30', 'Yael', 'Gone', ['9999'], { address: springfield('3000 Gone Rd') }),
    expected: [{ kind: 'cams-only', todIds: ['9999'] }],
  },
  {
    id: 'S31',
    title:
      'A trustee whose only TOD ID is not a number is CAMS only (defensive: none in CAMS today)',
    cams: linked('S31', 'Zane', 'Malformed', ['not-a-number'], {
      address: springfield('3100 Odd Rd'),
    }),
    expected: [{ kind: 'cams-only', todIds: ['not-a-number'] }],
  },
];

/** The run summary the scenarios add up to. */
export function expectedSummary() {
  const all = SCENARIOS.flatMap((scenario) => scenario.expected);
  const fieldDifferencesByField: Record<Field, number> = {
    name: 0,
    companyName: 0,
    publicAddress: 0,
    internalAddress: 0,
    phone: 0,
    email: 0,
  };
  for (const difference of all) {
    if (difference.kind === 'field') fieldDifferencesByField[difference.field]++;
  }
  return {
    trusteesCompared: SCENARIOS.filter((scenario) => scenario.compared).length,
    todOnly: all.filter((difference) => difference.kind === 'tod-only').length,
    camsOnly: all.filter((difference) => difference.kind === 'cams-only').length,
    fieldDifferences: all.filter((difference) => difference.kind === 'field').length,
    fieldDifferencesByField,
  };
}

/** TOD IDs 200-299 (03-seed-filler.sql): read by the report, reported nowhere. */
export const FILLER_TOD_IDS = Array.from({ length: 100 }, (_, index) => String(200 + index));
