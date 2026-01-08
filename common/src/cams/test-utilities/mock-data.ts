import { faker } from '@faker-js/faker';
import { Buffer } from 'buffer';
import {
  CaseBasics,
  CaseDetail,
  CaseDocketEntry,
  CaseDocketEntryDocument,
  CaseNote,
  CaseNoteDeleteRequest,
  CaseNoteEditRequest,
  CaseSummary,
  DxtrCase,
  SyncedCase,
} from '../cases';
import {
  ConsolidationOrder,
  ConsolidationOrderCase,
  ConsolidationType,
  Order,
  RawConsolidationOrder,
  TransferOrder,
} from '../orders';
import { Debtor, DebtorAttorney, Party, LegacyAddress, LegacyTrustee } from '../parties';
import { PhoneNumber, Address, ContactInformation } from '../contact';
import { Trustee, TrusteeHistory, TrusteeInput } from '../trustees';
import { TrusteeAppointment } from '../trustee-appointments';
import { COURT_DIVISIONS } from './courts.mock';
import { TRIAL_ATTORNEYS } from './attorneys.mock';
import { ConsolidationOrderSummary } from '../history';
import {
  Consolidation,
  ConsolidationDocumentTypes,
  ConsolidationFrom,
  ConsolidationTo,
} from '../events';
import { CaseAssignment } from '../assignments';
import { ResponseBody } from '../../api/response';
import { Action, ResourceActions } from '../actions';
import {
  AttorneyUser,
  PrivilegedIdentityUser,
  CamsUser,
  CamsUserReference,
  CamsUserGroup,
  Staff,
} from '../users';
import { CamsSession } from '../session';
import { CamsJwtClaims } from '../jwt';
import { Pagination } from '../../api/pagination';
import DateHelper from '../../date-helper';
import { CamsRole, CamsRoleType } from '../roles';
import { MOCKED_USTP_OFFICES_ARRAY } from '../offices';
import { REGION_02_GROUP_NY, SUPERUSER } from './mock-user';
import { RoleAndOfficeGroupNames } from '../privileged-identity';
import { SYSTEM_USER_REFERENCE } from '../auditable';
import { CaseSyncEvent } from '../../queue/dataflow-types';

const { getIsoDate, getTodaysIsoDate, sortDates, nowInSeconds } = DateHelper;

type EntityType = 'company' | 'person';
type BankruptcyChapters = '9' | '11' | '12' | '15';

const debtorTypeLabelMap = new Map<string, string>([
  ['CB', 'Corporate Business'],
  ['FD', 'Foreign Debtor'],
  ['IB', 'Individual Business'],
  ['IC', 'Individual Consumer'],
  ['JC', 'Joint Consumer'],
  ['MU', 'Municipality'],
  ['PB', 'Partnership Business'],
]);

function randomTruth() {
  return randomInt(2) > 0;
}

function randomId() {
  return `guid-${('00000' + randomInt(100000)).slice(-5)}`;
}

function randomInt(range: number) {
  return Math.floor(Math.random() * range);
}

function randomCaseNumber() {
  return '99-' + ('00000' + randomInt(99999)).slice(-5);
}

function randomCaseId(divisionCode: string = '999') {
  return divisionCode + '-' + randomCaseNumber();
}

function randomSsn() {
  return '999-' + ('00' + randomInt(99)).slice(-2) + '-' + ('0000' + randomInt(9999)).slice(-4);
}

function randomEin() {
  return '99-' + ('0000000' + randomInt(9999999)).slice(-7);
}

function getCourts() {
  return COURT_DIVISIONS;
}

function getOffices() {
  return MOCKED_USTP_OFFICES_ARRAY;
}

function getOfficeWithStaff(staff?: Staff[]) {
  const office = randomUstpOffice();
  if (staff) {
    office.staff = staff;
  } else {
    office.staff = [
      {
        id: office.officeCode + '_0',
        name: `staff_${office.officeName}_0`,
      },
      {
        id: office.officeCode + '_1',
        name: `staff_${office.officeName}_1`,
      },
      {
        id: office.officeCode + '_2',
        name: `staff_${office.officeName}_2`,
      },
    ];
  }
  return office;
}

function randomOffice() {
  return COURT_DIVISIONS[randomInt(COURT_DIVISIONS.length - 1)];
}

