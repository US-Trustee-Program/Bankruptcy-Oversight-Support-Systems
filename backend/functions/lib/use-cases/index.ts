import { CasePersistenceGateway, UserPersistenceGateway } from '../adapters/types/persistence-gateway';
import { Context } from '../adapters/types/basic';
import { CaseListDbResult } from '../adapters/types/cases';
import Chapter11CaseList from './chapter-11-case-list';
import Chapter15CaseList from './chapter-15-case-list';
import InvalidChapter from './invalid-chapter';

async function login(context: Context, database: UserPersistenceGateway, userName: {firstName: string, lastName: string}) {
  return await database.login(context, userName);
}

async function listCases(context: Context, database: CasePersistenceGateway, fields: {chapter: string, professionalId: string}) {
  let result: CaseListDbResult;
  if (fields.chapter == '11') {
    const chapter11CaseList = new Chapter11CaseList;
    result = await chapter11CaseList.getChapter11CaseList(context, database, fields);
  } else if (fields.chapter == '15') {
    const chapter15CaseList = new Chapter15CaseList;
    result = await chapter15CaseList.getChapter15CaseList(context);
  } else {
    const invalidChapter = new InvalidChapter;
    result = invalidChapter.returnInvalidChapterResponse();
  }

  return result;
}

async function getPacerToken() : Promise<string> {
  return await '';
}

export default {
  listCases,
  login,
  getPacerToken
};
