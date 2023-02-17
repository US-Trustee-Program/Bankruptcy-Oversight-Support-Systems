/*
import data from '../adapters/gateways/azure.sql.gateway';

const NAMESPACE = 'CHAPTERS-MODULE';

const database = new data('chapters');

function getAll(): {} {
  return database.getAll();
}
*/

import { PersistenceGateway } from './persistence-gateway.int';

function makeListChapters ( database: PersistenceGateway ) {
  return async function listChapters () {
    return await database.getAll('chapters')
  }  
}

export { makeListChapters }