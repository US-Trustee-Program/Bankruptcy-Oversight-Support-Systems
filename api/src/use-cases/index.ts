import proxyData from '../adapters/data-access.proxy';
import { PersistenceGateway } from '../adapters/types/persistence-gateway';
import { makeAddCase, makeListCases, makeGetCase, makeUpdateCase, makeDeleteCase } from './cases';
import { makeListChapters } from './chapters';

const database: PersistenceGateway = await proxyData();
const addCase = makeAddCase(database);
const listCases = makeListCases(database);
const getCase = makeGetCase(database);
const updateCase = makeUpdateCase(database);
const deleteCase = makeDeleteCase(database);
const listChapters = makeListChapters(database);

export default {
  addCase, listCases, getCase, updateCase, deleteCase, listChapters
}
