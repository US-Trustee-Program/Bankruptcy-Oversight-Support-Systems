import * as dotenv from 'dotenv';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { CaseBasics, CaseSummary, getCaseIdParts } from '../../../../common/src/cams/cases';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { OrdersUseCase } from '../../../lib/use-cases/orders/orders';
import { ConsolidationOrder, TransferOrder } from '../../../../common/src/cams/orders';
import { extractAndPrepareSqlData } from './dxtr-utils';
import {
  insertConsolidationOrders,
  insertTransferOrders,
  insertTrustees,
  syncCases,
} from './db-utils';
import { Trustee } from '../../../../common/src/cams/trustees';

export const KNOWN_GOOD_TRANSFER_FROM_CASE_NUMBER = '65-67641';
export const KNOWN_GOOD_TRANSFER_FROM_CASE_ID = '081-' + KNOWN_GOOD_TRANSFER_FROM_CASE_NUMBER;

export const KNOWN_GOOD_TRANSFER_TO_CASE_ID = '091-69-12345';

dotenv.config();

export async function seedCosmosE2eDatabase(context: ApplicationContext) {
  const { dxtrCaseIds, dxtrCases, transferTo, transferFrom } =
    await extractAndPrepareSqlData(context);

  await syncCases(context, dxtrCaseIds);

  const consolidationOrders = await generateConsolidationOrders(context, dxtrCases.slice(5, 25));
  await insertConsolidationOrders(context, consolidationOrders);

  const transferOrders = generateTransferOrders(dxtrCases.slice(25, 45), transferTo, transferFrom);
  await insertTransferOrders(context, transferOrders);

  const trustees = await generateTrustees();
  await insertTrustees(context, trustees);
}

export async function generateTrustees(): Promise<Trustee[]> {
  const trusteeProfiles: Trustee[] = [];

  for (let i = 0; i < 5; i++) {
    trusteeProfiles.push(MockData.getTrustee({ id: `test-trustee-${i}` }));
  }

  return trusteeProfiles;
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
