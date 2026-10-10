/**
 * Deterministic fixture synthesizer for the heal-sentinel-case-appointments harness.
 *
 * Every person name, address, phone number, ACMS professional ID, CAMS trustee ID, and case
 * number here is invented by a seeded PRNG. Nothing is read from data/ or any fixtures/
 * directory, and no real trustee name may ever be added.
 *
 * The same seed always yields byte-identical fixtures, so a failure reproduces exactly.
 */
import { isCaseClosed } from '../../../../common/src/cams/cases';
import { SENTINEL_TRUSTEE_ID } from '../../../../backend/lib/use-cases/dataflows/migrate-case-appointments-constants';
import {
  buildVariant,
  computeFingerprint,
} from '../../../../backend/lib/use-cases/dataflows/trustee-variant.helpers';
import { TrusteeProfessionalId } from '../../../../backend/lib/use-cases/dataflows/trustee-professional-ids.types';
import { CanonicalTrusteeSource } from '../../../../common/src/cams/dataflow-events';

export const DEFAULT_SEED = 877;

/** Rows per handlePage invocation (PAGE_SIZE in the dataflow's function app). */
export const PAGE_SIZE = 1000;

const SYSTEM_USER = { id: 'SYSTEM', name: 'SYSTEM' };
const ACMS_USER = { id: 'ACMS', name: 'ACMS' };

/**
 * linked              sole linked record, no sentinelsHealedOn: heals on the first run
 * linked-zero         sole linked record with no sentinels: only gets flagged
 * pre-flagged         linked record already carrying sentinelsHealedOn with leftover sentinels:
 *                     heals only on { ignoreSentinelsHealedOn: true }
 * no-match/ambiguous  non-linked records: never paged, sentinels never heal
 * conflict-with-link  conflict record sharing its ACMS ID with a 'linked' record: the conflict
 *                     record is never paged; the ACMS ID's sentinels heal to the linked trustee
 * conflict-orphan     conflict record whose ACMS ID has no linked record: sentinels never heal
 * double-linked       one ACMS ID linked to two CAMS trustees: both pages stop at link-changed,
 *                     sentinels never heal, neither record is flagged
 */
export type Scenario =
  | 'linked-heavy'
  | 'linked-medium'
  | 'linked-small'
  | 'linked-zero'
  | 'pre-flagged'
  | 'no-match'
  | 'ambiguous'
  | 'conflict-with-link'
  | 'conflict-orphan'
  | 'double-linked';

export type ProfessionalIdFixture = TrusteeProfessionalId & { scenario: Scenario };

export type AppointmentFixture = {
  documentType: 'CASE_APPOINTMENT';
  id: string;
  caseId: string;
  trusteeId: string;
  assignedOn: string;
  appointedDate: string;
  dateFiled: string;
  chapter: '7' | '11' | '12' | '13';
  courtDivisionCode: string;
  unassignedOn?: string;
  closedDate?: string;
  reopenedDate?: string;
  caseStatus: 'OPEN' | 'CLOSED';
  acmsProfessionalId?: string;
  reason?: 'trustee-not-found';
  createdOn: string;
  createdBy: { id: string; name: string };
  updatedOn: string;
  updatedBy: { id: string; name: string };
};

/** All sentinels sharing one acmsProfessionalId, with the trustee they must heal to (if any). */
export type SentinelGroup = {
  acmsProfessionalId: string;
  scenario: Scenario;
  /** camsTrusteeId the sentinels heal to, or null when they must never heal. */
  healsTo: string | null;
  /** Run that heals the group: 1 = plain start, 2 = ignoreSentinelsHealedOn, null = never. */
  healsOnRun: 1 | 2 | null;
  sentinels: AppointmentFixture[];
};

