import {
  LocalStorage,
  LOGIN_LOCAL_STORAGE_ACK_KEY,
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
} from './local-storage';
import { CamsSession, MOCK_AUTHORIZATION_BEARER_TOKEN } from '@common/cams/session';

const testSession: CamsSession = {
  apiToken: MOCK_AUTHORIZATION_BEARER_TOKEN,
  provider: 'mock',
  user: {
    name: 'Test User',
  },
};

describe('Local storage', () => {
  describe('getAck', () => {
    test('should return ack from local storage', () => {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_ACK_KEY, 'true');
      const ack = LocalStorage.getAck();
      expect(ack).toEqual(true);
    });

    test('should return false by default from local storage', () => {
      window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_ACK_KEY);
      const ack = LocalStorage.getAck();
      expect(ack).toEqual(false);
    });
  });

  describe('setAck', () => {
    test('should set ack in local storage if ack is true', () => {
      LocalStorage.setAck(true);
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_ACK_KEY)).toEqual('true');
    });
    test('should remove ack from local storage if ack is false', () => {
      LocalStorage.setAck(false);
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_ACK_KEY)).toBeNull();
    });
  });

  describe('removeAck', () => {
    test('should remove ack from local storage', () => {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_ACK_KEY, 'true');
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_ACK_KEY)).toEqual('true');
      LocalStorage.removeAck();
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_ACK_KEY)).toBeNull();
    });
  });

  describe('getSession', () => {
    test('should return session from local storage', () => {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, JSON.stringify(testSession));
      const session = LocalStorage.getSession();
      expect(session).toEqual(testSession);
    });

    test('should return null if the JSON is malformed', () => {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, '{ bad: json}');
      const session = LocalStorage.getSession();
      expect(session).toBeNull();
    });

    test('should return null from local storage if a session does not exist', () => {
      window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
      const session = LocalStorage.getSession();
      expect(session).toBeNull();
    });
  });

  describe('setSession', () => {
    test('should set session in local storage', () => {
      LocalStorage.setSession(testSession);
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY)).toEqual(
        JSON.stringify(testSession),
      );
    });
  });

  describe('removeSession', () => {
    test('should remove a session from local storage', () => {
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, JSON.stringify(testSession));
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY)).toEqual(
        JSON.stringify(testSession),
      );
      LocalStorage.removeSession();
      expect(window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY)).toBeNull();
    });
  });
});
