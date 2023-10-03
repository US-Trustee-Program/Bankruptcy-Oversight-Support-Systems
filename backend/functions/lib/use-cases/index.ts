import { ApplicationContext } from '../adapters/types/basic';
import { CaseListDbResult } from '../adapters/types/cases';
import Chapter15CaseList from './chapter-15.case';
import Chapter15CaseDetail from './chapter-15.case';
import AttorneysList from './attorneys';
import InvalidChapterCaseList from './invalid-chapter.case-list';
import { AttorneyListDbResult } from '../adapters/types/attorneys';

async function listAttorneys(
  context: ApplicationContext,
  fields: { officeId?: string },
): Promise<AttorneyListDbResult> {
  const attorneysList = new AttorneysList();
  return await attorneysList.getAttorneyList(context, fields);
}

async function listCases(context: ApplicationContext, fields: { chapter: string }) {
  let result: CaseListDbResult;
  if (fields.chapter == '15') {
    const chapter15CaseList = new Chapter15CaseList();
    result = await chapter15CaseList.getChapter15CaseList(context);
  } else {
    const invalidChapterCaseList = new InvalidChapterCaseList();
    result = invalidChapterCaseList.returnInvalidChapterResponse();
  }

  return result;
}

async function getCaseDetail(context: ApplicationContext, fields: { caseId: string }) {
  const chapter15CaseDetail = new Chapter15CaseDetail();
  return chapter15CaseDetail.getChapter15CaseDetail(context, fields.caseId);
}

export default {
  listAttorneys,
  listCases,
  getCaseDetail,
};
