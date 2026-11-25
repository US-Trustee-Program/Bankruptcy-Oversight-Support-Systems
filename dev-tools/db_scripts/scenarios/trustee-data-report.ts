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
 *   - 8 trustees compared: 1 exact match [S01], 1 merged from two TOD records with no difference
 *     [S57], and 6 that each differ in one field: name [S12], company name [S13], public address
 *     [S14], internal address [S15], phone [S16], email [S17]
 *   - 3 in TOD only: active [S20], active only through 12CBC status 2 [S44], and an empty status,
 *     flagged "Status missing, needs review" [S41]
 *   - 1 in CAMS only: a CAMS trustee whose TOD ID does not exist in TOD
 *
 * Appointments (Slice 2), all in the Southern District of New York (0208, divisions 081, 084 and
 * 087 per the courts reference data), one case per linked trustee:
 *   - exact-match: chapter 7 panel matches exactly; chapter 13 standing covers only division 081
 *     in CAMS, so it is noted as "divisions narrowed in CAMS" (a finding, not a difference)
 *   - name: chapter 7 matches; chapter 13 standing is in TOD only
 *   - company: chapter 13 standing is in CAMS only; its TOD row has a district the load cannot
 *     map, so it counts as 1 TOD appointment not translated
 *   - public-address: chapter 7 panel in TOD is off-panel in CAMS, so one appointment in TOD only
 *     and one in CAMS only
 *   - internal-address, phone, email: chapter 7 panel differs in status, appointed date and
 *     status effective date respectively
 *   - merged [S57]: linked to two TOD records that both have chapter 7 panel. CAMS holds the
 *     first's (in truIds order), as the load kept it, so nothing is reported; comparing with the
 *     second's would report status and both dates. Chapter 13 standing comes from the second.
 * Totals: 2 appointments in TOD only, 2 in CAMS only, 3 field differences, 1 divisions narrowed,
 * 1 TOD appointment not translated. If dev's DXTR lists other divisions for 0208, the seeded
 * full-district appointments are also noted as narrowed.
 *
 * Unseed removes the TOD rows by ID range and the CAMS trustees and appointments by their seed-
 * ids.
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

type TodAppointment = {
  chapter: string;
  status: string;
  district?: string;
  servingState?: string;
  appointedDate?: string;
  effectiveDate?: string;
};