function getOffice(courtDivisionCode?: string) {
  if (!courtDivisionCode) {
    return null;
  }
  return COURT_DIVISIONS.find((office) => office.courtDivisionCode === courtDivisionCode);
}

function randomUstpOffice() {
  return MOCKED_USTP_OFFICES_ARRAY[randomInt(MOCKED_USTP_OFFICES_ARRAY.length - 1)];
}

// TODO: consider whether this will eventually cause tests to fail
function randomDate(year = '2024') {
  return someDateAfterThisDate(`${year}-01-01`);
}

function someDateAfterThisDate(thisDateString: string, days?: number): string {
  const thisDate = new Date(Date.parse(thisDateString));
  const daysToAdd = days || randomInt(1000);
  const someDate = new Date(thisDate.setDate(thisDate.getDate() + daysToAdd));
  return getIsoDate(someDate);
}

function someDateBeforeThisDate(thisDateString: string, days?: number): string {
  const thisDate = new Date(Date.parse(thisDateString));
  const daysToSubtract = days || randomInt(1000);
  const someDate = new Date(thisDate.setDate(thisDate.getDate() - daysToSubtract));
  return getIsoDate(someDate);
}

function randomChapter(chapters: BankruptcyChapters[] = ['9', '11', '12', '15']) {
  return chapters[randomInt(chapters.length - 1)];
}

interface Options<T> {
  entityType?: EntityType;
  override?: Partial<T>;
}

function getConsolidation(options: Options<Consolidation> = { override: {} }): Consolidation {
  const { override } = options;
  const documentType: ConsolidationDocumentTypes = override?.documentType ?? 'CONSOLIDATION_TO';
  const consolidationType: ConsolidationType = override?.consolidationType ?? 'administrative';
  return {
    documentType,
    consolidationType,
    caseId: override?.caseId ?? randomCaseId(),
    orderDate: override?.orderDate ?? randomDate(),
    otherCase: override?.otherCase ?? getCaseSummary(),
  } as Consolidation;
}

function getConsolidatedOrderCase(
  options: Options<ConsolidationOrderCase> = { entityType: 'person', override: {} },
) {
  const { entityType, override } = options;
  const docketEntries = [getDocketEntry()];
  const consolidatedCaseSummary: ConsolidationOrderCase = {
    ...getCaseSummary({ entityType, override }),
    orderDate: docketEntries[0].dateFiled,
    docketEntries,
    attorneyAssignments: override?.attorneyAssignments ?? [getAttorneyAssignment()],
    associations: override?.associations ?? [],
  };

  return { ...consolidatedCaseSummary, ...override };
}

function getCaseBasics(
  options: Options<CaseBasics> = { entityType: 'person', override: {} },
): CaseBasics {
  const { entityType, override } = options;
  const debtor = getParty({ entityType });
  const debtorTypeCode = entityType === 'person' ? 'IC' : 'CB';
  const debtorTypeLabel = debtorTypeLabelMap.get(debtorTypeCode);
  const office = getOffice(override?.courtDivisionCode) ?? randomOffice();
  const caseSummary: CaseBasics = {
    ...office,
    dxtrId: '0', // NEED TO REFACTOR THIS OUT OF THE MODEL AND STOP LEAKING FROM THE API
    caseId: randomCaseId(office.courtDivisionCode),
    chapter: randomChapter(),
    caseTitle: debtor.name,
    dateFiled: randomDate(),
    debtorTypeCode,
    debtorTypeLabel,
  };

  return { ...caseSummary, ...override };
}

function getCaseSummary(
  options: Options<CaseSummary> = { entityType: 'person', override: {} },
): CaseSummary {
  const { entityType, override } = options;
  const debtor = getParty({ entityType });
  const caseBasics = getCaseBasics(options);
  return {
    debtor,
    ...caseBasics,
    ...override,
  };
}

function getCaseDetail(
  options: Options<ResourceActions<CaseDetail>> = { entityType: 'person', override: {} },
): ResourceActions<CaseDetail> {
  const { entityType, override } = options;
  const caseDetail: CaseDetail = {
    ...getCaseSummary({ entityType }),
    closedDate: undefined,
    dismissedDate: undefined,
    reopenedDate: undefined,
    assignments: [],
    transfers: [],
    consolidation: [],
    debtorAttorney: getDebtorAttorney(),
    judgeName: faker.person.fullName(),
  };

  const _actions: Action[] = [];

  return { ...caseDetail, _actions, ...override };
}

