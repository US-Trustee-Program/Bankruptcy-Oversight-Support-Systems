import proxyData from '../adapters/data-access.proxy';
import { PersistenceGateway } from './persistence-gateway.int';
import { makeListChapters } from './chapters';

const database: PersistenceGateway = await proxyData();
const listChapters = makeListChapters(database);

export { listChapters };