import { CamsSession } from '@common/cams/session';

export const LOGIN_LOCAL_STORAGE_SESSION_KEY = 'cams:session';
export const LOGIN_LOCAL_STORAGE_CACHE_KEY = 'cams:cache:';
export const LOGIN_LOCAL_STORAGE_ACK_KEY = 'cams:ack';
export const REFRESHING_TOKEN = 'cams:refreshing-token';
export const LAST_INTERACTION_KEY = 'cams:last-interaction';
export const FORM_LIST_KEY = 'cams:saved-form-keys';

function getSession(): CamsSession | null {
  let session: CamsSession | null = null;
  try {
    if (window.localStorage) {
      const sessionJson = window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
      if (sessionJson) {
        session = JSON.parse(sessionJson);
      }
    }
  } catch {
    session = null;
  }
  return session;
}

function setSession(session: CamsSession) {
  if (window.localStorage) {
    window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
  }
}

function removeSession() {
  const keysToDelete = [LOGIN_LOCAL_STORAGE_SESSION_KEY];
  if (window.localStorage) {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(LOGIN_LOCAL_STORAGE_CACHE_KEY)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  }
}

function getAck(): boolean {
  let ack = false;
  if (window.localStorage) {
    const ackValue = window.localStorage.getItem(LOGIN_LOCAL_STORAGE_ACK_KEY);
    if (ackValue) {
      ack = ackValue.toLowerCase() === 'true';
    }
  }
  return ack;
}

function setAck(ack: boolean) {
  if (window.localStorage) {
    if (ack.toString() === 'true') {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_ACK_KEY, ack.toString());
    } else {
      window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_ACK_KEY);
    }
  }
}

function removeAck() {
  if (window.localStorage) {
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_ACK_KEY);
  }
}

function isTokenBeingRefreshed() {
  if (window.localStorage) {
    const alreadyRefreshing = window.localStorage.getItem(REFRESHING_TOKEN);
    return alreadyRefreshing === 'true';
  }
}

function setRefreshingToken() {
  if (window.localStorage) {
    const alreadyRefreshing = window.localStorage.getItem(REFRESHING_TOKEN);
    if (alreadyRefreshing !== 'true') {
      window.localStorage.setItem(REFRESHING_TOKEN, 'true');
      return true;
    } else {
      return false;
    }
  }
}

function removeRefreshingToken() {
  if (window.localStorage) {
    window.localStorage.removeItem(REFRESHING_TOKEN);
  }
}

function getLastInteraction(): number | null {
  return getNumber(LAST_INTERACTION_KEY);
}

function setLastInteraction(timestamp: number) {
  setNumber(LAST_INTERACTION_KEY, timestamp);
}

function getNumber(key: string): number | null {
  const value = localStorage.getItem(key);
  if (!value) return null;
  try {
    return Number.parseInt(value);
  } catch {
    return null;
  }
}

function setNumber(key: string, value: number) {
  localStorage.setItem(key, value.toString());
}

////////////// Form Related Functions //////////////

function getFormKeys() {
  return JSON.parse(localStorage.getItem(FORM_LIST_KEY) || '[]');
}

function getForm(formKey: string): object {
  return JSON.parse(localStorage.getItem(formKey) || 'null');
}

function saveForm(formKey: string, data: object) {
  const formKeys = getFormKeys();

  localStorage.setItem(formKey, JSON.stringify(data));

  if (!formKeys.includes(formKey)) {
    formKeys.push(formKey);
    localStorage.setItem(FORM_LIST_KEY, JSON.stringify(formKeys));
  }
}

function clearForm(formKey: string) {
  const prevFormKeys = getFormKeys();

  localStorage.removeItem(formKey);

  const newFormKeys = prevFormKeys.filter((key: string) => key !== formKey);
  if (newFormKeys.length > 0) localStorage.setItem(FORM_LIST_KEY, JSON.stringify(newFormKeys));
  else localStorage.removeItem(FORM_LIST_KEY);
}

function clearAllForms() {
  const formKeys = getFormKeys();
  for (const key of formKeys) {
    localStorage.removeItem(key);
  }
  localStorage.removeItem(FORM_LIST_KEY);
}

////////////// End Form Related Functions //////////////

export const LocalStorage = {
  getSession,
  setSession,
  removeSession,
  getAck,
  setAck,
  removeAck,
  isTokenBeingRefreshed,
  setRefreshingToken,
  removeRefreshingToken,
  getLastInteraction,
  setLastInteraction,
  getFormKeys,
  getForm,
  saveForm,
  clearForm,
  clearAllForms,
};

export default LocalStorage;