function getDxtrCase(options: Options<DxtrCase> = { entityType: 'person', override: {} }) {
  const { entityType, override } = options;
  const dxtrCase: DxtrCase = {
    ...getCaseSummary({ entityType, override }),
    closedDate: undefined,
    dismissedDate: undefined,
    reopenedDate: undefined,
  };
  return { ...dxtrCase, ...override };
}

function getSyncedCase(options: Options<SyncedCase> = { entityType: 'person', override: {} }) {
  const { entityType, override } = options;
  const syncedCase: SyncedCase = {
    ...getDxtrCase({ entityType, override }),
    documentType: 'SYNCED_CASE',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: someDateBeforeThisDate(new Date().toISOString()),
  };
  return { ...syncedCase, ...override };
}

function getSyncedCaseNotMatchingCaseIds(exclude: string[]) {
  const syncedCase: SyncedCase = {
    ...getDxtrCase(),
    documentType: 'SYNCED_CASE',
    updatedBy: SYSTEM_USER_REFERENCE,
    updatedOn: someDateBeforeThisDate(getTodaysIsoDate()),
  };
  let caseId = randomCaseId();
  while (exclude.includes(caseId)) {
    caseId = randomCaseId();
  }
  return { ...syncedCase, caseId };
}

/**
 * @param {T} data There is no simple way to determine what type T is and generate
 *  random data accordingly, so it is required to provide it. We could modify to behave like
 *  buildArray does and accept a function from here as well, but it should verify the type
 *  is correct if we do that.
 * @param {String} [self='some-url'] The URI for the resource being mocked
 * @returns {ResponseBody<T>}
 */
function getNonPaginatedResponseBody<T>(data: T, self: string = 'some-url'): ResponseBody<T> {
  return {
    meta: {
      self,
    },
    data,
  };
}

/**
 * @param {T} data There is no simple way to determine what type T is and generate
 *  random data accordingly, so it is required to provide it. We could modify to behave like
 *  `buildArray` does and accept a function from here as well, but it should verify the type
 *  is correct if we do that.
 * @param {Options<Pagination>} [options={ override: {} }] Provide an object like the following:
 *  {
 *    entityType?: 'company' | 'person',
 *    override?: {
 *      count?: number,
 *      previous?: UriString,
 *      next?: UriString,
 *      limit?: number,
 *      currentPage?: number
 *    }
 *  }
 * @param {String} [self='some-url'] The URI for the resource being mocked
 * @returns {ResponseBody<T>}
 */
function getPaginatedResponseBody<T>(
  data: T,
  options: Options<Pagination> = { override: {} },
  self: string = 'some-url',
): ResponseBody<T> {
  const { override } = options;
  return {
    meta: {
      self,
    },
    pagination: {
      count: override?.count ?? 5,
      previous: override?.previous ?? undefined,
      next: override?.next ?? undefined,
      limit: override?.limit ?? 25,
      currentPage: override?.currentPage ?? 1,
    },
    data,
  };
}

function addAction<T>(data: T, actions: Action[]): ResourceActions<T> {
  return {
    ...data,
    _actions: actions,
  };
}

function getTransferOrder(options: Options<TransferOrder> = { override: {} }): TransferOrder {
  const { entityType, override } = options;
  const summary = getCaseSummary({ entityType });
  const newCase = getCaseSummary({ entityType });

  const transferOrder: TransferOrder = {
    ...summary,
    id: faker.string.uuid(),
    orderType: 'transfer',
    orderDate: override?.orderDate ?? someDateAfterThisDate(summary.dateFiled),
    dateFiled:
      override?.dateFiled ??
      (override?.orderDate ? someDateBeforeThisDate(override.orderDate) : summary.dateFiled),
    status: override?.status || 'pending',
    docketEntries: [getDocketEntry()],
    docketSuggestedCaseNumber: override?.status === 'approved' ? undefined : randomCaseNumber(),
    newCase: override?.status === 'approved' ? newCase : undefined,
    reason: override?.status === 'rejected' ? faker.lorem.sentences(2) : undefined,
  };

  return { ...transferOrder, ...override };
}

