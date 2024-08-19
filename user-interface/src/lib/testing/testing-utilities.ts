import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import LocalStorage from '../utils/local-storage';

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

function setUserWithRoles(roles: CamsRole[]) {
  const user = MockData.getCamsUser({ roles });
  LocalStorage.setSession(MockData.getCamsSession({ user }));
}

export const urlRegex = /https?:\/\/.*\//;
export const TestingUtilities = {
  waitFor,
  setUserWithRoles,
};

export default TestingUtilities;
