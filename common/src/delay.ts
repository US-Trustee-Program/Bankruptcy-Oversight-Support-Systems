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
