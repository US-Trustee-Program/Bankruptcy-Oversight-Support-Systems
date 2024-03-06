import { faker } from '@faker-js/faker';
import { CaseDetail, CaseDocketEntry, CaseDocketEntryDocument, CaseSummary } from '../cases';
import {
  ConsolidationOrder,
  ConsolidationOrderCase,
  RawConsolidationOrder,
  TransferOrder,
} from '../orders';
import { DebtorAttorney, Party } from '../parties';
import { OFFICES } from './offices.mock';
import { ATTORNEYS } from './attorneys.mock';
import { ConsolidationOrderSummary } from '../history';

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

function randomCaseId(divisionCode: string = '999') {
  return divisionCode + '-99-' + ('00000' + randomInt(99999)).slice(-5);
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

function getConsolidatedOrderCase(
  options: Options<ConsolidationOrderCase> = { entityType: 'person', override: {} },
) {
  const { entityType, override } = options;
  const docketEntries = [getDocketEntry()];
  const consolidatedCaseSummary: ConsolidationOrderCase = {
    ...getCaseSummary({ entityType: entityType }),
    docketEntries,
  };

  return { ...consolidatedCaseSummary, ...override };
}

function getCaseSummary(
  options: Options<CaseSummary> = { entityType: 'person', override: {} },
): CaseSummary {
  const { entityType, override } = options;
  const debtor = getParty({ entityType });
  const debtorTypeCode = entityType === 'person' ? 'IC' : 'CB';
  const debtorTypeLabel = debtorTypeLabelMap.get(debtorTypeCode);
  const office = randomOffice();
  const caseSummary: CaseSummary = {
    ...office,
    dxtrId: '0', // NEED TO REFACTOR THIS OUT OF THE MODEL AND STOP LEAKING FROM THE API
    caseId: randomCaseId(office.courtDivision),
    chapter: randomChapter(),
    caseTitle: debtor.name,
    dateFiled: randomDate(),
    debtor,
    debtorTypeCode,
    debtorTypeLabel,
  };
  return { ...caseSummary, ...override };
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
    debtorAttorney: getDebtorAttorney(),
    judgeName: faker.person.fullName(),
  };
  return { ...caseDetail, ...override };
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
    newCaseId: override.status === 'approved' ? newCase.caseId : randomCaseId(),
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
    courtName: summary.courtName,
    id: faker.string.uuid(),
    orderType: 'consolidation',
    orderDate: someDateAfterThisDate(summary.dateFiled),
    status: override.status || 'pending',
    docketEntries: [getDocketEntry()],
    divisionCode: summary.courtDivision,
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

function getDebtorAttorney(): DebtorAttorney {
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
  };
}

function buildArray(fn: () => void, size: number) {
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

export const MockData = {
  randomCaseId,
  getCaseSummary,
  getCaseDetail,
  getOffices,
  getParty,
  getDocketEntry,
  getTransferOrder,
  getDebtorAttorney,
  getConsolidationOrder,
  getConsolidatedOrderCase,
  getRawConsolidationOrder,
  buildArray,
  getTrialAttorneys,
  getConsolidationHistory,
};
