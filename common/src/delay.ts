/**
 * Delays execution for a specified number of milliseconds, then optionally executes a provided function.
 *
 * @param {number} milliseconds - The number of milliseconds to wait before resolving the promise.
 * @param {() => void} [optionalFunction] - An optional function to execute after the delay. Defaults to a no-op.
 * @returns {Promise<void>} A promise that resolves after the specified delay and after the optional function is called.
 *
 * @example
 * // Wait for 1 second, then log a message
 * await delay(1000, () => console.log('1 second passed'));
 *
 * @example
 * // Wait for 500ms without executing any function
 * await delay(500);
 */
export async function delay(
  milliseconds: number,
  optionalFunction: () => void = () => {
    return;
  },
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      optionalFunction();
      resolve();
    }, milliseconds);
  });
}
