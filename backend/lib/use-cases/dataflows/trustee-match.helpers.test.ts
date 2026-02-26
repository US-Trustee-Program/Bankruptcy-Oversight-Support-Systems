import { vi } from 'vitest';
import {
  escapeRegex,
  normalizeName,
  matchTrusteeByName,
  calculateAddressScore,
  calculateDistrictDivisionScore,
  calculateChapterScore,
  normalizeChapter,
  calculateCandidateScore,
  resolveTrusteeWithFuzzyMatching,
} from './trustee-match.helpers';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { LegacyAddress } from '@common/cams/parties';
import { Address } from '@common/cams/contact';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { SyncedCase } from '@common/cams/cases';
import { Trustee } from '@common/cams/trustees';
import factory from '../../factory';
import {
  CasesRepository,
  TrusteesRepository,
  TrusteeAppointmentsRepository,
} from '../gateways.types';

// Centralized test fixture builders
const makeAppointment = (overrides: Partial<TrusteeAppointment> = {}): TrusteeAppointment => ({
  id: 'appointment-1',
  trusteeId: 'trustee-1',
  chapter: '7',
  courtId: '081',
  divisionCode: '1',
  appointmentType: 'panel',
  status: 'active',
  createdBy: { id: 'system', name: 'System' },
  createdOn: '2024-01-01T00:00:00Z',
  updatedBy: { id: 'system', name: 'System' },
  updatedOn: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makeCase = (overrides: Partial<SyncedCase> = {}): SyncedCase => ({
  caseId: '24-12345',
  chapter: '7',
  courtId: '081',
  courtDivisionCode: '1',
  dxtrId: 'dxtr-1',
  caseTitle: 'Test Case',
  petitionLabel: 'Debtor',
  dateFiled: '2024-01-01',
  regionId: 'region-1',
  regionName: 'Region 1',
  officeCode: '081',
  closedDate: undefined,
  dismissedDate: undefined,
  reopenedDate: undefined,
  officeName: 'Test Office',
  courtName: 'Test Court',
  courtDivisionName: 'Test Division',
  groupDesignator: 'NY',
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee => ({
  trusteeId: 'trustee-1',
  name: 'John Doe',
  status: 'active',
  public: {
    address: {
      address1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      countryCode: 'US',
    },
  },
  createdBy: { id: 'system', name: 'System' },
  createdOn: '2024-01-01T00:00:00Z',
  updatedBy: { id: 'system', name: 'System' },
  updatedOn: '2024-01-01T00:00:00Z',
  ...overrides,
});

describe('normalizeName', () => {
  test('should trim leading and trailing whitespace', () => {
    expect(normalizeName('  John Doe  ')).toBe('John Doe');
  });

  test('should collapse multiple internal spaces to a single space', () => {
    expect(normalizeName('John   Q.   Smith')).toBe('John Q. Smith');
  });

  test('should handle tabs and mixed whitespace', () => {
    expect(normalizeName('John\t  Doe')).toBe('John Doe');
  });

  test('should return empty string for whitespace-only input', () => {
    expect(normalizeName('   ')).toBe('');
  });

  test('should return name unchanged if already normalized', () => {
    expect(normalizeName('John Doe')).toBe('John Doe');
  });
});

describe('escapeRegex', () => {
  test('should escape all special regex characters', () => {
    expect(escapeRegex('a.b*c+d?e^f$g{h}i(j)k[l]m\\n|o')).toBe(
      'a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\[l\\]m\\\\n\\|o',
    );
  });

  test('should return unchanged string when no special characters', () => {
    expect(escapeRegex('John Doe')).toBe('John Doe');
  });
});

describe('matchTrusteeByName', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return trusteeId when exactly one trustee matches', async () => {
    const trustee = MockData.getTrustee();
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([trustee]);

    const result = await matchTrusteeByName(context, trustee.name);

    expect(result).toBe(trustee.trusteeId);
  });

  test('should throw with mismatchReason NO_TRUSTEE_MATCH when no trustees match', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([]);

    await expect(matchTrusteeByName(context, 'Nonexistent Trustee')).rejects.toMatchObject({
      message: expect.stringContaining('No CAMS trustee found matching name "Nonexistent Trustee"'),
      data: { mismatchReason: 'NO_TRUSTEE_MATCH' },
    });
  });

  test('should throw with mismatchReason MULTIPLE_TRUSTEES_MATCH and matchCandidates when multiple trustees match', async () => {
    const trustee1 = MockData.getTrustee();
    const trustee2 = MockData.getTrustee();
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByName').mockResolvedValue([
      trustee1,
      trustee2,
    ]);

    await expect(matchTrusteeByName(context, trustee1.name)).rejects.toMatchObject({
      message: expect.stringContaining('Multiple CAMS trustees found matching name'),
      data: {
        mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
        matchCandidates: expect.arrayContaining([
          expect.objectContaining({ trusteeId: trustee1.trusteeId }),
          expect.objectContaining({ trusteeId: trustee2.trusteeId }),
        ]),
      },
    });
  });

  test('should normalize the name before querying', async () => {
    const trustee = MockData.getTrustee();
    const findSpy = vi
      .spyOn(MockMongoRepository.prototype, 'findTrusteesByName')
      .mockResolvedValue([trustee]);

    await matchTrusteeByName(context, '  ' + trustee.name + '  ');

    expect(findSpy).toHaveBeenCalledWith(trustee.name);
  });
});

