import { PersistenceGateway } from '../adapters/types/persistence-gateway';

const NAMESPACE = 'CHAPTERS-USE-CASE';

function makeListChapters(database: PersistenceGateway) {
  return async function listChapters() {
    return await database.getAll('chapters');
  };
}

export { makeListChapters };
