import {
  CasePersistenceGateway,
  UserPersistenceGateway,
} from '../adapters/types/persistence.gateway';
import { ApplicationContext } from '../adapters/types/basic';
import { CaseListDbResult } from '../adapters/types/cases';
import Chapter11CaseList from './chapter-11.case-list';
import Chapter15CaseList from './chapter-15.case-list';
import AttorneysList from './attorneys';
import InvalidChapterCaseList from './invalid-chapter.case-list';

async function login(
  context: ApplicationContext,
  database: UserPersistenceGateway,
  userName: { firstName: string; lastName: string },
) {
  return await database.login(context, userName);
}

async function listAttorneys(context: ApplicationContext, fields: { officeId: string }) {
  const attorneysList = new AttorneysList();
  return await attorneysList.getAttorneyList(context, fields);
}

async function listCases(
  context: ApplicationContext,
  database: CasePersistenceGateway,
  fields: { chapter: string; professionalId: string },
) {
  let result: CaseListDbResult;
  if (fields.chapter == '11') {
    const chapter11CaseList = new Chapter11CaseList();
    result = await chapter11CaseList.getChapter11CaseList(context, database, fields);
  } else if (fields.chapter == '15') {
    const chapter15CaseList = new Chapter15CaseList();
    result = await chapter15CaseList.getChapter15CaseList(context);
  } else {
    const invalidChapterCaseList = new InvalidChapterCaseList();
    result = invalidChapterCaseList.returnInvalidChapterResponse();
  }

  return result;
}

export default {
  listAttorneys,
  listCases,
  login,
};
