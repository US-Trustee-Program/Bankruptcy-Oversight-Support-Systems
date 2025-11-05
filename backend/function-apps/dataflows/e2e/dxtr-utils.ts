import { ApplicationContext } from '../../../lib/use-cases/application.types';
import { getCasesGateway } from '../../../lib/factory';
import { CasesSearchPredicate } from '../../../../common/src/api/search';
import { CaseBasics } from '../../../../common/src/cams/cases';
import {
  KNOWN_GOOD_TRANSFER_FROM_CASE_ID,
  KNOWN_GOOD_TRANSFER_TO_CASE_ID,
} from './data-generation-utils';

export async function getCasesFromDxtr(appContext: ApplicationContext) {
  const casesGateway = getCasesGateway(appContext);
  const predicate: CasesSearchPredicate = {
    limit: 50,
    offset: 0,
    chapters: ['15'],
    divisionCodes: ['081'],
  };
  const dxtrCases = await casesGateway.searchCases(appContext, predicate);

  return dxtrCases;
}

export async function getKnownGoodTransferCasesFromDxtr(appContext: ApplicationContext) {
  const casesGateway = getCasesGateway(appContext);
  const transferTo = await casesGateway.getCaseSummary(appContext, KNOWN_GOOD_TRANSFER_TO_CASE_ID);
  const transferFrom = await casesGateway.getCaseSummary(
    appContext,
    KNOWN_GOOD_TRANSFER_FROM_CASE_ID,
  );

  return { transferTo, transferFrom };
}

export async function extractAndPrepareSqlData(appContext: ApplicationContext) {
  const dxtrCases = await getCasesFromDxtr(appContext);
  const { transferTo, transferFrom } = await getKnownGoodTransferCasesFromDxtr(appContext);
  const dxtrCaseIds = deduplicateCases(dxtrCases).map((bCase) => bCase.caseId);
  dxtrCaseIds.push(transferTo.caseId, transferFrom.caseId);
  return { dxtrCaseIds, dxtrCases, transferTo, transferFrom };
}

function deduplicateCases(cases: CaseBasics[]) {
  const dedupedCases = cases.filter(
    (bCase) =>
      bCase.caseId != KNOWN_GOOD_TRANSFER_FROM_CASE_ID &&
      bCase.caseId != KNOWN_GOOD_TRANSFER_TO_CASE_ID,
  );
  return dedupedCases;
}
