import { RecordObj } from '../adapters/types/basic';
import { CasePersistenceGateway, UserPersistenceGateway } from '../adapters/types/persistence-gateway';

async function login(database: UserPersistenceGateway, userName: {firstName: string, lastName: string}) {
  return await database.login(userName);
}

async function addCase(database: CasePersistenceGateway, fields: RecordObj[]) {
  return await database.createCase(fields);
}

async function listCases(database: CasePersistenceGateway, fields: {chapter: string, professionalId: number}) {
  return await database.getCaseList(fields);
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
