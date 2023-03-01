import proxyData from '../adapters/data-access.proxy';
import { ChaptersPersistenceGateway, CasePersistenceGateway } from '../adapters/types/persistence-gateway';
import { makeAddCase, makeListCases, makeGetCase, makeUpdateCase, makeDeleteCase } from './cases';
import { makeListChapters } from './chapters';

const casesDb: CasePersistenceGateway = (await proxyData('cases')) as CasePersistenceGateway;
const chapterDb: ChaptersPersistenceGateway = (await proxyData('chapters')) as ChaptersPersistenceGateway;
const addCase = makeAddCase(casesDb);
const listCases = makeListCases(casesDb);
const getCase = makeGetCase(casesDb);
const updateCase = makeUpdateCase(casesDb);
const deleteCase = makeDeleteCase(casesDb);
const listChapters = makeListChapters(chapterDb);

export default {
  addCase,
  listCases,
  getCase,
  updateCase,
  deleteCase,
  listChapters,
};
