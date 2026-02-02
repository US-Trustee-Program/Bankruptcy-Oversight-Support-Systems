import * as dotenv from 'dotenv';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { CaseBasics, CaseSummary, getCaseIdParts } from '@common/cams/cases';
import MockData from '@common/cams/test-utilities/mock-data';
import { OrdersUseCase } from '../../../lib/use-cases/orders/orders';
import { ConsolidationOrder, TransferOrder } from '@common/cams/orders';
import DxtrUtils from './dxtr-utils';
import {
  insertConsolidationOrders,
  insertHybridSearchTestCases,
  insertTransferOrders,
  insertTrustees,
  insertUserGroups,
  syncCases,
} from './db-utils';
import { Trustee } from '@common/cams/trustees';
import { UserGroup } from '@common/cams/users';

const KNOWN_GOOD_TRANSFER_FROM_CASE_NUMBER = '65-67641';
const KNOWN_GOOD_TRANSFER_FROM_CASE_ID = '081-' + KNOWN_GOOD_TRANSFER_FROM_CASE_NUMBER;

const KNOWN_GOOD_TRANSFER_TO_CASE_ID = '091-69-12345';

dotenv.config();

async function seedCosmosE2eDatabase(context: ApplicationContext) {
  const { dxtrCaseIds, dxtrCases, transferTo, transferFrom } =
    await DxtrUtils.extractAndPrepareSqlData(context);

  await syncCases(context, dxtrCaseIds);

  const consolidationOrders = await generateConsolidationOrders(context, dxtrCases.slice(5, 25));
  await insertConsolidationOrders(context, consolidationOrders);

  const transferOrders = generateTransferOrders(dxtrCases.slice(25, 45), transferTo, transferFrom);
  await insertTransferOrders(context, transferOrders);

  const trustees = await generateTrustees();
  await insertTrustees(context, trustees);

  const userGroups = await generateUserGroups();
  await insertUserGroups(context, userGroups);
}

async function generateTrustees(): Promise<Trustee[]> {
  const trusteeProfiles: Trustee[] = [];

  for (let i = 0; i < 5; i++) {
    trusteeProfiles.push(MockData.getTrustee({ id: `test-trustee-${i}` }));
  }

  return trusteeProfiles;
}

async function generateUserGroups(): Promise<UserGroup[]> {
  const attorneys = [
    { id: 'attorney-1', name: 'Weis, Brandon' },
    { id: 'attorney-2', name: 'Smith, Jane' },
    { id: 'attorney-3', name: 'Johnson, Bob' },
  ];

  const auditors = [
    { id: 'auditor-1', name: 'Williams, Sarah' },
    { id: 'auditor-2', name: 'Brown, Michael' },
    { id: 'auditor-3', name: 'Davis, Emily' },
  ];

  return [
    {
      id: 'group-attorneys',
      groupName: 'USTP CAMS Trial Attorney',
      users: attorneys,
    },
    {
      id: 'group-auditors',
      groupName: 'USTP CAMS Auditor',
      users: auditors,
    },
  ];
}

async function generateConsolidationOrders(
  appContext: ApplicationContext,
  cases: CaseBasics[],
): Promise<ConsolidationOrder[]> {
  const ordersUseCase = new OrdersUseCase(appContext);
  const jobId = Math.floor(Math.random() * 1000);
  const rawOrders = [];

  for (const bCase of cases) {
    rawOrders.push(MockData.getRawConsolidationOrder({ override: { ...bCase, jobId } }));
  }
  const consolidationsMap = await ordersUseCase.mapConsolidations(appContext, rawOrders);

  return Array.from(consolidationsMap.values());
}

function generateTransferOrders(
  cases: CaseBasics[],
  transferTo: CaseSummary,
  transferFrom: CaseSummary,
) {
  const transferOrders: TransferOrder[] = [];
  const originalCases = cases.slice(0, 2);
  const newCases = cases.slice(2);
  //Create random transfers
  for (let i = 0; i < 2; i++) {
    transferOrders.push(
      MockData.getTransferOrder({
        override: {
          ...originalCases[i],
          status: 'pending',
          newCase: { ...MockData.getCaseSummary({ override: { ...newCases[i] } }) },
        },
      }),
    );
  }

  const knownGoodTransferOrder = createKnownGoodTransferOrder(transferTo, transferFrom);
  transferOrders.push(knownGoodTransferOrder);

  return transferOrders;
}

function createKnownGoodTransferOrder(transferTo: CaseSummary, transferFrom: CaseSummary) {
  const { caseNumber } = getCaseIdParts(KNOWN_GOOD_TRANSFER_TO_CASE_ID);
  const knownGoodTransferOrder: TransferOrder = {
    ...transferFrom,
    id: MockData.randomId(),
    orderDate: new Date().toISOString(),
    orderType: 'transfer',
    status: 'pending',
    docketSuggestedCaseNumber: caseNumber,
    docketEntries: [],
    newCase: transferTo,
  };
  return knownGoodTransferOrder;
}

async function seedHybridSearchTestData(context: ApplicationContext) {
  await insertHybridSearchTestCases(context);
}

const DataGenerationUtils = {
  KNOWN_GOOD_TRANSFER_FROM_CASE_NUMBER,
  KNOWN_GOOD_TRANSFER_FROM_CASE_ID,
  KNOWN_GOOD_TRANSFER_TO_CASE_ID,
  seedCosmosE2eDatabase,
  seedHybridSearchTestData,
  generateTrustees,
  generateUserGroups,
};

export default DataGenerationUtils;
