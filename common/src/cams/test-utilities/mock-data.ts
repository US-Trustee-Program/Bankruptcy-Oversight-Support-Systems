import { faker } from '@faker-js/faker';
import { CaseDetail, CaseDocketEntry, CaseDocketEntryDocument, CaseSummary } from '../cases';
import { RequiredId } from '../common';
import { TransferOrder } from '../orders';
import { Party } from '../parties';
import { OFFICES } from './offices.mock';

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

function randomTruth() {
  return randomInt(2) > 0;
}

function randomInt(range: number) {
  return Math.floor(Math.random() * range);
}

function getCaseId() {
  return '24-' + ('00000' + randomInt(99999)).slice(-5);
}

function getOffices() {
  return OFFICES;
}

function randomOffice() {
  return OFFICES[randomInt(OFFICES.length - 1)];
}

interface Options<T> {
  entityType?: EntityType;
  override?: Partial<T>;
}

function getCaseSummary(options: Options<CaseSummary> = { override: {} }): CaseSummary {
  const { entityType, override } = options;
  const debtor = getParty({ entityType });
  const debtorTypeCode = entityType === 'person' ? 'IC' : randomTruth() ? 'CB' : 'IB';
  const debtorTypeLabel = debtorTypeLabelMap.get(debtorTypeCode);
  const office = randomOffice();
  const caseSummary: CaseSummary = {
    ...office,
    caseId: getCaseId(),
    chapter: '',
    caseTitle: debtor.name,
    dateFiled: '',
    debtor,
    debtorTypeCode,
    debtorTypeLabel,
  };
  return { ...caseSummary, ...override };
}

function getCaseDetail(options: Options<CaseDetail> = { override: {} }): CaseDetail {
  const { entityType, override } = options;
  const caseDetail: CaseDetail = {
    ...getCaseSummary({ entityType }),
  };
  return { ...caseDetail, ...override };
}

function getTransferOrder(options: Options<TransferOrder> = { override: {} }): TransferOrder {
  const { entityType, override } = options;
  const summary = getCaseSummary({ entityType });
  const newCase = getCaseSummary({ entityType });

  const transferOrder: TransferOrder = {
    ...summary,
    orderType: 'transfer',
    orderDate: '2024-01-01',
    status: override.status || 'pending',
    docketEntries: [getDocketEntry()],
    newCaseId: override.status === 'approved' ? newCase.caseId : undefined,
    newCase: override.status === 'approved' ? newCase : undefined,
    reason: override.status === 'rejected' ? faker.lorem.sentences(2) : undefined,
  };

  return { ...transferOrder, ...override };
}

function getTransferOrderWithId(
  options: Options<TransferOrder> = { override: {} },
): RequiredId<TransferOrder> {
  return { ...getTransferOrder(options), id: faker.string.uuid(), ...options.override };
}

function getParty(options: Options<Party> = { override: {} }): Party {
  const { entityType, override } = options;
  const party: Party = {
    name: entityType === 'company' ? faker.company.name() : faker.person.fullName(),
    address1: faker.location.streetAddress(),
    address2: faker.location.secondaryAddress(),
    address3: '',
    cityStateZipCountry: `${faker.location.city()}, ${faker.location.state()}, ${faker.location.zipCode()}, US`,
    taxId: entityType === 'company' ? '88-8888888' : '',
    ssn: entityType === 'person' ? '999-99-9999' : '',
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
    dateFiled: '2024-01-01',
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

export const Mock = {
  getCaseId,
  getCaseSummary,
  getCaseDetail,
  getOffices,
  getParty,
  getDocketEntry,
  getTransferOrder,
  getTransferOrderWithId,
};