function getConsolidationOrder(
  options: Options<ConsolidationOrder> = { override: {} },
): ConsolidationOrder {
  const { entityType, override } = options;
  const summary = getCaseSummary({ entityType, override });

  const consolidationOrder: ConsolidationOrder = {
    consolidationId: faker.string.uuid(),
    consolidationType: 'administrative',
    courtName: summary.courtName,
    id: faker.string.uuid(),
    orderType: 'consolidation',
    orderDate: override?.orderDate ?? someDateAfterThisDate(summary.dateFiled),
    status: override?.status || 'pending',
    courtDivisionCode: summary.courtDivisionCode,
    jobId: faker.number.int(),
    childCases: [getConsolidatedOrderCase({ override }), getConsolidatedOrderCase({ override })],
  };

  return { ...consolidationOrder, ...override };
}

function getSortedOrders(count: number = 10): Order[] {
  let transferCount = count;
  let consolidationCount = 0;

  if (count > 1) {
    transferCount = Math.floor(count / 2);
    consolidationCount = count - transferCount;
  }

  return [
    ...buildArray(MockData.getTransferOrder, transferCount),
    ...buildArray(MockData.getConsolidationOrder, consolidationCount),
  ].sort((a, b) => sortDates(a.orderDate, b.orderDate));
}

function getRawConsolidationOrder(
  options: Options<RawConsolidationOrder> = { override: {} },
): RawConsolidationOrder {
  const { entityType, override } = options;
  const summary = getCaseSummary({ entityType });

  const consolidationOrder: RawConsolidationOrder = {
    ...summary,
    orderDate: someDateAfterThisDate(summary.dateFiled),
    docketEntries: [getDocketEntry()],
    jobId: faker.number.int(),
    leadCaseIdHint: randomTruth() ? randomCaseId() : undefined,
  };

  return { ...consolidationOrder, ...override };
}

function getConsolidationReference(
  options: Options<ConsolidationTo | ConsolidationFrom> = { override: {} },
): ConsolidationTo | ConsolidationFrom {
  const reference: ConsolidationTo | ConsolidationFrom = {
    caseId: randomCaseId(),
    consolidationType: 'administrative',
    documentType: 'CONSOLIDATION_FROM',
    orderDate: randomDate(),
    otherCase: getCaseSummary(),
    updatedBy: options?.override?.updatedBy ?? {
      id: '123',
      name: faker.person.fullName(),
    },
    updatedOn: options?.override?.updatedOn ?? someDateAfterThisDate('2024-12-01'),
  };
  return {
    ...reference,
    ...options.override,
  };
}

function getConsolidationTo(options: Options<ConsolidationTo> = { override: {} }): ConsolidationTo {
  return getConsolidationReference({
    override: { ...options.override, documentType: 'CONSOLIDATION_TO' },
  }) as ConsolidationTo;
}

function getConsolidationFrom(
  options: Options<ConsolidationFrom> = { override: {} },
): ConsolidationFrom {
  return getConsolidationReference({
    override: { ...options.override, documentType: 'CONSOLIDATION_FROM' },
  }) as ConsolidationFrom;
}

function getPhone(override: Partial<PhoneNumber> = {}): PhoneNumber {
  return {
    number: getPhoneNumber(),
    extension: randomTruth() ? faker.string.numeric(6) : undefined,
    ...override,
  };
}

function getAddress(override: Partial<Address> = {}): Address {
  return {
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    address3: '',
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode(),
    countryCode: 'US' as const,
    ...override,
  };
}

function getLegacyAddress(override: Partial<LegacyAddress> = {}): LegacyAddress {
  return {
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    address3: 'suite 100',
    cityStateZipCountry: `${faker.location.city()}, ${faker.location.state({
      abbreviated: true,
    })}, ${faker.location.zipCode()}, US`,
    ...override,
  };
}

function getContactInformation(override: Partial<ContactInformation> = {}): ContactInformation {
  return {
    phone: getPhone(),
    email: faker.internet.email(),
    address: getAddress(),
    // Randomly include website ~30% of the time to simulate real-world data
    ...(faker.datatype.boolean({ probability: 0.3 }) && {
      website: `https://www.${faker.internet.domainName()}`,
    }),
    ...override,
  };
}

