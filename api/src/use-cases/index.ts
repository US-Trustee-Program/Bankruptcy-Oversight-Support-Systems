import proxyData from '../adapters/data-access.proxy';
import { PersistenceGateway } from '../adapters/types/persistence-gateway';
import { makeListChapters } from './chapters';

const database: PersistenceGateway = await proxyData();
const listChapters = makeListChapters(database);

export { listChapters };
