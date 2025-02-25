import * as dotenv from 'dotenv';
import ContextCreator from '../../../backend/function-apps/azure/application-context-creator';
import { createMockAzureFunctionContext } from '../../../backend/function-apps/azure/testing-helpers';
import { ApplicationContext } from '../../../backend/lib/adapters/types/basic';
import {
  getCasesGateway,
  getConsolidationOrdersRepository,
  getOrdersRepository,
} from '../../../backend/lib/factory';
import { CasesSearchPredicate } from '../../../common/src/api/search';
import { CaseBasics } from '../../../common/src/cams/cases';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import ExportAndLoadCase from '../../../backend/lib/use-cases/dataflows/export-and-load-case';
import { CaseSyncEvent } from '../../../common/src/queue/dataflow-types';
import { OrdersUseCase } from '../../../backend/lib/use-cases/orders/orders';
import { ConsolidationOrder, TransferOrder } from '../../../common/src/cams/orders';

//TEST CASES:

//1. when an consolidation order is approved, the accordion on data-verification should change to 'Approved'
//////a. on the case Detail of a child, it should show the parent caseId
//////b. Parent Case Detail should show associations
//2. when a consolidation order is rejected, the accordion status should change to 'Rejected'
//////a. should not change the Case Detail Overview
//3. When a Transfer order is approved should show 'Approved' on data-verification
//////a. Case Detail Overview should show information appropriately for either case and properly show 'To' and 'From'

dotenv.config();

export async function seedCosmosE2eDatabase() {
  const env = { ...process.env };
  const invocationContext = createMockAzureFunctionContext(env);
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });

  // Get some cases from DXTR
  const dxtrCases = await getCasesFromDxtr(appContext);
  const dxtrCaseIds = dxtrCases.map((bCase) => bCase.caseId);

  // Create SYNCED_CASE docs in Cosmos for each of the cases.
  await syncCases(appContext, dxtrCaseIds);

  // 5 cases no orders, 10 with consolidations, 10 with transfers all orders pending
  const casesWithConsolidations = dxtrCases.slice(5, 15);
  const casesWithTransfers = dxtrCases.slice(15, 25);

  const consolidationOrders = await generateConsolidationOrders(
    appContext,
    casesWithConsolidations,
  );
  const consolidationRepo = getConsolidationOrdersRepository(appContext);
  await consolidationRepo.createMany(consolidationOrders);

  const transfersRepo = getOrdersRepository(appContext);
  const transferOrders = generateTransferOrders(casesWithTransfers);
  await transfersRepo.createMany(transferOrders);
}

async function getCasesFromDxtr(appContext: ApplicationContext) {
  const casesGateway = getCasesGateway(appContext);
  const predicate: CasesSearchPredicate = {
    limit: 25,
    offset: 0,
    chapters: ['15'],
  };

  return await casesGateway.searchCases(appContext, predicate);
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
  const map = await ordersUseCase.mapConsolidations(appContext, rawOrders);

  // TODO: get docket entries added?
  return [map.get(jobId)];
}

function generateTransferOrders(cases: CaseBasics[]) {
  const transferOrders: TransferOrder[] = [];
  const originalCases = cases.slice(0, 5);
  const newCases = cases.slice(5);
  for (let i = 0; i < 5; i++) {
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

  // TODO: ensure docket entries exist if necessary
  return transferOrders;
}

async function syncCases(context: ApplicationContext, caseIds: string[]) {
  const events: CaseSyncEvent[] = caseIds.map((caseId) => {
    return { type: 'CASE_CHANGED', caseId };
  });
  return await ExportAndLoadCase.exportAndLoad(context, events);
}

seedCosmosE2eDatabase();