function getParty(options: Options<Party> = { override: {} }): Party {
  const { entityType, override } = options;
  const party: Party = {
    name: entityType === 'company' ? faker.company.name() : faker.person.fullName(),
    ...getLegacyAddress(),
    phone: faker.phone.number(),
    extension: randomTruth() ? faker.string.numeric(6) : undefined,
    email: faker.internet.email(),
  };
  return {
    ...party,
    ...override,
  };
}

function getDebtor(options: Options<Debtor> = { override: {} }): Debtor {
  const { entityType, override } = options;
  return {
    taxId: entityType === 'company' ? randomEin() : undefined,
    ssn: entityType === 'person' ? randomSsn() : undefined,
    ...getParty(options),
    ...override,
  };
}

function getDocketEntry(override: Partial<CaseDocketEntry> = {}): CaseDocketEntry {
  const docketEntry: CaseDocketEntry = {
    sequenceNumber: 1,
    documentNumber: 1,
    dateFiled: randomDate(),
    summaryText: faker.lorem.lines(1),
    fullText: faker.lorem.paragraph(),
    documents: [],
  };
  const documentCount = randomInt(5);
  for (let docIndex = 0; docIndex < documentCount; docIndex++) {
    const fileUri = `001-24-00001-1-${docIndex}.pdf`;
    const documentEntry: CaseDocketEntryDocument = {
      fileUri,
      fileSize: randomInt(1000000),
      fileLabel: docIndex.toString(),
    };
    if (!docketEntry.documents) {
      docketEntry.documents = [];
    }
    docketEntry.documents.push(documentEntry);
  }
  return {
    ...docketEntry,
    ...override,
  };
}

function getTrustee(override: Partial<Trustee> = {}): Trustee {
  const trusteeInput = getTrusteeInput(override);
  // Convert any null banks value to undefined
  const sanitizedOverride = { ...override } as Partial<Trustee>;
  if (sanitizedOverride.banks === null) {
    sanitizedOverride.banks = undefined;
  }
  if (sanitizedOverride.software === null) {
    sanitizedOverride.software = undefined;
  }

  // Create a properly typed result
  const result: Trustee = {
    id: faker.string.uuid(),
    trusteeId: faker.string.uuid(),
    updatedOn: getDateBeforeToday().toISOString(),
    updatedBy: getCamsUserReference(),
    name: trusteeInput.name,
    public: trusteeInput.public,
    // Optional fields with proper types
    internal: sanitizedOverride.internal || trusteeInput.internal,
    banks: sanitizedOverride.banks,
    software: sanitizedOverride.software,
    legacy: sanitizedOverride.legacy,
  };

  return result;
}

function getTrusteeInput(override: Partial<TrusteeInput> = {}): TrusteeInput {
  return {
    name: faker.person.fullName(),
    public: getContactInformation(),
    ...override,
  };
}

function getChapter13Trustee(override: Partial<Trustee> = {}): Trustee {
  const trusteeLastName = faker.person.lastName().toLowerCase().replace(/\s/g, '-');
  const publicContact = getContactInformation({
    website: `https://www.${trusteeLastName}-ch13.com`,
  });
  const internalContact = getContactInformation({
    website: `https://internal.${trusteeLastName}-ch13.com`,
  });

  return {
    id: faker.string.uuid(),
    trusteeId: faker.string.uuid(),
    name: faker.person.fullName(),
    public: publicContact,
    internal: internalContact,
    updatedOn: getDateBeforeToday().toISOString(),
    updatedBy: getCamsUserReference(),
    ...override,
  };
}

function getTrusteeAppointment(override: Partial<TrusteeAppointment> = {}): TrusteeAppointment {
  return {
    id: faker.string.uuid(),
    trusteeId: faker.string.uuid(),
    chapter: '7-panel',
    courtDivisionName: 'Manhattan',
    courtId: '0208',
    courtName: 'Southern District of New York',
    divisionCode: '081',
    appointedDate: getDateBeforeToday().toISOString(),
    status: 'active',
    effectiveDate: getDateBeforeToday().toISOString(),
    createdOn: getDateBeforeToday().toISOString(),
    createdBy: getCamsUserReference(),
    updatedOn: getDateBeforeToday().toISOString(),
    updatedBy: getCamsUserReference(),
    ...override,
  };
}

