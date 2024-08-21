/* eslint-disable @typescript-eslint/no-explicit-any */
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '../utils/local-storage';
import { GlobalAlertRef } from '../components/cams/GlobalAlert/GlobalAlert';
import * as globalAlertHook from '@/lib/hooks/UseGlobalAlert';
import { CamsUser } from '@common/cams/users';
import * as UseStateModule from '@/lib/hooks/UseState';

async function waitFor(condition: () => boolean, timeout = 5000, interval = 50): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkCondition = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime >= timeout) {
        reject(new Error('waitFor timed out'));
      } else {
        setTimeout(checkCondition, interval);
      }
    };

    checkCondition();
  });
}

function setUser(override: Partial<CamsUser> = {}) {
  const user = MockData.getCamsUser(override);
  LocalStorage.setSession(MockData.getCamsSession({ user }));
  return user;
}

function setUserWithRoles(roles: CamsRole[]) {
  const user = MockData.getCamsUser({ roles });
  LocalStorage.setSession(MockData.getCamsSession({ user }));
  return user;
}

function spyOnGlobalAlert() {
  const hookFunctions: GlobalAlertRef = {
    show: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  };
  vi.spyOn(globalAlertHook, 'useGlobalAlert').mockReturnValue(hookFunctions);
  return hookFunctions;
}

const useStateMock: any = (initialValue: any) => {
  // Credit: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#implementing_basic_set_operations
  function difference(setA: Set<string>, setB: Set<string>) {
    const _difference = new Set(setA);
    for (const elem of setB) {
      _difference.delete(elem);
    }
    return _difference as Set<string>;
  }

  let value = typeof initialValue === 'object' ? { ...initialValue } : initialValue;
  return [
    value,
    <T = any>(newValue: T) => {
      if (typeof value === 'object') {
        const existingKeys = new Set([...Object.keys(value)]);
        const newKeys = new Set([...Object.keys(value)]);
        difference(existingKeys, newKeys).forEach((key) => {
          delete value[key];
        });
        Object.keys(newValue as object).forEach((key) => {
          value[key] = (newValue as Record<string, any>)[key];
        });
      } else {
        value = newValue;
      }
    },
  ];
};

function spyOnUseState() {
  return vi.spyOn(UseStateModule, 'useState').mockImplementation(useStateMock);
}

export const TestingUtilities = {
  waitFor,
  setUser,
  setUserWithRoles,
  spyOnGlobalAlert,
  spyOnUseState,
};

export default TestingUtilities;