export type Fixtures = {
  seed: number;
  professionalIds: ProfessionalIdFixture[];
  groups: SentinelGroup[];
  /** Sentinels in insertion order (shuffled across groups so _id cursors interleave). */
  sentinels: AppointmentFixture[];
  /** Ordinary resolved appointments that no run may touch. */
  ordinary: AppointmentFixture[];
};

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  private readonly next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  float(): number {
    return this.next();
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  hex(length: number): string {
    let out = '';
    for (let i = 0; i < length; i++) out += Math.floor(this.next() * 16).toString(16);
    return out;
  }
  uuid(): string {
    const variant = ((Math.floor(this.next() * 4) + 8) as number).toString(16);
    return `${this.hex(8)}-${this.hex(4)}-4${this.hex(3)}-${variant}${this.hex(3)}-${this.hex(12)}`;
  }
  shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

// ---------------------------------------------------------------------------
// Invented demographics
// ---------------------------------------------------------------------------

const GIVEN_NAMES = [
  'Arlo',
  'Brisa',
  'Calder',
  'Delphine',
  'Emrys',
  'Fenna',
  'Galen',
  'Halcyon',
  'Ivo',
  'Jessamy',
  'Kestrel',
  'Liora',
  'Maddox',
  'Nerissa',
  'Orrin',
  'Perrin',
  'Quilla',
  'Roswell',
  'Saffi',
  'Thane',
] as const;
const SURNAME_HEADS = [
  'Brack',
  'Corv',
  'Dunm',
  'Fell',
  'Grisw',
  'Harl',
  'Kemb',
  'Lund',
  'Mord',
  'Quar',
  'Raff',
  'Selb',
  'Tarr',
  'Vend',
  'Wexl',
] as const;
const SURNAME_TAILS = [
  'avel',
  'erholt',
  'icombe',
  'ondry',
  'askett',
  'enwick',
  'oller',
  'ustane',
  'imore',
  'edge',
] as const;
const STREETS = [
  'Larkspur',
  'Quarry Ridge',
  'Old Mill',
  'Tidewater',
  'Hollis',
  'Cinder',
  'Ashgrove',
  'Bellweather',
] as const;
const SUFFIXES = ['Ave', 'St', 'Rd', 'Blvd', 'Ln'] as const;

/** Group designator -> court division codes used for invented case numbers. */
const GROUPS: Array<{ designator: string; divisions: string[]; city: string; state: string }> = [
  { designator: 'NY', divisions: ['081', '091'], city: 'New York', state: 'NY' },
  { designator: 'BR', divisions: ['071', '072'], city: 'Brooklyn', state: 'NY' },
  { designator: 'PH', divisions: ['132', '133'], city: 'Philadelphia', state: 'PA' },
  { designator: 'CH', divisions: ['521', '522'], city: 'Chicago', state: 'IL' },
  { designator: 'SA', divisions: ['567', '568'], city: 'San Antonio', state: 'TX' },
];

function inventSource(rng: Rng, group: (typeof GROUPS)[number]): CanonicalTrusteeSource {
  const firstName = rng.pick(GIVEN_NAMES);
  const lastName = `${rng.pick(SURNAME_HEADS)}${rng.pick(SURNAME_TAILS)}`;
  const middleName = rng.chance(0.4) ? rng.pick(GIVEN_NAMES).slice(0, 1) : undefined;
  const zip = `${rng.int(10, 99)}${rng.int(100, 999)}`;
  return {
    firstName,
    middleName,
    lastName,
    fullName: [firstName, middleName, lastName].filter(Boolean).join(' ').toUpperCase(),
    legacy: {
      address1: `${rng.int(10, 9800)} ${rng.pick(STREETS)} ${rng.pick(SUFFIXES)}`,
      cityStateZipCountry: `${group.city}, ${group.state} ${zip}`,
      // 555-01xx is reserved for fictional use.
      phone: `${rng.int(200, 989)}-555-01${String(rng.int(0, 99)).padStart(2, '0')}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.test`,
    },
  };
}

// ---------------------------------------------------------------------------
// Dates and appointments
// ---------------------------------------------------------------------------

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function pickChapter(rng: Rng): AppointmentFixture['chapter'] {
  const roll = rng.float();
  if (roll < 0.65) return '7';
  if (roll < 0.9) return '13';
  if (roll < 0.98) return '11';
  return '12';
}

class CaseNumbers {
  private readonly next = new Map<string, number>();
  constructor(private readonly rng: Rng) {}
  issue(division: string, dateFiled: string): string {
    const yy = dateFiled.slice(2, 4);
    const key = `${division}-${yy}`;
    const n = (this.next.get(key) ?? this.rng.int(100, 900)) + this.rng.int(1, 37);
    this.next.set(key, n);
    return `${division}-${yy}-${String(n).padStart(5, '0')}`;
  }
}

function buildAppointment(
  rng: Rng,
  caseNumbers: CaseNumbers,
  group: (typeof GROUPS)[number],
  trusteeId: string,
  extra: Pick<AppointmentFixture, 'acmsProfessionalId' | 'reason'>,
): AppointmentFixture {
  const filed = addDays(new Date(Date.UTC(2014, 0, 2)), rng.int(0, 4200));
  const assigned = addDays(filed, rng.int(0, 6));
  const dateFiled = isoDate(filed);
  const courtDivisionCode = rng.pick(group.divisions);

  const appointment: AppointmentFixture = {
    documentType: 'CASE_APPOINTMENT',
    id: rng.uuid(),
    caseId: caseNumbers.issue(courtDivisionCode, dateFiled),
    trusteeId,
    assignedOn: isoDate(assigned),
    appointedDate: isoDate(assigned),
    dateFiled,
    chapter: pickChapter(rng),
    courtDivisionCode,
    caseStatus: 'OPEN',
    ...extra,
    createdOn: '2026-08-14T03:12:45.000Z',
    createdBy: SYSTEM_USER,
    updatedOn: '2026-08-14T03:12:45.000Z',
    updatedBy: SYSTEM_USER,
  };

  if (rng.chance(0.3)) {
    const closed = addDays(assigned, rng.int(90, 1500));
    appointment.closedDate = isoDate(closed);
    if (rng.chance(0.4)) appointment.unassignedOn = isoDate(addDays(closed, rng.int(0, 30)));
    // A reopened case: reopenedDate after closedDate means it is OPEN again.
    if (rng.chance(0.15)) appointment.reopenedDate = isoDate(addDays(closed, rng.int(30, 400)));
  } else if (rng.chance(0.08)) {
    // Trustee replaced on a still-open case.
    appointment.unassignedOn = isoDate(addDays(assigned, rng.int(30, 700)));
  }
  appointment.caseStatus = isCaseClosed(appointment) ? 'CLOSED' : 'OPEN';
  return appointment;
}

// ---------------------------------------------------------------------------
// Professional-id records
// ---------------------------------------------------------------------------

function audit(on: string) {
  return { createdOn: on, createdBy: ACMS_USER, updatedOn: on, updatedBy: ACMS_USER };
}

function nameCandidate(rng: Rng, trusteeId: string, source: CanonicalTrusteeSource) {
  return {
    camsRaw: {
      trusteeId,
      firstName: source.firstName ?? '',
      lastName: source.lastName ?? '',
      name: `${source.firstName} ${source.lastName}`,
      phone: { number: `${rng.int(200, 989)}-555-01${String(rng.int(0, 99)).padStart(2, '0')}` },
    },
    camsNormalized: {
      firstName: source.firstName?.toLowerCase(),
      lastName: source.lastName?.toLowerCase(),
    },
    memo: {},
    scores: { doesNameMatch: { pass: true, quality: 'exact' } },
    origin: 'recallByName',
  };
}

function buildProfessionalId(
  rng: Rng,
  scenario: Scenario,
  acmsProfessionalId: string,
  source: CanonicalTrusteeSource,
  options: {
    camsTrusteeId?: string;
    linkMethod?: 'auto' | 'manual';
    sentinelsHealedOn?: string;
    conflictingTrusteeId?: string;
    candidateIds?: string[];
  } = {},
): ProfessionalIdFixture {
  const variant = buildVariant(source);
  const candidates = (options.candidateIds ?? []).map((id) => nameCandidate(rng, id, source));
  const isLinkedShape =
    scenario !== 'no-match' && scenario !== 'ambiguous' && scenario !== 'conflict-orphan';
  const isConflict = scenario === 'conflict-with-link' || scenario === 'conflict-orphan';
  const camsTrusteeId =
    options.camsTrusteeId ?? (isConflict ? rng.uuid() : computeFingerprint(variant));
  const disposition: TrusteeProfessionalId['disposition'] = isConflict
    ? 'conflict'
    : isLinkedShape
      ? 'linked'
      : scenario === 'ambiguous'
        ? 'ambiguous'
        : 'no-match';

  const record: ProfessionalIdFixture = {
    scenario,
    id: rng.uuid(),
    documentType: 'TRUSTEE_PROFESSIONAL_ID',
    camsTrusteeId,
    acmsProfessionalId,
    disposition,
    nameMatchCount: candidates.length,
    evidence: {
      sourceRaw: source,
      sourceNormalized: {},
      memo: {},
      candidates,
      match:
        disposition === 'linked' || isConflict
          ? { trusteeId: camsTrusteeId, score: {}, resolvedBy: 'resolveByNameAndAddress' }
          : null,
      skip: false,
      error: null,
      variant,
      ...(options.conflictingTrusteeId
        ? { conflictingTrusteeId: options.conflictingTrusteeId }
        : {}),
    } as TrusteeProfessionalId['evidence'],
    ...audit('2026-09-02T11:04:19.000Z'),
  };
  if (disposition === 'linked') record.linkMethod = options.linkMethod ?? 'auto';
  if (disposition === 'ambiguous') record.suspectDuplicateCamsTrustee = false;
  if (options.sentinelsHealedOn) record.sentinelsHealedOn = options.sentinelsHealedOn;
  return record;
}

// ---------------------------------------------------------------------------
// Synthesis
// ---------------------------------------------------------------------------

export const SCENARIO_SIZES = {
  heavySentinels: 2500,
  mediumRecords: 3,
  smallRecords: 40,
  zeroRecords: 3,
  preFlaggedSentinels: 37,
  noMatchRecords: 4,
  ambiguousRecords: 3,
  conflictOrphanSentinels: 9,
  doubleLinkedSentinels: 12,
  ordinaryAppointments: 150,
} as const;

export function synthesizeFixtures(seed: number = DEFAULT_SEED): Fixtures {
  const rng = new Rng(seed);
  const caseNumbers = new CaseNumbers(rng);
  const professionalIds: ProfessionalIdFixture[] = [];
  const groups: SentinelGroup[] = [];
  const professionalNumbers = new Map<string, number>();

  const nextAcmsId = (group: (typeof GROUPS)[number]) => {
    const n = (professionalNumbers.get(group.designator) ?? rng.int(40000, 60000)) + rng.int(1, 9);
    professionalNumbers.set(group.designator, n);
    return `${group.designator}-${String(n).padStart(5, '0')}`;
  };

  const addGroup = (
    scenario: Scenario,
    group: (typeof GROUPS)[number],
    acmsProfessionalId: string,
    count: number,
    healsTo: string | null,
    healsOnRun: SentinelGroup['healsOnRun'],
  ) => {
    const sentinels = Array.from({ length: count }, () =>
      buildAppointment(rng, caseNumbers, group, SENTINEL_TRUSTEE_ID, {
        acmsProfessionalId,
        reason: 'trustee-not-found',
      }),
    );
    groups.push({ acmsProfessionalId, scenario, healsTo, healsOnRun, sentinels });
  };

  const addLinked = (scenario: Scenario, count: number, healsOnRun: 1 | 2, healedOn?: string) => {
    const group = rng.pick(GROUPS);
    const acmsId = nextAcmsId(group);
    const record = buildProfessionalId(rng, scenario, acmsId, inventSource(rng, group), {
      camsTrusteeId: rng.uuid(),
      linkMethod: rng.chance(0.85) ? 'auto' : 'manual',
      sentinelsHealedOn: healedOn,
      candidateIds: rng.chance(0.6) ? [] : [rng.uuid()],
    });
    professionalIds.push(record);
    addGroup(scenario, group, acmsId, count, record.camsTrusteeId, healsOnRun);
    return record;
  };

  addLinked('linked-heavy', SCENARIO_SIZES.heavySentinels, 1);
  for (let i = 0; i < SCENARIO_SIZES.mediumRecords; i++) {
    addLinked('linked-medium', rng.int(300, 800), 1);
  }
  const small: ProfessionalIdFixture[] = [];
  for (let i = 0; i < SCENARIO_SIZES.smallRecords; i++) {
    // Heavy-tailed toward 1: 1 + floor(19 * u^3) spans 1..20.
    small.push(addLinked('linked-small', 1 + Math.floor(19 * rng.float() ** 3), 1));
  }
  for (let i = 0; i < SCENARIO_SIZES.zeroRecords; i++) addLinked('linked-zero', 0, 1);
  addLinked('pre-flagged', SCENARIO_SIZES.preFlaggedSentinels, 2, '2026-09-15T06:41:02.000Z');

  for (let i = 0; i < SCENARIO_SIZES.noMatchRecords; i++) {
    const group = rng.pick(GROUPS);
    const acmsId = nextAcmsId(group);
    professionalIds.push(
      buildProfessionalId(rng, 'no-match', acmsId, inventSource(rng, group), {
        candidateIds: rng.chance(0.5) ? [] : [rng.uuid()],
      }),
    );
    addGroup('no-match', group, acmsId, rng.int(2, 30), null, null);
  }
  for (let i = 0; i < SCENARIO_SIZES.ambiguousRecords; i++) {
    const group = rng.pick(GROUPS);
    const acmsId = nextAcmsId(group);
    professionalIds.push(
      buildProfessionalId(rng, 'ambiguous', acmsId, inventSource(rng, group), {
        candidateIds: [rng.uuid(), rng.uuid(), ...(rng.chance(0.3) ? [rng.uuid()] : [])],
      }),
    );
    addGroup('ambiguous', group, acmsId, rng.int(2, 30), null, null);
  }

  // Conflict sharing an ACMS ID with a linked record: its sentinels already belong to that
  // linked record's group and heal to the linked trustee, never to the conflict's trustee.
  const linkedPartner = small[0];
  const partnerGroup = GROUPS.find((g) =>
    linkedPartner.acmsProfessionalId.startsWith(`${g.designator}-`),
  )!;
  professionalIds.push(
    buildProfessionalId(
      rng,
      'conflict-with-link',
      linkedPartner.acmsProfessionalId,
      inventSource(rng, partnerGroup),
      { conflictingTrusteeId: linkedPartner.camsTrusteeId, candidateIds: [rng.uuid()] },
    ),
  );

  // Conflict whose linked partner no longer exists (its trustee's records were deleted).
  {
    const group = rng.pick(GROUPS);
    const acmsId = nextAcmsId(group);
    professionalIds.push(
      buildProfessionalId(rng, 'conflict-orphan', acmsId, inventSource(rng, group), {
        conflictingTrusteeId: rng.uuid(),
        candidateIds: [rng.uuid()],
      }),
    );
    addGroup('conflict-orphan', group, acmsId, SCENARIO_SIZES.conflictOrphanSentinels, null, null);
  }

  // One ACMS ID linked to two CAMS trustees: not a single link, so nothing heals.
  {
    const group = rng.pick(GROUPS);
    const acmsId = nextAcmsId(group);
    const source = inventSource(rng, group);
    for (const linkMethod of ['auto', 'manual'] as const) {
      professionalIds.push(
        buildProfessionalId(rng, 'double-linked', acmsId, source, {
          camsTrusteeId: rng.uuid(),
          linkMethod,
        }),
      );
    }
    addGroup('double-linked', group, acmsId, SCENARIO_SIZES.doubleLinkedSentinels, null, null);
  }

  // Ordinary resolved appointments. Some belong to linked trustees and carry the
  // acmsProfessionalId migrate-case-appointments writes on resolved rows; none are sentinels.
  const linkedRecords = professionalIds.filter((p) => p.disposition === 'linked');
  const ordinary: AppointmentFixture[] = [];
  for (let i = 0; i < SCENARIO_SIZES.ordinaryAppointments; i++) {
    const group = rng.pick(GROUPS);
    const owner = rng.chance(0.6) ? rng.pick(linkedRecords) : null;
    ordinary.push(
      buildAppointment(rng, caseNumbers, group, owner?.camsTrusteeId ?? rng.uuid(), {
        ...(owner && rng.chance(0.35) ? { acmsProfessionalId: owner.acmsProfessionalId } : {}),
      }),
    );
  }

  const sentinels = rng.shuffle(groups.flatMap((g) => g.sentinels));
  return { seed, professionalIds, groups, sentinels, ordinary };
}

/** handlePage invocations one record costs: one per non-empty page plus the final empty read. */
export function pagesToHeal(sentinelCount: number): number {
  return Math.ceil(sentinelCount / PAGE_SIZE) + 1;
}
