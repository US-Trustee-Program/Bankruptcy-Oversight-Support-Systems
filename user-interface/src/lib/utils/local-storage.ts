import { CamsSession } from '@common/cams/session';

export const LOGIN_LOCAL_STORAGE_SESSION_KEY = 'cams:session';
export const LOGIN_LOCAL_STORAGE_FORM_CACHE_KEY = 'cams:cache:form:';
export const LOGIN_LOCAL_STORAGE_CACHE_KEY = 'cams:cache:';
export const LOGIN_LOCAL_STORAGE_ACK_KEY = 'cams:ack';
export const REFRESHING_TOKEN = 'cams:refreshing-token';
export const LAST_INTERACTION_KEY = 'cams:last-interaction';

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

function getLastInteraction(): null | number {
  return getNumber(LAST_INTERACTION_KEY);
}

function getNumber(key: string): null | number {
  const value = localStorage.getItem(key);
  if (!value) return null;
  const parsed = Number.parseInt(value);
  return isNaN(parsed) ? null : parsed;
}

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

function isTokenBeingRefreshed() {
  if (window.localStorage) {
    const alreadyRefreshing = window.localStorage.getItem(REFRESHING_TOKEN);
    return alreadyRefreshing === 'true';
  }
}

function removeAck() {
  if (window.localStorage) {
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_ACK_KEY);
  }
}

function removeRefreshingToken() {
  if (window.localStorage) {
    window.localStorage.removeItem(REFRESHING_TOKEN);
  }
}

function removeSession() {
  if (window.localStorage) {
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
  }
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

function setLastInteraction(timestamp: number) {
  setNumber(LAST_INTERACTION_KEY, timestamp);
}

function setNumber(key: string, value: number) {
  localStorage.setItem(key, value.toString());
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

function setSession(session: CamsSession) {
  if (window.localStorage) {
    window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
  }
}

export const LocalStorage = {
  getAck,
  getLastInteraction,
  getSession,
  isTokenBeingRefreshed,
  removeAck,
  removeRefreshingToken,
  removeSession,
  setAck,
  setLastInteraction,
  setRefreshingToken,
  setSession,
};

export default LocalStorage;