describe('calculateAddressScore', () => {
  test('should return 100 when all fields match (city, state, zipCode)', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10001',
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(100);
  });

  test('should return 60 when city and state match but zipCode differs', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10001',
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10002',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(40); // City + state match (different zip)
  });

  test('should return 30 when only state matches', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10001',
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'Brooklyn',
      state: 'NY',
      zipCode: '11201',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(30);
  });

  test('should return 0 when no fields match', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10001',
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(0);
  });

  test('should be case-insensitive', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'NEW YORK, ny 10001',
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'new york',
      state: 'NY',
      zipCode: '10001',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(100);
  });

  test('should return 0 when DXTR address is undefined', () => {
    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(undefined, camsAddress);
    expect(score).toBe(0);
  });

  test('should return 0 when cityStateZipCountry is malformed', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'Invalid Format',
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(0);
  });

  test('should handle cityStateZipCountry with country suffix', () => {
    const dxtrAddress: LegacyAddress = {
      cityStateZipCountry: 'New York, NY 10001 US',
      address1: '123 Main St',
    };

    const camsAddress: Address = {
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      address1: '456 Different St',
      countryCode: 'US',
    };

    const score = calculateAddressScore(dxtrAddress, camsAddress);
    expect(score).toBe(100);
  });
});

describe('normalizeChapter', () => {
  test('should remove leading zeros from single-digit chapters', () => {
    expect(normalizeChapter('07')).toBe('7');
    expect(normalizeChapter('013')).toBe('13');
  });

  test('should keep double-digit chapters as-is', () => {
    expect(normalizeChapter('11')).toBe('11');
    expect(normalizeChapter('12')).toBe('12');
    expect(normalizeChapter('13')).toBe('13');
  });

  test('should normalize chapter with subchapter suffix', () => {
    expect(normalizeChapter('11-subchapter-v')).toBe('11');
    expect(normalizeChapter('7-subchapter-b')).toBe('7');
  });

  test('should handle already normalized chapters', () => {
    expect(normalizeChapter('7')).toBe('7');
    expect(normalizeChapter('11')).toBe('11');
  });

  test('should be case-insensitive', () => {
    expect(normalizeChapter('11-SUBCHAPTER-V')).toBe('11');
  });
});