function getTrusteeHistory(): TrusteeHistory[] {
  return [
    {
      id: faker.string.uuid(),
      trusteeId: '7d4e2a0b-c39a-4f57-b2c6-ea1fc3c61488',
      documentType: 'AUDIT_NAME',
      updatedOn: '2023-12-14T21:39:18.909Z',
      updatedBy: SYSTEM_USER_REFERENCE,
      before: 'John Doe',
      after: 'John M. Doe',
    },
    {
      id: faker.string.uuid(),
      trusteeId: 'a8f72c5d-6e94-4b1a-9d3e-8c7b59a23f01',
      documentType: 'AUDIT_PUBLIC_CONTACT',
      updatedOn: '2023-12-15T14:22:45.123Z',
      updatedBy: SYSTEM_USER_REFERENCE,
      before: {
        email: 'john.doe@example.com',
        phone: {
          number: '555-123-4567',
          extension: '101',
        },
        address: {
          address1: '123 Main St',
          city: 'Anytown',
          state: 'NY',
          zipCode: '10001',
          countryCode: 'US',
        },
      },
      after: {
        email: 'john.m.doe@example.com',
        phone: {
          number: '555-123-4567',
          extension: '101',
        },
        address: {
          address1: '456 Oak Ave',
          city: 'Newtown',
          state: 'NY',
          zipCode: '10002',
          countryCode: 'US',
        },
      },
    },
    {
      id: faker.string.uuid(),
      trusteeId: 'c6b3e9a2-7d51-48f9-b0e4-3a5c2d1f8e7a',
      documentType: 'AUDIT_INTERNAL_CONTACT',
      updatedOn: '2023-12-16T09:15:30.456Z',
      updatedBy: MockData.getCamsUserReference(),
      before: {
        email: 'internal.doe@example.org',
        phone: {
          number: '555-987-6543',
          extension: '202',
        },
        address: {
          address1: '789 Elm St',
          address2: 'Suite 100',
          city: 'Oldcity',
          state: 'NY',
          zipCode: '10003',
          countryCode: 'US',
        },
      },
      after: {
        email: 'internal.m.doe@example.org',
        phone: {
          number: '555-987-6543',
          extension: '303',
        },
        address: {
          address1: '789 Elm St',
          address2: 'Suite 200',
          city: 'Oldcity',
          state: 'NY',
          zipCode: '10003',
          countryCode: 'US',
        },
      },
    },
  ];
}

function getLegacyTrustee(override: Partial<LegacyTrustee> = {}): LegacyTrustee {
  return {
    name: faker.person.fullName(),
    legacy: {
      ...getLegacyAddress(),
      phone: faker.phone.number(),
      email: faker.internet.email(),
    },
    ...override,
  };
}

function getStaffAssignee(override: Partial<Staff> = {}) {
  return {
    id: randomId(),
    name: faker.person.fullName(),
    ...override,
  };
}

function getDebtorAttorney(override: Partial<DebtorAttorney> = {}): DebtorAttorney {
  return {
    ...getParty({ entityType: 'person' }),
    office: faker.company.name(),
    ...override,
  };
}

function getAttorneyAssignment(override: Partial<CaseAssignment> = {}): CaseAssignment {
  const firstDate = someDateAfterThisDate(`2023-01-01`, 28);
  const secondDate = someDateAfterThisDate(firstDate, 28);
  return {
    id: randomId(),
    documentType: 'ASSIGNMENT',
    caseId: randomCaseId(),
    userId: randomId(),
    name: faker.person.fullName(),
    role: 'TrialAttorney',
    assignedOn: firstDate,
    unassignedOn: secondDate,
    updatedOn: secondDate,
    updatedBy: getCamsUserReference(),
    ...override,
  };
}

function getCaseNote(override: Partial<CaseNote> = {}): CaseNote {
  const firstDate = someDateAfterThisDate(`2023-01-01`, 28);
  const user = {
    id: SUPERUSER.user.id,
    name: SUPERUSER.user.name,
  } as CamsUserReference;
  return {
    id: randomId(),
    title: 'Note Title',
    documentType: 'NOTE',
    caseId: randomCaseId(),
    content: 'Test Note',
    updatedOn: firstDate,
    updatedBy: user,
    createdOn: firstDate,
    createdBy: user,
    ...override,
  };
}