type CamsAppointment = {
  chapter: string;
  appointmentType: string;
  status: string;
  divisionCodes?: string[];
  appointedDate?: string;
  effectiveDate?: string;
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
  appointments: TodAppointment[];
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

const APPOINTED = '2015-03-01';
const SDNY = { courtId: '0208', courtName: 'Southern District of New York' };
const SDNY_DIVISIONS = ['081', '084', '087'];

/** A TOD appointment row in the Southern District of New York, which the load maps to 0208. */
const sdny = (chapter: string, status: string): TodAppointment => ({
  chapter,
  status,
  district: 'Southern',
  servingState: 'New York',
  appointedDate: APPOINTED,
  effectiveDate: APPOINTED,
});
const CH7_PANEL_ACTIVE = sdny('7', 'PA');
const CH13_STANDING_ACTIVE = sdny('13', 'S');

/** The CAMS appointment the load would create from CH7_PANEL_ACTIVE, changed as given. */
const camsCh7Panel = (change: Partial<CamsAppointment> = {}): CamsAppointment => ({
  chapter: '7',
  appointmentType: 'panel',
  status: 'active',
  ...change,
});
const camsCh13Standing = (change: Partial<CamsAppointment> = {}): CamsAppointment => ({
  chapter: '13',
  appointmentType: 'standing',
  status: 'active',
  ...change,
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
  appointments: [{ chapter: '7', status: 'PA' }],
  ...contact,
});

/**
 * The TOD record and the CAMS trustee linked to it, with the CAMS profile as stored. A merged
 * trustee is also linked to a second TOD record, after the first in truIds.
 */
const LINKED: {
  slug: string;
  tod: TodTrustee;
  alsoLinkedTo?: TodTrustee;
  cams: CamsProfile;
  camsAppointments: CamsAppointment[];
}[] = [
  {
    slug: 'exact-match',
    tod: linkedTod(10, 'Avery', 'Exact', {
      street: '100 Main St',
      phone: '217-555-0110',
      email: 'avery.exact@example.com',
      appointments: [CH7_PANEL_ACTIVE, CH13_STANDING_ACTIVE],
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
    camsAppointments: [camsCh7Panel(), camsCh13Standing({ divisionCodes: ['081'] })],
  },
  {
    slug: 'name',
    tod: linkedTod(21, 'Robert', 'Browne', {
      street: '2100 Name St',
      phone: '217-555-0121',
      email: 'robert.browne@example.com',
      appointments: [CH7_PANEL_ACTIVE, CH13_STANDING_ACTIVE],
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
    camsAppointments: [camsCh7Panel()],
  },
  {
    slug: 'company',
    tod: linkedTod(22, 'Jamie', 'Firm', {
      company: 'Old Firm LLP',
      street: '2200 Company St',
      phone: '217-555-0122',
      email: 'jamie.firm@example.com',
      appointments: [{ ...CH7_PANEL_ACTIVE, district: 'Nowhere', servingState: 'Atlantis' }],
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
    camsAppointments: [camsCh13Standing()],
  },
  {
    slug: 'public-address',
    tod: linkedTod(23, 'Kai', 'Mover', {
      street: '500 Pine St',
      phone: '217-555-0123',
      email: 'kai.mover@example.com',
      appointments: [CH7_PANEL_ACTIVE],
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
    camsAppointments: [camsCh7Panel({ appointmentType: 'off-panel', status: 'resigned' })],
  },
  {
    slug: 'internal-address',
    tod: linkedTod(24, 'Lane', 'Backoffice', {
      street: '2400 Front St',
      internalStreet: '600 Back St',
      internalZip: '62703',
      phone: '217-555-0124',
      email: 'lane.backoffice@example.com',
      appointments: [CH7_PANEL_ACTIVE],
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
    camsAppointments: [camsCh7Panel({ status: 'voluntarily-suspended' })],
  },
  {
    slug: 'phone',
    tod: linkedTod(25, 'Morgan', 'Caller', {
      street: '2500 Ring Rd',
      phone: '217-555-0125',
      email: 'morgan.caller@example.com',
      appointments: [CH7_PANEL_ACTIVE],
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
    camsAppointments: [camsCh7Panel({ appointedDate: '2016-04-02' })],
  },
  {
    slug: 'email',
    tod: linkedTod(26, 'Noel', 'Mailer', {
      street: '2600 Post Rd',
      phone: '217-555-0126',
      email: 'noel.mailer@example.com',
      appointments: [CH7_PANEL_ACTIVE],
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
    camsAppointments: [camsCh7Panel({ effectiveDate: '2020-01-15' })],
  },
  {
    slug: 'merged',
    tod: linkedTod(69, 'Jude', 'Apptmerged', {
      street: '6900 Appt St',
      phone: '217-555-0169',
      email: 'jude.apptmerged@example.com',
      appointments: [
        { ...sdny('7', 'PA'), appointedDate: '2019-01-01', effectiveDate: '2019-01-01' },
      ],
    }),
    alsoLinkedTo: linkedTod(70, 'Jude', 'Apptmerged', {
      street: '6900 Appt St',
      phone: '217-555-0169',
      email: 'jude.apptmerged@example.com',
      appointments: [
        { ...sdny('7', 'PR'), appointedDate: '2010-01-01', effectiveDate: '2010-01-01' },
        CH13_STANDING_ACTIVE,
      ],
    }),
    cams: {
      name: 'Jude Apptmerged',
      firstName: 'Jude',
      lastName: 'Apptmerged',
      public: {
        address: springfield('6900 Appt St'),
        phone: { number: '217-555-0169' },
        email: 'jude.apptmerged@example.com',
      },
    },
    camsAppointments: [
      camsCh7Panel({ appointedDate: '2019-01-01', effectiveDate: '2019-01-01' }),
      camsCh13Standing(),
    ],
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
    appointments: [{ chapter: '7', status: '' }],
  }),
  linkedTod(54, 'Kit', 'Casebycase', {
    street: '5400 Code St',
    phone: '217-555-0154',
    email: 'kit.casebycase@example.com',
    appointments: [{ chapter: '12CBC', status: '2' }],
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

const SEEDED_BY = { id: 'SEED', name: 'Seed Data' };
const SEEDED_ON = '2026-11-24T00:00:00.000Z';

function camsAppointment(slug: string, appointment: CamsAppointment) {
  const trusteeId = `seed-trustee-data-report-${slug}`;
  return {
    id: `${trusteeId}-ch${appointment.chapter}-${appointment.appointmentType}`,
    documentType: 'TRUSTEE_APPOINTMENT',
    trusteeId,
    chapter: appointment.chapter,
    appointmentType: appointment.appointmentType,
    ...SDNY,
    divisionCodes: appointment.divisionCodes ?? SDNY_DIVISIONS,
    appointedDate: appointment.appointedDate ?? APPOINTED,
    status: appointment.status,
    effectiveDate: appointment.effectiveDate ?? APPOINTED,
    updatedOn: SEEDED_ON,
    updatedBy: SEEDED_BY,
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
  const todTrustees = [
    ...LINKED.flatMap(({ tod, alsoLinkedTo }) => (alsoLinkedTo ? [tod, alsoLinkedTo] : [tod])),
    ...TOD_ONLY,
  ];

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
      data: todTrustees.flatMap((tod) =>
        tod.appointments.map((appointment) => ({
          TRU_ID: todId(tod.harnessId),
          CHAPTER: appointment.chapter,
          STATUS: appointment.status,
          DISTRICT: appointment.district ?? null,
          SERVING_STATE: appointment.servingState ?? null,
          APPOINTED_DATE: appointment.appointedDate ?? null,
          STATUS_EFF_DATE: appointment.effectiveDate ?? null,
        })),
      ),
    },
    {
      db: 'cams',
      collectionOrTable: 'trustees',
      data: [
        ...LINKED.map(({ slug, tod, alsoLinkedTo, cams }) =>
          camsTrustee(
            slug,
            cams,
            [tod, alsoLinkedTo].flatMap((linked) =>
              linked ? [String(todId(linked.harnessId))] : [],
            ),
          ),
        ),
        camsTrustee(CAMS_ONLY.slug, CAMS_ONLY.cams, CAMS_ONLY.truIds),
      ],
    },
    {
      db: 'cams',
      collectionOrTable: 'trustee-appointments',
      data: LINKED.flatMap(({ slug, camsAppointments }) =>
        camsAppointments.map((appointment) => camsAppointment(slug, appointment)),
      ),
    },
  ];
}
