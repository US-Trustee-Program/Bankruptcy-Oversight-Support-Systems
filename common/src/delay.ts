/**
 * Delays execution for a specified number of milliseconds, then optionally executes a provided function.
 *
 * @template T The return type of the optional function, or undefined if not provided.
 * @param {number} milliseconds - The number of milliseconds to wait before resolving the promise.
 * @param {() => T} [optionalFunction] - An optional function to execute after the delay. If provided, the promise resolves with the return value of this function. If not provided, the promise resolves with undefined.
 * @returns {Promise<T | undefined>} A promise that resolves after the specified delay, with the return value of the optional function (if provided), or undefined.
 *
 * @example
 * // Wait for 1 second, then log a message (promise resolves with undefined)
 * await delay(1000, () => console.log('1 second passed'));
 *
 * @example
 * // Wait for 500ms and resolve with a value
 * const result = await delay(500, () => 42); // result: number (42)
 *
 * @example
 * // Wait for 500ms without executing any function (promise resolves with undefined)
 * await delay(500);
 */
export async function delay<T = undefined>(
  milliseconds: number,
  optionalFunction?: () => T,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(optionalFunction ? optionalFunction() : undefined);
    }, milliseconds);
  });
}
