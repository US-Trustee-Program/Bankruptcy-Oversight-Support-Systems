import { CamsSession } from '@common/cams/session';

const LOGIN_LOCAL_STORAGE_SESSION_KEY = 'cams:session';
const LOGIN_LOCAL_STORAGE_FORM_CACHE_KEY = 'cams:cache:form:';
const LOGIN_LOCAL_STORAGE_CACHE_KEY = 'cams:cache:';
const LOGIN_LOCAL_STORAGE_ACK_KEY = 'cams:ack';
const RENEWING_TOKEN = 'cams:renewing-token';
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

function isTokenBeingRenewed() {
  if (window.localStorage) {
    const alreadyRenewing = window.localStorage.getItem(RENEWING_TOKEN);
    return alreadyRenewing === 'true';
  }
}

function setRenewingToken() {
  if (window.localStorage) {
    const alreadyRenewing = window.localStorage.getItem(RENEWING_TOKEN);
    if (alreadyRenewing !== 'true') {
      window.localStorage.setItem(RENEWING_TOKEN, 'true');
      return true;
    } else {
      return false;
    }
  }
}

function removeRenewingToken() {
  if (window.localStorage) {
    window.localStorage.removeItem(RENEWING_TOKEN);
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
  isTokenBeingRenewed,
  setRenewingToken,
  removeRenewingToken,
  getLastInteraction,
  setLastInteraction,
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
  LOGIN_LOCAL_STORAGE_FORM_CACHE_KEY,
  LOGIN_LOCAL_STORAGE_CACHE_KEY,
  LOGIN_LOCAL_STORAGE_ACK_KEY,
  RENEWING_TOKEN,
  LAST_INTERACTION_KEY,
};

export default LocalStorage;
