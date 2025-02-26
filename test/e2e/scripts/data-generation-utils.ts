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
const KNOWN_GOOD_TRANSFER_CASE_ID = '081-65-67641';
const KNOWN_GOOD_TRANSFER_NEW_CASE_ID = '091-69-12345';
dotenv.config();

export async function seedCosmosE2eDatabase() {
  const env = { ...process.env };
  const invocationContext = createMockAzureFunctionContext(env);
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });

  // Get some cases from DXTR
  const dxtrCases = await getCasesFromDxtr(appContext);
  const knownGoodTransferCases = await getKnownGoodTransferCasesFromDxtr(appContext);
  const casesToSync = [...new Set([...dxtrCases, ...knownGoodTransferCases])];

  const dxtrCaseIds = casesToSync.map((bCase) => bCase.caseId);

  // Create SYNCED_CASE docs in Cosmos for each of the cases.
  const caseEvents = await syncCases(appContext, dxtrCaseIds);
  console.log('Case Events returned from sync.....   ', caseEvents);

  // 5 cases no orders, 10 within consolidations, 10 with transfers all orders pending
  const casesWithConsolidations = dxtrCases.slice(5, 15);
  const casesWithTransfers = dxtrCases.slice(15, 25);

  const consolidationRepo = getConsolidationOrdersRepository(appContext);
  const consolidationOrders = await generateConsolidationOrders(
    appContext,
    casesWithConsolidations,
  );
  await consolidationRepo.createMany(consolidationOrders);
  console.log('Created Consolidation Orders....   ', consolidationOrders);

  const transfersRepo = getOrdersRepository(appContext);
  const transferOrders = generateTransferOrders(casesWithTransfers, knownGoodTransferCases);
  console.log('Created Transfer Orders....   ', consolidationOrders);
  await transfersRepo.createMany(transferOrders);
  consolidationRepo.release();
  transfersRepo.release();
}

async function getCasesFromDxtr(appContext: ApplicationContext) {
  const casesGateway = getCasesGateway(appContext);
  const predicate: CasesSearchPredicate = {
    limit: 25,
    offset: 0,
    chapters: ['15'],
    divisionCodes: ['081'],
  };

  return await casesGateway.searchCases(appContext, predicate);
}

async function getKnownGoodTransferCasesFromDxtr(appContext: ApplicationContext) {
  const casesGateway = getCasesGateway(appContext);
  const transferPredicate: CasesSearchPredicate = {
    limit: 25,
    offset: 0,
    caseIds: [KNOWN_GOOD_TRANSFER_CASE_ID, KNOWN_GOOD_TRANSFER_NEW_CASE_ID],
  };
  return await casesGateway.searchCases(appContext, transferPredicate);
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
  console.log('After map consolidations but inside consolidation generation....');
  return Array.from(consolidationsMap.values());
}

function generateTransferOrders(cases: CaseBasics[], knownGoodTransferCases: CaseBasics[]) {
  const transferOrders: TransferOrder[] = [];
  const originalCases = cases.slice(0, 5);
  const newCases = cases.slice(5);
  newCases[0] = { ...originalCases[0] };

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
  //a Manually created SQL record that is known to be a good transfer with corresponding AO_PY, and AO_TX record
  transferOrders.push(
    MockData.getTransferOrder({
      override: {
        ...knownGoodTransferCases[0],
        status: 'pending',
        newCase: { ...MockData.getCaseSummary({ override: { ...knownGoodTransferCases[1] } }) },
      },
    }),
  );
  return transferOrders;
}

async function syncCases(context: ApplicationContext, caseIds: string[]) {
  const events: CaseSyncEvent[] = caseIds.map((caseId) => {
    return { type: 'CASE_CHANGED', caseId };
  });
  return await ExportAndLoadCase.exportAndLoad(context, events);
}
