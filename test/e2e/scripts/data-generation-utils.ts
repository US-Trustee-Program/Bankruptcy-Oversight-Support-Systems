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
import { CaseBasics, CaseSummary } from '../../../common/src/cams/cases';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import ExportAndLoadCase from '../../../backend/lib/use-cases/dataflows/export-and-load-case';
import { CaseSyncEvent } from '../../../common/src/queue/dataflow-types';
import { OrdersUseCase } from '../../../backend/lib/use-cases/orders/orders';
import { ConsolidationOrder, TransferOrder } from '../../../common/src/cams/orders';
import { getCaseIdParts } from '../../../backend/lib/adapters/gateways/dxtr/cases.dxtr.gateway';

//TEST CASES:

//1. when an consolidation order is approved, the accordion on data-verification should change to 'Approved'
//////a. on the case Detail of a child, it should show the parent caseId
//////b. Parent Case Detail should show associations
//2. when a consolidation order is rejected, the accordion status should change to 'Rejected'
//////a. should not change the Case Detail Overview
//3. When a Transfer order is approved should show 'Approved' on data-verification
//////a. Case Detail Overview should show information appropriately for either case and properly show 'To' and 'From'
const KNOWN_GOOD_TRANSFER_FROM_CASE_ID = '081-65-67641';
const KNOWN_GOOD_TRANSFER_TO_CASE_ID = '091-69-12345';
dotenv.config();

export async function seedCosmosE2eDatabase() {
  const env = { ...process.env };
  const invocationContext = createMockAzureFunctionContext(env);
  const appContext = await ContextCreator.getApplicationContext({ invocationContext });

  const { dxtrCases, transferTo, transferFrom } = await getCasesFromDxtr(appContext);
  const dedupedDxtrCases = deduplicateCases(dxtrCases);
  const dxtrCaseIds = dedupedDxtrCases.map((bCase) => bCase.caseId);

  // Create SYNCED_CASE docs in Cosmos for each of the cases.
  const caseEvents = await syncCases(appContext, dxtrCaseIds);
  const transferCaseEvents = await syncCases(appContext, [
    KNOWN_GOOD_TRANSFER_FROM_CASE_ID,
    KNOWN_GOOD_TRANSFER_TO_CASE_ID,
  ]);
  console.log('Case Events returned from sync.....   ', caseEvents);
  console.log('Case Events returned from transfer cases sync.....   ', transferCaseEvents);

  const casesWithConsolidations = dxtrCases.slice(5, 15);
  const casesWithTransfers = dxtrCases.slice(15, 19);

  const consolidationOrders = await generateConsolidationOrders(
    appContext,
    casesWithConsolidations,
  );
  await insertConsolidationOrders(appContext, consolidationOrders);

  const transferOrders = generateTransferOrders(casesWithTransfers, transferTo, transferFrom);
  await insertTransferOrders(appContext, transferOrders);
}

async function getCasesFromDxtr(appContext: ApplicationContext) {
  const casesGateway = getCasesGateway(appContext);
  const predicate: CasesSearchPredicate = {
    limit: 25,
    offset: 0,
    chapters: ['15'],
    divisionCodes: ['081'],
  };
  const { transferTo, transferFrom } = await getKnownGoodTransferCasesFromDxtr(appContext);
  const dxtrCases = await casesGateway.searchCases(appContext, predicate);
  return { dxtrCases, transferTo, transferFrom };
}

async function getKnownGoodTransferCasesFromDxtr(appContext: ApplicationContext) {
  const casesGateway = getCasesGateway(appContext);

  const transferTo = await casesGateway.getCaseSummary(appContext, KNOWN_GOOD_TRANSFER_TO_CASE_ID);
  const transferFrom = await casesGateway.getCaseSummary(
    appContext,
    KNOWN_GOOD_TRANSFER_FROM_CASE_ID,
  );

  return { transferTo, transferFrom };
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

function generateTransferOrders(
  cases: CaseBasics[],
  transferTo: CaseSummary,
  tranferFrom: CaseSummary,
) {
  const transferOrders: TransferOrder[] = [];
  const originalCases = cases.slice(0, 2);
  const newCases = cases.slice(2);

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
  //a Manually created SQL record that is known to be a good transfer with corresponding AO_PY, and AO_TX record
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
  transferOrders.push(knownGoodTransferOrder);

  return transferOrders;
}

async function insertConsolidationOrders(
  appContext: ApplicationContext,
  consolidations: ConsolidationOrder[],
) {
  const consolidationRepo = getConsolidationOrdersRepository(appContext);
  await consolidationRepo.createMany(consolidations);
  console.log('Created Consolidation Orders....   ', consolidations);
  consolidationRepo.release();
}

async function insertTransferOrders(appContext: ApplicationContext, transfers: TransferOrder[]) {
  const transfersRepo = getOrdersRepository(appContext);
  await transfersRepo.createMany(transfers);
  console.log('Created Transfer Orders....   ', transfers);
  transfersRepo.release();
}

async function syncCases(context: ApplicationContext, caseIds: string[]) {
  const events: CaseSyncEvent[] = caseIds.map((caseId) => {
    return { type: 'CASE_CHANGED', caseId };
  });
  return await ExportAndLoadCase.exportAndLoad(context, events);
}

function deduplicateCases(cases: CaseBasics[]) {
  const dedupedCases = cases.filter(
    (bCase) =>
      bCase.caseId != KNOWN_GOOD_TRANSFER_FROM_CASE_ID &&
      bCase.caseId != KNOWN_GOOD_TRANSFER_TO_CASE_ID,
  );
  return dedupedCases;
}
