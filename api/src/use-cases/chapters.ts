import { ChaptersPersistenceGateway } from '../adapters/types/persistence-gateway';

const NAMESPACE = 'CHAPTERS-USE-CASE';

function makeListChapters(database: ChaptersPersistenceGateway) {
  return async function listChapters() {
    return await database.getChaptersList();
  };
}

export { makeListChapters };
