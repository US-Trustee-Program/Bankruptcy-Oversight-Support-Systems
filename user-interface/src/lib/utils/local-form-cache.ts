import { DAY } from './datetime';
import LocalCache from './local-cache';

const { get, set, remove } = LocalCache;

function getForm(key: string): object | null {
  const formKey = 'form:' + key;
  return get<object>(formKey);
}

function saveForm(key: string, data: object) {
  const formKey = 'form:' + key;
  set<object>(formKey, data, DAY);
}

function clearForm(key: string) {
  const formKey = 'form:' + key;
  remove(formKey);
}

const LocalFormCache = {
  getForm,
  saveForm,
  clearForm,
};

export default LocalFormCache;