function getCaseNoteDeletionRequest(
  override: Partial<CaseNoteDeleteRequest> = {},
): CaseNoteDeleteRequest {
  const userId = randomId();
  return {
    id: crypto.randomUUID(),
    caseId: randomCaseId(),
    sessionUser: getCamsUserReference({ id: userId }),
    ...override,
  };
}

function getCaseNoteEditRequest(override: Partial<CaseNoteEditRequest> = {}): CaseNoteEditRequest {
  const userId = randomId();
  return {
    note: MockData.getCaseNote(),
    sessionUser: getCamsUserReference({ id: userId }),
    ...override,
  };
}

function getCaseNoteDeletion(override: Partial<CaseNote> = {}): Partial<CaseNote> {
  const archivedOn = new Date().toISOString();
  return {
    id: randomId(),
    caseId: randomCaseId(),
    updatedBy: getCamsUserReference(),
    archivedOn,
    ...override,
  };
}

function buildArray<T = unknown>(fn: () => T, size: number): Array<T> {
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(fn());
  }
  return arr;
}

function getTrialAttorneys() {
  return TRIAL_ATTORNEYS;
}

function getConsolidationHistory(override: Partial<ConsolidationOrderSummary> = {}) {
  return {
    status: override.status || 'pending',
    leadCase: override.leadCase || undefined,
    childCases: override.childCases || [],
  };
}

function getDateBeforeToday() {
  return faker.date.past();
}

function getDateAfterToday() {
  return faker.date.future();
}

function getCamsUserReference(override: Partial<CamsUserReference> = {}): CamsUserReference {
  return {
    id: randomId(),
    name: faker.person.fullName(),
    ...override,
  };
}

function getCamsUser(override: Partial<CamsUser> = {}): CamsUser {
  return {
    id: randomId(),
    name: faker.person.fullName(),
    offices: [randomUstpOffice()],
    roles: [],
    ...override,
  };
}

function getCamsUserGroup(): CamsUserGroup {
  return {
    id: randomId(),
    name: faker.lorem.words(4),
  };
}

function getAttorneyUser(override: Partial<AttorneyUser> = {}): AttorneyUser {
  return {
    ...getCamsUser({ roles: [CamsRole.TrialAttorney] }),
    ...override,
  };
}

function getAuditorUser(override: Partial<AttorneyUser> = {}): AttorneyUser {
  return {
    ...getCamsUser({ roles: [CamsRole.Auditor] }),
    ...override,
  };
}

function getParalegalUser(override: Partial<AttorneyUser> = {}): AttorneyUser {
  return {
    ...getCamsUser({ roles: [CamsRole.Paralegal] }),
    ...override,
  };
}

function getPrivilegedIdentityUser(
  override: Partial<PrivilegedIdentityUser> = {},
): PrivilegedIdentityUser {
  return {
    claims: {
      groups: [],
    },
    ...getCamsUserReference(),
    ...override,
    documentType: 'PRIVILEGED_IDENTITY_USER',
    expires: override.expires ?? getDateAfterToday().toISOString(),
  };
}

function getRole(): string {
  return 'USTP CAMS ' + faker.lorem.words(2);
}

function getRoleAndOfficeGroupNames(): RoleAndOfficeGroupNames {
  const offices = MockData.getOffices().map((office) => office.idpGroupName);
  return {
    roles: buildArray(getRole, 5),
    offices,
  };
}

function getCamsSession(override: Partial<CamsSession> = {}): CamsSession {
  let offices = [REGION_02_GROUP_NY];
  let roles: CamsRoleType[] = [];
  if (override?.user?.roles?.includes(CamsRole.SuperUser)) {
    offices = MOCKED_USTP_OFFICES_ARRAY;
    roles = Object.values(CamsRole);
  }
  const expires = override.expires ?? getExpiration();
  return {
    user: {
      id: randomId(),
      name: 'Mock Name',
      offices,
      roles,
    },
    accessToken: getJwt({ exp: expires }),
    provider: 'mock',
    issuer: 'http://issuer/',
    expires,
    ...override,
  };
}

