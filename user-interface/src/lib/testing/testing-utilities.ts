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

export const urlRegex = /https?:\/\/.*\//;
export const TestingUtilities = {
  waitFor,
};

export default TestingUtilities;
