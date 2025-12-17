import { CamsSession } from '@common/cams/session';

const LOGIN_LOCAL_STORAGE_SESSION_KEY = 'cams:session';
const LOGIN_LOCAL_STORAGE_FORM_CACHE_KEY = 'cams:cache:form:';
const LOGIN_LOCAL_STORAGE_CACHE_KEY = 'cams:cache:';
const LOGIN_LOCAL_STORAGE_ACK_KEY = 'cams:ack';
const REFRESHING_TOKEN = 'cams:refreshing-token';
const LAST_INTERACTION_KEY = 'cams:last-interaction';

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
  if (window.localStorage) {
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
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
  const parsed = Number.parseInt(value);
  return isNaN(parsed) ? null : parsed;
}

function setNumber(key: string, value: number) {
  localStorage.setItem(key, value.toString());
}

const LocalStorage = {
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
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
  LOGIN_LOCAL_STORAGE_FORM_CACHE_KEY,
  LOGIN_LOCAL_STORAGE_CACHE_KEY,
  LOGIN_LOCAL_STORAGE_ACK_KEY,
  REFRESHING_TOKEN,
  LAST_INTERACTION_KEY,
};

export default LocalStorage;