describe('calculateDistrictDivisionScore', () => {
  test('should return 100 when exact court and division match with active appointment', () => {
    const appointments = [makeAppointment({ courtId: '081', divisionCode: '1', status: 'active' })];
    const score = calculateDistrictDivisionScore('081', '1', appointments);
    expect(score).toBe(100);
  });

  test('should return 50 when same court but different division', () => {
    const appointments = [makeAppointment({ courtId: '081', divisionCode: '2', status: 'active' })];
    const score = calculateDistrictDivisionScore('081', '1', appointments);
    expect(score).toBe(50);
  });

  test('should return 0 when no matching court', () => {
    const appointments = [makeAppointment({ courtId: '082', divisionCode: '1', status: 'active' })];
    const score = calculateDistrictDivisionScore('081', '1', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when matching appointment is not active', () => {
    const appointments = [
      makeAppointment({ courtId: '081', divisionCode: '1', status: 'inactive' }),
    ];
    const score = calculateDistrictDivisionScore('081', '1', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when appointments array is empty', () => {
    const score = calculateDistrictDivisionScore('081', '1', []);
    expect(score).toBe(0);
  });

  test('should return highest score when multiple appointments exist', () => {
    const appointments = [
      makeAppointment({ courtId: '082', divisionCode: '1', status: 'active' }),
      makeAppointment({ courtId: '081', divisionCode: '2', status: 'active' }),
      makeAppointment({ courtId: '081', divisionCode: '1', status: 'active' }),
    ];
    const score = calculateDistrictDivisionScore('081', '1', appointments);
    expect(score).toBe(100);
  });
});

describe('calculateChapterScore', () => {
  test('should return 100 when exact chapter match with active appointment', () => {
    const appointments = [makeAppointment({ chapter: '7', status: 'active' })];
    const score = calculateChapterScore('7', appointments);
    expect(score).toBe(100);
  });

  test('should return 100 when chapter matches after normalization', () => {
    const appointments = [makeAppointment({ chapter: '7', status: 'active' })];
    const score = calculateChapterScore('07', appointments);
    expect(score).toBe(100);
  });

  test('should return 100 when chapter with subchapter matches', () => {
    const appointments = [makeAppointment({ chapter: '11', status: 'active' })];
    const score = calculateChapterScore('11-subchapter-v', appointments);
    expect(score).toBe(100);
  });

  test('should return 0 when no matching chapter', () => {
    const appointments = [makeAppointment({ chapter: '11', status: 'active' })];
    const score = calculateChapterScore('7', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when matching appointment is not active', () => {
    const appointments = [makeAppointment({ chapter: '7', status: 'inactive' })];
    const score = calculateChapterScore('7', appointments);
    expect(score).toBe(0);
  });

  test('should return 0 when appointments array is empty', () => {
    const score = calculateChapterScore('7', []);
    expect(score).toBe(0);
  });

  test('should return 100 when multiple appointments and one matches', () => {
    const appointments = [
      makeAppointment({ chapter: '11', status: 'active' }),
      makeAppointment({ chapter: '7', status: 'active' }),
      makeAppointment({ chapter: '13', status: 'active' }),
    ];
    const score = calculateChapterScore('7', appointments);
    expect(score).toBe(100);
  });
});

describe('calculateCandidateScore', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  const createDxtrTrustee = (cityStateZip?: string): DxtrTrusteeParty => ({
    fullName: 'John Doe',
    legacy: cityStateZip ? { cityStateZipCountry: cityStateZip } : undefined,
  });

  const createCamsCase = (chapter: string, courtId: string, divisionCode: string): SyncedCase => ({
    caseId: '24-12345',
    chapter,
    courtId,
    courtDivisionCode: divisionCode,
    dxtrId: 'dxtr-1',
    caseTitle: 'Test Case',
    petitionLabel: 'Debtor',
    dateFiled: '2024-01-01',
    regionId: 'region-1',
    regionName: 'Region 1',
    officeCode: '081',
    closedDate: undefined,
    dismissedDate: undefined,
    reopenedDate: undefined,
  });

  const createCamsTrustee = (city: string, state: string, zipCode: string): Trustee => ({
    trusteeId: 'trustee-1',
    name: 'John Doe',
    status: 'active',
    public: {
      address: {
        address1: '123 Main St',
        city,
        state,
        zipCode,
        countryCode: 'US',
      },
    },
  });

  test('should return totalScore 100 when all scores are 100', () => {
    const dxtrTrustee = createDxtrTrustee('New York, NY 10001');
    const camsCase = createCamsCase('7', '081', '1');
    const camsTrustee = createCamsTrustee('New York', 'NY', '10001');
    const appointments = [
      makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' }),
    ];

    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      camsCase,
      camsTrustee,
      appointments,
    );

    expect(score.trusteeId).toBe('trustee-1');
    expect(score.trusteeName).toBe('John Doe');
    expect(score.addressScore).toBe(100);
    expect(score.districtDivisionScore).toBe(100);
    expect(score.chapterScore).toBe(100);
    expect(score.totalScore).toBe(100); // (100 * 0.2) + (100 * 0.4) + (100 * 0.4)
  });

  test('should apply weighted scoring correctly (20/40/40)', () => {
    const dxtrTrustee = createDxtrTrustee('New York, NY 10001');
    const camsCase = createCamsCase('7', '081', '1');
    const camsTrustee = createCamsTrustee('New York', 'NY', '10002'); // Different zip
    const appointments = [
      makeAppointment({ chapter: '7', courtId: '081', divisionCode: '2', status: 'active' }),
    ]; // Different division

    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      camsCase,
      camsTrustee,
      appointments,
    );

    expect(score.addressScore).toBe(40); // City + state match (different zip)
    expect(score.districtDivisionScore).toBe(50); // Same court, different division
    expect(score.chapterScore).toBe(100); // Chapter matches
    // (40 * 0.2) + (50 * 0.4) + (100 * 0.4) = 8 + 20 + 40 = 68
    expect(score.totalScore).toBe(68);
  });

  test('should return totalScore 20 when only address matches', () => {
    const dxtrTrustee = createDxtrTrustee('New York, NY 10001');
    const camsCase = createCamsCase('11', '082', '1');
    const camsTrustee = createCamsTrustee('New York', 'NY', '10001');
    const appointments = [
      makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' }),
    ];

    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      camsCase,
      camsTrustee,
      appointments,
    );

    expect(score.addressScore).toBe(100);
    expect(score.districtDivisionScore).toBe(0);
    expect(score.chapterScore).toBe(0);
    expect(score.totalScore).toBe(20); // (100 * 0.2) + (0 * 0.4) + (0 * 0.4)
  });

  test('should return totalScore 40 when only district matches', () => {
    const dxtrTrustee = createDxtrTrustee(); // No address
    const camsCase = createCamsCase('11', '081', '1');
    const camsTrustee = createCamsTrustee('New York', 'NY', '10001');
    const appointments = [
      makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' }),
    ];

    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      camsCase,
      camsTrustee,
      appointments,
    );

    expect(score.addressScore).toBe(0);
    expect(score.districtDivisionScore).toBe(100);
    expect(score.chapterScore).toBe(0);
    expect(score.totalScore).toBe(40); // (0 * 0.2) + (100 * 0.4) + (0 * 0.4)
  });

  test('should return totalScore 40 when only chapter matches', () => {
    const dxtrTrustee = createDxtrTrustee(); // No address
    const camsCase = createCamsCase('7', '082', '1');
    const camsTrustee = createCamsTrustee('New York', 'NY', '10001');
    const appointments = [
      makeAppointment({ chapter: '7', courtId: '081', divisionCode: '1', status: 'active' }),
    ];

    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      camsCase,
      camsTrustee,
      appointments,
    );

    expect(score.addressScore).toBe(0);
    expect(score.districtDivisionScore).toBe(0);
    expect(score.chapterScore).toBe(100);
    expect(score.totalScore).toBe(40); // (0 * 0.2) + (0 * 0.4) + (100 * 0.4)
  });

  test('should include trusteeId and trusteeName in result', () => {
    const dxtrTrustee = createDxtrTrustee();
    const camsCase = createCamsCase('7', '081', '1');
    const camsTrustee = createCamsTrustee('New York', 'NY', '10001');
    const appointments: TrusteeAppointment[] = [];

    const score = calculateCandidateScore(
      context,
      dxtrTrustee,
      camsCase,
      camsTrustee,
      appointments,
    );

    expect(score.trusteeId).toBe('trustee-1');
    expect(score.trusteeName).toBe('John Doe');
  });
});

