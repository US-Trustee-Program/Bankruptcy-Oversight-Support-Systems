import { RecordObj } from '../adapters/types/basic';
import { CasePersistenceGateway } from '../adapters/types/persistence-gateway';

async function addCase(database: CasePersistenceGateway, fields: RecordObj[]) {
  return await database.createCase(fields);
}

async function listCases(database: CasePersistenceGateway) {
  return await database.getCaseList();
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
};
