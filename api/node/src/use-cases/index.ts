import { RecordObj } from '../adapters/types/basic';
import { CasePersistenceGateway, UserPersistenceGateway } from '../adapters/types/persistence-gateway';
import { ObjectKeyVal } from '../../../../gui/src/models/api';

async function login(database: UserPersistenceGateway, userName: {firstName: string, lastName: string}) {
  return await database.login(userName);
}

async function addCase(database: CasePersistenceGateway, fields: RecordObj[]) {
  return await database.createCase(fields);
}

async function listCases(database: CasePersistenceGateway, fields: {chapter: string, professionalId: number}) {
  const caseList = await database.getCaseList(fields);

  caseList.body.forEach((brCase: ObjectKeyVal) => {
    if (brCase['currentCaseChapter'] == '11') {
      brCase['staff1Label'] = 'Trial Attorney';
      brCase['staff2Label'] = 'Auditor';
    }
  })
  return caseList;
}

async function getCase(database: CasePersistenceGateway, id: number) {
  return await database.getCase(id);
}

async function updateCase(database: CasePersistenceGateway, id: number, fields: RecordObj[]) {
  return await database.updateCase(id, fields);
}

async function deleteCase(database: CasePersistenceGateway, id: number) {
  return await database.deleteCase(id);
}

export default {
  addCase,
  listCases,
  getCase,
  updateCase,
  deleteCase,
  login,
};
