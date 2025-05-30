import { THREE_DAYS } from './datetime';
import LocalCache, { Cacheable, NAMESPACE } from './local-cache';

const FORM_NAMESPACE = 'form:';

const { get, set, remove, removeNamespace } = LocalCache;

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

function getFormsByPattern<T extends Cacheable>(pattern: RegExp): Array<{ key: string; form: T }> {
  const forms: Array<{ key: string; form: T }> = [];

  if (!window.localStorage) return forms;

  for (let i = 0; i < window.localStorage.length; i++) {
    const fullKey = window.localStorage.key(i);

    if (fullKey && fullKey.startsWith(NAMESPACE + FORM_NAMESPACE)) {
      const key = fullKey.substring(NAMESPACE.length + FORM_NAMESPACE.length);

      if (pattern.test(key)) {
        const form = getForm<T>(key);
        if (form && form.value) {
          forms.push({ key, form });
        }
      }
    }
  }

  return forms;
}

const LocalFormCache = {
  getForm,
  saveForm,
  clearForm,
  removeAll,
  getFormsByPattern,
};

export default LocalFormCache;
