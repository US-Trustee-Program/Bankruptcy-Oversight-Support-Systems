import { faker } from '@faker-js/faker';
import { Buffer } from 'buffer';
import {
  CaseBasics,
  CaseDetail,
  CaseDocketEntry,
  CaseDocketEntryDocument,
  CaseSummary,
} from '../cases';
import {
  ConsolidationOrder,
  ConsolidationOrderCase,
  ConsolidationType,
  RawConsolidationOrder,
  TransferOrder,
} from '../orders';
import { DebtorAttorney, Party } from '../parties';
import { OFFICES } from './offices.mock';
import { ATTORNEYS } from './attorneys.mock';
import { ConsolidationOrderSummary } from '../history';
import {
  Consolidation,
  ConsolidationDocumentTypes,
  ConsolidationFrom,
  ConsolidationTo,
} from '../events';
import { CaseAssignment } from '../assignments';
import { CamsSession } from '../session';
import { ResponseBodySuccess } from '../../api/response';
import { WithPagination } from '../../api/pagination';

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

function getOffices() {
  return OFFICES;
}

function randomOffice() {
  return OFFICES[randomInt(OFFICES.length - 1)];
}

function randomDate(year = '2024') {
  return someDateAfterThisDate(`${year}-01-01`, 28);
}

function someDateAfterThisDate(thisDateString: string, days?: number): string {
  const thisDate = new Date(Date.parse(thisDateString));
  const daysToAdd = days || randomInt(1000);
  const someDate = new Date(thisDate.setDate(thisDate.getDate() + daysToAdd));
  return someDate.toISOString().split('T')[0];
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
  const documentType: ConsolidationDocumentTypes = override.documentType ?? 'CONSOLIDATION_TO';
  const consolidationType: ConsolidationType = override.consolidationType ?? 'administrative';
  return {
    documentType,
    consolidationType,
    caseId: override.caseId ?? randomCaseId(),
    orderDate: override.orderDate ?? randomDate(),
    otherCase: override.otherCase ?? getCaseSummary(),
  } as Consolidation;
}

function getConsolidatedOrderCase(
  options: Options<ConsolidationOrderCase> = { entityType: 'person', override: {} },
) {
  const { entityType, override } = options;
  const docketEntries = [getDocketEntry()];
  const consolidatedCaseSummary: ConsolidationOrderCase = {
    ...getCaseSummary({ entityType: entityType }),
    orderDate: docketEntries[0].dateFiled,
    docketEntries,
    attorneyAssignments: override.attorneyAssignments ?? [getAttorneyAssignment()],
    associations: override.associations ?? [],
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
  const office = randomOffice();
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
  options: Options<CaseDetail> = { entityType: 'person', override: {} },
): CaseDetail {
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
  return { ...caseDetail, ...override };
}

/**
 * @param data T required There is no simple way to determine what type T is and generate
 *  random data accordingly, so it is required to provide it. We could modify to behave like
 *  buildArray does and accept a function from here as well, but it should verify the type
 *  is correct if we do that.
 * @param self String optional The URI for the resource being mocked
 */
function getNonPaginatedResponseBodySuccess<T>(
  data: T,
  self: string = 'some-url',
): ResponseBodySuccess<T> {
  return {
    meta: {
      self,
      isPaginated: false,
    },
    isSuccess: true,
    data,
  };
}

/**
 * @param data T required There is no simple way to determine what type T is and generate
 *  random data accordingly, so it is required to provide it. We could modify to behave like
 *  buildArray does and accept a function from here as well, but it should verify the type
 *  is correct if we do that.
 * @param options Options<WithPagination> optional Provide an object like the following:
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
 * @param self String optional The URI for the resource being mocked
 */
function getPaginatedResponseBodySuccess<T>(
  data: T,
  options: Options<WithPagination> = { override: {} },
  self: string = 'some-url',
): ResponseBodySuccess<T> {
  const { override } = options;
  return {
    meta: {
      self,
      isPaginated: true,
      count: override.count ?? 5,
      previous: override.previous ?? undefined,
      next: override.next ?? undefined,
      limit: override.limit ?? 25,
      currentPage: override.currentPage ?? 1,
    },
    isSuccess: true,
    data,
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
    orderDate: someDateAfterThisDate(summary.dateFiled),
    status: override.status || 'pending',
    docketEntries: [getDocketEntry()],
    docketSuggestedCaseNumber: override.status === 'approved' ? undefined : randomCaseNumber(),
    newCase: override.status === 'approved' ? newCase : undefined,
    reason: override.status === 'rejected' ? faker.lorem.sentences(2) : undefined,
  };

  return { ...transferOrder, ...override };
}

function getConsolidationOrder(
  options: Options<ConsolidationOrder> = { override: {} },
): ConsolidationOrder {
  const { entityType, override } = options;
  const summary = getCaseSummary({ entityType });

  const consolidationOrder: ConsolidationOrder = {
    consolidationId: faker.string.uuid(),
    consolidationType: 'administrative',
    courtName: summary.courtName,
    id: faker.string.uuid(),
    orderType: 'consolidation',
    orderDate: someDateAfterThisDate(summary.dateFiled),
    status: override.status || 'pending',
    courtDivisionCode: summary.courtDivisionCode,
    jobId: faker.number.int(),
    childCases: [getConsolidatedOrderCase(), getConsolidatedOrderCase()],
  };

  return { ...consolidationOrder, ...override };
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
    leadCaseIdHint: randomTruth() ? randomCaseId() : null,
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
  };
  return {
    ...reference,
    ...options.override,
  };
}

