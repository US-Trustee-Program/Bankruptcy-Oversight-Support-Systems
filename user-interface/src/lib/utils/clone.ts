export function deepClone(obj: object) {
  return JSON.parse(JSON.stringify(obj));
}