function getManhattanAssignmentManagerSession(): CamsSession {
  return getCamsSession({
    user: {
      id: 'userId-Bob Jones',
      name: 'Bob Jones',
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.CaseAssignmentManager],
    },
  });
}

function getManhattanTrialAttorneySession(): CamsSession {
  return getCamsSession({
    user: {
      id: 'userId-Bob Jones',
      name: 'Bob Jones',
      offices: [REGION_02_GROUP_NY],
      roles: [CamsRole.TrialAttorney],
    },
  });
}

function getTrusteeAdminSession(): CamsSession {
  return getCamsSession({
    user: {
      id: 'userId-Bob Jones',
      name: 'Bob Jones',
      roles: [CamsRole.TrusteeAdmin],
    },
  });
}

function getExpiration(): number {
  const NOW = nowInSeconds();
  const ONE_HOUR = 3600;
  const salt = Math.floor(Math.random() * 10);

  return NOW + ONE_HOUR + salt;
}

function getJwt(claims: Partial<CamsJwtClaims> = {}): string {
  const payload: CamsJwtClaims = {
    iss: 'http://fake.issuer.com/oauth2/default',
    sub: 'user@fake.com',
    aud: 'fakeApi',
    exp: getExpiration(),
    groups: [],
    ...claims,
  };

  const header = '{"typ":"JWT","alg":"HS256"}';
  const encodedHeader = Buffer.from(header, 'binary').toString('base64');
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'binary').toString('base64');

  // The prior implementation of the signature failed decoding by JWT.io and by the `jsonwebtoken` library.
  // This is a stop gap, valid signature, but not valid for the payload above.
  const encodedSignature = 'uo8vHLYnkLiN4xHccj8buiaFugq1y4qPRbdJN_dyv_E'; // pragma: allowlist secret
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

function getCaseSyncEvent(override: Partial<CaseSyncEvent>) {
  const defaultEvent: CaseSyncEvent = {
    type: 'CASE_CHANGED',
    caseId: randomCaseId(),
  };
  return {
    ...defaultEvent,
    ...override,
  };
}

function getPhoneNumber(): string {
  return `${faker.string.numeric(3)}-${faker.string.numeric(3)}-${faker.string.numeric(4)}`;
}

const MockData = {
  addAction,
  randomId,
  randomCaseId,
  randomCaseNumber,
  randomEin,
  randomOffice,
  randomSsn,
  randomUstpOffice,
  getAddress,
  getContactInformation,
  getLegacyAddress,
  getPhone,
  getStaffAssignee,
  getAttorneyAssignment,
  getCaseNote,
  getCaseNoteDeletion,
  getCaseNoteDeletionRequest,
  getCaseNoteEditRequest,
  getCaseBasics,
  getCaseSummary,
  getCaseDetail,
  getDxtrCase,
  getSyncedCase,
  getSyncedCaseNotMatchingCaseIds,
  getCourts,
  getOffices,
  getOfficeWithStaff,
  getParty,
  getDebtor,
  getDocketEntry,
  getNonPaginatedResponseBody,
  getPaginatedResponseBody,
  getDebtorAttorney,
  getConsolidation,
  getConsolidationOrder,
  getTransferOrder,
  getSortedOrders,
  getConsolidatedOrderCase,
  getConsolidationReference,
  getConsolidationTo,
  getConsolidationFrom,
  getRawConsolidationOrder,
  buildArray,
  getTrialAttorneys,
  getConsolidationHistory,
  getDateAfterToday,
  getDateBeforeToday,
  getCamsUserReference,
  getCamsUser,
  getCamsUserGroup,
  getAttorneyUser,
  getAuditorUser,
  getParalegalUser,
  getPrivilegedIdentityUser,
  getRole,
  getRoleAndOfficeGroupNames,
  getCamsSession,
  getManhattanAssignmentManagerSession,
  getManhattanTrialAttorneySession,
  getTrusteeAdminSession,
  getJwt,
  someDateAfterThisDate,
  someDateBeforeThisDate,
  getCaseSyncEvent,
  getTrustee,
  getTrusteeInput,
  getChapter13Trustee,
  getTrusteeAppointment,
  getTrusteeHistory,
  getLegacyTrustee,
};

export default MockData;
