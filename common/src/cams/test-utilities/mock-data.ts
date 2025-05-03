import { faker } from '@faker-js/faker';
import { Buffer } from 'buffer';

import { Pagination } from '../../api/pagination';
import { ResponseBody } from '../../api/response';
import { getIsoDate, getTodaysIsoDate, nowInSeconds, sortDates } from '../../date-helper';
import { CaseSyncEvent } from '../../queue/dataflow-types';
import { Action, ResourceActions } from '../actions';
import { CaseAssignment } from '../assignments';
import { SYSTEM_USER_REFERENCE } from '../auditable';
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
  Consolidation,
  ConsolidationDocumentTypes,
  ConsolidationFrom,
  ConsolidationTo,
} from '../events';
import { ConsolidationOrderSummary } from '../history';
import { CamsJwtClaims } from '../jwt';
import { MOCKED_USTP_OFFICES_ARRAY } from '../offices';
import {
  ConsolidationOrder,
  ConsolidationOrderCase,
  ConsolidationType,
  Order,
  RawConsolidationOrder,
  TransferOrder,
} from '../orders';
import { DebtorAttorney, Party } from '../parties';
import { RoleAndOfficeGroupNames } from '../privileged-identity';
import { CamsRole } from '../roles';
import { CamsSession } from '../session';
import {
  AttorneyUser,
  CamsUser,
  CamsUserGroup,
  CamsUserReference,
  PrivilegedIdentityUser,
  Staff,
} from '../users';
import { TRIAL_ATTORNEYS } from './attorneys.mock';
import { COURT_DIVISIONS } from './courts.mock';
import { REGION_02_GROUP_NY } from './mock-user';

type BankruptcyChapters = '9' | '11' | '12' | '15';
type EntityType = 'company' | 'person';

const debtorTypeLabelMap = new Map<string, string>([
  ['CB', 'Corporate Business'],
  ['FD', 'Foreign Debtor'],
  ['IB', 'Individual Business'],
  ['IC', 'Individual Consumer'],
  ['JC', 'Joint Consumer'],
  ['MU', 'Municipality'],
  ['PB', 'Partnership Business'],
]);

interface Options<T> {
  entityType?: EntityType;
  override?: Partial<T>;
}

function addAction<T>(data: T, actions: Action[]): ResourceActions<T> {
  return {
    ...data,
    _actions: actions,
  };
}

function buildArray<T = unknown>(fn: () => T, size: number): Array<T> {
  const arr = [];
  for (let i = 0; i < size; i++) {
    arr.push(fn());
  }
  return arr;
}

function getAttorneyAssignment(override: Partial<CaseAssignment> = {}): CaseAssignment {
  const firstDate = someDateAfterThisDate(`2023-01-01`, 28);
  const secondDate = someDateAfterThisDate(firstDate, 28);
  return {
    assignedOn: firstDate,
    caseId: randomCaseId(),
    documentType: 'ASSIGNMENT',
    id: randomId(),
    name: faker.person.fullName(),
    role: 'TrialAttorney',
    unassignedOn: secondDate,
    updatedBy: getCamsUserReference(),
    updatedOn: secondDate,
    userId: randomId(),
    ...override,
  };
}

function getAttorneyUser(override: Partial<AttorneyUser> = {}): AttorneyUser {
  return {
    ...getCamsUser({ roles: [CamsRole.TrialAttorney] }),
    ...override,
  };
}

