import { THREE_DAYS } from './datetime';
import LocalCache, { Cacheable } from './local-cache';

const FORM_NAMESPACE = 'form:';

const { get, getByKeyPattern, set, remove, removeNamespace } = LocalCache;

function getForm<T extends Cacheable>(key: string): T | null {
  const formKey = FORM_NAMESPACE + key;
  return get<object>(formKey) as T;
}

function saveForm(key: string, data: object) {
  const formKey = FORM_NAMESPACE + key;
  set<object>(formKey, data, THREE_DAYS);
}

function clearForm(key: string) {
  const formKey = FORM_NAMESPACE + key;
  remove(formKey);
}

function removeAll() {
  removeNamespace(FORM_NAMESPACE);
}

function getFormsByPattern<T>(pattern: RegExp): Array<{ key: string; item: Cacheable<T> }> {
  const regExString = pattern.source.replace('^', `^${FORM_NAMESPACE}`);
  return getByKeyPattern<T>(new RegExp(regExString, pattern.flags)).map((cached) => {
    return {
      key: cached.key.replace(FORM_NAMESPACE, ''),
      item: cached.item,
    };
  });
}

const LocalFormCache = {
  getForm,
  saveForm,
  clearForm,
  removeAll,
  getFormsByPattern,
};

export default LocalFormCache;
