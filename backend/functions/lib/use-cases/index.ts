import { CasePersistenceGateway, UserPersistenceGateway } from '../adapters/types/persistence-gateway';
import { Context } from '../adapters/types/basic';

async function login(context: Context, database: UserPersistenceGateway, userName: {firstName: string, lastName: string}) {
  return await database.login(context, userName);
}

async function listCases(context: Context, database: CasePersistenceGateway, fields: {chapter: string, professionalId: string}): Promise<[]> {
  const result = await database.getCaseList(context, fields);

  // do we want to do this on the front end now?
  //result.body.staff1Label = 'Trial Attorney';
  //result.body.staff2Label = 'Auditor';

  // TODO: When we start returning multiple chapters, we need to define the staff labels at the case level
  // result.body.forEach((brCase: ObjectKeyVal) => {
  //   if (brCase['currentCaseChapter'] == '11') {
  //     brCase['staff1Label'] = 'Trial Attorney';
  //     brCase['staff2Label'] = 'Auditor';
  //   }
  // })
  return result;
}

export default {
  listCases,
  login,
};
