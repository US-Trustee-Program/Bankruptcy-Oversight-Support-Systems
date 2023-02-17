import database from '../adapters/data-access.proxy';
import {
  makeListChapters
} from './chapters';

const listChapters = makeListChapters({ database });

export { listChapters };