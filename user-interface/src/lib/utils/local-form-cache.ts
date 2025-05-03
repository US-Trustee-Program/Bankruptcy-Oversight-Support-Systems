import { DAY } from './datetime';
import LocalCache from './local-cache';

const NAMESPACE = 'form:';

const { get, remove, removeNamespace, set } = LocalCache;

function clearForm(key: string) {
  const formKey = NAMESPACE + key;
  remove(formKey);
}

function getForm(key: string): null | object {
  const formKey = NAMESPACE + key;
  return get<object>(formKey);
}

function removeAll() {
  removeNamespace(NAMESPACE);
}

function saveForm(key: string, data: object) {
  const formKey = NAMESPACE + key;
  set<object>(formKey, data, DAY);
}

const LocalFormCache = {
  clearForm,
  getForm,
  removeAll,
  saveForm,
};

export default LocalFormCache;
