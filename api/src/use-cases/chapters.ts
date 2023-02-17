/*
import data from '../adapters/gateways/azure.sql.gateway';

const NAMESPACE = 'CHAPTERS-MODULE';

const database = new data('chapters');

function getAll(): {} {
  return database.getAll();
}
*/

function makeListChapters ( database: Object ) {
  return async function listChapters () {
    return await database.getAll()
  }  
}

export { makeListChapters }