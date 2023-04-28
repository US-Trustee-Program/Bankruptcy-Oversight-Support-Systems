import { RecordObj } from '../adapters/types/basic';
import { CasePersistenceGateway, UserPersistenceGateway } from '../adapters/types/persistence-gateway';
import { LogContext } from '../adapters/types/basic';

async function login(context: LogContext, database: UserPersistenceGateway, userName: {firstName: string, lastName: string}) {
  return await database.login(context, userName);
}

async function addCase(context: LogContext, database: CasePersistenceGateway, fields: RecordObj[]) {
  return await database.createCase(context, fields);
}

async function listCases(context: LogContext, database: CasePersistenceGateway, fields: {chapter: string, professionalId: number}) {
  const result = await database.getCaseList(context, fields);
  result.body.staff1Label = 'Trial Attorney';
  result.body.staff2Label = 'Auditor';

  // TODO: When we start returning multiple chapters, we need to define the staff labels at the case level
  // result.body.forEach((brCase: ObjectKeyVal) => {
  //   if (brCase['currentCaseChapter'] == '11') {
  //     brCase['staff1Label'] = 'Trial Attorney';
  //     brCase['staff2Label'] = 'Auditor';
  //   }
  // })
  return result;
}

async function getCase(context: LogContext, database: CasePersistenceGateway, id: number) {
  return await database.getCase(context, id);
}

async function updateCase(context: LogContext, database: CasePersistenceGateway, id: number, fields: RecordObj[]) {
  return await database.updateCase(context, id, fields);
}

async function deleteCase(context: LogContext, database: CasePersistenceGateway, id: number) {
  return await database.deleteCase(context, id);
}

export default {
  addCase,
  listCases,
  getCase,
  updateCase,
  deleteCase,
  login,
};