function getParty(options: Options<Party> = { override: {} }): Party {
  const { entityType, override } = options;
  const party: Party = {
    name: entityType === 'company' ? faker.company.name() : faker.person.fullName(),
    address1: faker.location.streetAddress(),
    address2: randomTruth() ? faker.location.secondaryAddress() : undefined,
    address3: undefined,
    cityStateZipCountry: `${faker.location.city()}, ${faker.location.state({
      abbreviated: true,
    })}, ${faker.location.zipCode()}, US`,
    taxId: entityType === 'company' ? randomEin() : undefined,
    ssn: entityType === 'person' ? randomSsn() : undefined,
  };
  return {
    ...party,
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
    docketEntry.documents.push(documentEntry);
  }
  return {
    ...docketEntry,
    ...override,
  };
}

function getDebtorAttorney(override: Partial<DebtorAttorney> = {}): DebtorAttorney {
  return {
    name: faker.person.fullName(),
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    address3: '',
    cityStateZipCountry: `${faker.location.city()}, ${faker.location.state({
      abbreviated: true,
    })}, ${faker.location.zipCode()}, US`,
    phone: faker.phone.number(),
    email: faker.internet.email(),
    office: faker.company.name(),
    ...override,
  };
}

function getAttorneyAssignment(override: Partial<CaseAssignment> = {}): CaseAssignment {
  const firstDate = someDateAfterThisDate(`2023-01-01`, 28);
  return {
    id: `guid-${('00000' + randomInt(100000)).slice(-5)}`,
    documentType: 'ASSIGNMENT',
    caseId: randomCaseId(),
    name: faker.person.fullName(),
    role: 'TrialAttorney',
    assignedOn: firstDate,
    unassignedOn: someDateAfterThisDate(firstDate, 28),
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
  return ATTORNEYS;
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

function getCamsSession(override: Partial<CamsSession> = {}): CamsSession {
  return {
    user: { name: 'Mock Name' },
    accessToken: getJwt(),
    provider: 'mock',
    validatedClaims: { claimOne: '' },
    ...override,
  };
}

function getJwt(): string {
  const SECONDS_SINCE_EPOCH = Math.floor(Date.now() / 1000);
  const ONE_HOUR = 3600;

  const header = '{"typ":"JWT","alg":"HS256"}';
  const payload = `{"iss":"http://fake.issuer.com","sub":"user@fake.com","aud":"fakeApi","exp":${SECONDS_SINCE_EPOCH + ONE_HOUR}},"random":"${Math.random()}"}`;
  const encodedHeader = Buffer.from(header, 'binary').toString('base64');
  const encodedPayload = Buffer.from(payload, 'binary').toString('base64');

  // The prior implementation of the signature failed decoding by JWT.io and by the `jsonwebtoken` library.
  // This is a stop gap, valid signature, but not valid for the payload above.
  const encodedSignature = 'uo8vHLYnkLiN4xHccj8buiaFugq1y4qPRbdJN_dyv_E'; // pragma: allowlist secret
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export const MockData = {
  randomCaseId,
  getAttorneyAssignment,
  getCaseBasics,
  getCaseSummary,
  getCaseDetail,
  getOffices,
  getParty,
  getDocketEntry,
  getNonPaginatedResponseBodySuccess,
  getPaginatedResponseBodySuccess,
  getTransferOrder,
  getDebtorAttorney,
  getConsolidation,
  getConsolidationOrder,
  getConsolidatedOrderCase,
  getConsolidationReference,
  getRawConsolidationOrder,
  buildArray,
  getTrialAttorneys,
  getConsolidationHistory,
  getDateBeforeToday,
  getCamsSession,
  getJwt,
};

export default MockData;
