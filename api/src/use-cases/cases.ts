import { RecordObj } from '../adapters/types/basic';
import { PersistenceGateway } from '../adapters/types/persistence-gateway';

const NAMESPACE = 'CASES-USE-CASE';

function makeAddCase(database: PersistenceGateway) {
  return async function addCase(fields: RecordObj[]) {
    return await database.createRecord('cases', fields);
  }
}

function makeListCases(database: PersistenceGateway) {
  return async function listCases() {
    return await database.getAll('cases');
  };
}

function makeGetCase(database: PersistenceGateway) {
  return async function getCase(id: number) {
    return await database.getRecord('cases', id);
  };
}

function makeUpdateCase(database: PersistenceGateway) {
  return async function updateCase(id: number, fields: RecordObj[]) {
    return await database.updateRecord('cases', id, fields);
  }
}

function makeDeleteCase(database: PersistenceGateway) {
  return async function deleteCase(id: number) {
    return await database.deleteRecord('cases', id);
  }
}

export { makeAddCase, makeListCases, makeGetCase, makeUpdateCase, makeDeleteCase };
