import { DAY } from './datetime';
import LocalCache from './local-cache';

const NAMESPACE = 'form:';

const { get, set, remove, removeNamespace } = LocalCache;

function getForm(key: string): object | null {
  const formKey = NAMESPACE + key;
  return get<object>(formKey);
}

function saveForm(key: string, data: object) {
  const formKey = NAMESPACE + key;
  set<object>(formKey, data, DAY);
}

function clearForm(key: string) {
  const formKey = NAMESPACE + key;
  remove(formKey);
}

function removeAll() {
  removeNamespace(NAMESPACE);
}

const LocalFormCache = {
  getForm,
  saveForm,
  clearForm,
  removeAll,
};

export default LocalFormCache;
