import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '../utils/local-storage';
import { GlobalAlertRef } from '../components/cams/GlobalAlert/GlobalAlert';
import * as globalAlertHook from '@/lib/hooks/UseGlobalAlert';
import { CamsUser } from '@common/cams/users';

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

export const TestingUtilities = {
  waitFor,
  setUser,
  setUserWithRoles,
  spyOnGlobalAlert,
};

export default TestingUtilities;
