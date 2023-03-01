import { RecordObj } from '../adapters/types/basic';
import { CasePersistenceGateway } from '../adapters/types/persistence-gateway';

const NAMESPACE = 'CASES-USE-CASE';

function makeAddCase(database: CasePersistenceGateway) {
  return async function addCase(fields: RecordObj[]) {
    return await database.createCase(fields);
  }
}

function makeListCases(database: CasePersistenceGateway ) {
  return async function listCases() {
    return await database.getCaseList();
  };
}

function makeGetCase(database: CasePersistenceGateway) {
  return async function getCase(id: number) {
    return await database.getCase(id);
  };
}

function makeUpdateCase(database: CasePersistenceGateway) {
  return async function updateCase(id: number, fields: RecordObj[]) {
    return await database.updateCase(id, fields);
  }
}

function makeDeleteCase(database: CasePersistenceGateway) {
  return async function deleteCase(id: number) {
    return await database.deleteCase(id);
  }
}

export { makeAddCase, makeListCases, makeGetCase, makeUpdateCase, makeDeleteCase };
