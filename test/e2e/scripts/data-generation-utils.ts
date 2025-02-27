import * as dotenv from 'dotenv';
import ContextCreator from '../../../backend/function-apps/azure/application-context-creator';
import { createMockAzureFunctionContext } from '../../../backend/function-apps/azure/testing-helpers';
import { ApplicationContext } from '../../../backend/lib/adapters/types/basic';
import { CaseBasics, CaseSummary } from '../../../common/src/cams/cases';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { OrdersUseCase } from '../../../backend/lib/use-cases/orders/orders';
import { ConsolidationOrder, TransferOrder } from '../../../common/src/cams/orders';
import { getCaseIdParts } from '../../../backend/lib/adapters/gateways/dxtr/cases.dxtr.gateway';
import { extractAndPrepareSqlData } from './dxtr-utils';
import { insertConsolidationOrders, insertTransferOrders, syncCases } from './cosmos-utils';

//TEST CASES:

//1. when an consolidation order is approved, the accordion on data-verification should change to 'Approved'
//////a. on the case Detail of a child, it should show the parent caseId
//////b. Parent Case Detail should show associations
//2. when a consolidation order is rejected, the accordion status should change to 'Rejected'
//////a. should not change the Case Detail Overview
//3. When a Transfer order is approved should show 'Approved' on data-verification
//////a. Case Detail Overview should show information appropriately for either case and properly show 'To' and 'From'

export const KNOWN_GOOD_TRANSFER_FROM_CASE_ID = '081-65-67641';
//a Manually created SQL record that is known to be a good transfer with corresponding AO_PY, and AO_TX record
export const KNOWN_GOOD_TRANSFER_TO_CASE_ID = '091-69-12345';

dotenv.config();

export async function seedCosmosE2eDatabase() {
  const env = { ...process.env };
  const invocationContext = createMockAzureFunctionContext(env);
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });
  const { dxtrCaseIds, dxtrCases, transferTo, transferFrom } =
    await extractAndPrepareSqlData(appContext);

  await syncCases(appContext, dxtrCaseIds);

  const consolidationOrders = await generateConsolidationOrders(appContext, dxtrCases.slice(5, 15));
  await insertConsolidationOrders(appContext, consolidationOrders);

  const transferOrders = generateTransferOrders(dxtrCases.slice(15, 19), transferTo, transferFrom);
  await insertTransferOrders(appContext, transferOrders);
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
  tranferFrom: CaseSummary,
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

  const knownGoodTransferOrder = createKnownGoodTransferOrder(transferTo, tranferFrom);
  transferOrders.push(knownGoodTransferOrder);

  return transferOrders;
}

function createKnownGoodTransferOrder(transferTo: CaseSummary, tranferFrom: CaseSummary) {
  const { caseNumber } = getCaseIdParts(KNOWN_GOOD_TRANSFER_TO_CASE_ID);
  const knownGoodTransferOrder: TransferOrder = {
    ...tranferFrom,
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