function getCamsSession(override: Partial<CamsSession> = {}): CamsSession {
  let offices = [REGION_02_GROUP_NY];
  let roles = [];
  if (override?.user?.roles?.includes(CamsRole.SuperUser)) {
    offices = MOCKED_USTP_OFFICES_ARRAY;
    roles = Object.values(CamsRole);
  }
  const expires = override.expires ?? getExpiration();
  return {
    accessToken: getJwt({ exp: expires }),
    expires,
    issuer: 'http://issuer/',
    provider: 'mock',
    user: {
      id: randomId(),
      name: 'Mock Name',
      offices,
      roles,
    },
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

function getCamsUserReference(override: Partial<CamsUserReference> = {}): CamsUserReference {
  return {
    id: randomId(),
    name: faker.person.fullName(),
    ...override,
  };
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
    caseId: randomCaseId(office.courtDivisionCode),
    caseTitle: debtor.name,
    chapter: randomChapter(),
    dateFiled: randomDate(),
    debtorTypeCode,
    debtorTypeLabel,
    dxtrId: '0', // NEED TO REFACTOR THIS OUT OF THE MODEL AND STOP LEAKING FROM THE API
  };

  return { ...caseSummary, ...override };
}

function getCaseDetail(
  options: Options<ResourceActions<CaseDetail>> = { entityType: 'person', override: {} },
): ResourceActions<CaseDetail> {
  const { entityType, override } = options;
  const caseDetail: CaseDetail = {
    ...getCaseSummary({ entityType }),
    assignments: [],
    closedDate: undefined,
    consolidation: [],
    debtorAttorney: getDebtorAttorney(),
    dismissedDate: undefined,
    judgeName: faker.person.fullName(),
    reopenedDate: undefined,
    transfers: [],
  };

  const _actions: Action[] = [];

  return { ...caseDetail, _actions, ...override };
}

function getCaseNote(override: Partial<CaseNote> = {}): CaseNote {
  const firstDate = someDateAfterThisDate(`2023-01-01`, 28);
  const user = getCamsUserReference();
  return {
    caseId: randomCaseId(),
    content: 'Test Note',
    createdBy: user,
    createdOn: firstDate,
    documentType: 'NOTE',
    id: randomId(),
    title: 'Note Title',
    updatedBy: user,
    updatedOn: firstDate,
    ...override,
  };
}

function getCaseNoteDeletion(override: Partial<CaseNote> = {}): Partial<CaseNote> {
  const archivedOn = new Date().toISOString();
  return {
    archivedOn,
    caseId: randomCaseId(),
    id: randomId(),
    updatedBy: getCamsUserReference(),
    ...override,
  };
}

function getCaseNoteDeletionRequest(
  override: Partial<CaseNoteDeleteRequest> = {},
): CaseNoteDeleteRequest {
  const userId = randomId();
  return {
    caseId: randomCaseId(),
    id: crypto.randomUUID(),
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

function getCaseSyncEvent(override: Partial<CaseSyncEvent>) {
  const defaultEvent: CaseSyncEvent = {
    caseId: randomCaseId(),
    type: 'CASE_CHANGED',
  };
  return {
    ...defaultEvent,
    ...override,
  };
}

function getConsolidatedOrderCase(
  options: Options<ConsolidationOrderCase> = { entityType: 'person', override: {} },
) {
  const { entityType, override } = options;
  const docketEntries = [getDocketEntry()];
  const consolidatedCaseSummary: ConsolidationOrderCase = {
    ...getCaseSummary({ entityType, override }),
    associations: override.associations ?? [],
    attorneyAssignments: override.attorneyAssignments ?? [getAttorneyAssignment()],
    docketEntries,
    orderDate: docketEntries[0].dateFiled,
  };

  return { ...consolidatedCaseSummary, ...override };
}

function getConsolidation(options: Options<Consolidation> = { override: {} }): Consolidation {
  const { override } = options;
  const documentType: ConsolidationDocumentTypes = override.documentType ?? 'CONSOLIDATION_TO';
  const consolidationType: ConsolidationType = override.consolidationType ?? 'administrative';
  return {
    caseId: override.caseId ?? randomCaseId(),
    consolidationType,
    documentType,
    orderDate: override.orderDate ?? randomDate(),
    otherCase: override.otherCase ?? getCaseSummary(),
  } as Consolidation;
}

function getConsolidationFrom(
  options: Options<ConsolidationFrom> = { override: {} },
): ConsolidationFrom {
  return getConsolidationReference({
    override: { ...options.override, documentType: 'CONSOLIDATION_FROM' },
  }) as ConsolidationFrom;
}

function getConsolidationHistory(override: Partial<ConsolidationOrderSummary> = {}) {
  return {
    childCases: override.childCases || [],
    leadCase: override.leadCase || undefined,
    status: override.status || 'pending',
  };
}

function getConsolidationOrder(
  options: Options<ConsolidationOrder> = { override: {} },
): ConsolidationOrder {
  const { entityType, override } = options;
  const summary = getCaseSummary({ entityType, override });

  const consolidationOrder: ConsolidationOrder = {
    childCases: [getConsolidatedOrderCase({ override }), getConsolidatedOrderCase({ override })],
    consolidationId: faker.string.uuid(),
    consolidationType: 'administrative',
    courtDivisionCode: summary.courtDivisionCode,
    courtName: summary.courtName,
    id: faker.string.uuid(),
    jobId: faker.number.int(),
    orderDate: override.orderDate ?? someDateAfterThisDate(summary.dateFiled),
    orderType: 'consolidation',
    status: override.status || 'pending',
  };

  return { ...consolidationOrder, ...override };
}

function getConsolidationReference(
  options: Options<ConsolidationFrom | ConsolidationTo> = { override: {} },
): ConsolidationFrom | ConsolidationTo {
  const reference: ConsolidationFrom | ConsolidationTo = {
    caseId: randomCaseId(),
    consolidationType: 'administrative',
    documentType: 'CONSOLIDATION_FROM',
    orderDate: randomDate(),
    otherCase: getCaseSummary(),
    updatedBy: options.override?.updatedBy ?? {
      id: '123',
      name: faker.person.fullName(),
    },
    updatedOn: options.override?.updatedOn ?? someDateAfterThisDate('2024-12-01'),
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

function getCourts() {
  return COURT_DIVISIONS;
}

function getDateAfterToday() {
  return faker.date.future();
}

function getDateBeforeToday() {
  return faker.date.past();
}

function getDebtorAttorney(override: Partial<DebtorAttorney> = {}): DebtorAttorney {
  return {
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    address3: '',
    cityStateZipCountry: `${faker.location.city()}, ${faker.location.state({
      abbreviated: true,
    })}, ${faker.location.zipCode()}, US`,
    email: faker.internet.email(),
    name: faker.person.fullName(),
    office: faker.company.name(),
    phone: faker.phone.number(),
    ...override,
  };
}

function getDocketEntry(override: Partial<CaseDocketEntry> = {}): CaseDocketEntry {
  const docketEntry: CaseDocketEntry = {
    dateFiled: randomDate(),
    documentNumber: 1,
    documents: [],
    fullText: faker.lorem.paragraph(),
    sequenceNumber: 1,
    summaryText: faker.lorem.lines(1),
  };
  const documentCount = randomInt(5);
  for (let docIndex = 0; docIndex < documentCount; docIndex++) {
    const fileUri = `001-24-00001-1-${docIndex}.pdf`;
    const documentEntry: CaseDocketEntryDocument = {
      fileLabel: docIndex.toString(),
      fileSize: randomInt(1000000),
      fileUri,
    };
    docketEntry.documents.push(documentEntry);
  }
  return {
    ...docketEntry,
    ...override,
  };
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

function getExpiration(): number {
  const NOW = nowInSeconds();
  const ONE_HOUR = 3600;
  const salt = Math.floor(Math.random() * 10);

  return NOW + ONE_HOUR + salt;
}

function getJwt(claims: Partial<CamsJwtClaims> = {}): string {
  const payload: CamsJwtClaims = {
    aud: 'fakeApi',
    exp: getExpiration(),
    groups: [],
    iss: 'http://fake.issuer.com/oauth2/default',
    sub: 'user@fake.com',
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
    data,
    meta: {
      self,
    },
  };
}

function getOffice(courtDivisionCode?: string) {
  if (!courtDivisionCode) return null;
  return COURT_DIVISIONS.find((office) => office.courtDivisionCode === courtDivisionCode);
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
    data,
    meta: {
      self,
    },
    pagination: {
      count: override.count ?? 5,
      currentPage: override.currentPage ?? 1,
      limit: override.limit ?? 25,
      next: override.next ?? undefined,
      previous: override.previous ?? undefined,
    },
  };
}

function getParty(options: Options<Party> = { override: {} }): Party {
  const { entityType, override } = options;
  const party: Party = {
    address1: faker.location.streetAddress(),
    address2: randomTruth() ? faker.location.secondaryAddress() : undefined,
    address3: undefined,
    cityStateZipCountry: `${faker.location.city()}, ${faker.location.state({
      abbreviated: true,
    })}, ${faker.location.zipCode()}, US`,
    name: entityType === 'company' ? faker.company.name() : faker.person.fullName(),
    ssn: entityType === 'person' ? randomSsn() : undefined,
    taxId: entityType === 'company' ? randomEin() : undefined,
  };
  return {
    ...party,
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

function getRawConsolidationOrder(
  options: Options<RawConsolidationOrder> = { override: {} },
): RawConsolidationOrder {
  const { entityType, override } = options;
  const summary = getCaseSummary({ entityType });

  const consolidationOrder: RawConsolidationOrder = {
    ...summary,
    docketEntries: [getDocketEntry()],
    jobId: faker.number.int(),
    leadCaseIdHint: randomTruth() ? randomCaseId() : null,
    orderDate: someDateAfterThisDate(summary.dateFiled),
  };

  return { ...consolidationOrder, ...override };
}

function getRole(): string {
  return 'USTP CAMS ' + faker.lorem.words(2);
}

function getRoleAndOfficeGroupNames(): RoleAndOfficeGroupNames {
  const offices = MockData.getOffices().map((office) => office.idpGroupName);
  return {
    offices,
    roles: buildArray(getRole, 5),
  };
}

function getSortedOrders(count: number = 10): Order[] {
  let transferCount = count;
  let consolidationCount = 0;

  if (count > 1) {
    transferCount = Math.floor(count / 2);
    consolidationCount = count - transferCount;
  }

  const orderList = [
    ...buildArray(MockData.getTransferOrder, transferCount),
    ...buildArray(MockData.getConsolidationOrder, consolidationCount),
  ].sort((a, b) => sortDates(a.orderDate, b.orderDate));

  return orderList;
}

function getStaffAssignee(override: Partial<Staff> = {}) {
  return {
    id: randomId(),
    name: faker.person.fullName(),
    ...override,
  };
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

function getTransferOrder(options: Options<TransferOrder> = { override: {} }): TransferOrder {
  const { entityType, override } = options;
  const summary = getCaseSummary({ entityType });
  const newCase = getCaseSummary({ entityType });

  const transferOrder: TransferOrder = {
    ...summary,
    dateFiled:
      override.dateFiled ??
      (override.orderDate ? someDateBeforeThisDate(override.orderDate) : summary.dateFiled),
    docketEntries: [getDocketEntry()],
    docketSuggestedCaseNumber: override.status === 'approved' ? undefined : randomCaseNumber(),
    id: faker.string.uuid(),
    newCase: override.status === 'approved' ? newCase : undefined,
    orderDate: override.orderDate ?? someDateAfterThisDate(summary.dateFiled),
    orderType: 'transfer',
    reason: override.status === 'rejected' ? faker.lorem.sentences(2) : undefined,
    status: override.status || 'pending',
  };

  return { ...transferOrder, ...override };
}

function getTrialAttorneys() {
  return TRIAL_ATTORNEYS;
}

function randomCaseId(divisionCode: string = '999') {
  return divisionCode + '-' + randomCaseNumber();
}

function randomCaseNumber() {
  return '99-' + ('00000' + randomInt(99999)).slice(-5);
}

function randomChapter(chapters: BankruptcyChapters[] = ['9', '11', '12', '15']) {
  return chapters[randomInt(chapters.length - 1)];
}

// TODO: consider whether this will eventually cause tests to fail
function randomDate(year = '2024') {
  return someDateAfterThisDate(`${year}-01-01`);
}

function randomEin() {
  return '99-' + ('0000000' + randomInt(9999999)).slice(-7);
}

function randomId() {
  return `guid-${('00000' + randomInt(100000)).slice(-5)}`;
}

function randomInt(range: number) {
  return Math.floor(Math.random() * range);
}

function randomOffice() {
  return COURT_DIVISIONS[randomInt(COURT_DIVISIONS.length - 1)];
}

function randomSsn() {
  return '999-' + ('00' + randomInt(99)).slice(-2) + '-' + ('0000' + randomInt(9999)).slice(-4);
}

function randomTruth() {
  return randomInt(2) > 0;
}

function randomUstpOffice() {
  return MOCKED_USTP_OFFICES_ARRAY[randomInt(MOCKED_USTP_OFFICES_ARRAY.length - 1)];
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

export const MockData = {
  addAction,
  buildArray,
  getAttorneyAssignment,
  getAttorneyUser,
  getCamsSession,
  getCamsUser,
  getCamsUserGroup,
  getCamsUserReference,
  getCaseBasics,
  getCaseDetail,
  getCaseNote,
  getCaseNoteDeletion,
  getCaseNoteDeletionRequest,
  getCaseNoteEditRequest,
  getCaseSummary,
  getCaseSyncEvent,
  getConsolidatedOrderCase,
  getConsolidation,
  getConsolidationFrom,
  getConsolidationHistory,
  getConsolidationOrder,
  getConsolidationReference,
  getConsolidationTo,
  getCourts,
  getDateAfterToday,
  getDateBeforeToday,
  getDebtorAttorney,
  getDocketEntry,
  getDxtrCase,
  getJwt,
  getManhattanAssignmentManagerSession,
  getManhattanTrialAttorneySession,
  getNonPaginatedResponseBody,
  getOffices,
  getOfficeWithStaff,
  getPaginatedResponseBody,
  getParty,
  getPrivilegedIdentityUser,
  getRawConsolidationOrder,
  getRole,
  getRoleAndOfficeGroupNames,
  getSortedOrders,
  getStaffAssignee,
  getSyncedCase,
  getSyncedCaseNotMatchingCaseIds,
  getTransferOrder,
  getTrialAttorneys,
  randomCaseId,
  randomCaseNumber,
  randomEin,
  randomId,
  randomOffice,
  randomSsn,
  randomUstpOffice,
  someDateAfterThisDate,
  someDateBeforeThisDate,
};

export default MockData;