// TODO: remove redundant/extra tests, and mocks like createCase etc...
describe('resolveTrusteeWithFuzzyMatching', () => {
  let context: ApplicationContext;
  let mockCasesRepo: Partial<CasesRepository>;
  let mockTrusteesRepo: Partial<TrusteesRepository>;
  let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;

  beforeEach(async () => {
    context = await createMockApplicationContext();

    mockCasesRepo = {
      getSyncedCase: vi.fn(),
      release: vi.fn(),
    };

    mockTrusteesRepo = {
      read: vi.fn(),
      release: vi.fn(),
    };

    mockAppointmentsRepo = {
      getTrusteeAppointments: vi.fn(),
      release: vi.fn(),
    };

    vi.spyOn(factory, 'getCasesRepository').mockReturnValue(mockCasesRepo as CasesRepository);
    vi.spyOn(factory, 'getTrusteesRepository').mockReturnValue(
      mockTrusteesRepo as TrusteesRepository,
    );
    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      mockAppointmentsRepo as TrusteeAppointmentsRepository,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createEvent = (): TrusteeAppointmentSyncEvent => ({
    caseId: '24-12345',
    courtId: '081',
    dxtrTrustee: {
      fullName: 'John Doe',
      legacy: {
        cityStateZipCountry: 'New York, NY 10001',
      },
    },
  });

  test('should return trusteeId when clear winner found (>75% and 5+ gap)', async () => {
    const event = createEvent();
    const syncedCase = makeCase();
    const winner = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe Winner',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const loser = makeTrustee({
      trusteeId: 'trustee-2',
      name: 'John Doe Loser',
      public: {
        address: {
          address1: '123 Main St',
          city: 'Brooklyn',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });

    // Winner: perfect match (100 points)
    const winnerAppointments = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-01',
        effectiveDate: '2024-01-01',
      }),
    ];
    // Loser: only state match (30 points address, 0 district, 0 chapter = 6 total)
    const loserAppointments = [
      makeAppointment({
        id: 'appointment-trustee-2',
        trusteeId: 'trustee-2',
        chapter: '11',
        courtId: '082',
        divisionCode: '2',
        appointedDate: '2024-01-01',
        effectiveDate: '2024-01-01',
      }),
    ];

    (mockCasesRepo.getSyncedCase as ReturnType<typeof vi.fn>).mockResolvedValue(syncedCase);
    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(winner)
      .mockResolvedValueOnce(loser);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(winnerAppointments)
      .mockResolvedValueOnce(loserAppointments);

    const result = await resolveTrusteeWithFuzzyMatching(context, event, [
      'trustee-1',
      'trustee-2',
    ]);

    expect(result).toBe('trustee-1');
  });

  test('should throw error when no candidate scores >75%', async () => {
    const event = createEvent();
    const syncedCase = makeCase();
    const candidate1 = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe 1',
      public: {
        address: {
          address1: '123 Main St',
          city: 'Brooklyn',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const candidate2 = makeTrustee({
      trusteeId: 'trustee-2',
      name: 'John Doe 2',
      public: {
        address: {
          address1: '123 Main St',
          city: 'Queens',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });

    // Both candidates score low (only state match = 30 address * 0.2 = 6 points)
    const appointments1 = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '11',
        courtId: '082',
        divisionCode: '2',
      }),
    ];
    const appointments2 = [
      makeAppointment({
        id: 'appointment-trustee-2',
        trusteeId: 'trustee-2',
        chapter: '12',
        courtId: '082',
        divisionCode: '3',
      }),
    ];

    (mockCasesRepo.getSyncedCase as ReturnType<typeof vi.fn>).mockResolvedValue(syncedCase);
    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(candidate1)
      .mockResolvedValueOnce(candidate2);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(appointments1)
      .mockResolvedValueOnce(appointments2);

    await expect(
      resolveTrusteeWithFuzzyMatching(context, event, ['trustee-1', 'trustee-2']),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Fuzzy matching failed'),
      data: {
        mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
        matchCandidates: expect.arrayContaining([
          expect.objectContaining({ trusteeId: 'trustee-1' }),
          expect.objectContaining({ trusteeId: 'trustee-2' }),
        ]),
      },
    });
  });

  test('should throw error when top scores within 5 points', async () => {
    const event = createEvent();
    const syncedCase = makeCase();
    const candidate1 = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe 1',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const candidate2 = makeTrustee({
      trusteeId: 'trustee-2',
      name: 'John Doe 2',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });

    // Both score 80 (perfect address + court match = 20 + 40 = 60, then chapter 50% match = 20, total 80)
    const appointments1 = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '2',
      }),
    ];
    const appointments2 = [
      makeAppointment({
        id: 'appointment-trustee-2',
        trusteeId: 'trustee-2',
        chapter: '7',
        courtId: '081',
        divisionCode: '3',
      }),
    ];

    (mockCasesRepo.getSyncedCase as ReturnType<typeof vi.fn>).mockResolvedValue(syncedCase);
    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(candidate1)
      .mockResolvedValueOnce(candidate2);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(appointments1)
      .mockResolvedValueOnce(appointments2);

    await expect(
      resolveTrusteeWithFuzzyMatching(context, event, ['trustee-1', 'trustee-2']),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Fuzzy matching failed'),
      data: {
        mismatchReason: 'MULTIPLE_TRUSTEES_MATCH',
        matchCandidates: expect.any(Array),
      },
    });
  });

  test('should return winner when single candidate meets 75% threshold', async () => {
    const event = createEvent();
    const syncedCase = makeCase();
    const candidate = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const appointments = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '2',
      }),
    ]; // 80 points

    (mockCasesRepo.getSyncedCase as ReturnType<typeof vi.fn>).mockResolvedValue(syncedCase);
    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>).mockResolvedValue(candidate);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
      appointments,
    );

    const result = await resolveTrusteeWithFuzzyMatching(context, event, ['trustee-1']);

    expect(result).toBe('trustee-1');
  });

  test('should lazy-load case, trustee, and appointment data', async () => {
    const event = createEvent();
    const syncedCase = makeCase();
    const trustee = makeTrustee({
      trusteeId: 'trustee-1',
      name: 'John Doe',
      public: {
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
    });
    const appointments = [
      makeAppointment({
        id: 'appointment-trustee-1',
        trusteeId: 'trustee-1',
        chapter: '7',
        courtId: '081',
        divisionCode: '1',
        appointedDate: '2024-01-01',
        effectiveDate: '2024-01-01',
      }),
    ];

    (mockCasesRepo.getSyncedCase as ReturnType<typeof vi.fn>).mockResolvedValue(syncedCase);
    (mockTrusteesRepo.read as ReturnType<typeof vi.fn>).mockResolvedValue(trustee);
    (mockAppointmentsRepo.getTrusteeAppointments as ReturnType<typeof vi.fn>).mockResolvedValue(
      appointments,
    );

    await resolveTrusteeWithFuzzyMatching(context, event, ['trustee-1']);

    expect(mockCasesRepo.getSyncedCase).toHaveBeenCalledWith('24-12345');
    expect(mockTrusteesRepo.read).toHaveBeenCalledWith('trustee-1');
    expect(mockAppointmentsRepo.getTrusteeAppointments).toHaveBeenCalledWith('trustee-1');
  });
});
